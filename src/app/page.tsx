'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Globe2, RotateCcw, ExternalLink, Radio, Activity, LayoutGrid, ShieldCheck } from 'lucide-react';
import RegionPanel, { TxEntry } from '@/components/RegionPanel';
import VaquitaAside from '@/components/VaquitaAside';
import VaquitaCards from '@/components/VaquitaCards';
import AdminPanel from '@/components/AdminPanel';
import type { Step } from '@/components/Tour';
import { getDisaster, SEVERITY_COLOR, REGION_NAMES } from '@/lib/chile';
import { DemoAccounts, setupDemo, explorerTx } from '@/lib/stellar';
import { AdminSession, connectAdmin } from '@/lib/admin';
import {
  VaquitaIncident,
  VaquitaFilter,
  fetchVaquitas,
  filterVaquitas,
  regionOfPoint,
  MOCK_INCIDENTS,
} from '@/lib/vaquitas';

const VacaGlobe = dynamic(() => import('@/components/VacaGlobe'), { ssr: false });
const Tour = dynamic(() => import('@/components/Tour'), { ssr: false });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const COMMUNITY_VOTE_THRESHOLD = 20;

interface SelectedRegion {
  id: number;
  name: string;
  center: [number, number];
}

// ── Pasos del tour guiado (react-joyride) ──
const OVERVIEW_STEPS: Step[] = [
  {
    target: '[data-tour="brand"]',
    title: 'Bienvenido a V.A.C.A.',
    content:
      'Infraestructura de resiliencia post-catástrofe sobre Stellar. Te guiamos por el flujo completo del MVP, paso a paso.',
    placement: 'bottom-start',
  },
  {
    target: '[data-tour="status"]',
    title: 'Stellar Testnet en vivo',
    content:
      'Conectamos a la red de prueba real de Stellar. Cada operación de la demo es una transacción verificable en el explorador.',
    placement: 'bottom-end',
  },
  {
    target: '[data-tour="legend"]',
    title: 'Focos de catástrofe',
    content:
      'El globo enfoca Chile. Cada foco pulsante es una región afectada; el color indica la severidad (crítico, alto o medio).',
    placement: 'top-start',
  },
  {
    target: 'body',
    title: 'Empieza por una región',
    content:
      'Haz clic en una región con foco para abrir su panel de ayuda. Allí te explicaremos el flujo completo de la donación.',
    placement: 'center',
  },
];

const PANEL_STEPS: Step[] = [
  {
    target: '[data-tour="panel-header"]',
    title: 'Panel de la región',
    content:
      'Aquí ves el detalle de la catástrofe: tipo de evento, severidad y personas damnificadas. Sigue los 5 pasos para entregar ayuda.',
    placement: 'left',
  },
  {
    target: '[data-tour="catastro"]',
    title: '1 · Verdad emergente',
    content:
      'Validamos el catastro cruzando reportes comunitarios. Al validar, la confianza llega al 100% y se activa la capa de ayuda.',
    placement: 'left',
  },
  {
    target: '[data-tour="wallet"]',
    title: '2 · Wallet multifirma',
    content:
      'Cada evento abre su propia cuenta 2-de-2: requiere la firma de la Plataforma y la Municipalidad para liberar fondos (anti-fraude).',
    placement: 'left',
  },
  {
    target: '[data-tour="tokenize"]',
    title: '3 · Tokenizar necesidades',
    content:
      'Cada necesidad (agua, alimentos, abrigo…) se emite como un asset en Stellar Testnet, trazable de punta a punta.',
    placement: 'left',
  },
  {
    target: '[data-tour="donate"]',
    title: '4 · Donar al pool',
    content:
      'Las donaciones en USDC entran al pool multifirma del evento. Define el monto y dona; el saldo del pool se actualiza al instante.',
    placement: 'left',
  },
  {
    target: '[data-tour="proof"]',
    title: '5 · Liberar + Proof of Aid',
    content:
      'Con doble firma se libera la ayuda vía Claimable Balance; el beneficiario la reclama y se genera el Proof of Aid verificable.',
    placement: 'left',
  },
  {
    target: 'body',
    title: 'Transparencia total',
    content:
      'Cada acción genera transacciones que aparecen abajo a la derecha y enlazan al explorador de Stellar. ¡Explora libremente!',
    placement: 'center',
  },
];

