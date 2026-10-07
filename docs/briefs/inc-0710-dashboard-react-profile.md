# INC-2709-09 · Perfil de Dashboard dentro de App · 7/10/2026

## Estado

Diagnóstico preparado sobre `48410e5b9c47f48dd0462d8bb84192a1f73efbce`,
tree `839c975d8ba3ca7a9c3a7a53c1b474c01b160971`: producto equivalente a beta102
`6b81279676d66337d7b34b7badc6d1ff2c66bc24`. Sólo pruebas, documentación y registro.
**0 DOM ejecutados localmente. Revisión independiente y CI exacta pendientes.**
INC-2709-09 sigue abierto; no se acredita causa ni resolución del lag humano.

## Hipótesis acotada

Dashboard deriva sus tres movimientos recientes en cada render: filtra todas las filas,
consulta las lápidas y ordena el resultado. Renders por estado local o propiedades ajenas
al histórico pueden repetir ese trabajo. La lectura estructural demuestra ese recorrido,
pero no demuestra su frecuencia/coste real dentro de React ni que cause el síntoma prolongado.
Este guion busca medir esa frontera antes de proponer una optimización de producto.

`expenseDeletedSet` actual conserva un WeakMap por referencia de `deleted`: no se afirma
que reconstruya una tabla O(d) en cada fila. Se incluyen 100 lápidas para distinguir ese
contrato de una reconstrucción accidental O(n·d). La métrica `rows` cuenta filas filtradas;
`comparisons` cuenta comparaciones de sort, no se presenta como un perfil de todas las finanzas.

## Instrumento y aislamiento

`e2e/dashboard-profile-instrument.mjs` transforma únicamente la respuesta del HTML local:

| Ancla exacta, única | Cambio exclusivo del banco de prueba |
|---|---|
| Entrada de Dashboard | Captura state, totals y setter de props reales de App. |
| Expresión recent completa | Observa filtro y sort originales; alternativa virtual de cache por referencias expenses/deleted. |
| Declaración syncCloudExpenses | Expone la closure real para invocar un pull contra el doble Supabase ya instalado. |

No cambia el algoritmo financiero, no reemplaza App por un componente de juguete,
no añade código a src ni escribe el HTML instrumentado en public. Si cambia cualquiera
de las tres anclas, el test falla cerrado. Registra SHA de git real, hash del guion,
HTML original e instrumentado, navegador, versión y CPU×6.

La cache es **virtual y no publicada**. No se usa como autorización de una versión nueva.
La igualdad se compara contra la expresión original con filas `===`, orden y objetos originales;
el oracle se ejecuta fuera de las ventanas medidas para no cargar de nuevo el histórico en cada
hit y falsear el A/B. Fuera de esas ventanas se comprueban textos/importes de **las filas
recientes** en el DOM real, no igualdad del layout de toda App.

La ruta aborta peticiones externas; Supabase, sync y altas son dobles/datos sintéticos.
No dispara sync bancaria, no lee cuentas reales, no despliega Edge ni ingiere pagos.
El setter y la closure conservan su implementación real; no se sustituye el merge.
El instrumento observa cloud.bankSync/bankSyncHistory desde la primera entrada de Dashboard,
antes de efectos, y exige cero intentos durante arranque y campaña: abortar red no basta para
acreditar ausencia de llamadas al doble. Control positivo Node verifica contador, receiver,
retorno y restauración de ambos métodos. No ejecuta red ni añade anclas de producto.
`renders` cuenta entradas de derivación/intentos de render, no commits de React.

## Campaña registrada

Dos casos de `e2e/dashboard-react-profile.spec.mjs`, con 3000/5200 movimientos sintéticos,
empates de fecha y 100 lápidas sobre filas antiguas. Registrados bajo Dashboard en E2E_MAP;
el runner los envía al grupo serial de rendimiento, conservando los límites de otros tests.

| Fase/control | Contrato que debe discriminar |
|---|---|
| Cuatro aperturas del presupuesto y back real, baseline | App/Dashboard reales; derivación en cada render; sin escritura del histórico. |
| Mismo recorrido, cache virtual | Reuso cuando referencias relevantes no cambian; mismos objetos y DOM financiero. |
| Settings ajenos y reloj civil | Referencias expenses/deleted intactas, hits; mismas filas recientes. |
| Edición de la primera fila y su inversa | Nueva referencia invalida; filas anteriores no se mutan; importe/texto en DOM cambia y se restaura. |
| Lápida manual antigua y su inversa | deleted invalida; se retira/restaura la fila correcta, sin tocar expenses. |
| Alta por pull sintético | Closure real syncCloudExpenses procesa una fila legítima del doble; aparece en recientes. |
| Bloqueo artificial 3×180ms | Instrumento detecta RAF>100ms y tareas largas; separado del síntoma humano. |
| Recuperación sin bloqueo | RAF nativo sigue produciendo muestras; máximo del control supera 3×mediana recuperada. |

