# B09-B — ventana del mes (app = widget)

**Estado (2026-09-07):** `inicioDeMesMs` compartida Europe/Madrid en cliente e ingest.
Guardián: `tests/month-window.test.mjs` (bordes 00:30 y 23:30, reloj fijo).

## Porqué

Cliente: `new Date(y, m, 1)` local. Ingest: `Date.UTC(y, m, 1)`. Compra el día 1 a las
00:30 en España → meses distintos → cifra de Gastos ≠ widget con app cerrada.
