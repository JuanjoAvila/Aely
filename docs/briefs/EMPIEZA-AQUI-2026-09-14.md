# EMPIEZA AQUÍ — sesión de la noche del 14/9/2026

Traspaso de la sesión del 13–14/9. Producción pasó de **4.18.25 → 4.19.106 → 4.20.4** en un día, y
beta vuelve a estar vacía. Esto es lo que hay que saber para seguir sin preguntarle nada.

---

## 0. LOS CUATRO COMANDOS, ANTES DE TOCAR NADA

    npm run salud
    node scripts/errores.mjs --kind=beta --limit=20
    node scripts/errores.mjs --kind=feedback --limit=20
    node scripts/errores.mjs --kind=hist

Buzón con Cursor: `.claude/canal-equipo/messages/cursor` (gitignored; los JSON pueden llevar BOM).
**Arma el watcher del buzón al empezar** (Monitor sobre esa carpeta), no cuando él lo recuerde.

## 1. CÓMO SE TRABAJA (no opcional)

- **Todo pasa por Cursor por el buzón**: diagnóstico → voto → picar → review EJECUTANDO → beta.
- **Worktree propio** para cada tanda (`git worktree add -b tanda/x .claude/worktrees/claude-x refs/remotes/origin/beta`
  + junction de `node_modules`). **Dos agentes llegaron a editar el MISMO worktree** el 13/9: di por el
  buzón de quién es cada uno.
- **Beta sin preguntar; main solo con su OK.** Escribir poco.
- **Nunca editar con PowerShell** (Cursor dejó `build.gradle` con mojibake). En heredoc de bash las `\`
  se pierden: para regex, herramienta Edit. Revisa `grep -c "Ã\|â€"` en cada diff ajeno.

## 2. ESTADO AL CERRAR

| | |
|---|---|
| producción (`main`) | **4.20.4** (ver §3 si el promote quedó a medias) |
| beta | vacía, mismo SHA que main |
| siguiente versión de código | **4.21.0** (él pidió resetear la numeración de beta) |
| APK | 45 en la calle; **la 46 hace falta** (§4) |

## 3. CÓMO SE PROMOCIONA AHORA (lo aprendido, repetirlo tal cual)

Memoria: `promote-4-19-106-como-se-hizo`. Resumen:
1. Si `main` tiene commits que `beta` no → portar lo que falte y `merge -s ours origin/main`. Nunca `-X theirs`.
2. **Nota única** para la familia: juntar las notas de la ronda en UNA entrada; todas con `tandas:[]`.
3. **Push a main con commit vacío `[skip ci]`**: `supabase.yml` despliega las 13 funciones + migraciones en
   cualquier push que toque `supabase/**`. Luego `gh workflow run deploy.yml --ref main`.
4. Verificar **por contenido** `/Aely/` (index `APP_VERSION`, version.json, bundle.zip, release-notes, apk.json).
5. **Puente** `JuanjoAvila/Mi-Cartera`: copiar `version.json`, `bundle.zip`, `apk.json` de `/Aely/` y comprobar `/Mi-Cartera/`.
6. `beta` al mismo SHA + `gh workflow run beta.yml --ref beta`.
7. Edge de una en una: `gh workflow run supabase.yml --ref main -f funcion=X -f migraciones=no`.

## 4. SEGURIDAD (OPS-06) — `docs/briefs/ops-06-seguridad-auditoria-repo.md`

- **P0 token de ingest en la APK pública**: código arreglado (release sin `INGEST_URL`, fallback solo DEBUG,
  `release:apk` aborta si no está vacía). **Él ya hizo TR off/on y BORRÓ `INGEST_TOKEN` e `INGEST_USER_ID`**:
  el token de las APK 44/45 ya no vale. Falta **compilar y publicar la APK 46** (`npm run release:apk`, con su
  OK) para que la nativa quede limpia. ⚠ La `.debug` ya no puede usar el token legacy: normal.
- **P1 Hogar**: códigos de 10 + freno (migración 0022). **P2 app_events**: topes (0023). Se aplican con el
  promote 4.20.4 (`supabase.yml --ref main -f funcion=categorize -f migraciones=si`). Comprobar que un hogar
  con código viejo de 6 sigue entrando.
- **Pendiente**: `allowBackup="true"` (va con APK), instalador propio vs Play Store (DEC-01), BD viva
  (`pg_policies`) necesita SQL Editor y su OK, `localStorage`, SEC-01 (Edge sin sesión).

## 5. LO SIGUIENTE (por orden)

1. **Cuotas de deudas en Gastos** — `docs/briefs/brief-categorias-por-deudas.md`. **Él decidió**: categoría
   «Deudas» + filtro por cada deuda; NO cuenta en gastado; histórico en 2ª tanda. Con los 4 apuntes de Cursor
   del brief. Espejo en servidor (`cuentaParaPresupuesto`). Tanda 4.21.0.
2. **APK 46** (seguridad nativa + `allowBackup`), con su OK.
3. **Verificar en su OnePlus la degradación de Gastos (4.21 ya lleva 4.20.1)**: la `.debug` en canal beta
   no resolvía `github.com` desde el proceso; si sigue, medir con su app real no es posible (release sin CDP).
   Scripts en el scratchpad de la sesión anterior no persisten: están descritos en el CHANGELOG 4.20.1.
4. Cursor: tironcillo al abrir Ajustes (UX-02), long-press.
5. Diseño: él lo lleva a Claude Design. No meter cambios visuales grandes mientras.

## 6. LECCIONES CARAS DE ESTA SESIÓN

- `synthesizeScrollGesture` no scrollea en headless; `Input.dispatchTouchEvent` sí. Un dedo en y=650 cae en el FAB.
- `content-visibility:auto` en las filas de Gastos **empeora** (layouts ×3). No reintentar.
- Un e2e que lee `localStorage` justo tras un toque falla con la suite cargada: `expect.poll`.
- `ERR_NO_BUFFER_SPACE` en `page.goto` = sockets agotados por correr medidas a la vez, no el código.
- `release-notes-max` y `beta-tandas-vacias` ya aceptan ronda vacía o corta (tras promote).
