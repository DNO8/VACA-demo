'use client';

import { useEffect, useState } from 'react';
import {
  X,
  Vote,
  HeartHandshake,
  MapPin,
  Users,
  Wallet,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { requestAccess, isConnected } from '@stellar/freighter-api';
import {
  VaquitaIncident,
  CATEGORY_LABEL,
  CATEGORY_COLOR,
  VAQUITA_GOLD,
} from '@/lib/vaquitas';
import { donateToPool, getBalance } from '@/lib/donate';
import { castVote, VoteError } from '@/lib/vote';

interface VaquitaAsideProps {
  incident: VaquitaIncident;
  regionName: string | null;
  supabaseUrl: string;
  voteThreshold: number;
  onVote: (id: string, result: { votes: number; donationStatus: string | null }) => void;
  onClose: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  signal: 'Señal de coordinación',
  community: 'Vaquita Comunitaria',
  vaquita: 'Vaquita verificada',
};

/** Aside del incidente: detalle + voto comunitario + donación testnet. */
export default function VaquitaAside({
  incident,
  regionName,
  supabaseUrl,
  voteThreshold,
  onVote,
  onClose,
}: VaquitaAsideProps) {
  const [wallet, setWallet] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [busy, setBusy] = useState<'wallet' | 'vote' | 'donate' | null>(null);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('5');
  const [donationTx, setDonationTx] = useState<string | null>(null);

  const color = CATEGORY_COLOR[incident.category] ?? '#A6C2D4';
  const promoted = incident.donationStatus !== 'signal';
  const verified = incident.donationStatus === 'vaquita';

  const connect = async (): Promise<string | null> => {
    setBusy('wallet');
    setError('');
    try {
      const conn = await isConnected();
      if (!conn.isConnected) throw new Error('Freighter no instalado');
      const { address, error } = await requestAccess();
      if (error || !address) throw new Error(error?.message ?? 'Acceso denegado');
      setWallet(address);
      setBalance(await getBalance(address));
      return address;
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo conectar la wallet');
      return null;
    } finally {
      setBusy(null);
    }
  };

  const vote = async () => {
    const addr = wallet ?? (await connect());
    if (!addr) return;
    setBusy('vote');
    setError('');
    try {
      const result = await castVote(supabaseUrl, addr, incident.id);
      onVote(incident.id, {
        votes: result.votes,
        donationStatus: result.donationStatus,
      });
    } catch (e: any) {
      setError(
        e instanceof VoteError
          ? e.message
          : (e?.message ?? 'No se pudo registrar el voto'),
      );
    } finally {
      setBusy(null);
    }
  };

  // El error se auto-descarta a los 5 s.
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 5000);
    return () => clearTimeout(t);
  }, [error]);

  const parsedAmount = Number(amount.replace(',', '.'));
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;

  const donate = async () => {
    if (!amountValid) {
      setError('Monto inválido — usa un número positivo');
      return;
    }
    const addr = wallet ?? (await connect());
    if (!addr) return;
    setBusy('donate');
    setError('');
    setDonationTx(null);
    try {
      const res = await donateToPool(addr, String(parsedAmount), incident.id);
      setDonationTx(res.explorerUrl);
      setBalance(await getBalance(addr));
    } catch (e: any) {
      setError(e?.message ?? 'Donación fallida');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="vaca-soft-blur absolute inset-y-0 right-0 z-30 flex w-full flex-col border-l border-[var(--border-secondary)] bg-[var(--bg-panel)] md:w-1/4 md:min-w-[340px] md:max-w-[460px]">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-[var(--border-secondary)] p-3.5">
        <span
          className="h-3.5 w-3.5 shrink-0 rounded-full"
          style={{
            background: promoted ? VAQUITA_GOLD : color,
            boxShadow: promoted ? `0 0 8px ${VAQUITA_GOLD}` : undefined,
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-[var(--text-heading)]">
            {CATEGORY_LABEL[incident.category] ?? incident.category}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
            {STATUS_LABEL[incident.donationStatus] ?? incident.donationStatus}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          aria-label="Cerrar"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3.5">
        {/* Meta */}
        <div className="space-y-1.5 text-xs text-[var(--text-secondary)]">
          <div className="flex items-center gap-1.5">
            <MapPin size={12} className="text-[var(--text-muted)]" />
            {regionName ?? 'Ubicación aproximada'} · coordenadas fuzzeadas
          </div>
          {incident.peopleCount != null && (
            <div className="flex items-center gap-1.5">
              <Users size={12} className="text-[var(--text-muted)]" />
              {incident.peopleCount} personas reportadas
            </div>
          )}
          <div className="text-[10px] text-[var(--text-muted)]">
            Señal {incident.id.slice(0, 8)}… ·{' '}
            {incident.createdAt
              ? new Date(incident.createdAt).toLocaleString('es-CL')
              : 'sin fecha'}
          </div>
        </div>

        {/* Wallet */}
        <button
          onClick={connect}
          disabled={busy != null}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-primary)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition hover:border-[var(--gold-primary)] disabled:opacity-50"
        >
          {busy === 'wallet' ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Wallet size={13} />
          )}
          {wallet
            ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}`
            : 'Conectar wallet (Freighter)'}
        </button>
        {wallet && balance != null && (
          <div className="-mt-1 text-center text-[11px] text-[var(--text-muted)]">
            Balance: <span className="font-semibold text-[var(--text-primary)]">{balance} XLM</span>
            <span className="text-[10px]"> · testnet</span>
          </div>
        )}

        {/* Voto */}
        <div className="rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-heading)]">
              Voto comunitario
            </span>
            <span className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
              <Vote size={11} /> {incident.votes}/{voteThreshold}
            </span>
          </div>
          <button
            onClick={vote}
            disabled={busy != null}
            className="mt-2 w-full rounded border border-[var(--cyan-primary)] px-2 py-1.5 text-[11px] font-semibold text-[var(--cyan-primary)] transition hover:bg-[var(--cyan-primary)]/10 disabled:opacity-40"
          >
            {busy === 'vote' ? (
              <Loader2 size={11} className="mx-auto animate-spin" />
            ) : (
              'Votar para elevar a Vaquita Comunitaria'
            )}
          </button>
          <p className="mt-1.5 text-[10px] leading-snug text-[var(--text-muted)]">
            Tu wallet firma el voto (1 cada 5 min). En producción se exigirá
            KYC o antigüedad de wallet contra Sybil.
          </p>
        </div>

        {/* Donación */}
        <div className="rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-heading)]">
            <HeartHandshake size={13} className="text-[var(--gold-primary)]" />
            Donación
          </div>
          {promoted ? (
            <>
              <div className="mt-2 flex gap-1.5">
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) =>
                    setAmount(e.target.value.replace(/[^0-9.,]/g, ''))
                  }
                  className="w-20 rounded border border-[var(--border-secondary)] bg-transparent px-2 py-1.5 text-xs text-[var(--text-primary)]"
                  aria-label="Monto XLM"
                />
                <button
                  onClick={donate}
                  disabled={busy != null || !amountValid}
                  className="flex-1 rounded border border-[var(--gold-primary)] px-2 py-1.5 text-[11px] font-semibold text-[var(--gold-primary)] transition hover:bg-[var(--gold-primary)]/10 disabled:opacity-40"
                >
                  {busy === 'donate' ? (
                    <Loader2 size={11} className="mx-auto animate-spin" />
                  ) : (
                    `Donar ${amountValid ? parsedAmount : '—'} XLM`
                  )}
                </button>
              </div>
              <p className="mt-1.5 text-[10px] leading-snug text-[var(--text-muted)]">
                Testnet real: el pago XLM va al pool Vaquita con memo del
                incidente y lo firma tu Freighter (debe estar en modo Testnet).
              </p>
              {donationTx && (
                <a
                  href={donationTx}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 flex items-center gap-1 text-[11px] text-[var(--cyan-primary)] hover:underline"
                >
                  <ExternalLink size={11} /> Ver transacción en Stellar Expert
                </a>
              )}
            </>
          ) : (
            <p className="mt-2 text-[10px] leading-snug text-[var(--text-muted)]">
              Las donaciones se habilitan cuando la señal es promovida a
              Vaquita (votos comunitarios o verificación VACA).
            </p>
          )}
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        {verified && (
          <p className="text-[10px] leading-snug text-[var(--text-muted)]">
            Verificada por curaduría VACA — la verificación certifica la señal,
            no garantiza respuesta institucional.
          </p>
        )}
      </div>
    </div>
  );
}