export default function Home() {
  // La simulación arranca directamente (sin modal): el globo vuela a Chile.
  const [started] = useState(true);
  const [selected, setSelected] = useState<SelectedRegion | null>(null);
  const [accounts, setAccounts] = useState<DemoAccounts | null>(null);
  const [setupMsg, setSetupMsg] = useState('');
  const [txLog, setTxLog] = useState<TxEntry[]>([]);

  // Tour guiado (react-joyride): fase 'overview' (globo/HUD) y fase 'panel' (flujo de ayuda).
  const [tourPhase, setTourPhase] = useState<'idle' | 'overview' | 'panel'>('idle');
  const [panelTourPending, setPanelTourPending] = useState(false);
  const [panelTourShown, setPanelTourShown] = useState(false);

  // ── Vaquita: feed público de señales (real o mock) ──
  const [incidents, setIncidents] = useState<VaquitaIncident[]>([]);
  const [geojson, setGeojson] = useState<any>(null);
  const [selectedIncident, setSelectedIncident] = useState<VaquitaIncident | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'cards'>('map');
  const [filter, setFilter] = useState<VaquitaFilter>({
    regionId: null,
    donationStatus: null,
  });
  // Curaduria — wallet admin real (Freighter) verificada por el servidor.
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminError, setAdminError] = useState('');

  const loadFeed = useCallback(async () => {
    const useMock =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('mock');
    const rows =
      useMock || !SUPABASE_URL
        ? MOCK_INCIDENTS
        : await fetchVaquitas(SUPABASE_URL);
    setIncidents(rows.length ? rows : MOCK_INCIDENTS);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/chile-regions.geojson')
      .then((r) => r.json())
      .then((g) => !cancelled && setGeojson(g))
      .catch(() => {});
    loadFeed().then(() => cancelled && void 0);
    return () => {
      cancelled = true;
    };
  }, [loadFeed]);

  const handleAdminConnect = useCallback(async () => {
    setAdminError('');
    try {
      const session = await connectAdmin(SUPABASE_URL);
      setAdminSession(session);
      setAdminOpen(true);
    } catch (e: any) {
      setAdminError(e?.message ?? 'No se pudo conectar la wallet');
    }
  }, []);

  // El toast de error se auto-descarta a los 5 s.
  useEffect(() => {
    if (!adminError) return;
    const t = setTimeout(() => setAdminError(''), 5000);
    return () => clearTimeout(t);
  }, [adminError]);

  const visibleIncidents = useMemo(
    () => filterVaquitas(incidents, geojson, filter),
    [incidents, geojson, filter],
  );

  const handleIncidentClick = useCallback((incident: VaquitaIncident) => {
    setSelectedIncident(incident);
    setSelected(null);
  }, []);

  // Voto comunitario (mock): acumula localmente; al umbral promueve a
  // Vaquita Comunitaria. La barrera anti-Sybil real queda para el backend.
  const handleVote = useCallback((id: string) => {
    setIncidents((list) =>
      list.map((i) => {
        if (i.id !== id) return i;
        const votes = i.votes + 1;
        return {
          ...i,
          votes,
          donationStatus:
            votes >= COMMUNITY_VOTE_THRESHOLD ? 'community' : i.donationStatus,
        };
      }),
    );
    setSelectedIncident((cur) =>
      cur && cur.id === id ? { ...cur, votes: cur.votes + 1 } : cur,
    );
  }, []);

  // Deep-links (usados por los tests E2E): ?region=<id>.
  // El tour solo corre en una visita normal (sin parámetros de demo/tests).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    const r = p.get('region');
    if (r && REGION_NAMES[Number(r)]) {
      const id = Number(r);
      setSelected({ id, name: REGION_NAMES[id], center: [0, 0] });
    }
    const skipTour = p.has('start') || p.has('region') || p.has('mock') || p.has('notour');
    if (!skipTour) {
      setTourPhase('overview');
      setPanelTourPending(true);
    }
  }, []);

  // Lanza el tour del panel la primera vez que se abre una región con catástrofe.
  useEffect(() => {
    if (tourPhase !== 'idle' || !panelTourPending || panelTourShown) return;
    if (selected && getDisaster(selected.id)) {
      const t = setTimeout(() => {
        setTourPhase('panel');
        setPanelTourShown(true);
        setPanelTourPending(false);
      }, 450);
      return () => clearTimeout(t);
    }
  }, [selected, tourPhase, panelTourPending, panelTourShown]);

  const handleTourFinish = useCallback(() => setTourPhase('idle'), []);

  // Flujo legacy (pool multifirma / Proof of Aid): solo con ?legacy=1.
  const [legacyMode] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('legacy'),
  );

  // Inicializa cuentas demo al arrancar la simulación
  useEffect(() => {
    if (!started || !legacyMode || accounts) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await setupDemo((m) => !cancelled && setSetupMsg(m));
        if (!cancelled) {
          setAccounts(res.accounts);
          setSetupMsg('');
        }
      } catch (e: any) {
        if (!cancelled) setSetupMsg('Error inicializando Testnet: ' + (e?.message ?? ''));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [started, accounts]);

  const handleRegionClick = useCallback((id: number, name: string, center: [number, number]) => {
    setSelected({ id, name, center });
  }, []);

  const handleTx = useCallback((entry: TxEntry) => {
    setTxLog((log) => [entry, ...log].slice(0, 12));
  }, []);

  const handleReset = useCallback(() => {
    setSelected(null);
    setTxLog([]);
  }, []);

  const disaster = selected ? getDisaster(selected.id) ?? null : null;

  return (
    <main className="vaca-grain relative h-dvh w-screen overflow-hidden bg-[var(--bg-void)] text-[var(--text-primary)]">
      {/* Fondo atmosférico Soft Club */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--bg-tertiary),_transparent_60%)] opacity-60" />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-[radial-gradient(ellipse_at_bottom,_var(--cyan-primary),_transparent_70%)] opacity-10" />
        <div className="absolute right-0 top-1/4 h-96 w-96 rounded-full bg-[var(--gold-primary)] opacity-[0.07] blur-[120px]" />
      </div>

      {/* Globo */}
      <VacaGlobe
        started={started}
        legacy={legacyMode}
        selectedRegionId={selected?.id ?? null}
        onRegionClick={handleRegionClick}
        incidents={visibleIncidents}
        onIncidentClick={handleIncidentClick}
      />

      {/* HUD superior */}
      <header className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-start justify-between p-3 md:p-4">
        <div data-tour="brand" className="pointer-events-auto flex items-center gap-2.5">
          <div className="vaca-soft-blur flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-active)] bg-[var(--bg-panel)]">
            <Globe2 size={18} className="text-[var(--gold-primary)]" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-wide text-[var(--text-heading)]">
              V.A.C.A.
            </div>
            <div className="hidden text-[10px] uppercase tracking-widest text-[var(--text-muted)] sm:block">
              Resiliencia humanitaria · Stellar
            </div>
          </div>
        </div>

        {started && (
          <div data-tour="status" className="pointer-events-auto flex flex-wrap items-center justify-end gap-1.5 md:gap-2">
            <StatusPill accounts={accounts} setupMsg={setupMsg} />
            <button
              onClick={
                adminSession
                  ? () => setAdminOpen((o) => !o)
                  : handleAdminConnect
              }
              className="vaca-soft-blur flex items-center gap-1 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-panel)] px-2 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)] md:px-3 md:py-2 md:text-xs"
              title={adminError || 'Curaduría (wallet admin)'}
            >
              <ShieldCheck size={12} className="md:hidden" />
              <ShieldCheck size={13} className="hidden md:block" />
              <span className="hidden md:inline">
                {adminSession ? 'Curaduría' : 'Admin'}
              </span>
            </button>
            <button
              onClick={() =>
                setViewMode((m) => (m === 'map' ? 'cards' : 'map'))
              }
              className="vaca-soft-blur flex items-center gap-1 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-panel)] px-2 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)] md:px-3 md:py-2 md:text-xs"
            >
              <LayoutGrid size={12} className="md:hidden" />
              <LayoutGrid size={13} className="hidden md:block" />
              <span className="hidden md:inline">
                {viewMode === 'map' ? 'Panel' : 'Mapa'}
              </span>
            </button>
            <button
              onClick={handleReset}
              className="vaca-soft-blur flex items-center gap-1 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-panel)] px-2 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)] md:px-3 md:py-2 md:text-xs"
            >
              <RotateCcw size={12} className="md:hidden" />
              <RotateCcw size={13} className="hidden md:block" />
              <span className="hidden md:inline">Reiniciar</span>
            </button>
          </div>
        )}
      </header>

      {/* Leyenda inferior */}
      {started && !selected && (
        <div data-tour="legend" className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-panel)] p-2.5 backdrop-blur md:bottom-4 md:left-4 md:p-3">
          <div className="mb-1.5 text-[10px] uppercase tracking-widest text-[var(--text-muted)] md:mb-2">
            Señales
          </div>
          <div className="space-y-1 md:space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] md:gap-2 md:text-[11px]">
              <span
                className="h-2.5 w-2.5 rounded-full md:h-3 md:w-3"
                style={{ background: '#F5C542', boxShadow: '0 0 10px #F5C542' }}
              />
              Vaquita — podés donar
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] md:gap-2 md:text-[11px]">
              <span className="flex gap-0.5">
                {['#F0544F', '#F5C542', '#5CB8E4', '#C86BF0'].map((c) => (
                  <span
                    key={c}
                    className="h-1.5 w-1.5 rounded-full md:h-2 md:w-2"
                    style={{ background: c }}
                  />
                ))}
              </span>
              Señal — vota para promoverla
            </div>
          </div>
          <div className="mt-1.5 hidden border-t border-[var(--border-secondary)] pt-1.5 text-[10px] text-[var(--text-muted)] md:block">
            Haz clic en un punto para ver el detalle
          </div>
        </div>
      )}

      {/* Registro de transacciones */}
      {started && txLog.length > 0 && (
        <div className="pointer-events-auto absolute bottom-24 right-3 z-20 w-64 max-w-[calc(100vw-1.5rem)] rounded-lg border border-[var(--border-primary)] bg-[var(--bg-panel)] p-2.5 backdrop-blur md:bottom-4 md:right-12 md:w-72 md:p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[var(--text-muted)] md:mb-2">
            <Activity size={12} className="text-[var(--cyan-primary)]" /> Transacciones
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto md:max-h-48 md:space-y-1.5">
            {txLog.map((t, i) => (
              <a
                key={i}
                href={explorerTx(t.hash)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-2 rounded border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-2 py-1 text-[11px] transition hover:border-[var(--border-active)] md:py-1.5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[var(--text-primary)]">{t.label}</span>
                  <span className="block truncate text-[10px] text-[var(--text-muted)]">
                    {t.regionName}
                  </span>
                </span>
                <ExternalLink size={12} className="shrink-0 text-[var(--text-muted)]" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Panel lateral de región (flujo legacy, ?legacy=1) */}
      <div
        className={`absolute right-0 top-0 z-30 h-dvh w-full transform transition-transform duration-300 md:w-1/4 md:min-w-[340px] md:max-w-[460px] ${
          selected && legacyMode ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {selected && legacyMode && (
          <RegionPanel
            regionName={selected.name}
            disaster={disaster}
            accounts={accounts}
            onClose={() => setSelected(null)}
            onTx={handleTx}
          />
        )}
      </div>

      {/* Aside del incidente seleccionado */}
      {selectedIncident && viewMode === 'map' && (
        <VaquitaAside
          incident={selectedIncident}
          regionName={
            selectedIncident.latitude != null &&
            selectedIncident.longitude != null &&
            geojson
              ? regionOfPoint(
                  geojson,
                  selectedIncident.longitude,
                  selectedIncident.latitude,
                )?.name ?? null
              : null
          }
          voteThreshold={COMMUNITY_VOTE_THRESHOLD}
          onVote={handleVote}
          onClose={() => setSelectedIncident(null)}
        />
      )}

      {/* Vista en panel de cards */}
      {viewMode === 'cards' && (
        <VaquitaCards
          incidents={visibleIncidents}
          geojson={geojson}
          filter={filter}
          onFilterChange={setFilter}
          onSelect={(incident) => {
            setSelectedIncident(incident);
            setViewMode('map');
          }}
          onClose={() => setViewMode('map')}
        />
      )}

      {/* Panel de curaduria (wallet admin) */}
      {adminSession && adminOpen && (
        <AdminPanel
          session={adminSession}
          supabaseUrl={SUPABASE_URL}
          incidents={incidents}
          onChanged={loadFeed}
          onClose={() => setAdminOpen(false)}
        />
      )}

      {/* Error de conexión admin */}
      {adminError && !adminSession && (
        <div className="absolute bottom-3 left-1/2 z-40 -translate-x-1/2 rounded-lg border border-red-400/40 bg-[var(--bg-panel)] px-3 py-2 text-xs text-red-400">
          {adminError}
        </div>
      )}

      {/* Tour guiado paso a paso */}
      {tourPhase !== 'idle' && (
        <Tour
          steps={tourPhase === 'overview' ? OVERVIEW_STEPS : PANEL_STEPS}
          run
          onFinish={handleTourFinish}
        />
      )}
    </main>
  );
}

function StatusPill({ accounts, setupMsg }: { accounts: DemoAccounts | null; setupMsg: string }) {
  const ok = !!accounts;
  return (
    <div className="vaca-soft-blur flex items-center gap-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-panel)] px-3 py-2 text-xs">
      <Radio
        size={13}
        className={ok ? 'text-[var(--alert-green)]' : 'animate-pulse text-[var(--gold-primary)]'}
      />
      <span className="text-[var(--text-secondary)]">
        {ok ? 'Testnet lista' : setupMsg || 'Conectando Testnet…'}
      </span>
    </div>
  );
}
