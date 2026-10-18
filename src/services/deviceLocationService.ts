/**
 * Device Location Service for SAATHI
 * Provides honest GPS acquisition, live tracking, accuracy radius tracking,
 * permission denial handling, and manual landmark fallback without ever blocking emergency reporting.
 */

export interface DeviceLocationResult {
  coords: [number, number];
  accuracyMeters: number;
  source: 'live_gps' | 'gps_cached' | 'speech_extracted' | 'manual_landmark' | 'unavailable';
  timestamp: string;
  isLiveTracking: boolean;
  error?: string;
  address?: string;
  isStale?: boolean;
}

export type LocationListener = (loc: DeviceLocationResult) => void;

class DeviceLocationService {
  private watchId: number | null = null;
  private currentResult: DeviceLocationResult = {
    coords: [28.7153, 77.1147], // Default Rohini Delhi fallback coordinate
    accuracyMeters: 18,
    source: 'speech_extracted',
    timestamp: new Date().toISOString(),
    isLiveTracking: false
  };
  private listeners: Set<LocationListener> = new Set();

  public getCurrentLocation(): DeviceLocationResult {
    return this.currentResult;
  }

  public subscribe(listener: LocationListener): () => void {
    this.listeners.add(listener);
    listener(this.currentResult);
    return () => this.listeners.delete(listener);
  }

  private notify(res: DeviceLocationResult) {
    this.currentResult = res;
    this.listeners.forEach((l) => l(res));
  }

  /**
   * Acquire a single high-accuracy GPS fix from browser
   */
  async acquireGpsFix(): Promise<DeviceLocationResult> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const res: DeviceLocationResult = {
        ...this.currentResult,
        source: 'unavailable',
        error: 'Geolocation is not supported by your browser or device.',
        isLiveTracking: false
      };
      this.notify(res);
      return res;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const res: DeviceLocationResult = {
            coords: [pos.coords.latitude, pos.coords.longitude],
            accuracyMeters: Math.round(pos.coords.accuracy),
            source: 'live_gps',
            timestamp: new Date(pos.timestamp).toISOString(),
            isLiveTracking: this.watchId !== null,
            isStale: false
          };
          this.notify(res);
          resolve(res);
        },
        (err) => {
          let errorMsg = 'GPS location unavailable.';
          if (err.code === err.PERMISSION_DENIED) {
            errorMsg = 'Location permission denied by user. You can enter a landmark manually.';
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            errorMsg = 'GPS signal unavailable or weak indoors.';
          } else if (err.code === err.TIMEOUT) {
            errorMsg = 'GPS acquisition timed out. Continuing with estimated location.';
          }

          const res: DeviceLocationResult = {
            ...this.currentResult,
            source: this.currentResult.source === 'live_gps' ? 'gps_cached' : 'unavailable',
            error: errorMsg,
            isLiveTracking: false
          };
          this.notify(res);
          resolve(res);
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 15000
        }
      );
    });
  }

  /**
   * Start live GPS tracking using watchPosition
   */
  startLiveTracking(): void {
    if (this.watchId !== null) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const res: DeviceLocationResult = {
          coords: [pos.coords.latitude, pos.coords.longitude],
          accuracyMeters: Math.round(pos.coords.accuracy),
          source: 'live_gps',
          timestamp: new Date(pos.timestamp).toISOString(),
          isLiveTracking: true,
          isStale: false
        };
        this.notify(res);
      },
      (err) => {
        console.warn('[SAATHI GPS Watcher error]:', err.message);
        const res: DeviceLocationResult = {
          ...this.currentResult,
          isLiveTracking: false,
          error: `Tracking paused: ${err.message}`
        };
        this.notify(res);
        this.stopLiveTracking();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    );
  }

  /**
   * Stop live GPS tracking
   */
  stopLiveTracking(): void {
    if (this.watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    const res: DeviceLocationResult = {
      ...this.currentResult,
      isLiveTracking: false
    };
    this.notify(res);
  }

  /**
   * Set manual landmark if citizen enters it or GPS is unavailable
   */
  setManualLandmark(landmarkText: string, coords?: [number, number]): DeviceLocationResult {
    const res: DeviceLocationResult = {
      coords: coords || this.currentResult.coords,
      accuracyMeters: 50,
      source: 'manual_landmark',
      timestamp: new Date().toISOString(),
      isLiveTracking: false,
      address: landmarkText
    };
    this.notify(res);
    return res;
  }
}

export const deviceLocationService = new DeviceLocationService();
