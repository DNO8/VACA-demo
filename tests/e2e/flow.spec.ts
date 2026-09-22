import { test, expect } from '@playwright/test';

// El modo ?mock=1 evita llamadas reales a Stellar Testnet (rápido y determinista).
// Los deep-links ?start=1 y ?region=<id> permiten abrir el panel sin clickear el canvas del globo.

test.describe('V.A.C.A. — flujo de la demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('vaca-lang', 'es'));
  });

  test('la web arranca directo en el HUD (sin modal)', async ({ page }) => {
    // ?mock=1 evita Stellar real y desactiva el tour guiado (react-joyride).
    await page.goto('/?legacy=1&mock=1');
    await expect(page.getByText('V.A.C.A.')).toBeVisible();
    // Ya no existe el modal con CTA "Iniciar simulación".
    await expect(page.getByRole('button', { name: /Iniciar simulación/i })).toHaveCount(0);
    await expect(page.getByText(/Señales/i)).toBeVisible();
  });

  test('al cargar (mock) se inicializa la Testnet automáticamente', async ({ page }) => {
    await page.goto('/?legacy=1&mock=1');
    // Sin clicks: la simulación arranca sola y la red queda lista.
    await expect(page.getByText('Testnet lista')).toBeVisible();
    await expect(page.getByRole('button', { name: /Reiniciar/i })).toBeVisible();
  });

  test('región sin catástrofe muestra "Sin alerta activa"', async ({ page }) => {
    await page.goto('/?legacy=1&start=1&region=1&mock=1'); // Tarapacá: sin catástrofe
    await expect(page.getByRole('heading', { name: 'Tarapacá' })).toBeVisible();
    await expect(page.getByText(/Sin alerta activa/i)).toBeVisible();
  });

  test('flujo completo de ayuda en una región afectada (Valparaíso)', async ({ page }) => {
    await page.goto('/?legacy=1&start=1&region=5&mock=1');

    // Cabecera del panel
    await expect(page.getByRole('heading', { name: 'Valparaíso' })).toBeVisible();
    await expect(page.getByText(/Crítico/)).toBeVisible();
    await expect(page.getByText('Testnet lista')).toBeVisible();

    // 1 · Verdad emergente: validar catastro
    await expect(page.getByText(/reportes comunitarios/i)).toBeVisible();
    await page.getByRole('button', { name: /Validar catastro comunitario/i }).click();
    await expect(page.getByText(/capa de ayuda activada/i)).toBeVisible();
    await expect(page.getByText('Confianza 100%')).toBeVisible();

    // 2 · Wallet multifirma 2-de-2
    await page.getByRole('button', { name: /Activar wallet multifirma/i }).click();
    await expect(page.getByText(/Cuenta 2-de-2 activa/i)).toBeVisible();

    // 3 · Tokenizar una necesidad
    await page.getByRole('button', { name: 'Tokenizar', exact: true }).first().click();
    await expect(page.getByText('Emitido').first()).toBeVisible();

    // 4 · Donar USDC al pool
    await page.getByRole('button', { name: 'Donar', exact: true }).click();
    await expect(page.getByText(/Pool del evento:/i)).toBeVisible();

    // 5 · Liberar 2-de-2 + Proof of Aid
    await page.getByRole('button', { name: /Liberar y entregar ayuda/i }).click();
    await expect(page.getByText(/Proof of Aid registrado/i)).toBeVisible();

    // Registro de transacciones (dashboard de transparencia)
    await expect(page.getByText(/Transacciones/i)).toBeVisible();
    await expect(page.getByText(/Beneficiario reclamó la ayuda/i)).toBeVisible();
  });

  test('los pasos están bloqueados hasta validar el catastro', async ({ page }) => {
    await page.goto('/?legacy=1&start=1&region=8&mock=1'); // Biobío
    await expect(page.getByRole('heading', { name: 'Biobío' })).toBeVisible();
    // El botón de wallet existe pero su sección está deshabilitada (pointer-events-none)
    const walletBtn = page.getByRole('button', { name: /Activar wallet multifirma/i });
    await expect(walletBtn).toBeVisible();
    // Forzar el click no debe activar la wallet (sección deshabilitada)
    await walletBtn.click({ force: true });
    await expect(page.getByText(/Cuenta 2-de-2 activa/i)).toHaveCount(0);
  });
});
