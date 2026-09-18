'use client';

import { useMemo } from 'react';
import { MapPin, Vote, X } from 'lucide-react';
import {
  VaquitaIncident,
  VaquitaFilter,
  DonationStatus,
  CATEGORY_LABEL,
  CATEGORY_COLOR,
  VAQUITA_GOLD,
  regionOfPoint,
} from '@/lib/vaquitas';
import { REGION_NAMES } from '@/lib/chile';

interface VaquitaCardsProps {
  incidents: VaquitaIncident[];
  geojson: any;
  filter: VaquitaFilter;
  onFilterChange: (f: VaquitaFilter) => void;
  onSelect: (incident: VaquitaIncident) => void;
  onClose: () => void;
}

const STATUS_OPTIONS: { value: DonationStatus | null; label: string }[] = [
  { value: null, label: 'Todas' },
  { value: 'vaquita', label: 'Vaquitas' },
  { value: 'community', label: 'Comunitarias' },
  { value: 'signal', label: 'Señales' },
];

const ORDER: Record<DonationStatus, number> = {
  vaquita: 0,
  community: 1,
  signal: 2,
};

/** Vista en panel: los mismos puntos del mapa como cards filtrables. */
export default function VaquitaCards({
  incidents,
  geojson,
  filter,
  onFilterChange,
  onSelect,
  onClose,
}: VaquitaCardsProps) {
  const sorted = useMemo(
    () =>
      [...incidents].sort(
        (a, b) =>
          ORDER[a.donationStatus] - ORDER[b.donationStatus] ||
          b.createdAt.localeCompare(a.createdAt),
      ),
    [incidents],
  );

  return (
    <div className="vaca-soft-blur absolute inset-y-0 right-0 z-30 flex w-full flex-col border-l border-[var(--border-primary)] bg-[var(--bg-panel)] md:w-[380px]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-secondary)] p-3">
        <h2 className="text-sm font-bold text-[var(--text-heading)]">
          Señales y Vaquitas
        </h2>
        <button
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          aria-label="Volver al mapa"
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-2 border-b border-[var(--border-secondary)] p-3">
        <select
          value={filter.regionId ?? ''}
          onChange={(e) =>
            onFilterChange({
              ...filter,
              regionId: e.target.value ? Number(e.target.value) : null,
            })
          }
          className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
        >
          <option value="">Chile — todas las regiones</option>
          {Object.entries(REGION_NAMES)
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
        </select>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() =>
                onFilterChange({ ...filter, donationStatus: opt.value })
              }
              className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                filter.donationStatus === opt.value
                  ? 'border-[var(--gold-primary)] text-[var(--gold-primary)]'
                  : 'border-[var(--border-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {sorted.length === 0 && (
          <p className="p-4 text-center text-xs text-[var(--text-muted)]">
            Sin señales en este filtro.
          </p>
        )}
        {sorted.map((incident) => {
          const color = CATEGORY_COLOR[incident.category] ?? '#A6C2D4';
          const isVaquita = incident.donationStatus === 'vaquita';
          return (
            <button
              key={incident.id}
              onClick={() => onSelect(incident)}
              className="w-full rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-3 text-left transition hover:border-[var(--border-active)]"
              style={
                isVaquita ? { borderColor: `${VAQUITA_GOLD}66` } : undefined
              }
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: color, boxShadow: `0 0 8px ${color}` }}
                />
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  {CATEGORY_LABEL[incident.category] ?? incident.category}
                </span>
                {isVaquita && (
                  <span
                    className="ml-auto text-[10px] font-bold uppercase tracking-wide"
                    style={{ color: VAQUITA_GOLD }}
                  >
                    Vaquita
                  </span>
                )}
                {incident.donationStatus === 'community' && (
                  <span className="ml-auto flex items-center gap-1 text-[10px] text-[var(--gold-primary)]">
                    <Vote size={10} /> {incident.votes}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                <MapPin size={10} />
                {(incident.latitude != null && incident.longitude != null && geojson
                  ? regionOfPoint(geojson, incident.longitude, incident.latitude)?.name
                  : null) ?? 'Ubicación aproximada'}{' '}
                ·{' '}
                {incident.peopleCount != null
                  ? `${incident.peopleCount} personas`
                  : 'personas no reportadas'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
