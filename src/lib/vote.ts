// Voto comunitario on-chain (testnet): el votante firma una tx
// manageData {vq-vote: incidentId} en su propia cuenta — un ballot público e
// inmutable. El servidor verifica la tx por hash contra Horizon, aplica
// cooldown 5 min, dedup por incidente y auto-promueve al umbral.

import {
  TransactionBuilder,
  Operation,
  BASE_FEE,
} from '@stellar/stellar-sdk';
import { signTransaction } from '@stellar/freighter-api';
import { getServer, NETWORK } from './stellar';
import { fundIfMissing } from './donate';

const VOTE_ENDPOINT = '/functions/v1/vaquita-vote';
const VOTE_DATA_NAME = 'vq-vote';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export interface VoteResult {
  votes: number;
  donationStatus: string | null;
  cooldownS: number;
  txHash: string;
  explorerUrl: string;
}

export class VoteError extends Error {
  constructor(
    message: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
  }
}

/**
 * Emite el voto: tx manageData firmada por el votante → Horizon → hash como
 * prueba al backend. El ballot queda público en el ledger de testnet.
 */
export async function castVote(
  supabaseUrl: string,
  voterPublicKey: string,
  incidentId: string,
): Promise<VoteResult> {
  const srv = getServer();
  await fundIfMissing(voterPublicKey);
  const source = await srv.loadAccount(voterPublicKey);

  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK,
  })
    .addOperation(
      Operation.manageData({ name: VOTE_DATA_NAME, value: incidentId }),
    )
    .setTimeout(180)
    .build();

  const { signedTxXdr, error } = await signTransaction(tx.toXDR(), {
    networkPassphrase: NETWORK,
    address: voterPublicKey,
  });
  if (error || !signedTxXdr) {
    throw new VoteError(error?.message ?? 'Firma rechazada');
  }

  const signed = TransactionBuilder.fromXDR(signedTxXdr, NETWORK);
  const submitted = await srv.submitTransaction(signed);
  const txHash = submitted.hash;

  const resp = await fetch(`${supabaseUrl}${VOTE_ENDPOINT}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
    },
    body: JSON.stringify({
      incident_id: incidentId,
      public_key: voterPublicKey,
      tx_hash: txHash,
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
    txHash,
    explorerUrl: `https://stellar.expert/explorer/testnet/tx/${txHash}`,
  };
}

/** Cooldown restante del votante (0 = puede votar ya). Sin side-effects. */
export async function getVoteCooldown(
  supabaseUrl: string,
  voterPublicKey: string,
): Promise<number> {
  try {
    const resp = await fetch(
      `${supabaseUrl}${VOTE_ENDPOINT}?voter=${voterPublicKey}`,
      { headers: SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {} },
    );
    const body = await resp.json();
    return Math.max(0, Number(body?.retry_after ?? 0));
  } catch {
    return 0;
  }
}
