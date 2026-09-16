# Aely — Auditoría de diseño, septiembre 2026

> Hecha leyendo `main` (tree `c34fe81c`): `shell.html`, `04-tab-gastos.js`, `06-sync-brokers.js`,
> `07-tab-patri-fijos.js`, `14-v4-screens.js`, `SPEC-v4.md` y `PULIDO-v4.md`.
> No incluye lo que ya está encargado en la spec de esta tanda (`handoff/SPEC-v4.1-fichas.md`).

## El diagnóstico en una frase

La v4 no está a medias por falta de diseño: está a medias porque **hay tres capas de app vivas a la vez**
y solo la primera se rediseñó. Cuando una pantalla v4 necesita algo que ya existía en la v3, la mete dentro
de un sheet y le pinta encima unos radios con `.v4-embed-legacy`. Eso explica exactamente lo que notas:
lo que se ve en la tab está pulido, y en cuanto pulsas «Gestionar», «Herramientas» o editas algo,
aparece la app de antes.

Los tres sitios son literalmente estos:

| Sitio | Línea | Qué monta |
|---|---|---|
| `BillsManageSheet` | `14-v4-screens.js:353` | `<Fijos>` entero (`08-motor-bank.js:1849`) |
| `InvToolsSheet` | `14-v4-screens.js:556` | `<Investments toolsMode>` (`06-sync-brokers.js:651`) |
| Cartera › cuentas | `14-v4-screens.js` (bloque `cuentas`) | `<Wealth v4Embed>` — este sí está adaptado |

**Criterio para el futuro:** `.v4-embed-legacy` no es un estilo, es una deuda marcada. Cada vez que se
quiera usar, la respuesta correcta es reescribir esa vista con piezas v4, no envolverla.

---

## A · Hallazgos con mock en esta tanda

**A1 · El patrón «v3 dentro de un sheet v4»** — *crítico, es la causa de todo lo que reportas.*
Cubierto por los mocks `1f`/`1g` (Gestionar) y `1k` (Inversiones).

**A2 · Dos fichas distintas para el mismo objeto.** `ApuntarSheet` y `ExpenseDetailSheet` resuelven lo
mismo con distinto orden, distinto teclado (propio vs. del sistema) y distinta forma de elegir categoría.
Editar no se parece a apuntar, y eso hace que editar se sienta roto aunque técnicamente funcione.
Cubierto por `1c`/`1d`.

**A3 · Un gasto automático no dice de dónde salió, y sin embargo su importe se puede editar.**
La ficha resume el origen en un `metaBits.join(" · ")` («Sabadell · entró solo») y deja el importe
editable. Cambiarlo desancla el saldo real del banco sin avisar de nada. Cubierto por `1d`.

**A4 · Borrar no tiene red.** El copy sigue diciendo «Esto no se puede deshacer» (`01-i18n.js`,
`v4_exp_del_sub`) cuando el SPEC §28 pedía un «Deshacer» de 5 s. Es el detalle que hace que una app de
dinero se sienta segura. Cubierto por `1l`.

---

## B · Hallazgos de la auditoría general (sin mock todavía)

Ordenados por cuánto resta hoy.

**B1 · Plan no tiene portada.** *(Alta — es tu red flag del padre.)*
Al entrar en Plan aterrizas en Recibos con un hero de «queda por pagar» y dos listas. Un usuario que no
lleva finanzas no sabe si eso es bueno o malo. Los tres segmentos (Recibos/Deudas/Metas) obligan a saber
de antemano cuál te interesa. Propuesta: una frase de estado arriba, en el mismo tono que la tarjeta de
presupuesto de Inicio («Este mes te queda por pagar 614 €; a fin de mes seguirás con 4.381 € en Sabadell»)
y los segmentos con su número al lado. Mock en tanda 2 si te interesa.

