# Encargo a Cursor · revisión independiente de la 4.26.233 (15/11/2026)

**De:** Claude (coordinador) · **Tipo:** revisión (bot «Aely PRs») · **Rama de partida:** `main` = `20ac544ca`.
El dueño quiere una segunda opinión de TODO lo que se ha hecho y subido en esta ronda, «por si ves algo que Claude no ha visto».

## Contexto: qué pasó en la ronda

1. 14/11: cuatro auditorías de solo lectura sobre producción 4.26.232 (`5ceb117c0`): seguridad, diseño, rendimiento y funciones/textos (es/en/ca).
2. Arreglos en cinco ramas desde la beta 232 (`8d82bb729`), integradas en `claude/integra-233`:

| Rama | Cabeza | Qué cambia | Revisión de dinero (Opus) |
|---|---|---|---|
| `claude/233-saldos` | `7835a409d` | Bucle de render en el histórico de saldos: el efecto de `Wealth` montaba su propia clave por cuenta en vez de `accountOrderKeyOf`; dos cuentas con la misma clave se pisaban sin fin. Nueva `accountBalanceRows` (02-ui-shared.js): no guarda nada si la clave falta o se repite, ni un 0 inventado si no hay saldo. e2e `saldos-sin-bucle`. | GO |
| `claude/233-rendimiento` | `810c2521f` | Apuntar y la ficha de un gasto abren sin tarea larga la primera vez (ensayo en seco + `soloVelo`); caché por fila en la serie de patrimonio (`netWorthSeries`) y deuda por día; código y CSS muertos fuera; topes de tamaño 1904/522 KiB. | GO con remate (zona horaria y deudas en la clave de caché) |
| `claude/233-diseno` | `6d51e2ee8` | Contraste: `--muted-2` por tema, tema Claro (categorías, «del banco», verdes con `--on-mint`); teclado de Apuntar siempre visible (`.v4-ficha-amount.empty` chocaba con la clase global `.empty`); áreas táctiles de 44 px; scroll suave en Deudas; cifras del rodillo sin hueco; Deudas sin rojo. | — |
| `claude/233-textos` | `105c3a658` | Frase del Plan sencillo nombra el banco (y clave `_noday` que no existía); «libres de» en Inicio; modo sencillo sin metas en Inicio; mismos nombres que Recibos; fuera `alert` y `prompt/confirm` de reserva; tipo de cambio a 4 decimales; ~25 toasts crudos → `errTxt(e)`; jerga fuera; catalán «Configuració». | GO con remate |
| `claude/233-edge` | `ca7178593` | Solo `supabase/`: supabase-js fijado a 2.110.0 en las 13 funciones (+ test `imports-fijos`); aviso `ENC_MISSING` si falta la clave de cifrado; cupos (prices por usuario ENCENDIDO salvo `PRICES_RATE_LIMIT=0`, globales con cubo aparte para cuentas de menos de 7 días, topes de categorize y help-assistant); fase 1 de confirmación de Open Banking por quien la inició (función nueva `bank-confirm`, sin cambio para clientes que no mandan `confirm`); `delete-account` con freno y errores como código; migración `0027_hogar_funciones_sin_anon.sql`; `supabase.yml` con `permissions: contents: read`. | — |

3. Integración: `872814e80` (4.26.233) + `0184ef82c` (dos umbrales de e2e-perf que caían en ruido de CI: espera de 450 → 750 ms en `dashboard-memo-profile` y `categoryMs` 0,35 → 0,5 en `tr-emparejado-rendimiento`; medido A/B 232 vs 233 igual). CI de beta verde (run 43676789534).
4. El dueño aprobó en su móvil la tanda `auditorias-233` (7/7). Producción: `6148c0e04` (nota única es/en/ca, catálogo sin tandas) + cierre `20ac544ca` con main como primer padre. APK sin cambios (64, release v4.26.206).
5. **Edge aún sin desplegar.** Va justo después, una función cada vez (orden: bank-confirm, bank-callback, bank-connect, prices, help-assistant, categorize, myinvestor-*, delete-account, resto; 0027 al final).

## Qué revisar (ejecutando, no leyendo)

1. **Dinero** — `accountBalanceRows` + su uso en `07-tab-patri-fijos.js`, y la caché de `netWorthSeries`: ¿algún caso real (cuenta sin `key`, dos bancos con la misma clave, divisa sin cambio, deuda que cambia a mitad de mes, cambio de hora) da una cifra distinta a la de la 232 sin motivo? Siembra DOS bancos.
2. **Edge antes de desplegar** — `bank-callback`/`bank-confirm` (que un enlace ajeno no se active, que sin `confirm` todo sea igual), `_shared/cupos.ts` (que la familia no choque con los topes), `crypto.ts` sin clave. Corre los `*.test.ts` con Deno como los lanza `scripts/run-tests.mjs`.
3. **Merge de producción** — `git diff 5ceb117c0 20ac544ca`: nada de main tragado (CHANGELOG, `RELEASE_NOTES`), ningún `const` duplicado (`npm run test:syntax`), `public/apk.json` apunta a la release estable.
4. **Textos** — claves nuevas en los tres idiomas con los mismos `{placeholders}`; que `errTxt` nunca enseñe un mensaje crudo ni oculte uno ya traducido.
5. **Lo que se pinta** — tema Claro, Apuntar en 360×740, ficha de gasto la primera vez; algún e2e que debería existir y no existe.

## Entrega

- Rama `cursor/revision-233` (esta), PR **draft contra `beta`** solo si propones tests o arreglos; nada a `main`.
- Informe en `docs/briefs/CURSOR-revision-233-RESULTADO.md`: por punto, OK o hallazgo con fichero:línea, caso que lo reproduce y gravedad (P0–P3), y los comandos corridos con su EXIT real.
- Repo PÚBLICO: ni nombres, ni cifras reales, ni detalles de seguridad aún abiertos.
- Avisa a Claude por el canal (`to: claude`) al terminar. No despliegues Edge ni toques producción.
