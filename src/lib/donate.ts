// Donaciones Vaquita en Testnet: XLM a un pool por incidente.
//
// El donante firma con su wallet (Freighter) un payment XLM hacia la cuenta
// pool de Vaquitas con memo del incidente. Todo testnet: fondos de prueba,
// cuenta pool efímera fondeada por friendbot. En producción el pool sería
// una wallet multifirma VACA + claimable balances al receptor.

import {
  Keypair,
  TransactionBuilder,
  Operation,
  Asset,
  Memo,
  BASE_FEE,
} from '@stellar/stellar-sdk';
import { signTransaction } from '@stellar/freighter-api';
import { getServer, NETWORK, explorerTx } from './stellar';

const POOL_KEY = 'vaca-vaquita-pool-v1';

interface PoolAccount {
  publicKey: string;
  secret: string;
}

/** Cuenta pool persistente en localStorage (testnet, demo). */
export function getPool(): PoolAccount {
  try {
    const raw = localStorage.getItem(POOL_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p?.publicKey && p?.secret) return p;
    }
  } catch {}
  const kp = Keypair.random();
  const pool = { publicKey: kp.publicKey(), secret: kp.secret() };
  localStorage.setItem(POOL_KEY, JSON.stringify(pool));
  return pool;
}

async function fundIfMissing(pub: string): Promise<void> {
  const srv = getServer();
  try {
    await srv.loadAccount(pub);
  } catch {
    await fetch(
      `https://friendbot.stellar.org?addr=${encodeURIComponent(pub)}`,
    );
    // Espera corta a que friendbot propague la cuenta.
    await new Promise((r) => setTimeout(r, 1500));
  }
}

/** Balance XLM nativo de una cuenta testnet (null si no existe). */
export async function getBalance(publicKey: string): Promise<string | null> {
  try {
    const acc = await getServer().loadAccount(publicKey);
    const native = acc.balances.find((b: any) => b.asset_type === 'native');
    return native ? Number(native.balance).toFixed(2) : null;
  } catch {
    return null;
  }
}

export interface DonationResult {
  txHash: string;
  explorerUrl: string;
}

/**
 * Dona XLM al pool Vaquita, con memo del incidente.
 * Fondea con friendbot al donante si su cuenta no existe en testnet.
 */
export async function donateToPool(
  donorPublicKey: string,
  amountXlm: string,
  incidentId: string,
): Promise<DonationResult> {
  const pool = getPool();
  const srv = getServer();

  // Cuentas deben existir en testnet antes de construir la tx.
  await fundIfMissing(donorPublicKey);
  await fundIfMissing(pool.publicKey);

  const source = await srv.loadAccount(donorPublicKey);
  const memoText = `vq:${incidentId.slice(0, 8)}`; // máx 28 bytes
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK,
  })
    .addOperation(
      Operation.payment({
        destination: pool.publicKey,
        asset: Asset.native(),
        amount: amountXlm,
      }),
    )
    .addMemo(Memo.text(memoText))
    .setTimeout(180)
    .build();

  const { signedTxXdr, error } = await signTransaction(tx.toXDR(), {
    networkPassphrase: NETWORK,
    address: donorPublicKey,
  });
  if (error || !signedTxXdr) {
    throw new Error(error?.message ?? 'Firma rechazada');
  }

  const signed = TransactionBuilder.fromXDR(signedTxXdr, NETWORK);
  const res = await srv.submitTransaction(signed);
  return { txHash: res.hash, explorerUrl: explorerTx(res.hash) };
}
