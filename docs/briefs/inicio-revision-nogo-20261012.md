# Inicio: revisión sobre beta119

Este corte conserva la evidencia de la ronda anterior. La segunda revisión
independiente pidió correcciones sobre f274ef04: [continuación concreta](inicio-ronda3-bienes-20261012.md).
VERSION aceptada como rojo de candidata por el coordinador; no repetir CI por ese motivo.

PR204 en borrador; unidad nueva `inicio-patrimonio-flujos`, base de ejecución
`788432f4682c199edd785f6973d9353330c0064a`. El encargo/claim conserva su base118.
Las actas previas son históricas. Esta revisión no está publicada ni aprobada.

## Corte de validación del12/10,19:20UTC

Runtime y pruebas de pantalla congelados en
`16d921c56d5b244bd4b9dd68a82244a5c505c305`. El cierre documental posterior
conserva esos bytes; no atribuye a otra fuente una pasada nueva.

| Gate ejecutado | Resultado real |
|---|---|
| Build, sintaxis, i18n, mapa, seguridad, auth y veredictos | EXIT0 |
| Inicio causal en UTC y Madrid | EXIT0; siete mutantes monetarios muertos |
| `beta-sources` completo, incluyendo Catálogo119/Retiro119 actuales e históricos | EXIT0 |
| Focal DOM propia |31PASS/0FAIL/0skip/0flaky;60.141s;1worker/0retry |
| Cinco archivos originales de rendimiento |14PASS/0FAIL/0skip/0flaky;515.317s;1worker/0retry |
| Inicio CPU6,20000movimientos/400cierres |entrada60.003FPS y arrastre60.004FPS;0frames>32ms;presupuesto12.9ms |
| A/B119, primera pasada |EXIT1: candidato44.670/45.333/60.004; base36.708/31.766/35.296FPS |
| Única repetición efectiva del A/B |EXIT0: candidato60.003/60.004/59.999; base45.003/45.714/44.473FPS |
| Tres reentradas, bytes escritos |candidato2571; base5757, en ambas pasadas |
| `docs-frescura` local |EXIT1: código después del ancla119 sin VERSION nueva; consulta7d349 pendiente |

La repetición del A/B estaba prescrita con GameAssist presente. Se conservan
ambas pasadas, todos sus puntos y el rojo inicial. No se ha probado la causa de
esa diferencia y no se atribuye a GameAssist ni se selecciona sólo el punto60.
Dos intentos de publicación fallaron antes de lanzar la repetición: son errores
de transporte, no pasadas ni reintentos de Playwright.

Las tomas y devoluciones fueron propias y nuevas por fase. La última devolución
`8fb65911888da1160a3515d9c88d5b82619868c9` conserva el nonce62ef y el payload
preparado por el helper canónico. Tras fallar GitTCP443 se publicó por el conector
GitHub con el padre remoto227f, sin force, y se leyó el fichero exacto.
Censo final libre, HTML antes/después
`0cc7d621d4e10a0d97e51eea6fd53d09c80a5e8d0fd49386dee307ba7a1b2cb6`.
No se adoptaron leases ni retornos ajenos, ni se cerró GameAssist.

Pendiente al cerrar este corte: Tests remoto sobre el HEAD final, revisión e
integración de Claude, catálogo/versionado de integración, publicación y móvil.
La funcional completa no se repite en local. La guardia VERSION no se elude.

Tests remoto38297577603 sobreb61f cerróFAILURE/EXIT1: `docs-frescura` y
`metas-pull-transport`. Los demás grupos Node y los siete ficheros Deno reales
pasaron; Deno2.9.7. No entró Playwright funcional ni rendimiento por el fallo
previo, y el paso de Privacidad quedóSKIPPED. Duración1880.0s; `beta-sources`
ocupó1546.01s. El log completo se conserva en evidencia privada.

El banco de Metas extrae el transporte vigente, pero no suministraba `sessionRef`:
el estado válido llegaba al bloque de historial y caía antes de pedir gastos.
Se proporciona la misma sesión sintética que inicia el pull y se usa el helper
real `mergeAccountBalanceHistory`, sin cambiar el transporte ni los oráculos.
Quitar esa única dependencia reproduce los cinco fallos de CI; incluirla da
10/10 EXIT0. El probe temporal fue eliminado. El código, HTML y pruebas de
pantalla/rendimiento no cambian. Nueva CI exacta necesaria tras este ajuste de
prueba; no se presenta la CI anterior como validación del HEAD posterior.

