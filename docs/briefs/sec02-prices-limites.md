# SEC-02 · `prices` — límites / replay (propuesta, sin deploy)

PR: [#127](https://github.com/JuanjoAvila/Aely/pull/127) · rama `cursor/sec-02-prices-limits-8d38`  
Base de trabajo: `origin/main` `8bb0398f`.

## Qué queda ACTIVO en el código (esta entrega)

| Control | Estado | Notas |
|---|---|---|
| `verify_jwt` en `config.toml` | ya estaba | gateway |
| `getUser` en handler | **nuevo** | 401 sin sesión |
| Tope de cuerpo 4 KiB | **nuevo** | 413; no es cuota Finnhub |
| Tope 25 símbolos + regex | ya estaba | |
| Sleep 120 ms tras intento Finnhub (`finally`) | **ajustado** | solo pace del isolate |
| Catch de proveedor | **ajustado** (post NO-GO `932267aa`) | solo `{sym,status:"exception",code:"provider"}`; **sin** `String(e)` ni URL |
| Rate limit 30/600 | **NO activo por defecto** | ver propuesta |

## Propuesta 30/600 (NO contrato activo)

```
bucket:  prices:{userId}
limit:   30
window:  600 s
unidad:  petición HTTP a la función prices
estado:  proposal-pending-authorization
```

Constantes: `PRICES_RATE_PROPOSAL` en `supabase/functions/prices/prices_core.ts`.  
Activación futura (solo tras autorización): secreto/env `PRICES_RATE_LIMIT=1` en el deploy de la función — **entrega aparte, no esta PR**.

### Por qué no se activa como «protección de presupuesto»

- La RPC compartida `check_rate_limit` (migración **0019**) solo ofrece contadores; **no** define una cuota `prices`.
- `categorize` (40/600) y `help-assistant` (15/600) son contratos **ya autorizados** sobre otro coste (LLM). Copiar la forma no autoriza 30/600 para cotizaciones.
- Con 30 peticiones × hasta 25 símbolos US ≈ **750 fetches** a Finnhub/Yahoo antes del 429 de la petición 31. Eso **no** acredita proteger el tier gratis ~60/min.
- El `sleep(120)` es por isolate/símbolo, no un freno global de concurrencia.

Presupuesto real (para una autorización futura, no inventado aquí como vigente):

1. Medir fetches/proveedor por refresh típico de cartera (símbolos US vs Yahoo-mapeados).
2. Decidir si el contador es por **fetch al proveedor** (compartido por `FINNHUB_KEY`) o por petición HTTP.
3. Autorizar números y deploy Edge aparte.

## Pruebas

- `supabase/functions/prices/prices.test.ts` (Deno, en `denoEnLista` de `scripts/run-tests.mjs`).
- Gate: `rateLimit` real de `_shared/ratelimit.ts` + RPC `check_rate_limit` simulada que usa `p_bucket` / `p_limit` / `p_window_secs`.
- Mutantes: `limit=1` vs `999999`, caducidad `window=1`, aislamiento `prices:u1`/`u2`, concurrencia.
- Rojo/verde: fixture `prices_base_fixture.ts` (= lógica `8bb0398f`) vs `handlePrices` candidato.
- **Fuga `errors[].body` (comprobado):** fetch simulado lanza `Error(String(input))` con URL Finnhub + clave sintética → base filtra token/URL; candidato no; `NVDA` queda en errors con `code:"provider"` y `GOLD` sigue con precio. El test antiguo con `c:0` no entraba en el `catch`.

## Fuera de alcance

Deploy Edge, SQL/migraciones, categorize/ingest/bank-sync/FIN-04, activar `PRICES_RATE_LIMIT=1` en producción.
