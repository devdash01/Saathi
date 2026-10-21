import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { LocateFixed } from 'lucide-react';

import type { EmergencyServiceEntity } from '../services/locationService';

interface TacticalMapProps {
  scenarioId?: string;
  callerCoords?: [number, number];
  locationAddress: string;
  nearbyServices?: EmergencyServiceEntity[];
  policeDispatched: boolean;
  medicalDispatched: boolean;
  accuracyMeters?: number;
  locationSource?: string;
}

const DEFAULT_COORDS: [number, number] = [28.7153, 77.1147];

export const TacticalEmergencyMap: React.FC<TacticalMapProps> = ({
  callerCoords,
  locationAddress,
  nearbyServices = [],
  policeDispatched,
  medicalDispatched,
  accuracyMeters,
  locationSource
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const routeLinesRef = useRef<L.Polyline[]>([]);

  const effectiveCallerCoords = callerCoords || DEFAULT_COORDS;

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: effectiveCallerCoords,
        zoom: 15,
        zoomControl: false,
        attributionControl: false
      });

      // OpenStreetMap Tiles with Dark Tactical Filter
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    map.flyTo(effectiveCallerCoords, 15, { animate: true, duration: 0.8 });
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);

    // Clean previous markers and lines
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];
    routeLinesRef.current.forEach((l) => map.removeLayer(l));
    routeLinesRef.current = [];

    // 1. Caller SOS Marker
    const callerIcon = L.divIcon({
      className: 'caller-sos-pin',
      html: `
        <div style="position: relative; width: 30px; height: 30px;">
          <div style="position: absolute; inset: -5px; background: rgba(239, 68, 68, 0.4); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: absolute; inset: 0; background: #ef4444; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: white; box-shadow: 0 0 12px rgba(239,68,68,0.8);">
            SOS
          </div>
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    const callerMarker = L.marker(effectiveCallerCoords, { icon: callerIcon }).addTo(map);
    const isSpeechLoc = locationSource === 'speech_extracted';
    const radiusMeters = accuracyMeters || (isSpeechLoc ? 1500 : 20);
    const accuracyLabel = isSpeechLoc ? `±${(radiusMeters / 1000).toFixed(1)} km (Speech Locality Estimate)` : `±${radiusMeters} m (Device GPS)`;

    callerMarker.bindPopup(`
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #0f172a; min-width: 180px;">
        <strong style="color: #ef4444; text-transform: uppercase; letter-spacing: 0.05em;">Incident Target Location</strong><br/>
        <span>${locationAddress}</span><br/>
        <span style="font-size: 11px; color: #64748b; font-family: monospace;">Coords: ${effectiveCallerCoords[0].toFixed(4)}, ${effectiveCallerCoords[1].toFixed(4)}</span><br/>
        <span style="display: inline-block; margin-top: 4px; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 3px; background: ${isSpeechLoc ? '#fef3c7' : '#dcfce7'}; color: ${isSpeechLoc ? '#92400e' : '#166534'};">
          ${accuracyLabel}
        </span>
      </div>
    `);
    markersRef.current.push(callerMarker);

    // Accuracy Perimeter Circle
    if (radiusMeters > 0) {
      const circle = L.circle(effectiveCallerCoords, {
        radius: radiusMeters,
        color: isSpeechLoc ? '#f59e0b' : '#3b82f6',
        dashArray: isSpeechLoc ? '6, 6' : undefined,
        weight: 1.5,
        fillColor: isSpeechLoc ? '#f59e0b' : '#3b82f6',
        fillOpacity: 0.06
      }).addTo(map);
      markersRef.current.push(circle as any);
    }

    // 2. Nearby Emergency Services Markers
    nearbyServices.forEach((srv) => {
      let pinColor = '#3b82f6';
      let pinLabel = '112';

      if (srv.type === 'police') {
        pinColor = policeDispatched ? '#2563eb' : '#3b82f6';
        pinLabel = 'PCR';
      } else if (srv.type === 'hospital') {
        pinColor = medicalDispatched ? '#ec4899' : '#ef4444';
        pinLabel = '108';
      } else if (srv.type === 'shelter') {
        pinColor = '#10b981';
        pinLabel = 'OSC';
      } else if (srv.type === 'legal') {
        pinColor = '#8b5cf6';
        pinLabel = 'DLSA';
      }

      const srvIcon = L.divIcon({
        className: 'cad-facility-pin',
        html: `
          <div style="background: ${pinColor}; border: 2px solid white; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; font-size: 9px; color: white; font-weight: 800; box-shadow: 0 2px 8px rgba(0,0,0,0.6);">
            ${pinLabel}
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      const srvMarker = L.marker([srv.lat, srv.lon], { icon: srvIcon }).addTo(map);
      srvMarker.bindPopup(`
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #0f172a; min-width: 170px;">
          <strong>${srv.name}</strong><br/>
          <span style="color: #2563eb; font-weight: 600;">${srv.categoryLabel}</span><br/>
          <span>Distance: <strong>${srv.distanceKm} km</strong> (ETA: <strong>${srv.etaMins} mins</strong>)</span><br/>
          <span style="color: #64748b;">Contact: ${srv.contactNumber}</span>
        </div>
      `);
      markersRef.current.push(srvMarker);

      // Route line if dispatched
      if (srv.type === 'police' && policeDispatched) {
        const line = L.polyline([[srv.lat, srv.lon], effectiveCallerCoords], {
          color: '#3b82f6',
          weight: 3,
          dashArray: '6, 6',
          opacity: 0.9
        }).addTo(map);
        routeLinesRef.current.push(line);
      } else if (srv.type === 'hospital' && medicalDispatched) {
        const line = L.polyline([[srv.lat, srv.lon], effectiveCallerCoords], {
          color: '#ec4899',
          weight: 3,
          dashArray: '6, 6',
          opacity: 0.9
        }).addTo(map);
        routeLinesRef.current.push(line);
      }
    });

    return () => {
      clearTimeout(timer);
    };
  }, [callerCoords?.[0], callerCoords?.[1], locationAddress, nearbyServices, policeDispatched, medicalDispatched]);

  const handleCenterCaller = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(effectiveCallerCoords, 16, { animate: true });
    }
  };

  return (
    <div className="tactical-map-container" style={{ position: 'relative', width: '100%', height: '100%', minHeight: '100%' }}>
      <div ref={mapContainerRef} className="leaflet-map-root" style={{ width: '100%', height: '100%', minHeight: '100%' }} />
      <button
        className="map-center-floating-btn"
        onClick={handleCenterCaller}
        title="Re-center GPS on target location"
      >
        <LocateFixed size={12} />
        <span>Center GPS</span>
      </button>
    </div>
  );
};
