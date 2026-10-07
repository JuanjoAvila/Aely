# INC-2709-09: mapa estructural y dos discriminantes

Auditoría 7/10/2026, sin modificar producto. Fuentes comparadas: main `067371705615e9cc58923509e3f60c3d0c9003ff` (producción98 en el encargo) y beta101 `77b7d5e4d6188ec08c7aea0a598c741bb3025d13`. Son referencias de código, no una nueva comprobación de artefactos servidos. La causa del empeoramiento observado por el dueño sigue **desconocida**. Ni las correcciones100/101/102 ni el borrador103 acreditan una cura global. No se han leído datos reales ni ejecutado conexiones financieras.

## Resultado y límites

Hay dos rutas comprobables que justifican unidades coherentes: trabajo derivado de Inicio repetido por renders locales y ownership de scroll de Plan repartido entre controladores. No hay perfil de frames/heap/React en navegador en esta auditoría: **DOM ejecutado0**. Los contadores Node son trabajo algorítmico, no milisegundos, frames ni una reproducción del lag humano. No se repitió la serie sostenida de30min.

El fixture recuperable es `docs/fixtures/inc-2709-09-structural-audit.mjs`. Usa `git show` local de ambos SHAs, extractores del repo, VM y datos sintéticos; ninguna red. Ejecutar desde la raíz: `node docs/fixtures/inc-2709-09-structural-audit.mjs "$PWD"`. Exit0 en las dos fuentes; emite JSON con hashes, contadores, controles y límites. No es una suite DOM ni un gate de publicación. Requiere ambos objetos Git disponibles.

## Mapa de estado, coste y contratos

| Ruta exacta | Lo comprobado en fuente | Riesgo/medición siguiente | Contrato que conservar |
| --- | --- | --- | --- |
| `11-app-main.js` set y layout effect, `00-core.js` mcPersistCommit/mcSaveRaw | Cada estado nuevo recibe `_savedAt`; persistencia sólo tras commit. Guardado agrupado; histórico partido sólo cuando cambia referencia de expenses, salvo primera migración. | Contar commits, bytes y escrituras por acción con históricos3.000/5.200; distinguir animación local de commit de App. | No guardar estados abandonados ni perder el histórico en la primera escritura partida. |
| syncFromCloud/syncCloudExpenses (`11`) y merges (`00`) | Pull general reconstruye lista con mergeExpenses; pull de gastos tiene secuencia contra respuesta tardía y conserva referencia cuando no cambia. Reconciliaciones financieras y LWW tienen efectos distintos de render. | A/B pull idéntico, cambio legítimo, offline→online y respuesta tardía: comparar identidad y commits sin red real. | Nunca omitir cambios, tombstones, edición local, saldo/anclas, ACK/categoría o reconciliación por una optimización de referencias. |
| totals/budgetStreak (`11:1815–1940`) | Memos con dependencias por slices y día; no dependen indiscriminadamente de state entero. | Medir invalidaciones por slice y coste en cambio de día/FX versus gesto puro. | Preservar gasto, saldo, deuda, cuotas, proyectado y ciclo exactamente. |
| contenidos/contenidoGastos (`11:3395`) | Páginas conservadas; contenido no-Gastos memoiza con state entero y flags de sincronización/drawer. Cambio transitorio puede invalidar varias páginas; tab se excluye deliberadamente. | React real: renders activos/ocultos y recalculados por acción; separar props transitivas y datos derivados sólo tras evidencia. | No perder activación por buses, drafts, scroll, foco ni edición al navegar. |
| Dashboard (`03`) + useCountUp (`02:589`) | Animación local setShown por rAF (duración950ms); render vuelve a derivar listas, presupuesto, próximos y metas. recent filtra/ordena TODO el histórico para mostrar3. | Primer candidato: selector de panel derivado por referencias, aislado de valor animado; A/B de resultados y renders reales. | Mismo orden/empates, fila/identidad, borrados manuales/legacy y edición. No modificar cifras. |
| Plan (`14:151–270`) + syncPageTouchAction (`11:176`) | Plan decide ownership al touchstart; cede al alcanzar scrollTop>2. App también quita/repone la misma clase en scroll/layout effect. | Unificar ownership DURANTE cada gesto; no tocar finanzas ni limitarlo a cambio cosmético. Contraprueba real obligatoria. | Scroll nativo fuera de tope, pull de segmento, horizontal, cancel, ola nativa y reduced motion. |
| Mount/cleanup y capas ocultas | Plan conserva subpantallas montadas tras uso, idle mount diferido4s con cancelación. Diagnóstico previo encontró listener/clase de animación de entrada retenidos al limpiar antes fallback. | Matriz mount→hide→show→dispose, timers/listeners/nodos antes/después de GC. No equiparar nodo oculto a leak. | No desmontar pantallas indiscriminadamente ni perder formularios/estado. Borrador103 no está validado para producto. |
| Caches (`00`, `01`) | Fecha usa Map acotado5.000; tombstones usa WeakMap por array deleted. | Distinguir working set5.200, churn y retención tras GC; heap real pendiente. | No afirmar reconstrucción O(n·d) del set ni fuga permanente: la fuente ya cachea el set. |

