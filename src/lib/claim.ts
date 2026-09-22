// Claimable Balances Vaquita (testnet): el pool convierte las donaciones
// acumuladas de un incidente en un claimable balance dirigido a la pubkey
// Stellar del reportante. La app mobile lo reclama con su propia wallet.
//
// Demo: el keypair del pool vive en localStorage y firma la tx en el
// navegador del admin. Producción: multisig VACA server-side + horizon
// RPC/cola, con top-ups para donaciones posteriores al primer claim.

import {
  Account,
  Keypair,
  TransactionBuilder,
  Operation,
  Asset,
  Memo,
  Claimant,
  BASE_FEE,
} from '@stellar/stellar-sdk';
import { getServer, NETWORK, explorerTx } from './stellar';
import { getPool, fundIfMissing, vaquitaMemoFor } from './donate';

export interface VaquitaClaim {
  txHash: string;
  amount: string;
  explorerUrl: string;
}

export function buildVaquitaClaimTransaction(
  source: Account,
  receiverPubkey: string,
  amountXlm: string,
  incidentId: string,
) {
  return new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK,
  })
    .addOperation(
      Operation.createClaimableBalance({
        asset: Asset.native(),
        amount: amountXlm,
        claimants: [
          new Claimant(receiverPubkey, Claimant.predicateUnconditional()),
        ],
      }),
    )
    .addMemo(Memo.text(vaquitaMemoFor(incidentId)))
    .setTimeout(180)
    .build();
}

/**
 * Suma los payments XLM que llegaron al pool con memo `vq:<id8>`.
 * Devuelve el total con 7 decimales; '0.0000000' si no hay donaciones.
 */
export async function sumIncidentDonations(
  incidentId: string,
): Promise<string> {
  const pool = getPool();
  const srv = getServer();
  const memo = `vq:${incidentId.slice(0, 8)}`;

  const txs = await srv
    .transactions()
    .forAccount(pool.publicKey)
    .order('desc')
    .limit(200)
    .call();

  let total = 0;
  for (const tx of txs.records) {
    if (tx.memo !== memo) continue;
    const ops = await tx.operations();
    for (const op of ops.records) {
      if (
        op.type === 'payment' &&
        'to' in op &&
        op.to === pool.publicKey &&
        'asset_type' in op &&
        op.asset_type === 'native'
      ) {
        total += Number((op as { amount?: string }).amount ?? 0);
      }
    }
  }
  return total.toFixed(7);
}

/**
 * Crea un claimable balance con el total de donaciones del incidente,
 * reclamable solo por la pubkey del reportante. Devuelve la tx.
 * Lanza si no hay donaciones acumuladas o el receptor no tiene pubkey.
 */
export async function createVaquitaClaim(
  receiverPubkey: string,
  incidentId: string,
): Promise<VaquitaClaim> {
  const pool = getPool();
  const srv = getServer();

  const total = Number(await sumIncidentDonations(incidentId));
  if (total <= 0) {
    throw new Error('El incidente no tiene donaciones acumuladas en el pool');
  }

  await fundIfMissing(pool.publicKey);
  const source = await srv.loadAccount(pool.publicKey);
  const tx = buildVaquitaClaimTransaction(
    source,
    receiverPubkey,
    total.toFixed(7),
    incidentId,
  );

  tx.sign(Keypair.fromSecret(pool.secret));
  const res = await srv.submitTransaction(tx);
  return {
    txHash: res.hash,
    amount: total.toFixed(2),
    explorerUrl: explorerTx(res.hash),
  };
}
