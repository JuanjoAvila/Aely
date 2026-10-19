# Plan y ficha del gasto: evidencia de pago

Corrección de presentación sobre `7090802099ac0c7956c0d3597a9936a82c52a95f`.

Una cuota vencida puede estar descontada de la previsión sin tener un cargo vinculado.
Ahora aparece en «Por confirmar», sin marca de pago. Un `paidYm` sin prueba
tampoco se presenta como pago acreditado. El subtotal de «Ya pagado» corresponde a
sus filas visibles; los importes, saldos y totales financieros originales no cambian.
El modo sencillo usa el mismo criterio en la lista y en la frase de la portada.

`paymentEvidenceUI` lee las pruebas ya validadas por el motor. La ficha necesita además
una fila única, sin lápida ni veto, y sin contradicciones entre referencias, cuentas,
ordinales o marcas explícitas. Una prueba BOOK v2 conserva su identidad original al
renombrar el recibo y sin extracto local. Los puntuales solo se acreditan visualmente
con una marca explícita firme y un cargo bancario único. No se infieren ni se guardan
vínculos nuevos. Los avisos de marcas dudosas conservan la posibilidad de corregirlas.

El aviso afirmativo de retirada exige `category=traspaso` y el timestamp existente de
confirmación. Ser candidato a la acción manual no lo convierte en una retirada.

Pruebas dirigidas: `tests/payment-evidence-ui.test.mjs` y
`e2e/plan-expense-links.spec.mjs`, registradas en los runners. El protocolo de entrega
conserva el ROJO del bundle base, la comparación exacta de Inicio/Plan/widget con esa
base, las mutaciones rechazadas y snapshots idénticos antes/después de abrir las vistas.
Las fixtures son sintéticas y la prueba de navegador bloquea toda red externa.

No se modifica el contrato financiero de `paid`, matching, importación, reconciliación,
persistencia o nube. VERSION y catálogo no cambian. Esta propuesta no acredita revisión
de Claude, integración, CI general, despliegue ni aceptación en móvil real.

## Remates R1–R3 sobre la primera propuesta

Base de esta ronda: `c10df468e6780dfc15b27ef688daa2d38ba8e2b6`, en la misma PR281.
La ficha conserva el nombre de una marca explícita no acreditada con «sin confirmar»;
si su destino falta o es ambiguo, muestra «—». Una marca inexistente sigue mostrando
«No». Esto no valida la relación ni modifica IDs, pruebas o importes.

Plan distingue «Por pagar», que contribuye al restante, de «Por confirmar», que no
se añade a ese importe y conserva su propio contador. Las filas mantienen el banco
sin repetir el estado. En modo normal, los traspasos previstos aparecen aparte de los pagos pendientes.
La portada sencilla dice «Todo pagado, salvo N cargo(s) por confirmar», con singular
y plural en español, inglés y catalán; conserva las frases de pago completo y de
pagos realmente pendientes.

`tests/payment-presentation.test.mjs` comprueba esas presentaciones, los destinos
ausentes y los importes discrepantes (197,50 frente a 197,00; 30,49 frente a 29,99).
El e2e amplía los casos de ficha y Plan a los tres idiomas. Su caso plural usa cuotas
de distinto importe para que la vinculación automática de arranque no convierta una
de ellas en un pago confirmado antes de probar la presentación. Las comparaciones
de esta ronda conservan además el estado y los resultados financieros de ambas bases.

La revisión de integración de documentación y tamaño sigue pendiente: no se modifica
VERSION, catálogo ni presupuestos para franquear esos controles.

## Regresiones de portada y recibos vencidos

Ronda 3 sobre `564efba46b31464a3a0f2dbf1b13c83878f8266e`, en la misma PR281.
Un recibo vencido sin pago observado conserva «Sin pago acreditado» junto al banco.
Una cuota descontada por calendario sigue en el grupo separado «Por confirmar».
La portada sencilla prioriza el saldo conocido negativo: con −80 € y un cargo por
confirmar muestra el saldo y evita afirmar «Todo pagado».

El modo sencillo conserva «Lo que aún saldrá» y agrupa recibos y movimientos entre
cuentas como antes. Si hay movimientos entre cuentas, la explicación precisa que
solo los recibos y las cuotas contribuyen al restante. El catalán usa «Es suma» y
«No es suma». No cambia ningún total financiero ni se guarda ninguna marca nueva.

Cinco expectativas antiguas de `plan-cover` que confundían `paidYm` con prueba de
pago se ajustan al diseño aprobado; el caso de saldo negativo mantiene y amplía su
comprobación de −80 €. La validación enumera todos los ficheros del mapa de Gastos y
Plan, con resultado individual y límites explícitos para las pruebas que requieren
CPU6. `inicio-cargos` contiene actualmente 78 casos, no solo los 21 citados en la
solicitud de revisión; se valida el fichero completo.

La expectativa previa de `retirada-bancaria` se alinea con el aviso aprobado: antes
de confirmar exige la explicación neutra y la acción, sin afirmar que ya sea una
retirada confirmada. El recorrido posterior de Traspaso y banco se conserva.