## A/B de trabajo derivado de Inicio

Fragmento recent SHA256 `6014d9c52abb332cd393bcdbaab0a99120e4c7dd5786347a257078ac240fb9f8`, idéntico main/beta. Se ejecutó60 veces sobre referencias estables. Variante virtual memoiza por expenses/deleted; controles invalidan cada una por separado, comparan IDs/identidad de filas y ausencia de mutación de entrada. No se editó Dashboard.

| Histórico |60 evaluaciones originales: tombstone / String |60 evaluaciones virtuales: tombstone / String |
| --- | --- | --- |
|3.000|180.000 /4.588.320|3.000 /76.472|
|5.200|312.000 /8.404.920|5.200 /140.082|

String cuenta conversiones de claves y de comparador, no sólo comparaciones de sort. El set borrado está cacheado; aun así el filtrado y ordenación se repiten. Se prueba una reducción de llamadas en un selector puro, no un factor de aceleración de toda la app. Próxima unidad: consolidar derivaciones de Inicio con entradas explícitas estables, pruebas de equivalencia y perfil React/rAF real; ampliar a otras pantallas sólo si sus invalidaciones están medidas.

### Revisión independiente y mapa de invalidación

La revisión del fixture inicial detectó que comparar IDs no probaba identidad de
filas. Corrección: cada resultado se compara también por `===`; un negativo con
filas clonadas conserva IDs pero falla la aserción. Controles pequeños separados
ejecutan empates de fecha con orden estable, edición de fecha/importe con array
nuevo, lápida manual con ID, manual legacy compartida entre dos gemelos, lápida
legacy bancaria y cambio de state ajeno a esas dos referencias. Una variante sin
dependencia deleted queda refutada por el borrado. Estas pruebas no acreditan
render React ni todos los writers del producto.

| Derivación | Entradas/invalidez que no se pueden omitir |
| --- | --- |
| recent | Referencias expenses/deleted; conservar objetos de fila y sort estable. Edición por reemplazo invalida; mutación in-place queda fuera del contrato y requiere auditar writers antes de cachear. No usa reloj ni cifras agregadas. |
| presupuesto de Inicio | expenses/deleted/accounts/reservaLog/budget/flows y settings de ciclo/bancos. lastPaydayOf tiene corte móvil de45d en milisegundos: un cache por día no conserva ese borde. Fechas corruptas usan Date.now en dateMs. No sustituir cálculo por totals ni omitir reservas/nómina. |
| próximos y overdue | fixed/debts/flows/oneoffs/accounts/bankTx/expenses/deleted, pruebas de pago y día/mes/año; fixedPaymentState compara candidatos/cuentas y hechos BOOK. Idioma para etiquetas derivadas. La lista overdue se construye a la vez: memoizar upcoming solo perdiendo ese side result rompería avisos. |
| partyDebts/goals | debts, partyDismissed y calendario: debtPaidCount lee mes y día actual; goals y done/orden. No reducir fechas de deuda al contador animado ni incorporar otras metas al límite visual aprobado. |
| informe mes cerrado | Ventana/día, gastos/bancos/reservas/presupuesto y closedMonthDismissed; el cambio de día puede retirar tarjeta aunque arrays sean iguales. |
| Sparkline | history/current netWorth; sus puntos no tienen fecha comprobada. No crear snapshots ni asignar días mediante el cache. |

