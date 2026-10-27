import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CatalogItem, MapBounds } from '../../shared/contracts';
import { formatNumber } from '../lib/presentation';

export interface MapView {
  latitude: number;
  longitude: number;
  zoom: number;
}

/** Owns Leaflet's DOM and lifecycle. Data loading belongs to the section. */
export default function MountainMap({
  items,
  view,
  onBounds,
  onOpen,
}: {
  items: CatalogItem[];
  view: MapView;
  onBounds: (bounds: MapBounds) => void;
  onOpen: (item: CatalogItem) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const callbacks = useRef({ onBounds, onOpen });
  callbacks.current = { onBounds, onOpen };
  useEffect(() => {
    const instance = L.map(element.current!, {
      center: [46.3, 10.5],
      zoom: 6,
      minZoom: 3,
      maxZoom: 19,
      scrollWheelZoom: false,
      maxBounds: [
        [-85, -180],
        [85, 180],
      ],
      maxBoundsViscosity: 1,
    });
    map.current = instance;
    const tiles = L.tileLayer(
      import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution:
          import.meta.env.VITE_MAP_ATTRIBUTION ||
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        noWrap: true,
      },
    ).addTo(instance);
    const error = L.DomUtil.create('p', 'map-tile-error', element.current!);
    error.hidden = true;
    error.textContent = 'Sfondo mappa non disponibile. Le cime restano esplorabili nell’elenco.';
    tiles.on('tileerror', () => {
      error.hidden = false;
    });
    tiles.on('load', () => {
      if (element.current?.querySelector('img.leaflet-tile-loaded')) error.hidden = true;
    });
    markers.current = L.layerGroup().addTo(instance);
    const report = () => {
      const bounds = instance.getBounds();
      callbacks.current.onBounds(
        [
          Math.max(-180, bounds.getWest()),
          Math.max(-90, bounds.getSouth()),
          Math.min(180, bounds.getEast()),
          Math.min(90, bounds.getNorth()),
        ].map((value) => Number(value.toFixed(5))) as MapBounds,
      );
    };
    instance.on('moveend', report);
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(element.current!);
    report();
    return () => {
      observer.disconnect();
      instance.remove();
      error.remove();
      map.current = null;
      markers.current = null;
    };
  }, []);
  useEffect(() => {
    map.current?.setView([view.latitude, view.longitude], view.zoom);
  }, [view]);
  useEffect(() => {
    const layer = markers.current;
    if (!layer) return;
    layer.clearLayers();
    for (const item of items) {
      if (item.latitude === null || item.longitude === null) continue;
      const content = document.createElement('div');
      content.className = 'mountain-popup';
      const title = document.createElement('strong');
      title.textContent = item.name;
      const elevation = document.createElement('p');
      elevation.textContent =
        item.elevationM === null ? 'Quota non disponibile' : formatNumber(item.elevationM) + ' m';
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Scopri questa cima →';
      button.onclick = () => callbacks.current.onOpen(item);
      content.append(title, elevation, button);
      L.circleMarker([item.latitude, item.longitude], {
        radius: 6,
        color: '#fff',
        weight: 1.5,
        fillColor: '#315b46',
        fillOpacity: 0.9,
      })
        .bindPopup(content)
        .addTo(layer);
    }
  }, [items]);
  return (
    <div
      ref={element}
      className="mountain-map"
      role="region"
      aria-label="Mappa interattiva delle montagne. Usa i pulsanti più e meno per lo zoom, le frecce per spostarti."
    />
  );
}
