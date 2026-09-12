<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (git-rama-y-tag-beta.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: git-rama-y-tag-beta
description: "⚠ En este repo hay RAMA `beta` y TAG `beta`: cualquier orden de git que reciba «beta» a secas es una lotería. Usar refs/heads/beta siempre. Y nunca un reset --hard en la misma línea que la orden que lo protege."
metadata: 
  node_type: memory
  type: project
  originSessionId: d64723ea-b951-4246-9d31-198411affbbe
  modified: 2026-09-12T10:15:24.690Z
---

**2026-09-12.** `git push origin beta` falla con *«error: src refspec beta matches more than one»*.
No es un fallo: en este repo existen las dos cosas con el mismo nombre.

- **rama `beta`** → el canal de pruebas de su familia, donde va todo antes de `main`.
- **tag `beta`** → la **GitHub Release que sirve el OTA** (`beta.yml:149,179`, `salud.mjs:82`). Es la
  trampa nº 1 de `EMPIEZA-AQUI.md` y ya hubo tres intentos míos de borrarlo
  ([[feedback-consenso-de-las-tres-ias]]).

**Why:** la ambigüedad no se queda en `push`. El mismo día me mordió al **crear una rama**:
`git branch fix/algo` salió con *«fatal: ambiguous object name: 'beta'»*. Y eso fue lo caro,
porque iba encadenado con un `git reset --hard origin/beta` que **corrió igual** y se llevó un
commit por delante. Se recuperó del `reflog` (`HEAD@{1}`), pero el susto sobra.

**How to apply:**
- **Siempre la ref completa**, no solo en push: `refs/heads/beta`. La forma que funciona para subir es
  `git push origin refs/heads/beta:refs/heads/beta`.
- **Nunca un `reset --hard` (ni un `checkout -f`) en la misma línea que la orden que lo protege.**
  Si la primera falla, el salto se ejecuta de todas formas. Una orden destructiva va sola, y
  después de comprobar que la red de seguridad EXISTE.
- ⚠ **Y el código de salida detrás de un pipe es el del último proceso.** `git push … | tail -3`
  seguido de `echo $?` da **0** aunque el push haya fallado: casi canto una subida como buena
  estando rota. Capturar `$?` justo después del comando, o redirigir a fichero y leerlo
  ([[feedback-no-dar-por-hecho]]).
- Antes de dar por publicado, `npm run salud` **o** el `version.json` del canal:
  `https://github.com/JuanjoAvila/Aely/releases/download/beta/version.json`. Push ≠ Pages.