El saldo manual y hoy usan la cifra real mostrada por Cartera, incluidos cobros
modelados. La deuda histórica usa la amortización existente: cuota entera como
salida bancaria, principal como reducción de deuda, intereses como pérdida.
Una fecha mensual sin día exacto no acredita el primer mes completo.
Los bienes conservan escalones manuales; sólo un alta real acredita que no
existían antes. Entre fotos de inversión se suman aportaciones propias fiables.
Si falta un valor o una atribución fiable, se recorta el tramo en vez de inventarlo.
Un traspaso neutro requiere dos patas propias, únicas, opuestas y próximas;
una nómina del mismo importe o una cuenta ajena no forman el par.

Una cuenta sin movimientos conserva su saldo; el efectivo no elimina el tramo
bancario. Los límites reales nombran la cuenta y su primera fecha. El botón
informativo contiene dos frases. La consulta táctil se activa al mantener o
desplazar horizontalmente; empezar un scroll vertical conserva cifra y fecha.

La nube recibe14 cierres por cuenta y14 escalones por bien; el local conserva400.
La unión por fecha evita perder400 cuando un cliente antiguo devuelve30.
El marcador de propietario no autentica sesiones y no mezcla dueños distintos.
El guardado estable no relee las claves grandes; la serie se cachea por referencias
financieras y día de Madrid, sin invalidarse sólo por `_savedAt`.

Cambios visibles: se retira la racha de Inicio; el mes natural conserva el importe
diario con un día restante en el último día. Se distingue «Este mes»/«Este ciclo»
y se muestra «Te quedan». El usuario nuevo lee «Tu histórico empieza hoy».
Sin presupuesto, restante positivo o plazo fiable no hay propuesta diaria.

Siete mutantes monetarios ejecutan oráculos reales sobre el HTML: céntimos,
lápidas, saldo manual actual, sobrado, no finito, primer cierre y foto futura.
El guardián119 declara29 huellas web heredadas y una unidad nueva, conserva
nativo/Edge y los contratos históricos Catálogo119/Retiro119. El escritor
compartido cambia las huellas de los widgets; sus cifras, APK y guiones no cambian.
Ninguna aprobación se hereda por arrastre.

Estado al preparar el acta: build y casos Node causales pasan en WIP. Pantalla,
rendimiento completo, tres entradas CPU6 contra119 y CI final pendientes.
Funcional completa sólo en Tests remoto. Consulta VERSION pendiente: no se
elude cambiando la rama ni rebajando guardas. Se conservan rojos y omisiones previos.

La primera focal0361901f dejó27PASS/4FAIL, sin omisiones ni reintentos. Sus tres
rojos del anillo demostraron que pintaba gastado junto al restante: corregido
para representar el porcentaje restante. El cuarto buscaba `.spark` en la hija
fullMode, donde no se monta. Se conserva el CSS del renderer legado y se prueba
su componente real con el CSS servido, mediante un contenedor sintético; eso no
acredita que exista una puerta actual hacia la gráfica legada.
El mínimo medido tras esta corrección es1.360.370/372.460B, DSN sintético95B y
sello119.99999, gzip9:1329/364KiB, margen526/276B. Sin topes adicionales.

Cinco pasos propuestos para el móvil cuando esté publicado:

1. Contrastar el total de Inicio con cuentas, inversiones y bienes menos deudas
   en Cartera. Una cuenta manual debe coincidir en ambos sitios.
2. Consultar un punto de dos días conocidos: un gasto reduce por su importe;
   un traspaso entre dos cuentas propias no cambia el total. Comparar sólo el
   tramo que tenga datos de todas las cuentas y sumar los movimientos entre días.
3. Revisar una cuota: el cambio debe reflejar intereses y otros movimientos
   del día, descontando el principal amortizado.
4. Hacer scroll vertical desde la gráfica: cifra intacta. Mantener o arrastrar
   horizontalmente muestra fecha/importe; al soltar vuelve el total actual.
5. Revisar «Este mes», «Te quedan» y gasto diario: último día tiene un día;
   presupuesto agotado no ofrece importe diario.
