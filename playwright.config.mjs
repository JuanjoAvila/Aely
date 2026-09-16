import { defineConfig, devices } from "@playwright/test";
import crypto from "node:crypto";

// Algunos entornos (contenedores de CI, Claude Code en la web) traen Chromium ya instalado en
// una ruta fija y sin el `headless shell` que espera la versión de Playwright del package.json.
// Con PLAYWRIGHT_CHROMIUM_PATH apuntamos al binario existente en vez de fallar con
// «Executable doesn't exist» (pasó al montar el entorno de pruebas — 2026-07-24).
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const launchOptions = chromiumPath ? { executablePath: chromiumPath } : {};

/* ⚠ UN PUERTO POR CHECKOUT (2026-09-10). Antes era 4173 fijo con `reuseExistingServer` CIEGO: no
   comprueba QUÉ hay detrás del puerto, solo que responde. Con varios worktrees a la vez —que es
   como trabajamos desde que somos tres— el primero que arranca se queda el 4173 y **los demás
   corren los e2e contra el bundle de otro checkout**.

   Cómo se cazó, el 10/9: un test falló con `mcSeedSandboxVacio is not defined`, una función que
   lleva en beta desde la 4.19.21. El proceso del puerto era un `serve` del checkout principal.
   El caso peligroso NO es ese: es el contrario. Si dos worktrees se parecen lo suficiente, la
   suite pasa ENTERA contra el bundle equivocado y alguien firma «187/187 verificado ejecutando»
   sobre código que no ha ejecutado. Justo lo que aquí está prohibido dar por hecho.

   El puerto sale del `cwd`, así que cada worktree tiene el suyo y el reuse solo puede reutilizar
   un servidor de ESTE checkout. `MC_E2E_PORT` lo fuerza si alguna vez hace falta. */
const PUERTO = process.env.MC_E2E_PORT
  ? Number(process.env.MC_E2E_PORT)
  : 4173 + (parseInt(crypto.createHash("sha1").update(process.cwd()).digest("hex").slice(0, 6), 16) % 300);
const BASE = "http://127.0.0.1:" + PUERTO;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  // Duraciones y resultados de cada intento: permite comparar sin inferir tiempos del log.
  reporter: [["list"], ["json", { outputFile: process.env.MC_E2E_REPORT || "test-results/playwright.json" }]],
  outputDir: process.env.MC_E2E_OUTPUT_DIR || "test-results",
  // La app es móvil-first: si los e2e corren en escritorio se cuelan bugs que solo se ven a
  // 390px (barras que tapan botones, sheets que no caben). Todo se prueba en viewport de móvil.
  use: {
    ...devices["Pixel 5"],
    baseURL: BASE,
    trace: "on-first-retry",
    launchOptions,
  },
  webServer: {
    command: "npx --yes serve public -l " + PUERTO,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    /* 60 s era justo: `npx --yes serve` resuelve el paquete la primera vez, y con la máquina
       cargada la suite entera se caía con 164 `ERR_CONNECTION_REFUSED` que parecían fallos del
       código y eran el servidor sin arrancar (10/9). Un rojo que miente cuesta más que dos
       minutos de espera. */
    timeout: 180_000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
