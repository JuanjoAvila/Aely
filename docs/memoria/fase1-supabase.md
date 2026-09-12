<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (fase1-supabase.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: fase1-supabase
description: Decisiones y plan de la migración Fase 1 a Supabase en Mi Cartera
metadata: 
  node_type: memory
  type: project
  originSessionId: e1dc0ffc-f316-4885-bf7c-1e694f8b4d24
---

Mi Cartera arranca **Fase 1: Supabase** (decidido 2026-06-18). Objetivo: multi-dispositivo real (habrá más dispositivos seguro).

Decisiones del usuario:
- **Auth:** magic link por email (Supabase Auth), con RLS por usuario desde el día 1.
- **Alcance:** todo el estado a la nube — gastos en tabla relacional `expenses`, resto (cuentas/inversiones/ajustes) en `app_state` JSONB (una fila por usuario).

Arquitectura: Edge Function `ingest` (reemplaza doPost MacroDroid→Sheet, protegida con INGEST_TOKEN + INGEST_USER_ID, escribe con service role saltando RLS) y `prices` (reemplaza doGetPrices, proxy Finnhub con FINNHUB_KEY secreto, verify_jwt=true). Apps Script se mantiene en paralelo hasta cortar.

Scaffolding ya en repo: `supabase/` (config.toml, migrations/0001_init.sql, functions/ingest, functions/prices) + workflow `.github/workflows/supabase.yml` (deploy automático, gateado por SUPABASE_ACCESS_TOKEN/SUPABASE_PROJECT_REF). Guía completa en docs/SETUP-SUPABASE.md.

Proyecto creado por el usuario (2026-06-18): ref `sfyfjagbnhbplrljpbvh`, URL https://sfyfjagbnhbplrljpbvh.supabase.co. Anon key y secretos de funciones (FINNHUB_KEY, INGEST_TOKEN, INGEST_USER_ID) ya configurados en Supabase. NUNCA pedir/usar la service_role key en el cliente.

Frontend YA cableado (v3.4.0, commit e82ee60): supabase-js por CDN, módulo `cloud` y wiring en App (sesión, botón nube, syncFromCloud, push debounced de app_state, onSync→tabla expenses, fetchPrices→función prices). Offline-first (localStorage si no hay sesión). app_state guarda el estado COMPLETO incluyendo gastos (modelo Y); la tabla expenses es buzón que se mezcla con dedup vía mergeExpenses.

Auth cambiado a **email+contraseña** (v3.5.0) por límite de emails del magic link integrado de Supabase (~2-4/hora, solo pruebas). Requiere DESACTIVAR "Confirm email" en Supabase para signup instantáneo sin email. Magic link sigue en código (cloud.signIn) pero no es el flujo principal.

**Desbloqueo biométrico** (huella/Face ID) añadido vía WebAuthn como candado LOCAL por dispositivo (módulo `bio`, componentes LockScreen + AuthPanel). No verificado en servidor — suficiente para uso personal (él+familia+amigos); subir a passkey completo si sale al mercado. Funciona en PWA instalado por HTTPS, sin APK. LockScreen tiene salida de emergencia ("No puedo desbloquear") para evitar lockout.

mergeExpenses es ADITIVO (nunca borra) tras bug 3.4.1 que borró gastos del Sheet al sincronizar con tabla vacía. Gastos del Sheet recuperables vía INSERT directo en SQL Editor (el endpoint GAS doGet devuelve el mes actual; CORS OK).

Apps Script JUBILADO (v3.8.0): fallback GAS quitado, todo por Supabase con sesión. Fase 0 completa (ajustes con presupuesto, export/import JSON, reset, versión visible; cajón lateral; auto-sync al abrir; pull-to-refresh desactivado). INGEST_TOKEN = `micartera2026clave` (pasó por chat → regenerar algún día; riesgo bajo, solo inserta gastos).

**Fase 4 iniciada (2026-06-18): app nativa Android con Capacitor** para reemplazar MacroDroid (trial ~6 días; quiere multi-usuario sin apps externas). Una PWA NO puede leer notificaciones → hace falta app nativa. Base en repo: package.json, capacitor.config.json (server.url carga la PWA en vivo desde Pages), docs/SETUP-ANDROID.md con NotificationListenerService (Kotlin) que lee la notificación de TR y la POSTea a ingest. Build/pruebas en local con Android Studio (Windows 11). Verificar package real de TR (asumido de.traderepublic.app).

**Caveat single-user de ingest:** hoy mapea todo a INGEST_USER_ID fijo y el token va hardcodeado en el Kotlin. Multi-usuario futuro: la app nativa manda el JWT del usuario e ingest pasa a verify_jwt=true derivando user_id del token. Import histórico del Sheet sigue pendiente.

Plan Free de Supabase: 500MB BD, 50k MAU, 500k invocaciones funciones/mes. Avisos: pausa tras 7 días de inactividad; sin backups automáticos (mitigar con export/import JSON). Ver [[mi-cartera-deploy]].
