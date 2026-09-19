// Curaduria Vaquita con wallet Stellar (Freighter).
//
// El servidor verifica la firma Ed25519 del challenge canonico y la
// membresia en admin_wallets. El cliente nunca decide solo: si la wallet
// no es admin, vaquita-admin responde 403.

import { requestAccess, signMessage, isConnected } from '@stellar/freighter-api';

export interface AdminSession {
  publicKey: string;
  role: string;
}

const ADMIN_ENDPOINT = '/functions/v1/vaquita-admin';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

function canonical(action: string, incidentId: string, status: string, ts: number) {
  return ['vaca-admin', action, incidentId, status, String(ts)].join('\n');
}

/** Firma un challenge con Freighter y devuelve firma en base64. */
async function signChallenge(message: string, address: string): Promise<string> {
  const res = await signMessage(message, { address });
  if (res.error || !res.signedMessage) {
    throw new Error(res.error?.message ?? 'Firma rechazada');
  }
  const signed = res.signedMessage;
  return typeof signed === 'string'
    ? signed
    : Buffer.from(signed as unknown as Uint8Array).toString('base64');
}

async function postAdmin(
  supabaseUrl: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; body: any }> {
  if (!supabaseUrl) {
    return { ok: false, status: 0, body: { error: 'backend_no_configurado' } };
  }
  const res = await fetch(`${supabaseUrl}${ADMIN_ENDPOINT}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body: json };
}

/** Conecta Freighter y verifica el rol admin firmando un challenge. */
export async function connectAdmin(
  supabaseUrl: string,
): Promise<AdminSession> {
  const conn = await isConnected();
  if (!conn.isConnected) throw new Error('Freighter no instalado');
  const { address, error } = await requestAccess();
  if (error || !address) throw new Error(error?.message ?? 'Acceso denegado');

  const ts = Math.floor(Date.now() / 1000);
  const signature = await signChallenge(canonical('check', '', '', ts), address);
  const res = await postAdmin(supabaseUrl, {
    action: 'check',
    public_key: address,
    signature,
    timestamp: ts,
  });
  if (res.status === 403) throw new Error('Esta wallet no tiene rol admin');
  if (!res.ok || res.body?.admin !== true) {
    throw new Error(res.body?.error ?? 'No se pudo verificar el rol admin');
  }
  return { publicKey: address, role: String(res.body.role ?? 'curator') };
}

/** Cambia el donation_status de un incidente (firma + rol verificados). */
export async function setDonationStatus(
  supabaseUrl: string,
  session: AdminSession,
  incidentId: string,
  donationStatus: 'signal' | 'community' | 'vaquita',
): Promise<void> {
  const ts = Math.floor(Date.now() / 1000);
  const signature = await signChallenge(
    canonical('set_status', incidentId, donationStatus, ts),
    session.publicKey,
  );
  const res = await postAdmin(supabaseUrl, {
    action: 'set_status',
    public_key: session.publicKey,
    signature,
    timestamp: ts,
    incident_id: incidentId,
    donation_status: donationStatus,
  });
  if (!res.ok) throw new Error(res.body?.error ?? 'update_failed');
}