Reloj de fecha: fixture civil 26/9/2026 y desplazamiento de un día para ese control.
No se reemplazan RAF, performance.now, temporizadores ni timestamps monotónicos.
Las ventanas registran coste de filtro/sort/derivación, número de renders/cálculos/hits,
frames y longtasks, duración y escrituras. No se exige un ahorro temporal arbitrario ni se
confunden menos cálculos con menos lag humano. El bloqueo es una contraprueba del instrumento.

## Comprobaciones locales y pendientes

- Build legible de la fuente base, sin delta generado persistente.
- Node `tests/dashboard-profile-instrument.test.mjs`: tres anclas ausentes/duplicadas fallan;
  parser no vacío; helpers financieros reales; filas por identidad, empates, edición, lápidas
  exactas/legacy, excepciones y arrays sin mutación. Matriz 3000/5200 con 100 lápidas:
  ocho cálculos baseline frente a un cálculo y siete hits virtuales. Es Node, no React/DOM.
- Guardian relevante, privacidad, sintaxis y diff sin errores.
- Discovery Playwright lista **2 tests**; usa adaptador temporal al runtime ya instalado,
  sin dependencia nueva ni instalación de navegador.
- Ninguna campaña DOM local: Chromium no está disponible. No se atribuyen renders, cifras
  de ms/frames ni resultados financieros del navegador hasta obtener la CI oficial exacta.

Comando de la campaña tras build y dependencias normales del repo:

```sh
node node_modules/playwright/cli.js test e2e/dashboard-react-profile.spec.mjs --workers=1
```

Los JSON adjuntos por test contienen resultados completos, hashes, fases y errores; un fallo
también guarda evidencia. El workflow test.yml no sube esos adjuntos: el finally imprime
además el JSON sintético completo, sin truncar, entre
`AELY_DASHBOARD_SYNTHETIC_REPORT_BEGIN size=…` y
`AELY_DASHBOARD_SYNTHETIC_REPORT_END size=…`. Se puede recuperar por el lector oficial de
logs incluso cuando falle una aserción; no contiene datos reales. Los hashes y size permiten
vincular cada informe al caso y fuente exactos. Este cambio requiere CI de la nueva fuente;
una ejecución del head anterior no acredita este transporte de evidencia.
La instrumentación retira RAF, observer y wrapper de Storage al
final; el contexto aislado de Playwright se cierra después. No hay proceso en segundo plano.

Siguiente gate: revisión del árbol exacto y CI con Chromium oficial. Si allí aterrizan los
controles, usar sus medidas para decidir una unidad de producto separable y financieramente
equivalente, con presupuesto HTML intacto, invalidaciones completas y nueva identidad cuando
corresponda. No heredar aprobaciones ni promover beta102 completa por este diagnóstico.

## Campaña parcial y control pendiente (7 de octubre)

CI 37691444682, head de comprobación 951f3949355d788d01ce9007837f16a753706c8d,
árbol 5cfd4e1b9d25c6fb2b7e817e4533f56a20d23280: FAILURE. Los cuatro informes
completos (3000/5200, intento y retry) fallaron en el control artificial: hubo frames
de 166–183 ms, pero longtasks vacío. Los controles anteriores de filas, invalidaciones
y sincronización sintética pasaron. Ocho intentos de derivación calcularon ocho veces
en baseline frente a una y siete hits en la variante virtual; no son commits React.
Las medidas parciales no validan el instrumento completo ni el lag humano.
La recuperación natural y el control final bancario no llegaron a ejecutarse;
el guard inicial sí pasó. No interpretar un campo final ausente como cero llamadas.

La revisión del test mantiene todos los umbrales y programa el bloqueo en un callback
setTimeout, como tarea del navegador. Que la evaluación DevTools explicase la ausencia
de longtasks es una hipótesis pendiente de Chromium. finally captura bankCallsAtFinal
como array o null incluso tras un fallo. Guardian Node y revisión independiente GO
limitado al test; ninguna nueva campaña Chromium ejecutada para esta corrección.
No hay implementación de producto ni aumento de presupuesto. El siguiente encargo
debe verificar fuente y árbol corregidos, CI completa, privacidad y controles finales.
