#!/usr/bin/env bash
# Prepara Aely en un Cloud Agent. Es la fase `install` de .cursor/environment.json:
# se ejecuta tras el checkout para refrescar dependencias y estado derivado del código.
# TIENE que ser idempotente y terminar sola (lo exige el build de entornos): nada de
# servidores en primer plano aquí — el server de estáticos vive en `terminals`.
set -euo pipefail

cd "$(dirname "$0")/.."

# 1. Dependencias de Node: build-app, Playwright y el CLI de Capacitor. Manda el lockfile.
npm ci

# 2. Deno v2 para los tests de las Edge Functions de Supabase (ingest, crypto, delete-account).
#    scripts/run-tests.mjs lo invoca como `deno` a secas —si falta, se los salta en silencio—,
#    así que lo dejamos en el PATH. El check hace que relanzar el install no reinstale.
if ! command -v deno >/dev/null 2>&1; then
  curl -fsSL https://deno.land/install.sh | DENO_INSTALL="$HOME/.deno" sh
  sudo ln -sf "$HOME/.deno/bin/deno" /usr/local/bin/deno
fi

# 3. Navegador de Playwright para los e2e (todo corre en viewport de móvil, Pixel 5). Se baja
#    una vez a ~/.cache/ms-playwright; `playwright install` no vuelve a bajarlo si ya está.
npx playwright install chromium

# 4. Ensambla public/index.html desde src/ para que el server sirva la versión recién construida.
npm run build