**B2 · Modo sencillo apaga cosas, no simplifica.** Hoy `simple` esconde Deudas, Metas y el detalle de
inversiones. Esconder no es simplificar: la pantalla que queda sigue diciendo «Patrimonio neto» en la
misma jerarquía. Para que tu padre entre en Plan, el modo sencillo debería cambiar el **lenguaje** y el
**orden**, no solo quitar pestañas. Es una decisión de producto: la levanto, no la resuelvo sola.

**B3 · Cinco maneras de abrir la misma cosa.** Conectar un banco se hace desde Inicio › Próximos cargos,
Cartera › icono, Ajustes › Mis bancos, el banner de reconexión y el CTA de Gastos. Cada una con su copy.
Está bien tener atajos; conviene que **el destino sea siempre la misma pantalla** y el copy, el mismo.

**B4 · «⇅ Ordenar secciones» al pie de Cartera no lo encuentra nadie.** Es potente y está escondido en el
peor sitio posible (final de scroll, texto pequeño). Debería ser un long-press en la cabecera de la
sección, que es el gesto que ya existe para ordenar cuentas (`.v4-mov-drag`).

**B5 · La leyenda del hero de Cartera son botones que no parecen botones.** `.v4-legend-btn` cambia el
gráfico al tocarla, pero se lee como una leyenda. Un `▾` o un borde permanente basta.

**B6 · Los importes grandes no comparten escala.** `.v4-gastos-summary-amount` usa
`clamp(22px,8.2vw,40px)`; `.v4-hero-amt` sigue a 56px fijo (P14 del PULIDO, aún abierto). Con seis cifras
y «Letra grande» el hero se aprieta contra los bordes. Es una línea de CSS.

**B7 · Inconsistencia tipográfica en las cifras.** Conviven Fraunces con `tabular-nums` (v4) y Manrope
800 (`.total-bar .tn`, `.v4-exp-amt` cuando es input). La regla del spec era simple: **toda cifra
protagonista es Fraunces**. Merece un barrido con `grep` de los `font-size` ≥ 20 sin `.serif`.

**B8 · Los estados vacíos de Inicio siguen abiertos** (P1–P5 del PULIDO-v4, revalidados el 9/9 y sin
tocar en 122 commits): sparkline plano con 0 puntos, pill «+0 € este mes», racha «🔥 0 meses», anillo que
no se dibuja. Es literalmente el primer minuto de un usuario nuevo — y de tu padre.

**B9 · Nadie ve el tema claro.** Todo el pulido se ha hecho en verde/oscuro. `html[data-theme="light"]`
redefine mint a `#249A5B` pero hay overrides puntuales (`.v4-embed-legacy .link` → `--mint-ink`) que
huelen a parche. Una pasada por las cuatro tabs en claro buscando mint sobre blanco en texto ≤14px.

**B10 · El `AGENTS.md` y los `docs/` son el mejor activo del proyecto y el peor riesgo.** Están
extraordinariamente bien escritos, y a la vez el propio repo ya documenta tres veces que un documento se
quedó caducado afirmando cosas falsas. El `## Screen map` de `github.md` que dejo en este proyecto
existe para eso: que la próxima sesión sepa qué mock corresponde a qué fichero sin fiarse de la memoria.

---

## C · Lo que está bien y no hay que tocar

Se dice poco y conviene decirlo, porque en las próximas tandas alguien va a querer «mejorarlo»:

- La anatomía de sheet con `useSheetSwipe` + `useBackClose`, y el guardado al vuelo sin botón Guardar.
  Es coherente, se aprende una vez y sirve para todo.
- Los roles de cuenta con su frase (`.v4-ficha-op`). Es el mejor patrón de la app: una decisión con su
  consecuencia escrita al lado. Debería replicarse en periodicidad de recibos y tipo de deuda.
- El trabajo de rendimiento de `PlanTab` (premontaje en `mcScheduleIdle` + `content-visibility:hidden`,
  con las tres medidas apuntadas). No lo toques «de paso» por ninguna razón estética.
- El tono de los copys. «Vas muy bien», «a tu ritmo la cumples en octubre», «ponle el valor por el que lo
  venderías hoy». Ahí no hay nada que arreglar.
