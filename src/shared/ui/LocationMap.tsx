import { useEffect, useRef } from "react";
import { circleMarker, map, tileLayer, type CircleMarker, type Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import "./LocationMap.css";
import { Button } from "./button";
export interface MapPoint { latitude: number; longitude: number }
interface Props { point: MapPoint | null; onChange: (point: MapPoint) => void; onUnavailable: () => void; label: string; zoomInLabel: string; zoomOutLabel: string }
export function LocationMap({ point, onChange, onUnavailable, label, zoomInLabel, zoomOutLabel }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<LeafletMap | null>(null);
  const marker = useRef<CircleMarker | null>(null);
  const callbacks = useRef({ onChange, onUnavailable });
  const initial = useRef(point);
  useEffect(() => { callbacks.current = { onChange, onUnavailable }; }, [onChange, onUnavailable]);
  useEffect(() => {
    if (!container.current) return;
    const start = initial.current;
    const leaflet = map(container.current, { zoomControl: false, keyboard: true, scrollWheelZoom: false }).setView(start ? [start.latitude, start.longitude] : [-34, -64], start ? 16 : 4);
    instance.current = leaflet;
    leaflet.attributionControl.setPrefix(false);
    tileLayer(import.meta.env.VITE_BUSINESS_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, minZoom: 2, noWrap: true, referrerPolicy: "strict-origin-when-cross-origin",
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    }).on("tileerror", () => callbacks.current.onUnavailable()).addTo(leaflet);
    leaflet.on("click", event => {
      const longitude = ((event.latlng.lng + 180) % 360 + 360) % 360 - 180;
      callbacks.current.onChange({ latitude: Number(event.latlng.lat.toFixed(6)), longitude: Number(longitude.toFixed(6)) });
    });
    const observer = new ResizeObserver(() => leaflet.invalidateSize()); observer.observe(container.current);
    return () => { observer.disconnect(); leaflet.remove(); instance.current = null; marker.current = null; };
  }, []);
  useEffect(() => {
    const leaflet = instance.current;
    if (!leaflet) return;
    marker.current?.remove(); marker.current = null;
    if (point) {
      marker.current = circleMarker([point.latitude, point.longitude], { radius: 8, color: "var(--color-primary)", fillColor: "var(--color-primary)", fillOpacity: 1, weight: 2 }).addTo(leaflet);
      if (!leaflet.getBounds().contains([point.latitude, point.longitude])) leaflet.panTo([point.latitude, point.longitude]);
    }
  }, [point]);
  return <div className="space-y-2">
    <div ref={container} role="region" aria-label={label} className="location-map h-64 w-full" />
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => instance.current?.zoomIn()}>{zoomInLabel}</Button><Button variant="outline" onClick={() => instance.current?.zoomOut()}>{zoomOutLabel}</Button></div>
  </div>;
}
