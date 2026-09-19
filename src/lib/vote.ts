// Voto comunitario firmado por wallet (SEP-53).
// El servidor verifica la firma, aplica cooldown 5 min, dedup por incidente
// y auto-promueve a 'community' al alcanzar el umbral.

import { signMessage } from '@stellar/freighter-api';

const VOTE_ENDPOINT = '/functions/v1/vaquita-vote';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export interface VoteResult {
  votes: number;
  donationStatus: string | null;
  cooldownS: number;
}

export class VoteError extends Error {
  constructor(
    message: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
  }
}

/** Firma el challenge canónico y emite el voto de la wallet. */
export async function castVote(
  supabaseUrl: string,
  voterPublicKey: string,
  incidentId: string,
): Promise<VoteResult> {
  const ts = Math.floor(Date.now() / 1000);
  const canonical = ['vaca-vote', incidentId, String(ts)].join('\n');

  const res = await signMessage(canonical, { address: voterPublicKey });
  if (res.error || !res.signedMessage) {
    throw new VoteError(res.error?.message ?? 'Firma rechazada');
  }
  const signed = res.signedMessage;
  const signature =
    typeof signed === 'string'
      ? signed
      : Buffer.from(signed as unknown as Uint8Array).toString('base64');

  const resp = await fetch(`${supabaseUrl}${VOTE_ENDPOINT}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
    },
    body: JSON.stringify({
      incident_id: incidentId,
      public_key: voterPublicKey,
      signature,
      timestamp: ts,
    }),
  });
  const body = await resp.json().catch(() => ({}));

  if (resp.status === 429) {
    throw new VoteError(
      `Puedes votar de nuevo en ${body?.retry_after ?? '?'} s`,
      body?.retry_after,
    );
  }
  if (resp.status === 409) {
    throw new VoteError('Ya votaste esta señal');
  }
  if (!resp.ok) {
    throw new VoteError(body?.error ?? 'No se pudo registrar el voto');
  }

  return {
    votes: Number(body.votes ?? 0),
    donationStatus: body.donation_status ?? null,
    cooldownS: Number(body.cooldown_s ?? 300),
  };
}
