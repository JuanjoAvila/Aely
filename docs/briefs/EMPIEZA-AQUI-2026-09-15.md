# EMPIEZA AQUÍ — sesión siguiente a la noche del 14/9/2026

Traspaso de la sesión del 14/9 (noche). Producción pasó de **4.20.4 → 4.21.2** y salió la **APK 46**.
Beta lleva la **4.22.2**, pendiente de su veredicto. Todo lo de abajo está verificado por contenido.

---

## 0. LOS CUATRO COMANDOS, ANTES DE TOCAR NADA

    npm run salud
    node scripts/errores.mjs --kind=beta --limit=20
    node scripts/errores.mjs --kind=feedback --limit=20
    node scripts/errores.mjs --kind=hist

Buzón con Cursor: `.claude/canal-equipo/messages/cursor` (gitignored; los JSON pueden llevar BOM).
**Arma el watcher del buzón al empezar** (Monitor sobre esa carpeta).
`errores.mjs` lee `.env.local` de la RAÍZ del repo: desde un worktree falla («Falta la clave»); córrelo en `E:\Mi cartera`.

## 1. CÓMO SE TRABAJA (no opcional)

- **Todo pasa por Cursor por el buzón**: plan → voto → picar → review EJECUTANDO → beta. El 14/9 piqué
  la 4.22.0 antes de pasar el plan: no repetir.
- **Worktree propio por tanda** (`git worktree add -b tanda/x .claude/worktrees/claude-x refs/remotes/origin/beta`
  + junction de `node_modules` con `New-Item -ItemType Junction` en PowerShell; `mklink` desde bash falla).
- **`TZ=UTC npm test` además de local**: la CI de beta corre en UTC y tumbó la 4.22.0 con un test que en
  Madrid pasaba (Cursor también lo hace ya).
- **Antes de picar una regla de casado, simular contra `expenses` reales de la nube.** El brief de deudas
  suponía que las cuotas casaban por nombre y ninguna lo hacía (memoria `cuotas-deudas-no-casan-por-nombre`).
- Beta sin preguntar; main solo con su OK. Nunca editar con PowerShell. Escribir poco.
- El clasificador de permisos bloquea `release:apk`, push a `main` y escribir en el repo puente: pedir
  su OK explícito en una línea y reintentar.

## 2. ESTADO AL CERRAR

| | |
|---|---|
| producción (`main`) | **4.21.2** (`571a85e5`): cuotas de deudas en Gastos. `/Aely/` y `/Mi-Cartera/` sirven 4.21.2 |
| APK | **46** en la calle (release `v4.20.4`, `Aely-4.20.4.apk`): sin token de ingest + sin copia de Android. Los dos `apk.json` = 46 |
| Edge | `ingest` redesplegada el 14/9 (`CAT_NEUTRAS.deudas` + `esCuotaDeDeuda`) |
| beta | **4.22.2** — tanda `hist-cuotas` (ver §3), pendiente de su prueba |
| siguiente código | **4.22.3** si hay que arreglar algo de beta; tras el promote, **4.23.0** |

## 3. LO QUE ESTÁ EN BETA (4.22.x, tanda `hist-cuotas`)

1. **4.22.0** — las cuotas de los últimos 12 meses también a «Deudas» (`CUOTA_MESES`); el importador del
   histórico ya no descarta deudas (`histCuotasDeDeuda`), misma regla que la pasada (`cuotaCasa`).
2. **4.22.1** — `cuotaDesdeMs` con la hora de la casa (el fallo de CI en UTC).
3. **4.22.2** — su rechazo de 4.22.1: «Cofidis 24,99 es la cuota, no la puedo cambiar manualmente?».
   Ficha → «Es la cuota de…» (todas las deudas, también acabadas); aprende `state.cuotaAlias[banco|comercio]`.
   Panel: 5 pasos, el 1 es su rechazo.

Si la aprueba → promote igual que 4.21.2 (memoria `promote-4-19-106-como-se-hizo`): nota única 4.22.3 con
`tandas:[]`, push main + vacío `[skip ci]`, `deploy.yml` a mano, verificar `/Aely/` por contenido, puente
(`version.json` + `bundle.zip`), beta al mismo SHA + `beta.yml`. **No toca Edge** (4.22 no cambia `supabase/`).

## 4. PENDIENTE (por orden)

1. **Su veredicto de 4.22.2** y promote si aprueba.
2. **Nit de Cursor en la review de 4.22.2** (para un .3 o el promote): en `cuotasDeDeudaPorMarcar` el
   `return` por `CAT_NEUTRAS` va ANTES del alias; si el banco vuelve a meter Cofidis como `traspaso`, el
   alias no lo caza. Mirar el alias antes de ese corte. Con test.
3. El importador del histórico no usa `cuotaAlias` (poco valor hoy: sus meses ya están importados).
4. **OPS-06** restante (`docs/briefs/ops-06-seguridad-auditoria-repo.md`): instalador propio vs Play (DEC-01),
   BD viva (`pg_policies`, necesita SQL Editor y su OK), `localStorage`, SEC-01 (Edge sin sesión).
5. Verificar en su OnePlus la degradación de Gastos (brief del 14/9, §5.3).
6. Cursor: UX-02 (tironcillo al abrir Ajustes), long-press.
7. Diferencia servidor/app vista en la simulación (usuario del dueño, `shown` 511,48 vs 480,93): previa a
   la tanda de deudas, sin investigar. Mirar con `scripts/diag-widget.mjs` si él nota el widget raro.
8. Compactar `MEMORY.md` (roza el límite de lectura).

## 5. LECCIONES CARAS DE ESTA SESIÓN

- **La marca en `source` con `~`, no con `#`**: el servidor hace `split("#")[0]` y con `#` sumaría. Y
  `macrodroid~…` lo lee «a mano» y también sumaría: ahí solo `cat:deudas`.
- **No sacar filas de `expenseCountsCash`** sin mirar el anclaje de `applyBankBalances`: salta el saldo.
- **`startOfMonth()` es hora de Madrid**: leer su mes con `getMonth()` local rompe en UTC.
- **Un `&&` que no encadena el test al push**: subí a beta con `docs-frescura` en rojo (lo arregló la 4.21.1).
  Test y push en la MISMA cadena `&&`.
- `sync-memoria` se comprueba con `node scripts/sync-memoria.mjs --check`, no con `tests/memoria-espejo`.
