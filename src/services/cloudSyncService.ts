/**
 * SAATHI Real-Time Cloud Sync Service
 * Connects Citizen Mobile App (on 4G/5G mobile data or Wi-Fi)
 * with Emergency Operator CAD Console across any network worldwide.
 * Uses secure MQTT over WebSockets (WSS) and local BroadcastChannel fallback.
 */

import mqtt from 'mqtt';
import type { MqttClient } from 'mqtt';

export type SyncStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface CloudSyncEvent {
  eventId: string;
  senderId: string;
  source: 'phone' | 'cad';
  channelId: string;
  type:
    | 'CALLER_INPUT'
    | 'CALLER_ANSWER'
    | 'LOCATION_UPDATE'
    | 'OPERATOR_ACKNOWLEDGE'
    | 'AGENCY_DISPATCH'
    | 'SEND_QUESTION'
    | 'URGENCY_OVERRIDE'
    | 'NEW_SESSION'
    | 'REQUEST_SYNC'
    | 'FULL_REPORT_SYNC';
  timestamp: string;
  payload: any;
}

export type CloudSyncListener = (event: CloudSyncEvent) => void;
export type SyncStatusListener = (status: SyncStatus, channelId: string) => void;

const DEFAULT_CHANNEL = 'saathi-live-1187';
const BROKERS = [
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://broker.emqx.io:8084/mqtt'
];

