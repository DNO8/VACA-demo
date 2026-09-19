// Capa de datos Vaquita: feed público de señales + utilidades de región.
//
// El feed viene del Edge Function `vaquita-feed` (coordenadas ya fuzzeadas
// a ~1.1 km). En modo ?mock=1 o sin backend configurado se usa MOCK_INCIDENTS.

export type DonationStatus = 'signal' | 'community' | 'vaquita';

export interface VaquitaIncident {
  id: string;
  category: 'sos' | 'medical' | 'person' | 'hazard' | 'coordination';
  priority: number;
  peopleCount: number | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  donationStatus: DonationStatus;
  createdAt: string;
  /** Votos comunitarios acumulados — mock hasta que exista el backend de votos. */
  votes: number;
}

export const CATEGORY_LABEL: Record<VaquitaIncident['category'], string> = {
  sos: 'SOS — vida en riesgo',
  medical: 'Emergencia médica',
  person: 'Persona / reunificación',
  hazard: 'Peligro o acceso',
  coordination: 'Coordinación',
};

export const CATEGORY_COLOR: Record<VaquitaIncident['category'], string> = {
  sos: '#FF6B9D',
  medical: '#DBA59E',
  person: '#B8D9C6',
  hazard: '#F2C879',
  coordination: '#A6C2D4',
};

export const VAQUITA_GOLD = '#F2C879';

/** Región de Chile que contiene un punto (point-in-polygon sobre el GeoJSON). */
export function regionOfPoint(
  geojson: any,
  lng: number,
  lat: number,
): { regionId: number; name: string } | null {
  for (const f of geojson?.features ?? []) {
    if (pointInGeometry(f.geometry, lng, lat)) {
      return { regionId: f.properties.regionId, name: f.properties.name };
    }
  }
  return null;
}

function pointInGeometry(geometry: any, lng: number, lat: number): boolean {
  if (!geometry) return false;
  if (geometry.type === 'Polygon') {
    return pointInPolygon(geometry.coordinates, lng, lat);
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((poly: any) =>
      pointInPolygon(poly, lng, lat),
    );
  }
  return false;
}

function pointInPolygon(rings: number[][][], lng: number, lat: number): boolean {
  // Ray casting sobre el anillo exterior; los anillos internos restan.
  if (!rings?.length) return false;
  const inside = ringContains(rings[0], lng, lat);
  if (!inside) return false;
  return !rings.slice(1).some((hole) => ringContains(hole, lng, lat));
}

function ringContains(ring: number[][], lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Trae el feed público. Devuelve [] si el backend no responde. */
export async function fetchVaquitas(supabaseUrl: string): Promise<VaquitaIncident[]> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/vaquita-feed`, {
      cache: 'no-store',
      headers: SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {},
    });
    if (!res.ok) return [];
    const body = await res.json();
    const rows = Array.isArray(body?.incidents) ? body.incidents : [];
    return rows
      .filter((r: any) => r.latitude != null && r.longitude != null)
      .map((r: any) => ({ ...r, votes: 0 })) as VaquitaIncident[];
  } catch {
    return [];
  }
}

/** Incidentes de demostración distribuidos por Chile (?mock=1 o sin feed). */
export const MOCK_INCIDENTS: VaquitaIncident[] = [
  {
    id: 'vq-iquique-01', category: 'hazard', priority: 3, peopleCount: 12,
    latitude: -20.22, longitude: -70.14, status: 'received',
    donationStatus: 'vaquita', createdAt: '2026-09-16T18:20:00Z', votes: 0,
  },
  {
    id: 'vq-antofa-01', category: 'coordination', priority: 4, peopleCount: null,
    latitude: -23.65, longitude: -70.39, status: 'received',
    donationStatus: 'signal', createdAt: '2026-09-16T20:05:00Z', votes: 3,
  },
  {
    id: 'vq-vina-01', category: 'sos', priority: 0, peopleCount: 4,
    latitude: -33.02, longitude: -71.55, status: 'received',
    donationStatus: 'vaquita', createdAt: '2026-09-17T02:41:00Z', votes: 0,
  },
  {
    id: 'vq-stgo-01', category: 'medical', priority: 1, peopleCount: 2,
    latitude: -33.44, longitude: -70.66, status: 'received',
    donationStatus: 'signal', createdAt: '2026-09-17T09:12:00Z', votes: 7,
  },
  {
    id: 'vq-stgo-02', category: 'coordination', priority: 4, peopleCount: 30,
    latitude: -33.51, longitude: -70.74, status: 'received',
    donationStatus: 'community', createdAt: '2026-09-17T11:30:00Z', votes: 21,
  },
  {
    id: 'vq-concep-01', category: 'hazard', priority: 3, peopleCount: 8,
    latitude: -36.82, longitude: -73.05, status: 'received',
    donationStatus: 'signal', createdAt: '2026-09-17T14:48:00Z', votes: 1,
  },
  {
    id: 'vq-temuco-01', category: 'medical', priority: 1, peopleCount: 1,
    latitude: -38.74, longitude: -72.59, status: 'received',
    donationStatus: 'signal', createdAt: '2026-09-17T16:02:00Z', votes: 0,
  },
  {
    id: 'vq-pmontt-01', category: 'sos', priority: 0, peopleCount: 6,
    latitude: -41.47, longitude: -72.94, status: 'received',
    donationStatus: 'community', createdAt: '2026-09-17T17:26:00Z', votes: 14,
  },
];

export interface VaquitaFilter {
  regionId: number | null;
  donationStatus: DonationStatus | null;
}

export function filterVaquitas(
  incidents: VaquitaIncident[],
  geojson: any,
  filter: VaquitaFilter,
): VaquitaIncident[] {
  return incidents.filter((i) => {
    if (filter.donationStatus && i.donationStatus !== filter.donationStatus) {
      return false;
    }
    if (filter.regionId != null) {
      if (i.latitude == null || i.longitude == null) return false;
      const region = regionOfPoint(geojson, i.longitude, i.latitude);
      if (region?.regionId !== filter.regionId) return false;
    }
    return true;
  });
}