Un primer límite coherente separa el contador animado de las derivaciones del
panel y conserva selectores con entradas completas. Antes de modificar dinero,
reproducir invalidaciones de cambio de banco/rol/ciclo, nómina tardía y borde45d,
reservas, BOOK frente pending, pruebas de cuotas/fijos, tombstones/edición,
import/pull concurrente y cierre de día/mes. No congelar resultados económicos
por una referencia state entera ni modificar normalización/contabilidad para
evitar renders. La memoización recent por sí sola demuestra trabajo evitable,
pero no cierra esa unidad estructural ni el lag humano.

### Viabilidad de tamaño de la representación, sin producto editado

Medición virtual del módulo03 con esbuild existente y las mismas opciones del
minificador (whitespace/syntax, sin identifiers, utf8/es2018): recent con useMemo
function-return añade58B; arrow-return44B; levantar deletedSet una vez en la
función78B. Son deltas de módulo, **no artefacto HTML publicado**. El margen del
artefacto102 era12B: ninguna representación probada demuestra cabida. No se
ha encontrado ahorro propio equivalente suficiente; no se suben límites ni se
recortan helpers ajenos, SDK, historial o minificador. NO-GO de esa propuesta
hasta presentar representación legible y medir artefacto completo con margen.
Preauditoría virtual reciente contra32scopes102: ninguno cambia su código, sin
editar el registro. Un selector más amplio debe repetir esa comprobación y
asignar identidades nuevas a cualquier alcance realmente afectado, sin repins.

## INC-0710-01-plan-scroll-top: hipótesis de ownership

Caso nuevo: scroll lento ascendente desde el tope de Plan. Relación UX-01/INC-2709-09 y con INC-2709-03, que sigue describiendo la ola nativa Plan→Gestionar/categoría; **no son el mismo caso**.

Efecto de gesto SHA256 `0f2aca6f0fbfe0d73d408ea4bcfed31522309b37053b110978810a345c30a762`, idéntico en ambas fuentes. Toques sintéticos parten y500, suben20px cada100ms hasta420. scrollTop observado por el modelo: original `[0,20,20,20,20,20]`; variante virtual que mantiene ownership hasta fin `[0,20,40,60,80,80]`. La cesión ocurre tras el primer movimiento. El modelo NO simula el scroll nativo ni demuestra el contrato touch-action del WebView: no convierte esta traza en reproducción humana.

Controles: empezar fuera del tope deja la ruta nativa, horizontal cede, cancel no cambia segmento, cleanup retira handlers/clases. Además, App puede retirar `.mc-touch-own` mientras Plan conserva ownOn=true; fuente indica que touch-action se decide al iniciar gesto. Antes de corregir, capturar clase/ownOn/scrollTop por fase en navegador sintético real y una contraprueba donde la cesión no causa salto. Un controlador único por gesto debe conservar start/move/end/cancel y no permitir que un layout effect cambie la propiedad a mitad de gesto.

La suite `e2e/rendimiento-sostenido.spec.mjs` desplaza táctilmente Inicio/Gastos; Plan cambia segmentos con click. Su verde previo no cubre este movimiento lento desde tope. No repetir toda la serie para sustituir el caso faltante: añadir una reproducción focal real primero.

## Barra: separar indicador, decoración y transición

