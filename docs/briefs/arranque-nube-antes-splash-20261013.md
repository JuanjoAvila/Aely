# Arranque: preparar el estado de nube antes de retirar la cortina

Candidata del encargo `arranque-pinta-nube-antes-del-splash-codex-20261013`, sesión
`codex-local-20261013-arranque-1aa78677`, claim889ce8ff abierto durante esta preparación. Base del claim123
`3625fa7ed5134cfbc5e364adc4f588bfdaf670c0` inmutable; ejecución rebasada por la señal
de Claude sobre124 `f5904735b514751ee926d25c22c92195b6ce3653`.

La hipótesis es que esperar a idle para iniciar el pull consume el tope del splash y
que resolver las promesas no demuestra que React haya aplicado sus updaters. App
inicia la lectura al resolver la sesión y espera el asiento dependiente del pull;
después encola un marcador de estado React cuyo layout effect programa dos frames
tras el commit. La versión final no depende de un flushSync vacío. Dashboard
escucha ready antes de la retirada y aplaza la serie hasta ready o splashGone.
Los topes520/1800/8000ms, salidas offline/sin sesión y política bancaria a demanda
no cambian. Una nube que exceda el tope permite ver el mejor estado local; esta
propuesta no garantiza estado definitivo ante una espera de red ilimitada.

## Alcance para integrar

- 11: nuevo ref/cleanup de frames, cola final de syncFromCloud y lectura inicial.
- 03: effect de bootReady y gating del memo. Fórmula netWorthSeries en02 y renderer
de Patrimonio en03 intactos; primer movimiento/comparación/textos son de Claude.
- 04 lastPaydayOf y08 budgetPeriodOf intactos, de sus titulares respectivos.
- Runner y mapa: un Node y un e2e nuevos, rendimiento serial. Guardas de auth mantienen
el método SDK y el efecto histórico, con una única diferencia de inicio inmediato
enumerada explícitamente; no se omiten los controles de sesión ni callbacks tardíos.

## Evidencia y límites

Node ejecuta callbacks reales contra transporte y renderer controlados: barrera,
cleanup antes de cada frame, dos pulls, red fallida, asiento, rojo base y memo0→1.
El mutante que salta el marcador falla; todas las referencias financieras previas del
memo se conservan. Eso no prueba frames físicos, DOM, aceptación móvil ni mejora.
Sobre124: build oficial, sintaxis7 bloques, Node nuevo, Metas pull10/10, i18n,
mapa, security, privacidad, bank-sync-acuse, auth-disposal y fit terminan EXIT0.
docs-frescura termina EXIT1 exclusivamente por los dos módulos candidatos posteriores
al ancla de VERSION; no se modifica esa guarda. El focal123 dio EXIT1 por huellas
transitivas nuevas frente a su lista cerrada; no se retoca el catálogo para evitarlo.
La revisión anterior con flush vacío midió1383847/379943B; sus bytes no se atribuyen
a la barrera final por layout effect. La final mide **1384043/379971B** con idéntica
reserva y minificador oficial: exceso **619/67B**, topes1351/371KiB y tres bloqueantes
intactos. El guardián de tamaño sigue rojo; no se recortan controles para ocultarlo.
Los JSON públicos regenerados por build sólo actualizan huellas de código; notas
fuente, textos, unidades y catálogos fuente quedan iguales a124. Integración debe
revisar esas identidades; ninguna aprobación se hereda de una huella anterior.

El e2e preparado compara HTML original124 ensamblado desde `git archive`, con
2000/20000 gastos sintéticos, local viejo/nube nueva, control sin nube, offline y
nube lenta. Cuenta RAF>32ms durante3s desde retirar el nodo, llamadas a serie/Gastos,
estado visto al entrar y sincronizaciones bancarias. Guarda cada raw, incluso parcial.
La sonda y ancla se adaptan de PR219/source05704393; su caso antiguo no siembra
app_state más nuevo, así que **su calibración no acredita este escenario**.
Tests38405882533 sobref071851a terminó FAILURE/EXIT1 en2502,2s. El Node nuevo y
siete suites Deno pasaron; PW funcional/rendimiento no se ejecutaron y la privacidad
independiente del workflow se omitió. beta-sources falló en Catálogo124/Retiro124 por
huellas nuevas y en META91 porque su mutante buscaba el literal anterior del asiento.
La revisión siguiente sólo adapta ese literal al nuevo `const asentado`, preservando
su propósito y añadiendo un oráculo que mata la omisión del asiento por estado real.
Los catálogos/identidades, VERSION y tamaño siguen pendientes de integración.
Log íntegro370612B/SHA256
`4f8829059804ffc54d8dd0dc6c7d750d93648285b70b2203f652cc9785e919e5`.
Esta CI anterior no se atribuye al HEAD que incorpora la corrección del mutante;
se despacha Tests final otra vez sobre ese HEAD. No es un verde ni un A/B físico.

El HTML baseline124 oficial tiene2217108B/SHA256
`b1451886953703315f73477aa5758310dd5cdbfcdfecccee1cbbdd05cbaf3fda` en esta máquina.

**CPU×6, A/B físico, latencia offline/lenta y e2e no ejecutados localmente.** FIN01
retiene el recurso6fa/hashd46, sin retorno expreso. No full npm, Chromium, Playwright,
Gradle ni recursos ajenos. Sólo CI remota Tests sobre el HEAD final, cuyo terminal
debe registrarse sin convertir skips o rojos en aceptación. Sin VERSION, notas
fuente, catálogo, límites, backend, APK, beta/main o publicación. Las revisiones
históricas de Inicio y PR204 no son la entrega de este claim.
