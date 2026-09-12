<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (mi-cartera-deploy.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: mi-cartera-deploy
description: Cómo se despliega Mi Cartera y dónde vive la fuente única del frontend
metadata: 
  node_type: memory
  type: project
  originSessionId: e1dc0ffc-f316-4885-bf7c-1e694f8b4d24
  modified: 2026-07-26T17:42:52.556Z
---

Mi Cartera es una PWA estática (React vía createElement, sin build/JSX) en GitHub Pages. Repo **público** (Pages gratis lo exige) → nunca meter secretos en el cliente.

**Fuente única del frontend:** `public/index.html` (artefacto único inlineado, ARQUITECTURA.md #2). GitHub Actions (`.github/workflows/deploy.yml`) despliega SOLO la carpeta `public/`. **No crear un `index.html` en la raíz**: hubo un duplicado raíz que se editaba por error y dejaba `public/` atrasado — un fix de TR no llegó al móvil hasta consolidar (v3.3.1, 2026-06-18). Edita siempre `public/index.html`.

El **Service Worker** es **stale-while-revalidate desde v3.71.0** (antes network-first): arranque instantáneo desde caché, la versión fresca baja en segundo plano y se ve en el siguiente arranque (sin skipWaiting, sin recargas a media sesión). Su versión se sella en CI (`scripts/stamp-version.mjs` lee `VERSION`) para invalidar caché.

**Pipeline CI desde v3.71.0:** deploy.yml hace stamp-version → **minify** (`scripts/minify-html.mjs`, esbuild whitespace+syntax, NUNCA minifyIdentifiers — los globales tipo `t`/`cloud` no se pueden renombrar) → sube `public/`. La fuente editable sigue siendo `public/index.html` legible. **Sin CDNs de terceros:** supabase-js auto-hospedado y pinneado en `public/vendor/supabase.min.js` (v2.110.0; actualizar = bajar de jsdelivr a mano y probar) y fuentes Manrope/Fraunces variables en `public/fonts/` (@font-face en el <style>). Todo en el SHELL del SW ⇒ offline completo. Un script en <head> aplica el tema desde localStorage ANTES del primer pintado (splash sin fogonazo).

**Apps Script JUBILADO (2026-06-18, v3.8.0):** migrado a Supabase. Borrada la carpeta apps-script/, quitado el fallback GAS de onSync/fetchPrices y las constantes GAS_URL/FIELDS/PRICES_PARAM. La implementación de Google la archivó el usuario. Backend ahora en [[fase1-supabase]]. Versión visible en la app: CONFIG.APP_VERSION, sellada por stamp-version.mjs en CI (igual que sw.js).

**Edge Functions (Supabase) también se autodespliegan:** `.github/workflows/supabase.yml` despliega `supabase/functions/**` al pushear a `main` (path filter `supabase/**`). Requiere secret `SUPABASE_ACCESS_TOKEN` + variable `SUPABASE_PROJECT_REF` (ambos CONFIRMADOS configurados: el deploy salió verde 2026-06-30). Migraciones solo si está el secret `SUPABASE_DB_PASSWORD` (si no, se aplican a mano en el SQL Editor). O sea: un mismo push a `main` despliega web (Pages) y funciones (Supabase) por separado.

⚠ **La versión canónica es el fichero `VERSION` de la raíz, NO `package.json`.** De `VERSION` leen `stamp-version.mjs` (sella `CONFIG.APP_VERSION` y el SW) y el paso OTA de deploy.yml (`version.json`). Bumpear solo `package.json` es un fallo silencioso y venenoso: el deploy sale verde pero `APP_VERSION` no cambia ⇒ el popup de Novedades no dispara (`_seenVersion` ya coincide) y el bundle OTA se publica con la versión que el móvil ya tiene ⇒ el usuario dice «sigo sin ver versión». Pasó en 4.7.1 (2026-07-23). Al versionar tocar SIEMPRE los dos + CHANGELOG + `RELEASE_NOTES` **al principio** del array (el comentario del propio array lo pide; en 4.7.1 se añadió a media lista y con una versión ya usada ⇒ clave duplicada e invisible).

⚠ **`beta` es a la vez RAMA y TAG, y el tag es load-bearing.** El canal de pruebas publica los assets (`bundle.zip`, `version.json`) en una Release con la etiqueta fija `beta` (`.github/workflows/beta.yml`), porque `main` va a Pages y ahí lo ven su padre y su pareja. **No borrar el tag `beta`** aunque apunte a un commit viejo (c28a825, de la 4.7.1): el workflow lo reutiliza. La consecuencia diaria es que `git push origin beta` falla con «src refspec beta matches more than one» → **usar `git push origin refs/heads/beta:refs/heads/beta`**. Lo mismo con `git log beta` («refname 'beta' is ambiguous»): desambiguar con `refs/heads/beta`.

Workflow del usuario: trabaja desde Claude Code, yo hago cambios y push a `main`, CI despliega y su app móvil (enlace a Pages) se actualiza sola. Versiona con bump X.Y.0 en `VERSION` + entrada en CHANGELOG.md (aunque el CHANGELOG se quedó sin entradas entre 3.39 y 3.68; retomado en 3.69.0). **Push DIRECTO al acabar cada tanda (pedido 2026-07-11: «cuando acabes algo, súbelo directamente para probarlo en el móvil») — ya no hace falta esperar a que lo pida.** Tras el push, verificar: `gh run watch` verde + `curl version.json` con la versión nueva. Lo que NO cambia: solo pushear trabajo TERMINADO y verificado (jsdom/tests), nunca a medias.
