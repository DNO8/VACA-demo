import type { Metadata, Viewport } from 'next';
import './globals.css';
import ErrorBoundary from '@/components/ErrorBoundary';
import { LangProvider } from '@/lib/i18n';
import { Analytics } from '@vercel/analytics/next';

export const viewport: Viewport = {
  themeColor: '#D4AF37',
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
};

export const metadata: Metadata = {
  title: 'V.A.C.A. — Resiliencia humanitaria sobre Stellar',
  description:
    'Plataforma de logística humanitaria post-catástrofe: tokeniza necesidades, distribuye USDC con Claimable Balances y emite Proof of Aid verificable en Stellar Testnet. Simulación enfocada en las regiones de Chile.',
  applicationName: 'V.A.C.A.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" dir="ltr">
      <body className="antialiased">
        <ErrorBoundary name="VACA Core">
          <LangProvider>{children}</LangProvider>
          <Analytics />
        </ErrorBoundary>
      </body>
    </html>
  );
}
