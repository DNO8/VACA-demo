'use client';

import { useEffect, useRef, useState, memo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DISASTERS, SEVERITY_COLOR } from '@/lib/chile';
import { VaquitaIncident, CATEGORY_COLOR, VAQUITA_GOLD } from '@/lib/vaquitas';

const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// Vista del globo (mundo) y vista enfocada a Chile
const GLOBE_VIEW = { center: [-30, 5] as [number, number], zoom: 1.6, pitch: 0, bearing: 0 };
const CHILE_VIEW = { center: [-71, -38] as [number, number], zoom: 3.9, pitch: 25, bearing: 0 };

interface VacaGlobeProps {
  started: boolean;
  // Capas legacy (sectores de regiones chilenas + focos) solo si legacy=true
  legacy?: boolean;
  selectedRegionId?: number | null;
  onRegionClick?: (regionId: number, name: string, center: [number, number]) => void;
  incidents?: VaquitaIncident[];
  onIncidentClick?: (incident: VaquitaIncident) => void;
  onReady?: () => void;
}

const DISASTER_IDS = new Set(DISASTERS.map((d) => d.regionId));

/** Centro del visitante por IP (Vercel) — silencioso, sin permiso. */
async function locateByIp(): Promise<[number, number] | null> {
  try {
    const res = await fetch('/api/geo');
    const body = await res.json();
    if (body?.center) return body.center as [number, number];
  } catch {}
  return null;
}

