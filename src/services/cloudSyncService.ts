/**
 * SAATHI Real-Time Cloud Sync Service
 * Connects Citizen Mobile App (on 4G/5G mobile data or Wi-Fi)
 * with Emergency Operator CAD Console across any network worldwide.
 * Uses secure MQTT over WebSockets (WSS).
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
  private reconnectTimer: any = null;
  private brokerIndex: number = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      const savedChannel = localStorage.getItem('saathi_sync_channel');
      if (savedChannel && savedChannel.trim()) {
        this.channelId = savedChannel.trim();
      }
    }
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
    }

    if (this.client && this.client.connected) {
      const newTopic = `saathi/incident/${this.channelId}`;
      this.client.subscribe(newTopic, { qos: 1 });
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
        reconnectPeriod: 4000,
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
          }
        });
      });

      this.client.on('message', (_topic, message) => {
        try {
          const raw = message.toString();
          const evt: CloudSyncEvent = JSON.parse(raw);

          // Discard own echoed messages to prevent loops
          if (evt.senderId === this.clientId) {
            return;
          }

          this.eventListeners.forEach((l) => l(evt));
        } catch (e) {
          console.warn('[CloudSync] Malformed incoming message:', e);
        }
      });

      this.client.on('error', (err) => {
        console.warn('[CloudSync] Broker connection error:', err.message);
        this.notifyStatus('error');
        // Try fallback broker on error
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

    if (!this.client || !this.client.connected) {
      // If not yet connected, trigger connect and attempt publish once connected
      this.connect();
      return;
    }

    const topic = `saathi/incident/${this.channelId}`;
    this.client.publish(topic, JSON.stringify(event), { qos: 1 });
  }

  public disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
    this.notifyStatus('disconnected');
  }
}

export const cloudSyncService = new CloudSyncService();
