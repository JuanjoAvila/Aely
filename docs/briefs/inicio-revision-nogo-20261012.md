# Inicio: revisión sobre beta119

PR204 en borrador; unidad nueva `inicio-patrimonio-flujos`, base de ejecución
`788432f4682c199edd785f6973d9353330c0064a`. El encargo/claim conserva su base118.
Las actas previas son históricas. Esta revisión no está publicada ni aprobada.

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
