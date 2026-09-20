// i18n mínimo ES/EN para la demo pública: diccionario plano + contexto.
// Persiste en localStorage y auto-detecta navigator.language al entrar.
'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Lang = 'es' | 'en';

const STRINGS = {
  es: {
    // HUD / header
    tagline: 'Resiliencia humanitaria · Stellar',
    admin_curation: 'Curaduría',
    admin_short: 'Admin',
    view_panel: 'Panel',
    view_map: 'Mapa',
    tour: 'Tour',
    reset: 'Reiniciar',
    tour_title: 'Tour guiado',
    admin_title: 'Curaduría (wallet admin)',
    status_ready: 'Testnet lista',
    status_wait: 'Conectando Testnet…',
    status_setup_error: 'Error inicializando Testnet: ',
    admin_connect_error: 'No se pudo conectar la wallet',
    // Leyenda
    legend_title: 'Señales',
    legend_vaquita: 'Vaquita — puedes donar',
    legend_signal: 'Señal — vota para promoverla',
    legend_hint: 'Haz clic en un punto para ver el detalle',
    // Log de transacciones
    tx_log: 'Transacciones',
    // Categorías de señal
    cat_sos: 'SOS — vida en riesgo',
    cat_medical: 'Emergencia médica',
    cat_person: 'Persona / reunificación',
    cat_hazard: 'Peligro o acceso',
    cat_coordination: 'Coordinación',
    // Estado de donación
    status_signal: 'Señal de coordinación',
    status_community: 'Vaquita Comunitaria',
    status_vaquita: 'Vaquita verificada',
    status_short_signal: 'señal',
    status_short_community: 'comunitaria',
    status_short_vaquita: 'vaquita',
    // Aside del incidente
    close: 'Cerrar',
    location_approx: 'Ubicación aproximada',
    coords_fuzzed: 'coordenadas fuzzeadas',
    people_reported: '{n} personas reportadas',
    people_short: '{n} personas',
    people_missing: 'personas no reportadas',
    signal_id: 'Señal {id}…',
    no_date: 'sin fecha',
    connect_wallet: 'Conectar wallet (Freighter)',
    balance: 'Balance:',
    community_vote: 'Voto comunitario',
    vote_cta: 'Votar para elevar a Vaquita Comunitaria',
    vote_cooldown: 'Próximo voto en {t}',
    vote_note:
      'El voto es una transacción testnet firmada por tu wallet (1 cada 5 min). En producción se exigirá KYC o antigüedad contra Sybil.',
    vote_view_tx: 'Ver tu voto en la cadena',
    donation: 'Donación',
    donate_cta: 'Donar {n} XLM',
    donate_cta_empty: 'Donar — XLM',
    donate_note:
      'Testnet real: el pago XLM va al pool Vaquita con memo del incidente y lo firma tu Freighter (debe estar en modo Testnet).',
    donate_view_tx: 'Ver transacción en Stellar Expert',
    donate_disabled:
      'Las donaciones se habilitan cuando la señal es promovida a Vaquita (votos comunitarios o verificación VACA).',
    verified_note:
      'Verificada por curaduría VACA — la verificación certifica la señal, no garantiza respuesta institucional.',
    amount_aria: 'Monto XLM',
    err_freighter: 'Freighter no instalado',
    err_denied: 'Acceso denegado',
    err_wallet: 'No se pudo conectar la wallet',
    err_vote: 'No se pudo registrar el voto',
    err_amount: 'Monto inválido — usa un número positivo',
    err_donate: 'Donación fallida',
    // Vista de cards
    cards_title: 'Señales y Vaquitas',
    cards_back_map: 'Volver al mapa',
    filter_all_regions: 'Chile — todas las regiones',
    filter_all: 'Todas',
    filter_vaquitas: 'Vaquitas',
    filter_community: 'Comunitarias',
    filter_signals: 'Señales',
    cards_empty: 'Sin señales en este filtro.',
    // Panel admin
    admin_panel_title: 'Curaduría Vaquita',
    admin_close: 'Cerrar panel admin',
    promote_community: 'A Comunitaria',
    promote_vaquita: 'A Vaquita verificada',
    demote_signal: 'Bajar a señal',
    release_aid: 'Liberar ayuda',
    release_no_wallet:
      'No se puede liberar: la señal se creó sin wallet del reportante.',
    promoted_no_wallet:
      'Promovida. El reportante no tiene wallet Stellar: sin claim.',
    released_ok: 'Ayuda liberada: {n} XLM reclamables',
    claim_failed: 'El claim falló: {e}',
    update_failed: 'No se pudo actualizar',
    release_failed: 'No se pudo liberar',
    // Tour overview
    tour1_title: 'Bienvenido a V.A.C.A.',
    tour1_body:
      'Infraestructura de resiliencia post-catástrofe sobre Stellar. Te guiamos por el flujo completo del MVP, paso a paso.',
    tour2_title: 'Stellar Testnet en vivo',
    tour2_body:
      'Conectamos a la red de prueba real de Stellar. Cada operación de la demo es una transacción verificable en el explorador.',
    tour3_title: 'Focos de catástrofe',
    tour3_body:
      'El globo enfoca Chile. Cada foco pulsante es una región afectada; el color indica la severidad (crítico, alto o medio).',
    tour4_title: 'Empieza por una región',
    tour4_body:
      'Haz clic en una región con foco para abrir su panel de ayuda. Allí te explicaremos el flujo completo de la donación.',
  },
  en: {
    tagline: 'Humanitarian resilience · Stellar',
    admin_curation: 'Curation',
    admin_short: 'Admin',
    view_panel: 'Panel',
    view_map: 'Map',
    tour: 'Tour',
    reset: 'Reset',
    tour_title: 'Guided tour',
    admin_title: 'Curation (admin wallet)',
    status_ready: 'Testnet ready',
    status_wait: 'Connecting Testnet…',
    status_setup_error: 'Testnet init failed: ',
    admin_connect_error: 'Could not connect wallet',
    legend_title: 'Signals',
    legend_vaquita: 'Vaquita — you can donate',
    legend_signal: 'Signal — vote to promote it',
    legend_hint: 'Click a point to see details',
    tx_log: 'Transactions',
    cat_sos: 'SOS — life at risk',
    cat_medical: 'Medical emergency',
    cat_person: 'Person / reunification',
    cat_hazard: 'Hazard or access',
    cat_coordination: 'Coordination',
    status_signal: 'Coordination signal',
    status_community: 'Community Vaquita',
    status_vaquita: 'Verified Vaquita',
    status_short_signal: 'signal',
    status_short_community: 'community',
    status_short_vaquita: 'vaquita',
    close: 'Close',
    location_approx: 'Approximate location',
    coords_fuzzed: 'fuzzed coordinates',
    people_reported: '{n} people reported',
    people_short: '{n} people',
    people_missing: 'people not reported',
    signal_id: 'Signal {id}…',
    no_date: 'no date',
    connect_wallet: 'Connect wallet (Freighter)',
    balance: 'Balance:',
    community_vote: 'Community vote',
    vote_cta: 'Vote to elevate to Community Vaquita',
    vote_cooldown: 'Next vote in {t}',
    vote_note:
      'Your vote is a testnet transaction signed by your wallet (1 every 5 min). Production will require KYC or wallet age against Sybil attacks.',
    vote_view_tx: 'View your vote on-chain',
    donation: 'Donation',
    donate_cta: 'Donate {n} XLM',
    donate_cta_empty: 'Donate — XLM',
    donate_note:
      'Real testnet: the XLM payment goes to the Vaquita pool with the incident memo, signed by your Freighter (must be in Testnet mode).',
    donate_view_tx: 'View transaction on Stellar Expert',
    donate_disabled:
      'Donations are enabled once the signal is promoted to Vaquita (community votes or VACA verification).',
    verified_note:
      'Verified by VACA curation — verification certifies the signal, it does not guarantee an institutional response.',
    amount_aria: 'XLM amount',
    err_freighter: 'Freighter not installed',
    err_denied: 'Access denied',
    err_wallet: 'Could not connect wallet',
    err_vote: 'Vote could not be recorded',
    err_amount: 'Invalid amount — use a positive number',
    err_donate: 'Donation failed',
    cards_title: 'Signals & Vaquitas',
    cards_back_map: 'Back to map',
    filter_all_regions: 'Chile — all regions',
    filter_all: 'All',
    filter_vaquitas: 'Vaquitas',
    filter_community: 'Community',
    filter_signals: 'Signals',
    cards_empty: 'No signals match this filter.',
    admin_panel_title: 'Vaquita Curation',
    admin_close: 'Close admin panel',
    promote_community: 'To Community',
    promote_vaquita: 'To verified Vaquita',
    demote_signal: 'Back to signal',
    release_aid: 'Release aid',
    release_no_wallet:
      'Cannot release: the signal was created without a reporter wallet.',
    promoted_no_wallet:
      'Promoted. The reporter has no Stellar wallet: no claim.',
    released_ok: 'Aid released: {n} XLM claimable',
    claim_failed: 'Claim failed: {e}',
    update_failed: 'Could not update',
    release_failed: 'Could not release',
    tour1_title: 'Welcome to V.A.C.A.',
    tour1_body:
      'Post-disaster resilience infrastructure on Stellar. We guide you through the full MVP flow, step by step.',
    tour2_title: 'Live Stellar Testnet',
    tour2_body:
      'We connect to the real Stellar test network. Every demo operation is a transaction verifiable in the explorer.',
    tour3_title: 'Disaster hotspots',
    tour3_body:
      'The globe focuses on Chile. Each pulsing hotspot is an affected region; color shows severity (critical, high, medium).',
    tour4_title: 'Start with a region',
    tour4_body:
      'Click a region with a hotspot to open its aid panel. We will walk you through the full donation flow there.',
  },
} as const;

export type StrKey = keyof (typeof STRINGS)['es'];

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Traducción con interpolación `{n}` → vars. */
  t: (key: StrKey, vars?: Record<string, string | number>) => string;
}

const LangContext = createContext<LangCtx | null>(null);
const STORAGE_KEY = 'vaca-lang';

export function LangProvider({ children }: { children: ReactNode }) {
  // 'es' por defecto en SSR/primer paint; el efecto ajusta al idioma real.
  const [lang, setLangState] = useState<Lang>('es');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const detected: Lang = navigator.language.toLowerCase().startsWith('en')
      ? 'en'
      : 'es';
    setLangState(saved === 'en' || saved === 'es' ? saved : detected);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<LangCtx>(
    () => ({
      lang,
      setLang: (l) => {
        setLangState(l);
        localStorage.setItem(STORAGE_KEY, l);
      },
      t: (key, vars) => {
        let out: string = STRINGS[lang][key] ?? STRINGS.es[key] ?? key;
        if (vars) {
          for (const [k, v] of Object.entries(vars)) {
            out = out.replace(`{${k}}`, String(v));
          }
        }
        return out;
      },
    }),
    [lang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangCtx {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang fuera de LangProvider');
  return ctx;
}