INC-2709-13 conserva tres contratos: indicador oculto con barra oculta, aparición fluida y decoración Cyberpunk preservada. `.botnav-ind` sólo recibe hide por drawer/perfil (`11:3494`); el colapso del host usa max-height0 y overflow-clip-margin30 (`shell:750`), mientras el indicador está top-9. Eso permite una hipótesis geométrica de indicador fuera de caja, no una captura de su color/píxeles reales. No resolver ocultando todo el nav: `.botnav::after` es la corriente Cyberpunk y debe conservar su contrato separado. Mantener fondo opaco, safe-bottom0/34, invertir hide→show durante transición, settled final y reduced motion en DOM real. Ningún fade de fondo transparente como atajo.

## PRO-02: qué calcula realmente la gráfica de Inicio

Dashboard pasa `state.history` y `tt.netWorth` a Sparkline (`03:230–231`). Sparkline (`02:627`) añade el valor actual, separa X por índice y autoescala Y entre mínimo/máximo; no usa fechas, intervalos, rendimiento, predicción ni rentabilidad. netWorth (`11:1849–1857`) suma efectivo de cuentas y extra OB, inversiones/aportaciones, otros activos y resta deuda restante proyectada. Las series fechadas de inversiones/cuentas son otras estructuras, no esta history.

Auditoría de writers en TODOS los módulos src: core vacío `history:[]`; i18n datos demo numéricos y clone de demo; constructor vacío; migración sólo inicializa si falta; onboarding crea `history:[0]`. No se encontró escritor periódico que tome fotos patrimoniales fechadas ni push/splice/concat de state.history. mcLoadRaw conserva el objeto almacenado, slimForCloud copia state salvo expenses/bankTx y sync general puede adoptar cloudState: series legacy/restauradas pueden entrar sin que esta auditoría acredite su origen temporal. validCloudState verifica arrays financieros principales, no da autenticidad temporal a history. No se consultó cartera del usuario.

Por tanto, una explicación fiel es: «La línea une los valores guardados con el patrimonio neto actual; los puntos siguen su orden y la escala se adapta al mínimo y máximo». Debe aclarar que no representa fechas/rentabilidad comprobadas. El cero del onboarding es una inicialización, no una foto patrimonial real. No presentar «tu evolución real» hasta definir metadatos y writer de snapshots, con revisión financiera y migración autorizada aparte. Esta unidad de explicación no necesita modificar cálculos monetarios.

## Secuencia implementable y gates

1. Consolidar derivaciones de Inicio por slices estables y aislar renders locales de animación: exactitud de resultados con3.000/5.200, cambio de referencia/borrados/edición, empates de fecha y cambio de día. A/B de llamadas ya disponible; perfil real pendiente. No cachear por state completo ni inventar ahorro de batería.
2. Resolver ownership de Plan como una sola unidad de gesto tras fixture DOM causal: slow-top, fuera del tope, horizontal, rápida inversión, cancel, ocultar/mostrar y reduced motion. No integrar una variante que sólo pase el modelo Node.
3. Medir amplificación de sync/render/persistencia en el mismo escenario: pulls sintéticos iguales/cambiados/tardíos, edición concurrente, offline/reentrada, páginas ocultas. Refactor de estructura por dominio sólo si conserva snapshots y contabilidad exactos, sin reconstruir toda la app.
4. Completar lifecycle/heap y contratos visuales de barra con infraestructura real autorizada; tratar103 como WIP, no como cierre global. Explicación PRO-02 separable, sin nueva supuesta historia financiera.

NO-GO de publicación en esta auditoría: sin DOM/perfil real para atribución; sin revisión independiente y CI del SHA de cualquier futura implementación; sin presupuesto de artefacto exacto; sin prueba de regresiones financieras. No subir caps, recortar histórico, reiniciar estado o esconder el síntoma. Visible→beta primero; producción exige aprobación exacta. INC-2709-09 permanece abierto.
