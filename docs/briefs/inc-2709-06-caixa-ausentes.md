# INC-2709-06 · cargos CaixaBank ausentes · actualización 2026-10-04

## Estado

**Parcial en cliente (candidata PR draft → beta).** Base revalidada: `origin/main` =
`8bb0398f9d16a848b984c989a6515e87937c815c` (producción 4.26.94). Rama aislada
`cursor/inc-2709-06-caixa-ausentes-da8c`.

Se corrigió un defecto sintético reproducible en la ruta diaria e histórica: referencias de
origen distintas (`bank|ext_id`) se tiraban por la terna día|importe|comercio. **No se declara
cerrado el caso humano** de otro perfil: falta cotejo de solo lectura (versión, enlace, respuesta
Edge activa, filas del titular, filtros de Gastos) autorizado por el dueño.

## Contrato afectado

| Etapa | Cambio |
|-------|--------|
| `flattenBankTx` | Conserva `acctUid` opaco del proveedor (`accounts[].uid`); no se inventa desde IBAN. |
| `importObExpenses` | Si hay `extId` nuevo, no bloquea por terna débil; la segunda fila salá fecha con `histDate("ob-ext|…")` para el índice nube. |
| `histFlattenHistoryLinks` | Dentro de una cuenta, `ext_id` distintos = cargos distintos; PDNG sin id → BOOK con id sigue siendo uno. |
| `keyOfExpense` | Distingue fechas saladas (hora ≠ 12:00:00); **no** mete `extId` (la tabla no lo guarda; meterlo duplicaba tras pull). |
| SQL / Edge / auto-sync | **Sin tocar.** FIN-03 (columnas de origen) y deploy de `bank-sync` quedan fuera. |

## Rojo → verde (misma reproducción sintética)

Sobre `8bb0398f` sin el parche:

- flatten 2, `importObExpenses` → **1** (`cargo-A`)
- hist misma cuenta `cargo-A`+`cargo-B` → **1** candidato, `skippedUniq=1`

Con el parche (`tests/inc-2709-06-caixa-extid.test.mjs`, registrado en `scripts/run-tests.mjs`):

- flatten 2 + `acctUid`, import **2**, claves de merge **2**
- hist **2**, `skippedUniq=0`
- TR sin `extId` sigue deduplicando por terna
- PDNG→BOOK y retirada/merge/ob-ingresos/tr-open-banking en verde

## Límites (siguen abiertos)

1. Caso humano real: no leído; no hay credenciales ni datos familiares en esta VM.
2. `expenses_dedup_idx` / ausencia de `ext_id` en tabla: la segunda fila usa fecha salada (mismo
   patrón que ranuras hist multicuenta). Migración de identidad de origen = FIN-03.
3. Lápidas antiguas por terna débil siguen ocultando todas las apariencias de ese día|importe|comercio.
4. Sin auto-sync, sin repair de histórico real, sin deploy Edge/SQL, sin bump de VERSION global
   (acordar con Codex antes de integrar).
5. Buzón local `E:/Mi cartera/.claude/canal-equipo` no montado en esta cloud VM; ACK/reserva solo
   en Project store outbox hasta self-hosted worker.

## Próximo dato decisivo (humano)

Cotejo autorizado de cargos de referencia: presencia en Edge activo → local → pull → vista filtrada.
Si Edge no los trae, el defecto es proveedor/ventana/cuenta, no este parche.