class CloudSyncService {
  private client: MqttClient | null = null;
  private status: SyncStatus = 'disconnected';
  private channelId: string = DEFAULT_CHANNEL;
  private clientId: string = `saathi-${Math.random().toString(36).substring(2, 9)}`;
  private eventListeners: Set<CloudSyncListener> = new Set();
  private statusListeners: Set<SyncStatusListener> = new Set();
  private brokerIndex: number = 0;
  private pendingQueue: CloudSyncEvent[] = [];
  private seenEventIds: Set<string> = new Set();
  private localBc: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const savedChannel = localStorage.getItem('saathi_sync_channel');
      if (savedChannel && savedChannel.trim()) {
        this.channelId = savedChannel.trim();
      }
      this.initLocalBroadcast();
    }
  }

  private initLocalBroadcast() {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        if (this.localBc) {
          try { this.localBc.close(); } catch (_e) {}
        }
        this.localBc = new BroadcastChannel(`saathi_sync_${this.channelId}`);
        this.localBc.onmessage = (msg) => {
          if (msg && msg.data) {
            this.handleIncomingEvent(msg.data);
          }
        };
      }
    } catch (_e) {}
  }

  public getChannelId(): string {
    return this.channelId;
  }

  public getStatus(): SyncStatus {
    return this.status;
  }

  public getClientId(): string {
    return this.clientId;
  }

  public setChannelId(newChannel: string) {
    const clean = newChannel.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || DEFAULT_CHANNEL;
    if (clean === this.channelId) return;

    const oldTopic = `saathi/incident/${this.channelId}`;
    if (this.client && this.client.connected) {
      this.client.unsubscribe(oldTopic);
    }

    this.channelId = clean;
    if (typeof window !== 'undefined') {
      localStorage.setItem('saathi_sync_channel', clean);
      this.initLocalBroadcast();
    }

    if (this.client && this.client.connected) {
      const newTopic = `saathi/incident/${this.channelId}`;
      this.client.subscribe(newTopic, { qos: 1 });
      // Request state for the new room
      this.broadcast('phone', 'REQUEST_SYNC', {});
    }

    this.notifyStatus(this.status);
  }

  public subscribeStatus(listener: SyncStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status, this.channelId);
    return () => this.statusListeners.delete(listener);
  }

  public subscribeEvents(listener: CloudSyncListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private notifyStatus(status: SyncStatus) {
    this.status = status;
    this.statusListeners.forEach((l) => l(status, this.channelId));
  }

  private handleIncomingEvent(evt: CloudSyncEvent) {
    if (!evt || !evt.eventId) return;
    if (evt.senderId === this.clientId) return; // Discard own echoed messages
    if (this.seenEventIds.has(evt.eventId)) return; // Discard duplicate receipts
    this.seenEventIds.add(evt.eventId);

    if (this.seenEventIds.size > 500) {
      const first = this.seenEventIds.values().next().value;
      if (first) this.seenEventIds.delete(first);
    }

    this.eventListeners.forEach((l) => l(evt));
  }

  /**
   * Initialize secure WSS connection to cloud broker
   */
  public connect() {
    if (this.client && (this.client.connected || this.status === 'connecting')) {
      return;
    }

    this.notifyStatus('connecting');
    const brokerUrl = BROKERS[this.brokerIndex % BROKERS.length];

    try {
      this.client = mqtt.connect(brokerUrl, {
        clientId: this.clientId,
        clean: true,
        connectTimeout: 8000,
        reconnectPeriod: 3000,
        keepalive: 30
      });

      this.client.on('connect', () => {
        this.notifyStatus('connected');
        const topic = `saathi/incident/${this.channelId}`;
        this.client?.subscribe(topic, { qos: 1 }, (err) => {
          if (err) {
            console.error('[CloudSync] Subscription error:', err);
          } else {
            console.log(`[CloudSync] Connected & Subscribed to ${topic} via ${brokerUrl}`);
            // Flush any pending queue messages
            this.flushPendingQueue();
            // Solicit initial report state from any active peer
            setTimeout(() => {
              if (this.client && this.client.connected) {
                this.broadcast('phone', 'REQUEST_SYNC', {});
              }
            }, 300);
          }
        });
      });

      this.client.on('message', (_topic, message) => {
        try {
          const raw = message.toString();
          const evt: CloudSyncEvent = JSON.parse(raw);
          this.handleIncomingEvent(evt);
        } catch (e) {
          console.warn('[CloudSync] Malformed incoming message:', e);
        }
      });

      this.client.on('error', (err) => {
        console.warn('[CloudSync] Broker connection error:', err.message);
        this.notifyStatus('error');
        this.brokerIndex++;
      });

      this.client.on('close', () => {
        if (this.status !== 'disconnected') {
          this.notifyStatus('disconnected');
        }
      });

      this.client.on('offline', () => {
        this.notifyStatus('disconnected');
      });
    } catch (e) {
      console.error('[CloudSync] Init error:', e);
      this.notifyStatus('error');
    }
  }

  private flushPendingQueue() {
    if (!this.client || !this.client.connected) return;
    const topic = `saathi/incident/${this.channelId}`;
    while (this.pendingQueue.length > 0) {
      const evt = this.pendingQueue.shift();
      if (evt) {
        try {
          this.client.publish(topic, JSON.stringify(evt), { qos: 1 });
        } catch (_e) {}
      }
    }
  }

  /**
   * Broadcast an event to all paired devices on this channel
   */
  public broadcast(source: 'phone' | 'cad', type: CloudSyncEvent['type'], payload: any) {
    const event: CloudSyncEvent = {
      eventId: `sync-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      senderId: this.clientId,
      source,
      channelId: this.channelId,
      type,
      timestamp: new Date().toISOString(),
      payload
    };

    // 1. Instant 0ms broadcast to any local tabs/windows on same machine
    if (this.localBc) {
      try {
        this.localBc.postMessage(event);
      } catch (_e) {}
    }

    // 2. Transmit via MQTT cloud broker
    if (!this.client || !this.client.connected) {
      this.pendingQueue.push(event);
      this.connect();
      return;
    }

    const topic = `saathi/incident/${this.channelId}`;
    try {
      this.client.publish(topic, JSON.stringify(event), { qos: 1 });
    } catch (_err) {
      this.pendingQueue.push(event);
    }
  }

  public disconnect() {
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
    if (this.localBc) {
      try { this.localBc.close(); } catch (_e) {}
      this.localBc = null;
    }
    this.notifyStatus('disconnected');
  }
}

export const cloudSyncService = new CloudSyncService();
