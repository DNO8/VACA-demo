'use client';

import { useState } from 'react';
import { X, ShieldCheck, Loader2, Vote } from 'lucide-react';
import { VaquitaIncident, CATEGORY_LABEL, CATEGORY_COLOR } from '@/lib/vaquitas';
import { AdminSession, setDonationStatus, recordClaim } from '@/lib/admin';
import { createVaquitaClaim } from '@/lib/claim';

interface AdminPanelProps {
  session: AdminSession;
  supabaseUrl: string;
  incidents: VaquitaIncident[];
  onChanged: () => void;
  onClose: () => void;
}

const NEXT_STATUS: Record<string, { to: 'community' | 'vaquita'; label: string }> = {
  signal: { to: 'community', label: 'A Comunitaria' },
  community: { to: 'vaquita', label: 'A Vaquita verificada' },
};

/** Panel de curaduria: solo visible tras conectar una wallet admin. */
export default function AdminPanel({
  session,
  supabaseUrl,
  incidents,
  onChanged,
  onClose,
}: AdminPanelProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Tras promover: si el reportante tiene wallet, convierte las donaciones
  // acumuladas en un claimable balance hacia su pubkey y lo registra.
  const tryClaim = async (
    incident: VaquitaIncident,
    stellarPubkey: string | null,
  ) => {
    if (!stellarPubkey) {
      setNotice('Promovida. El reportante no tiene wallet Stellar: sin claim.');
      return;
    }
    try {
      const claim = await createVaquitaClaim(stellarPubkey, incident.id);
      await recordClaim(supabaseUrl, session, incident.id, claim.txHash);
      setNotice(`Ayuda preparada: ${claim.amount} XLM reclamables`);
    } catch (e: any) {
      setNotice(`Promovida; el claim falló: ${e?.message ?? 'error'}`);
    }
  };

  const act = async (incident: VaquitaIncident, status: 'signal' | 'community' | 'vaquita') => {
    setBusy(incident.id);
    setError('');
    setNotice('');
    try {
      const { stellarPubkey } = await setDonationStatus(
        supabaseUrl,
        session,
        incident.id,
        status,
      );
      if (status !== 'signal') await tryClaim(incident, stellarPubkey);
      onChanged();
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo actualizar');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="vaca-soft-blur absolute inset-y-0 right-0 z-40 flex w-full flex-col border-l border-[var(--gold-primary)]/40 bg-[var(--bg-panel)] md:w-1/4 md:min-w-[340px] md:max-w-[460px]">
      <div className="flex items-center gap-2 border-b border-[var(--border-secondary)] p-3">
        <ShieldCheck size={15} className="text-[var(--gold-primary)]" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-[var(--text-heading)]">
            Curaduría Vaquita
          </div>
          <div className="truncate text-[10px] text-[var(--text-muted)]">
            {session.publicKey.slice(0, 8)}…{session.publicKey.slice(-4)} ·{' '}
            {session.role}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          aria-label="Cerrar panel admin"
        >
          <X size={16} />
        </button>
      </div>

      {error && (
        <p className="border-b border-[var(--border-secondary)] px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}
      {notice && (
        <p className="border-b border-[var(--border-secondary)] px-3 py-2 text-xs text-[var(--text-muted)]">
          {notice}
        </p>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {incidents.map((incident) => {
          const color = CATEGORY_COLOR[incident.category] ?? '#A6C2D4';
          const next = NEXT_STATUS[incident.donationStatus];
          return (
            <div
              key={incident.id}
              className="rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-3"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: color }}
                />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--text-primary)]">
                  {CATEGORY_LABEL[incident.category] ?? incident.category}
                </span>
                <span className="text-[10px] uppercase text-[var(--text-muted)]">
                  {incident.donationStatus}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                <span className="truncate">{incident.id.slice(0, 8)}…</span>
                {incident.votes > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Vote size={9} /> {incident.votes}
                  </span>
                )}
              </div>
              <div className="mt-2 flex gap-1.5">
                {next && (
                  <button
                    disabled={busy != null}
                    onClick={() => act(incident, next.to)}
                    className="flex-1 rounded border border-[var(--gold-primary)] px-2 py-1.5 text-[11px] font-semibold text-[var(--gold-primary)] transition hover:bg-[var(--gold-primary)]/10 disabled:opacity-40"
                  >
                    {busy === incident.id ? (
                      <Loader2 size={11} className="mx-auto animate-spin" />
                    ) : (
                      next.label
                    )}
                  </button>
                )}
                {incident.donationStatus !== 'signal' && !incident.claimable && (
                  <button
                    disabled={busy != null}
                    onClick={() => act(incident, incident.donationStatus)}
                    className="flex-1 rounded border border-[var(--border-secondary)] px-2 py-1.5 text-[11px] text-[var(--text-primary)] transition hover:bg-[var(--bg-primary)] disabled:opacity-40"
                  >
                    Preparar ayuda
                  </button>
                )}
                {incident.donationStatus !== 'signal' && (
                  <button
                    disabled={busy != null}
                    onClick={() => act(incident, 'signal')}
                    className="rounded border border-[var(--border-secondary)] px-2 py-1.5 text-[11px] text-[var(--text-muted)] transition hover:text-[var(--text-primary)] disabled:opacity-40"
                  >
                    Bajar a señal
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
