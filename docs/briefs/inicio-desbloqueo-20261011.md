# Inicio v4.2: cierre ligero del desbloqueo

Encargo `inicio-v42-desbloqueo-codex-20261011`, desde el candidato
`38aea2efb3efa92eb9735a34e47f3a1d6c7e741b` de PR204. Esta fase conserva
la entrega bloqueada anterior y prepara código local para el turno de máquina.

La serie agrupa el formateo de fechas por hora únicamente cuando ambos extremos
pertenecen al mismo día civil de Madrid. Las horas que atraviesan medianoche
conservan el formateo por movimiento. La acumulación diaria evita crear otro
array de 20.000 objetos. Una referencia independiente contrasta cada cierre en
ambos cambios horarios, con importes positivos y negativos y el total final exacto.
`netWorthDebtPolicy` reúne en un punto los dos criterios provisionales: deuda
actual constante y cuotas vinculadas neutras, pendientes de confirmación del dueño.

Se retiran el Sparkline antiguo sin llamadas, su CSS, diez claves de traducción
sin uso por idioma, el pie del ciclo sustituido y el helper `dashOrderOf` sin llamadas.
El smoke verifica la ausencia de la racha retirada por el diseño 3b y la presencia
del estado del ciclo. Su DOM todavía requiere ejecución en navegador.

Los guardianes de auth y veredictos mantienen las fuentes históricas junto a sus
descriptores históricos. La partición del historial exige identidad nueva y no
hereda aprobaciones antiguas. El descriptor vigente `inicio-grafica-vuelve` y sus
mutantes se actualizan en un commit técnico separado, sin repinar alias ni notas.

## Comprobaciones ligeras

Build, sintaxis, lógica Inicio en UTC y Europe/Madrid, auth-disposal,
beta-veredictos, i18n, mapa y beta-sources **sólo con `--inicio-v42-only`** terminan
con salida 0. No se acredita la suite completa de beta-sources ni npm ni navegador.
La atribución Node compara la misma serie sintética de 20.000 movimientos contra
38aea2ef: 20.201 llamadas de formato frente a 9.803. No acredita FPS ni sustituye
la comparación requerida contra beta684 con CPU ×6 y tres pasadas estables.

Medición LF, esbuild oficial sin renombrar identificadores y gzip nivel 9:

| Fuente | Minificado | Gzip | Con reserva de publicación, min/gzip |
| --- | ---: | ---: | ---: |
| Beta684 | 1.324.985 B | 361.834 B | 1.325.091 / 361.875 B |
| Candidato38 | 1.342.460 B | 366.653 B | 1.342.566 / 366.704 B |
| Cierre ligero | 1.340.391 B | 366.357 B | 1.340.497 / 366.413 B |

El corte reduce 2.069 B minificados y 296 B gzip respecto a38. Con el mismo sello
de versión `.99999` y reserva sintética de configuración de95 B, permanece un
exceso de **14.417 B minificados y 3.917 B gzip** sobre los límites existentes
de1.326.080 y362.496 B. Siguen tres recursos bloqueantes. Los topes no se cambian.

## Rebase sobre beta114

La orden canónica `maquina-liberada-beta114-codex-20261011` anuncia la base
`8adba5202a0444b386e3957a3c5ba499cf88e622`. La rama rebasa sobre ella conservando
PR207, PR203 y PR205. Los únicos conflictos fueron tres revisiones del HTML
generado, reconstruido después desde las fuentes. El commit del descriptor sigue
separado; los demás descriptores coinciden con beta114.

PR203 espera el cierre diario antes de espiar las escrituras de Bienes. Se adapta
su lectura a `mcLoadRaw`, porque la partición de Inicio mueve ese historial fuera
de la clave principal. No se atribuyen todavía los fallos previos a una causa
demostrada en navegador. El guardián de alias compara todas las tandas con alias
contra su fuente anterior, sin calcular las altas nuevas que no tienen alias
contra un catálogo histórico que aún no las contenía.

El bundle reconstruido mide 1.340.397 B minificados y 366.358 B gzip. Con la
misma reserva de publicación mide 1.340.503 / 366.413 B: exceso **14.423 / 3.917 B**.
La nueva fase requiere evidencias propias; las mediciones previas no acreditan FPS
ni el resultado de una suite completa sobre esta base.

## Pendiente antes de entregar

Widget liberó el recurso y el grant propio autorizó la fuente ae8edf51. npm completo
terminó con salida1 en583,75 s: instrumento de recientes, beta-sources por el
contrato histórico114, docs-frescura por código posterior al ancla versionada y
presupuesto de tamaño. Las cinco suites Deno se ejecutaron con salida0; el runner
no abrió Playwright porque ya había fallos de Node. La ruta de memoria inexistente
produjo la omisión prevista del espejo privado, sin alterar su filtro.

Se corrige la firma exacta que el instrumento busca en Dashboard, conservando sus
controles de ancla ausente/duplicada, parser y callback real. La entrega histórica114
se contrasta con su SHA8adba520; en la fuente actual se exige que todos los demás
descriptores sigan idénticos y el guardián propio vigila el descriptor de Inicio.
La prueba focal de Inicio incluye ahora esa comparación histórica relacionada.
No se aflojan asserts de identidad, umbrales de rendimiento ni límites de tamaño.

Los dos JSON públicos de catálogo/notas derivados por build se restauran a su
contenido comprometido después del terminal y se retira el deno.lock creado por
esta ejecución. Estos archivos de prueba no cambian las notas fuente ni su versión.
Las nuevas correcciones sólo tocan instrumentación, tests y esta acta: el HTML de
producto sigue igual al normalizar LF. Antes de repetir pruebas pesadas se publica
y lee el nuevo SHA congelado, con actualización del grant por el delegado.

Durante la reserva de Claude para integra115 se revisa sólo el CSS propio. El
título del ciclo nuevo sustituye todas las declaraciones del `.st` antiguo;
sus variantes `warn`/`bad` no tienen llamadas y el color de tema claro queda
sustituido por el color heredado explícito del renderer. Se retiran esas reglas
y el subtítulo del patrimonio hereda su peso y color ya definidos en `.v4-micro`.
Se mantienen las dimensiones, animaciones, textos y las tres reglas base activas
del ciclo. También se retira `V4Ring`: la base684 lo llamaba desde Inicio, pero tras
su sustitución por el anillo de76 px no queda ninguna llamada en las fuentes.
Las tres reglas base activas entran en el descriptor propio con mutantes explícitos,
en un commit técnico separado; ningún descriptor ajeno cambia.

El corte conjunto ahorra **1.497 B minificados / 361 B gzip** respecto a662588c3.
Bundle LF oficial: **1.338.900 / 365.997 B**; con la misma reserva de publicación:
**1.339.006 / 366.051 B**. Permanece un exceso de **12.926 / 3.555 B**. El guardián
de tamaño mantiene salida1 y tres recursos bloqueantes. Build, sintaxis, lógica de
Inicio en UTC y Madrid, auth, veredictos y los guardianes focales pasan; no se ha
abierto Chromium para esta revisión.
Los demás cálculos y reglas de dinero quedan intactos. La identidad de fuente
cambia: antes de las suites completas necesita la base anunciada y un grant nuevo.

Módulo11 sigue intacto. Las causas de Bienes y Metas contra beta684, PR203,
rendimiento y suites de navegador siguen pendientes. Los resultados Node no
acreditan otra revisión ni aceptación móvil. No hay integración de este cierre.
