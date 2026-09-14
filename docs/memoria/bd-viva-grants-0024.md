<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (bd-viva-grants-0024.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: bd-viva-grants-0024
description: "14/9 — la BD viva NO tenía el grant de device_id de la 0012: MyInvestor no sincronizaba solo. Cómo leer la BD real desde el SQL Editor y aplicar una migración sin desplegar las 13 funciones"
metadata: 
  node_type: memory
  type: project
  originSessionId: ead8a2c8-7e3d-401c-b100-4145235a3f05
  modified: 2026-09-14T17:47:02.603Z
---

14/9/2026 (OPS-06, «BD viva»): leída la BD real con SELECT en el SQL Editor de Supabase (Chrome del dueño, sesión suya). RLS en las 13 tablas y políticas = repo, pero **la 0012 (`device_id` de `myinvestor_links`) constaba como aplicada y su grant NO estaba** («las dos 0012»). `myinvestorStatus` pide `device_id`, recibía 42501, se lo tragaba → la sync automática de MyInvestor no corría nunca. Arreglado con la **0024** (grant + revoke REFERENCES/TRIGGER/TRUNCATE a anon/authenticated + revoke EXECUTE de `handle_new_user`), aplicada 14/9 y verificada en vivo. Guardián `grants-migraciones`.

**Why:** que una migración conste en `schema_migrations` no prueba que su contenido esté; y el paso «Aplicar migraciones» de `supabase.yml` tiene `continue-on-error`.
**How to apply:**
- Leer la BD: SQL Editor, meter el SQL con `monaco.editor.getModels()[0].setValue(...)` y pulsar Run (teclear con `type` dispara atajos del dashboard y navega). Leer resultados por `[role=gridcell]`, UNA FILA POR COSA (la celda larga se trunca). Probar permisos con `begin; set local role authenticated; …; rollback;` y probar la migración entera igual antes de aplicarla. No sacar el token de `localStorage` para llamar a la API.
- Aplicar: commit a main con cabeza vacía `[skip ci]` y `gh workflow run supabase.yml -f funcion=categorize -f migraciones=si` (función vacía = las 13). Luego verificar en vivo con `has_column_privilege`/`has_table_privilege`, no fiarse del verde.
- Relacionado: [[servidor-al-dia-compara-fechas]], [[ops-06-seguridad-hallazgos]], [[feedback-no-dar-por-hecho]].
