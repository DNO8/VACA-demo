'use client';

import { useState } from 'react';
import { X, HeartHandshake, Vote, MapPin, Users, Clock } from 'lucide-react';
import {
  VaquitaIncident,
  CATEGORY_LABEL,
  CATEGORY_COLOR,
} from '@/lib/vaquitas';

interface VaquitaDetailProps {
  incident: VaquitaIncident;
  regionName: string | null;
  walletConnected: boolean;
  onConnectWallet: () => void;
  onVote: (id: string) => void;
  onClose: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  signal: 'Señal registrada',
  community: 'Vaquita Comunitaria',
  vaquita: 'Vaquita verificada',
};

/**
 * Ficha del punto seleccionado en el mapa.
 * - vaquita: botón Donar (mock — claimable balance pendiente de decisión).
 * - signal: voto para elevar a Vaquita Comunitaria (requiere wallet, mock).
 * - community: votos acumulados + donación bajo responsabilidad del donante.
 */
export default function VaquitaDetail({
  incident,
  regionName,
  walletConnected,
  onConnectWallet,
  onVote,
  onClose,
}: VaquitaDetailProps) {
  const [donated, setDonated] = useState(false);
  const color = CATEGORY_COLOR[incident.category] ?? '#A6C2D4';
  const isVaquita = incident.donationStatus === 'vaquita';
  const isCommunity = incident.donationStatus === 'community';

  return (
    <div className="vaca-soft-blur absolute bottom-3 left-1/2 z-30 w-[calc(100vw-1.5rem)] max-w-md -translate-x-1/2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-panel)] p-4 md:bottom-5">
      <button
        onClick={onClose}
        className="absolute right-3 top-3 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        aria-label="Cerrar"
      >
        <X size={16} />
      </button>

      <div className="flex items-center gap-2">
        <span
          className="h-3 w-3 rounded-full"
          style={{ background: color, boxShadow: `0 0 10px ${color}` }}
        />
        <span className="text-sm font-bold text-[var(--text-heading)]">
          {CATEGORY_LABEL[incident.category] ?? incident.category}
        </span>
        <span className="ml-auto mr-6 rounded border border-[var(--border-secondary)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
          {STATUS_LABEL[incident.donationStatus] ?? incident.donationStatus}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-secondary)]">
        <span className="flex items-center gap-1">
          <MapPin size={11} className="text-[var(--text-muted)]" />
          {regionName ?? 'Ubicación aproximada'}
        </span>
        {incident.peopleCount != null && (
          <span className="flex items-center gap-1">
            <Users size={11} className="text-[var(--text-muted)]" />
            {incident.peopleCount} personas
          </span>
        )}
        <span className="flex items-center gap-1">
          <Clock size={11} className="text-[var(--text-muted)]" />
          {new Date(incident.createdAt).toLocaleString('es-CL', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      <div className="mt-3">
        {isVaquita && (
          donated ? (
            <p className="rounded border border-[var(--alert-green)]/40 bg-[var(--alert-green)]/10 px-3 py-2 text-xs text-[var(--alert-green)]">
              Donación registrada (demo). En producción se crea un claimable
              balance en Stellar que el receptor reclama al conectarse.
            </p>
          ) : (
            <button
              onClick={() => setDonated(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--gold-primary)] px-3 py-2.5 text-sm font-bold text-[var(--bg-void)] transition hover:brightness-110"
            >
              <HeartHandshake size={16} /> Donar a esta Vaquita
            </button>
          )
        )}

        {isCommunity && (
          <div className="rounded border border-[var(--gold-primary)]/40 bg-[var(--gold-primary)]/10 px-3 py-2 text-xs text-[var(--text-secondary)]">
            <span className="font-semibold text-[var(--gold-primary)]">
              {incident.votes} votos comunitarios.
            </span>{' '}
            Donaciones habilitadas sin validación institucional — bajo
            responsabilidad del donante.
          </div>
        )}

        {incident.donationStatus === 'signal' && (
          walletConnected ? (
            <button
              onClick={() => onVote(incident.id)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--gold-primary)] px-3 py-2.5 text-sm font-semibold text-[var(--gold-primary)] transition hover:bg-[var(--gold-primary)]/10"
            >
              <Vote size={16} /> Votar a Vaquita Comunitaria
            </button>
          ) : (
            <button
              onClick={onConnectWallet}
              className="w-full rounded-lg border border-[var(--border-active)] px-3 py-2.5 text-sm text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
            >
              Conecta tu wallet para votar
            </button>
          )
        )}
      </div>
    </div>
  );
}