function VacaGlobe({
  started,
  legacy = false,
  selectedRegionId = null,
  onRegionClick,
  incidents = [],
  onIncidentClick,
  onReady,
}: VacaGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const hoveredId = useRef<number | null>(null);
  const geoRef = useRef<any>(null);
  const visitorRef = useRef<[number, number] | null>(null);
  const clickHandler = useRef(onRegionClick);
  clickHandler.current = onRegionClick;
  const incidentHandler = useRef(onIncidentClick);
  incidentHandler.current = onIncidentClick;
  const incidentsRef = useRef(incidents);
  incidentsRef.current = incidents;

  // ── Init map ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE_URL,
        center: GLOBE_VIEW.center,
        zoom: GLOBE_VIEW.zoom,
        attributionControl: false,
        // Privacidad: sin zoom a nivel calle — los puntos fuzzeados no
        // deben resolver ubicaciones casa por casa. ~z12 = comuna/localidad.
        maxZoom: 12,
      });
    } catch (e) {
      console.error('[VACA] No se pudo inicializar el mapa (WebGL?):', e);
      return;
    }
    mapRef.current = map;

    map.on('load', async () => {
      try {
        map.setProjection({ type: 'globe' });
      } catch {
        /* globe no soportado */
      }
      try {
        map.setSky({
          'sky-color': '#04040A',
          'sky-horizon-blend': 0.5,
          'horizon-color': '#0a0f1f',
          'horizon-fog-blend': 0.4,
          'fog-color': '#04040A',
          'fog-ground-blend': 0.85,
        });
      } catch {
        /* sky opcional */
      }

      // ── Capas legacy (sectores + focos) solo en modo ?legacy ──
      if (legacy) {
        try {
          const geo = await fetch('/chile-regions.geojson').then((r) => r.json());
          geoRef.current = geo;
          geo.features.forEach((f: any) => {
            const d = DISASTERS.find((x) => x.regionId === f.properties.regionId);
            f.properties.hasDisaster = d ? 1 : 0;
            f.properties.color = d ? SEVERITY_COLOR[d.severity] : '#1E3240';
            f.id = f.properties.regionId;
          });
          map.addSource('regions', { type: 'geojson', data: geo, promoteId: 'regionId' });
          map.addLayer({
            id: 'regions-fill',
            type: 'fill',
            source: 'regions',
            paint: {
              'fill-color': ['get', 'color'],
              'fill-opacity': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                0.7,
                ['boolean', ['feature-state', 'hover'], false],
                0.55,
                ['==', ['get', 'hasDisaster'], 1],
                0.35,
                0.12,
              ],
            },
          });
          map.addLayer({
            id: 'regions-line',
            type: 'line',
            source: 'regions',
            paint: {
              'line-color': [
                'case',
                ['==', ['get', 'hasDisaster'], 1],
                ['get', 'color'],
                '#A6C2D4',
              ],
              'line-width': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                2.4,
                ['boolean', ['feature-state', 'hover'], false],
                1.6,
                0.7,
              ],
              'line-opacity': 0.9,
            },
          });

          const fociFeatures = DISASTERS.map((d) => {
            const region = geo.features.find((f: any) => f.properties.regionId === d.regionId);
            const center = region?.properties?.center ?? [-71, -38];
            return {
              type: 'Feature',
              properties: { regionId: d.regionId, color: SEVERITY_COLOR[d.severity] },
              geometry: { type: 'Point', coordinates: center },
            };
          });
          map.addSource('foci', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: fociFeatures } as any,
          });
          map.addLayer({
            id: 'foci-core',
            type: 'circle',
            source: 'foci',
            paint: {
              'circle-radius': 4,
              'circle-color': ['get', 'color'],
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 1,
            },
          });

          const setHover = (id: number | null) => {
            if (hoveredId.current !== null) {
              map.setFeatureState({ source: 'regions', id: hoveredId.current }, { hover: false });
            }
            hoveredId.current = id;
            if (id !== null) {
              map.setFeatureState({ source: 'regions', id }, { hover: true });
            }
          };
          map.on('mousemove', 'regions-fill', (e) => {
            if (!e.features?.length) return;
            map.getCanvas().style.cursor = 'pointer';
            setHover(e.features[0].properties!.regionId as number);
          });
          map.on('mouseleave', 'regions-fill', () => {
            map.getCanvas().style.cursor = '';
            setHover(null);
          });
          map.on('click', 'regions-fill', (e) => {
            const f = e.features?.[0];
            if (!f) return;
            const id = f.properties!.regionId as number;
            const name = f.properties!.name as string;
            const center = (f.properties!.center as any) ?? [e.lngLat.lng, e.lngLat.lat];
            const c = typeof center === 'string' ? JSON.parse(center) : center;
            clickHandler.current?.(id, name, c);
          });
          map.on('click', 'foci-core', (e) => {
            const f = e.features?.[0];
            if (!f) return;
            const id = f.properties!.regionId as number;
            const region = geo.features.find((g: any) => g.properties.regionId === id);
            const center = region?.properties?.center ?? [e.lngLat.lng, e.lngLat.lat];
            clickHandler.current?.(id, region?.properties?.name ?? '', center);
          });
        } catch (e) {
          console.error('[VACA] No se pudo cargar chile-regions.geojson', e);
        }
      }

      // ── Señales y Vaquitas (puntos reales del feed) ──
      // orbes = donationStatus 'vaquita' | 'community' (brillantes, dorado)
      // luceros = donationStatus 'signal' (pequeños, color de categoría)
      map.addSource('vaquitas', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] } as any,
      });
      map.addLayer({
        id: 'vaquita-glow',
        type: 'circle',
        source: 'vaquitas',
        filter: ['!=', ['get', 'donationStatus'], 'signal'],
        paint: {
          'circle-radius': 16,
          'circle-color': VAQUITA_GOLD,
          'circle-opacity': 0.28,
          'circle-blur': 0.7,
        },
      });
      map.addLayer({
        id: 'vaquita-orb',
        type: 'circle',
        source: 'vaquitas',
        filter: ['!=', ['get', 'donationStatus'], 'signal'],
        paint: {
          'circle-radius': 7,
          'circle-color': VAQUITA_GOLD,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.4,
          'circle-opacity': [
            'case',
            ['==', ['get', 'donationStatus'], 'vaquita'],
            1,
            0.75,
          ],
        },
      });
      map.addLayer({
        id: 'signal-lucero',
        type: 'circle',
        source: 'vaquitas',
        filter: ['==', ['get', 'donationStatus'], 'signal'],
        paint: {
          'circle-radius': 4,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.85,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 0.6,
        },
      });

      // Pulso en los orbes (los que se pueden donar)
      let t = 0;
      const pulse = () => {
        t += 0.06;
        const r = 16 + Math.sin(t) * 5 + 3;
        const op = 0.3 - (Math.sin(t) * 0.5 + 0.5) * 0.2;
        if (map.getLayer('vaquita-glow')) {
          map.setPaintProperty('vaquita-glow', 'circle-radius', r);
          map.setPaintProperty('vaquita-glow', 'circle-opacity', Math.max(0.08, op));
        }
        (map as any)._vacaPulse = requestAnimationFrame(pulse);
      };
      pulse();

      const openIncident = (e: maplibregl.MapLayerMouseEvent) => {
        const f = e.features?.[0];
        const incident = incidentsRef.current.find(
          (i) => i.id === f?.properties?.id,
        );
        if (incident) {
          map.flyTo({
            center: [e.lngLat.lng, e.lngLat.lat],
            zoom: 12,
            duration: 1400,
          });
          incidentHandler.current?.(incident);
        }
      };
      ['vaquita-orb', 'signal-lucero'].forEach((layer) => {
        map.on('click', layer, openIncident);
        map.on('mousemove', layer, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layer, () => {
          map.getCanvas().style.cursor = '';
        });
      });

      // Centro por IP: silencioso, sin permiso — centra al visitante.
      locateByIp().then((c) => {
        visitorRef.current = c;
      });

      // Botón "mi ubicación" opt-in (como el target de Google Maps):
      // el prompt de GPS solo aparece si el usuario lo pide — Brave y
      // otros navegadores que bloquean prompts tempranos no se afectan.
      map.addControl(
        new maplibregl.GeolocateControl({
          positionOptions: { timeout: 8000, maximumAge: 300000 },
          fitBoundsOptions: { maxZoom: 9 },
          showUserLocation: true,
          trackUserLocation: false,
        }),
        'bottom-right',
      );

      setReady(true);
      onReady?.();
    });

    return () => {
      if ((map as any)._vacaPulse) cancelAnimationFrame((map as any)._vacaPulse);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legacy]);

  // ── Volar al iniciar: país del visitante si se resolvió, si no Chile ──
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    if (started) {
      const target = visitorRef.current;
      if (target) {
        map.flyTo({ center: target, zoom: 4.2, pitch: 25, duration: 4000, essential: true });
      } else {
        map.flyTo({ ...CHILE_VIEW, duration: 4000, essential: true });
      }
    } else {
      map.flyTo({ ...GLOBE_VIEW, duration: 2500, essential: true });
    }
  }, [ready, started]);

  // ── Resaltar / volar a región seleccionada (legacy) ──
  useEffect(() => {
    if (!ready || !legacy || !mapRef.current) return;
    const map = mapRef.current;
    DISASTER_IDS.forEach((id) => map.setFeatureState({ source: 'regions', id }, { selected: false }));
    if (selectedRegionId != null) {
      map.setFeatureState({ source: 'regions', id: selectedRegionId }, { selected: true });
      const feature = geoRef.current?.features?.find(
        (f: any) => f.properties?.regionId === selectedRegionId
      );
      const center = feature?.properties?.center;
      if (center) {
        const c = typeof center === 'string' ? JSON.parse(center) : center;
        map.flyTo({ center: c, zoom: 7.2, pitch: 40, bearing: 0, duration: 1500, essential: true });
      }
    }
  }, [ready, legacy, selectedRegionId]);

  // ── Actualizar puntos Vaquita cuando cambia el feed ──
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const source = mapRef.current.getSource('vaquitas') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    const features = incidents
      .filter((i) => i.latitude != null && i.longitude != null)
      .map((i) => ({
        type: 'Feature',
        properties: {
          id: i.id,
          donationStatus: i.donationStatus,
          color: CATEGORY_COLOR[i.category] ?? '#A6C2D4',
        },
        geometry: { type: 'Point', coordinates: [i.longitude!, i.latitude!] },
      }));
    source.setData({ type: 'FeatureCollection', features } as any);
  }, [ready, incidents]);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" />;
}

export default memo(VacaGlobe);
