# OPS-05 · triaje de nueve PR antiguas · 12/10/2026

Revisión de fuente y GitHub, sin cerrar PR, borrar ramas/worktrees ni modificar producto.
La decisión de cierre corresponde al dueño. #202 y #204 siguen vivas y quedan excluidas.
Fuente comparada: beta **4.26.117**, `c5f62d6603d016150afd9d0e20547b608b323045`;
main `b2dfd2c01d7ec6a9a30b74ae71d473054932c42f`.
Este corte sustituye la foto de PR abiertas del 9/9 y 25/9 sólo para estos nueve expedientes.
No acredita entrega servida, firma/instalación de APK, despliegue Edge ni aceptación móvil.

## Decisión preparada para el dueño

| PR | Veredicto sobre su contenido | ¿Cerrar? · propuesta en una frase |
|---|---|---|
| [43](https://github.com/JuanjoAvila/Aely/pull/43) | **Sigue aportando algo vivo.** Falta confirmación de cambios parciales por UUID. | **No:** aún puede darse por guardada una decisión que el servidor no recibió; continuar FIN-04 en un encargo nuevo. |
| [48](https://github.com/JuanjoAvila/Aely/pull/48) | **Superada por otra solución.** Bizum ya se retiró de la clasificación; el handler actual tiene pruebas propias en main. | **Sí:** conservar el intento bloqueado como historia; no desplegar el paquete antiguo. |
| [87](https://github.com/JuanjoAvila/Aely/pull/87) | **Superada por otra solución.** Widget80 y el contrato nuevo de widget115 sustituyen el prototipo76. | **Sí:** conservar la incidencia y los requisitos de prueba real del widget actual. |
| [105](https://github.com/JuanjoAvila/Aely/pull/105) | **Superada por otra solución.** La recuperación del formato del registro está en el árbitro actual. | **Sí:** el arreglo de reinicio ya tiene sucesor; cerrar esta PR no confirma el pago real ni cierra FIN-05. |
| [170](https://github.com/JuanjoAvila/Aely/pull/170) | **Superada por otra solución.** Widget115 distingue pérdida real de registro recuperable. | **Sí:** conservar su prueba de incertidumbre, sin reinstalar un bloqueo que el contrato nuevo ya sabe recuperar. |
| [180](https://github.com/JuanjoAvila/Aely/pull/180) | **Superada por otra solución.** #181 y #182 contienen su diagnóstico y corrigen la prioridad del sheet. | **Sí:** el diagnóstico rojo está conservado en esta acta y el sucesor #182; no fusionar el prototipo. |
| [181](https://github.com/JuanjoAvila/Aely/pull/181) | **Superada por otra solución.** #182 añade protección de bytes crudos y medición aislada. | **Sí:** conservar #182 como único expediente de diagnóstico, sin llamar resuelto al lag. |
| [182](https://github.com/JuanjoAvila/Aely/pull/182) | **Sigue aportando algo vivo.** Huella de bytes crudos y banco de medidas de Plan ausentes de beta. | **No por ahora:** extraer el diagnóstico vigente a un encargo nuevo; esta rama sigue siendo sólo para CI. |
| [195](https://github.com/JuanjoAvila/Aely/pull/195) | **Sigue aportando algo vivo.** Las cachés por revisión todavía faltan en beta117. | **No:** portar sólo el tooling vigente, demostrar equivalencia y medirlo de nuevo antes de integrar. |

Son propuestas: las nueve PR estaban **OPEN / draft** al leer GitHub. No se ha solicitado ni
efectuado ningún cierre. Una propuesta de cierre técnico no cierra los informes humanos abiertos.

## Método reproducible y límite del diff

Se leyeron las cabezas de GitHub y se trajeron las nueve `refs/pull/<n>/head`, beta y main.
Se revisaron los commits propios de cada PR y, para sus ficheros, el diff directo
`git diff <head-PR> <beta-actual> -- <fichero>`: la comparación es con beta117, no con su base antigua.
`git log beta..PR` por sí solo no demuestra que falte una solución: un rescate selectivo tiene otro SHA.
La ausencia de un helper, un test o una regla se comprobó en la fuente actual; los sucesores se
comprobaron como ancestros de beta/main. No se propone fusionar árboles completos atrasados.

| PR | Cabeza exacta leída | Ficheros del diff original informado por GitHub |
|---|---|---:|
| 43 | `bf450c0b54828e3c0f59f3c6955e30e569f94355` | 8 |
| 48 | `1ddcf25cd2ace00e405287491003aa958a43130c` | 20 |
| 87 | `26c2fd082959f168323b6df221b14af71b36953e` | 29 |
| 105 | `9711219766449e4e7c50081b00f7f4da7d7abd1e` | 19 |
| 170 | `f4142b0e3d0b14bbb50623c9d6842e7ee8258a16` | 8 |
| 180 | `fe4f1a5487be588c91b8c67886b6697779d60087` | 72 |
| 181 | `0d443254b4327b79db3a540cc617e36c036fd8b1` | 72 |
| 182 | `e404dd3960d356161674de34b2adc51928dc283d` | 73 |
| 195 | `0e71eaf313d8e076a3996dbdadb0d673b74ba8da` | 12 |

Las cantidades de esta tabla describen el diff histórico de GitHub, **no** el trabajo a rescatar.
En particular, Plan incluye ancestría de diagnóstico y cambios de otras pantallas/versiones;
aplicarlo entero revertiría mejoras posteriores de Bienes, navegación, splash y widget.

## Dinero primero: #43 · FIN-04

Pretendía evitar que banco y decisión de duplicado se sobrescribieran al reconstruir `source`
desde una copia local antigua, y devolver ACK sólo tras comprobar la fila exacta y el campo escrito.
Delta vigente: en beta117 `src/modules/00-core.js:1122` (`setExpenseBank`) y `:1134`
(`setExpenseDup`) todavía retornan sin sesión y escriben el `source` reconstruido del gasto local;
consultan `error`, pero no filas afectadas ni el `source` confirmado. `expenseSourceField` y
`writeExpenseSourceField` de #43 no existen en beta. El test `expense-source-ack.test.mjs`
y su brief tampoco están. La confirmación de retirada (`confirmExpenseWithdrawal`, `:1181`)
sí comprueba identidad/ACK, pero protege otro recorrido y no sustituye estos dos métodos.

Valor vivo exacto en [la fuente de #43](https://github.com/JuanjoAvila/Aely/blob/bf450c0b54828e3c0f59f3c6955e30e569f94355/src/modules/00-core.js#L1171):
lectura por propietario+UUID, actualización condicionada al `source` leído, conflicto de dos
decisiones sobre el mismo campo y rechazo de cero filas/ACK incorrecto. No hay commit equivalente
en beta/main para este contrato. La PR sólo cubre un paso: no aporta cola persistente ni UI pendiente.
Su acta además reconoce que cambiar el banco de un OB pendiente no tenía recorrido UI demostrado;
ese caso es defensa de la API, no daño observado en el móvil.
No portar el helper antiguo literalmente: `expenseSourceForCloud` actual (`:1680`) también conserva
el vínculo de deuda y la vuelta de un alias pendiente TR/Wallet a `macrodroid`; la gramática de #43
no los cubre. El encargo debe preservar esos campos y el origen real, además de banco/decisión.

**Encargo propuesto FIN-04-ACK:** partir de beta vigente, revisar los llamantes y portar el contrato
parcial con identidad fiable; conservar pendiente/conflicto cuando no haya confirmación. Aceptación:
dos clientes A/B, cambio de campos distintos sin pérdida, conflicto del mismo campo explícito,
sesión ausente/cambiada, UPDATE sin fila, pérdida de conexión y timeout después del commit;
ningún éxito silencioso ni búsqueda de gemelos por importe/nombre. Registrar tests de transporte
y DOM del estado pendiente. Auditar categoría, nota y borrado como pasos separados.
Es un riesgo financiero abierto de fuente; esta lectura no identifica filas reales afectadas.
El test de transporte de #43 reejecutado contra fuente/artefacto beta117 reproduce **2 OK /16 FAIL,
exit1**: entre los rojos están pérdida del otro campo, sesión ausente, cero filas y ACK ajeno.
Se cambió sólo la ubicación del import del cargador para leer beta117; las aserciones y transportes
son los de #43. Un primer montaje falló por import auxiliar ausente antes de ejecutar casos;
se corrigió la ubicación del cargador, sin cambiar producto ni el test de la PR.

## #48 · clasificación y paquete antiguo

Pretendía desplegar exclusivamente `categorize` sin Bizum en `ALLOWED`, `HINTS` y keywords,
con un cierre de cuatro fuentes y rollback. El diff contra beta117 confirma que las tres retiradas
ya están en fuente por `ca71a024` (Bizum como forma de pago), con mejoras posteriores
`96c8e349` y `60d4863f` (Gasolina/Taxi y Movilidad). `categorize/index.ts:18` y
`_shared/ingest_logic.ts` ya no permiten Bizum como finalidad.
El paquete `supabase/packages/ops01-categorize` y su preparador faltan en beta, pero congelan
fuentes del 27/9: recuperarlos para desplegar perdería mejoras actuales del cierre.

El test candidato dependía de ese paquete. El sucesor `tests/categorize-handler.test.mjs:1`
ejecuta las cuatro fuentes actuales; `9d3b33ce` / `d4f708d8`, integrado en main por #196
(`bdd75636`), cubre este valor sin el paquete antiguo. No está en beta117: una futura integración
debe conservar también ese test de main. La CI exacta de la documentación final de #48,
[36320201056](https://github.com/JuanjoAvila/Aely/actions/runs/36320201056), terminó SUCCESS.
El HTTP403 del despliegue del 27/9 sigue siendo historia válida; este triaje no consulta el servidor
vivo ni certifica que la función desplegada incluya las retiradas. Cerrar #48 no cierra OPS-01.

## #87 · periodo y magnitud del widget

Pretendía hacer visible mes/ciclo y enviar la cifra de Inicio en tres pasos Edge→web→APK.
Delta contra beta117: `WidgetPeriod.java:17` conserva contrato2 y límite45d; el bridge actual
envía `widgetPeriod`/scope (`11-app-main.js:2109`) y contrato/magnitud/idioma (`:2150`).
La solución publicable fue la fuente80 `22396f9a0951c0f5a61eb8d59d7e65bb0385edf3`,
integrada por #101/`955765a9`. Es ancestro de beta y main.

Su antigua propuesta Edge `ventanaDelWidget`/`statsDelCiclo` no está en el `_shared/presupuesto.ts`
actual: no es un rescate pendiente. La sustituye `ingest/widget.ts:40` (`widgetStart`) y `:50`
(`widgetSnapshot`) con respuesta específica `widget` (`ingest/index.ts:415`), introducida por
`76dce659` y alineada con Inicio por `9c582881`. Mantiene separado el `month` usado por avisos.
Reponer #87 en bloque cambiaría ese contrato y devolvería código/versiones antiguas.
El manifiesto fuente beta anuncia APK54/4.26.116 y main APK52/4.26.80; no se han descargado
ni verificado aquí esos binarios. Tampoco se acredita el límite del día45 o la transición real de mes.

## #105 y #170 · incertidumbre y recuperación del widget

#105 pretendía evitar que el salto final del registro de pendientes pareciera corrupción tras
reiniciar Android. Delta vigente: el árbitro beta usa separadores sin salto final (`:42`), omite
líneas blancas sin TAB y valida identidad (`:146`), y conserva ACK/lápidas. El rescate equivalente
de formato está en `554ae636` (PR201), seguido por `76dce659` y `79563064` para recuperación.
Las pruebas actuales `widget-offline`, `widget-unknown-journal`, `widget-unknown-loss` y
`widget-notificacion-render` están registradas. El brief antiguo de #105 falta y se conserva
como referencia histórica [en su PR](https://github.com/JuanjoAvila/Aely/pull/105).
Su [CI exacta37111890658](https://github.com/JuanjoAvila/Aely/actions/runs/37111890658)
terminó SUCCESS, aunque la descripción de la PR todavía diga que estaba pendiente.

#170 pretendía que una identidad perdida no quedara falsamente confirmada por un ACK ajeno,
reinicio o cambio de periodo. Delta vigente: beta contiene `unknownLoss`, persistencia y
`writeBlocked` (`MiCarteraWidget.java:92`, `:122`), además de `identityLost` y `recoveryJournal`.
`WidgetSnapshotArbiter.java:46` conserva una reserva pequeña cuando el registro principal no
cabe; `lost` (`:71`) bloquea pérdida real. Los sucesores `554ae636`, `76dce659`, `3eef2053`,
`79563064` y `844ce4b0` distinguen recuperación acreditada de pérdida no acreditada;
PR201 se integró en `94050870`. #170 dejaba pérdida duradera sin ese circuito recuperable.
No hay motivo para reinstalar su bloqueo indiscriminado ni recuperar su brief como estado actual.

**Seguimiento financiero, sin duplicar PR201:** ejecutar en el contrato vigente reinicio, registro
corrupto/saturado, ACK exacto/parcial/ajeno, rollover y pérdida de ambas reservas; mostrar desconocido
hasta prueba suficiente, recuperar el caso legible y no descontar dos veces. La instalación de APK,
el pago con app cerrada y el día45 necesitan aceptación real propia. Cerrar estas PR antiguas no
autoriza cierre de FIN-05 ni del informe de widget del dueño.

## #180–#182 · un solo expediente de diagnóstico de Plan

Las tres nacen como **CI SOLO / NO INTEGRAR**, con runtime de prototipo y ancestría de diagnóstico.
No existe en beta117 la excepción `html:not(.sheet-open) .page.page-scroll-host.mc-p` ni la
mutación conjunta del marcador `mc-p`: el valor de producto aún es una hipótesis, no una mejora.

#180 queda superada por #181: esta última añade el gate que excluye sheets y quita una declaración
CSS redundante (delta180→181:3/3 líneas de shell,19 líneas de acta). Su CI exacta
[37772570681](https://github.com/JuanjoAvila/Aely/actions/runs/37772570681) fue FAILURE:
los cuatro casos nativecontracts fallaron por prioridad del sheet. No se oculta ese rojo con el sucesor.

#181 queda superada por #182: delta181→182 seis archivos, con huella cruda, guardia/test de
diagnóstico y clasificación de Plan en rendimiento. La CI exacta
[37798235197](https://github.com/JuanjoAvila/Aely/actions/runs/37798235197) fue SUCCESS;
891 funcionales y13 de rendimiento pasaron. Esto no demuestra ventaja frente a beta.

#182 conserva valor vivo ausente de beta: [huella cruda `:76`](https://github.com/JuanjoAvila/Aely/blob/e404dd3960d356161674de34b2adc51928dc283d/e2e/plan-ownership-candidate.mjs#L76),
que detecta espacios/escape/clave duplicada/surrogates aunque el estado parseado sea igual;
`tests/plan-diagnostic-contract.test.mjs:15` lo comprueba y el spec exige ambas huellas.
El runner de #182 pone `plan-ownership-candidate` en el grupo serial; beta no tiene ese spec.
La [CI exacta37799640112](https://github.com/JuanjoAvila/Aely/actions/runs/37799640112)
fue SUCCESS, 884 funcionales y20 de rendimiento. Su checkout sintético fue `7d0f1ee25c0910b76de17f8a4205720773d986d9`,
distinto del SHA de fuente de la PR: los logs identifican las muestras, no una ejecución móvil.

En sus muestras seriales `touchIntersecting`, frames>32ms primero/después de12 ciclos:
Recibos beta1/0, main1/0, candidata1/1; Deudas beta1/1, main1/0, candidata1/0;
Metas0/0 en los tres. Máximos16,8–33,4ms. No reproduce un deterioro acumulativo claro del control
ni una ventaja consistente de la candidata. Conservar **NO-GO de optimización** e INC-2709-09 abierto.

**Encargo propuesto Plan-diagnóstico:** portar sólo instrumentación/huellas vigentes a beta actual,
sin CSS de prototipo por arrastre; comprobar el escenario malo/bueno del informe humano con
CPU6x, rAF y muestras seriales naturales. Mantener estado/historial/bytes intactos y probar
sheet/perfil/reduced-motion/safe-area. Aceptación: banco discriminante y A/B repetible antes de
proponer producto; registrar todos los controles/mutantes y CI. #182 puede cerrarse después de
guardar ese sucesor revisable. No rescatar las modificaciones antiguas de hist-visor/Metas/Bienes.

## #195 · ahorro de la etapa Node actual

Pretendía evitar análisis repetidos del mismo texto con snapshot por revisión, cachés de
fragmentos/máscaras/índices, cota32 y copias públicas sobre registros privados congelados.
El diff directo prueba que `scripts/beta-source-code.mjs` en beta117 sigue byte a byte como
el padre de #195: las funciones de contexto de #195 (`revisionReader`, `:6`) faltan.
`beta-revisions.mjs:13` todavía crea sólo el Map de lecturas. `run-tests.mjs:66` ejecuta
`beta-sources`, pero no está registrado/existe el guardián nuevo `beta-source-context`.
El contrato vivo es tooling; al entrar en alcances completos de dos tandas del panel también
cambia identidad web y necesita el tratamiento de beta correspondiente, sin repin ni alias de aprobación.

La [CI exacta37879047912](https://github.com/JuanjoAvila/Aely/actions/runs/37879047912)
terminó SUCCESS: 956 funcionales/1 omitido y13 de rendimiento; Node/Deno y privacidad sin rojo.
Runner2635,5s, beta-sources284,13s, guardián nuevo10,74s. Es una observación de ese SHA109/110,
no un A/B de beta117 ni una promesa de ahorro de la CI actual. El ABBA109−57,87% de su acta
era local e instrumentado. No mezclarlo con tiempos del publicador ni móvil.
Desde `d9242e6d` el publicador beta no espera al job de tests: este ahorro actúa sobre la etapa
Node de la suite, no sobre la espera de publicación de beta117. Main/promote mantienen sus gates.

**Medición actual:** `node tests/beta-sources.test.mjs` completo, sin flags, cuatro procesos
seriales nuevos ABBA, Node24.16.0/Windows/UTC. A usa los189 inputs beta117 congelados; B usa
el parser exacto de #195 y sólo sustituye el reader de la `betaRevision` actual. El observador
de B y los readers por defecto leen los mismos bytes A, incluidos los scripts; no se cambian
aserciones ni matrices, no se hace build ni se ejecuta el runner completo o navegador local.

| Pasada | Variante | Segundos | Resultado real |
|---|---|---:|---|
| A1 | beta117 | 456,460 | 64 PASS /0 FAIL, exit0 |
| B1 | contexto/cachés #195 sobre los mismos inputs | 203,037 | 64 PASS /0 FAIL, exit0 |
| B2 | contexto/cachés #195 sobre los mismos inputs | 204,196 | 64 PASS /0 FAIL, exit0 |
| A2 | beta117 | 435,366 | 64 PASS /0 FAIL, exit0 |

Media445,913→203,616s: **242,297s menos (54,34%; unos4min02s)** en la etapa registrada actual.
Variación entre controles4,84%, entre optimizados0,57%. Las cuatro salidas completas son
idénticas, SHA256 `a9dda0241ccc958ddaa100219b428223885dcb5fba6c6c19d84bcc7d1edea860`.
No mide CI Ubuntu/Node20 ni el total de la suite; no extrapolar ese porcentaje a Chromium,
RAM, publicador o móvil. El primer montaje incompleto (sin package.json) dio63PASS/1FAIL,
exit1; se excluye del A/B y se conserva su error. Se repitió desde inputs completos, no se
eliminó el caso117 para obtener verde.

**Límite nuevo del port:** el guardián original `beta-source-context.test.mjs` de #195,
sin modificar, falla sobre inputs actuales antes de completar su primer grupo: `BETA_SCOPE_ABSENT`
en `src/modules/03-tab-dash.js`, exit1 (4,229s, cero grupos PASS). Recorre todos los alcances
directamente y no sigue `betaScopeSource`/el archivo actual de revisiones que usa el primario117.
No reducir el bucle ni suprimir la guardia: adaptar el oráculo a la fuente archivada exacta y
comprobar los nueve grupos completos. Ese coste final aún no está medido; el ahorro neto de
port+guardián y del runner/CI completos sigue sin acreditarse. El ahorro del primario sí se conserva.

**Encargo propuesto CI-contexto:** portar sólo cachés/reader/guardián sobre beta vigente, preservar
archivos de registro e historia y conservar las funciones actuales de archivo de revisiones.
Aceptar equivalencia de resultados/errores/alcances/mutantes actuales y guardas de contaminación,
snapshots y presión40/cota32; comparar la etapa completa en procesos frescos. Medir el coste
del guardián añadido y confirmar CI del SHA final, sin afirmar ahorro total a partir de una sola etapa.
No recuperar los generados ni los contratos históricos de VERSION de #195 en bloque.

## Validación de este triaje

Sólo dos ficheros de documentación cambian. No se creó test nuevo, no se alteró un filtro de
privacidad ni se generó `public/`. Las medidas focales y sus exits se incorporan antes de publicar
el borrador. La CI de este documento tendrá su SHA propio; no hereda los verdes de las nueve PR.
Para CHANGELOG de integración: elimina decisiones basadas en fotos antiguas, conserva FIN-04
abierto y separa sucesores de fuente/diagnóstico de publicación y aprobación humana.
