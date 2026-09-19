import { NextRequest, NextResponse } from 'next/server';
import { COUNTRY_CENTER } from '@/lib/countries';

// Geolocalización por IP: Vercel inyecta x-vercel-ip-country en cada request.
// Fallback cuando el visitante niega el permiso de GPS del navegador.
export function GET(req: NextRequest) {
  const country =
    req.headers.get('x-vercel-ip-country') ??
    req.headers.get('cf-ipcountry') ??
    '';
  const center = COUNTRY_CENTER[country.toUpperCase()] ?? null;
  return NextResponse.json({ country: country || null, center });
}
