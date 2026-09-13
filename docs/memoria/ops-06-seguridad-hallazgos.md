<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (ops-06-seguridad-hallazgos.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: ops-06-seguridad-hallazgos
description: "Auditoría de seguridad del 13–14/9 — el token de ingest iba dentro de la APK pública, códigos de Hogar adivinables, app_events sin tope; qué está cerrado y qué falta antes de la Play Store"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7fd7cd78-dc13-40b7-b03e-17cda8686805
  modified: 2026-09-13T18:46:48.603Z
---

Encargo suyo (12–13/9): «destrózala… intentando hackearla» antes de la Play Store, y «mirarlo bien Cursor y tú y arreglármelo». Informe vivo: `docs/briefs/ops-06-seguridad-auditoria-repo.md`.

- **P0 (cerrado en servidor el 14/9):** `INGEST_URL` con `?token=` iba en `defaultConfig` del gradle → también en release → la APK de un repo PÚBLICO llevaba el token legacy del dueño. Además `TrExpenseListener` caía a ese BuildConfig si el móvil no tenía token propio (un familiar podía mandarle sus gastos). Código arreglado (solo debug la lleva, `release:apk` aborta). Él hizo TR off/on y **borró `INGEST_TOKEN` e `INGEST_USER_ID`**. Falta la **APK 46**.
- **P1 Hogar:** códigos de 6 con `Math.random` + `join_household_by_code` sin freno → migración 0022 + códigos de 10 con crypto (4.20.2).
- **P2 app_events:** sin tope → migración 0023 (4.20.2).
- **Pendiente:** `allowBackup="true"`, instalador propio (Play lo prohíbe), comprobar la BD viva (`pg_policies`, necesita SQL Editor y su OK), `localStorage`, Edge sin sesión (SEC-01).

**Why:** con usuarios de fuera, cada uno de estos deja de ser un susto en familia.
**How to apply:** antes de cada APK, `grep INGEST_URL` en el BuildConfig de release debe dar vacío; cualquier secreto en `local.properties` NUNCA en `defaultConfig`. Ver [[promote-4-19-106-como-se-hizo]].
