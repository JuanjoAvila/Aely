# Informe del mes cerrado — la tarjeta del día 1

> Idea §5.3 del backlog histórico. **«Le encanta» a su pareja**, y por eso sube de prioridad.
> Diseñado el 2026-09-08. Cliente puro: sin Supabase, sin migraciones, sin Android.

## Lo que YA existe (no rehacerlo)

`shareMonthReport()` en `src/modules/02-ui-shared.js` ya pinta un informe del mes en un canvas y lo
comparte o lo descarga como PNG, con paleta fija por tema y aviso de dónde queda el fichero. La
idea §5.3.6 («exportar informe PDF/imagen para WhatsApp») está **hecha**.

Lo que falta es la otra mitad de §5.3.3: que el informe **le salga solo** cuando el mes cierra, en
vez de tener que acordarse de ir a buscarlo.

## Qué se añade

Una tarjeta en Inicio los primeros días de un mes nuevo, con el resumen del mes que acaba de
cerrar y un botón para compartirlo. Se puede descartar y no vuelve.

- Gastado del mes cerrado contra su presupuesto.
- La categoría que más se llevó.
- Lo que ahorró de verdad en el ciclo (ingresos − gastos que cuentan).
- Botón → `shareMonthReport` **de ESE mes**, no del actual.

## ⚠ LA TRAMPA, y hay que cerrarla antes de codear

`monthBudgetStats(state, nowMs)` (`08-motor-bank.js:564`) filtra así:

```js
const startMs = inicioDeMesMs(nowMs != null ? nowMs : Date.now());
(state.expenses||[]).forEach(function(e){
  if (dateMs(e.date) < startMs) return;      // ← SOLO tope inferior
```

O sea que **no calcula «ese mes»: calcula «desde el día 1 de ese mes en adelante»**. Pasarle una
fecha de agosto devolvería agosto + septiembre + todo lo que venga después. Si el informe se hace
con eso, le enseña una cifra inventada del mes cerrado — y encima parecida a la buena, que es la
peor clase de error.

**Cierre:** tope superior OPCIONAL, `hastaMs`, que por defecto es infinito. Así los llamantes de
hoy —Inicio, la cabecera de Gastos y el envío al widget— siguen dando exactamente lo mismo, y el
informe pasa el día 1 del mes siguiente. Cualquier otra forma de acotar (recortar la lista antes
de llamar, duplicar la función) acaba en dos reglas distintas, que es el bug de los 965 €.

`statsDelMes` del servidor NO se toca: recibe las filas ya acotadas por fecha desde la consulta.
Pero `tests/presupuesto-servidor.test.mjs` tiene que seguir verde, porque es el que garantiza que
cliente y servidor cuentan igual.

## Las otras trampas

- **La ventana del mes es la de la casa**, `inicioDeMesMs` (Europe/Madrid, B09-B). No inventar otra
  ni usar `getMonth()` local: el día 1 a las 00:30 en España caería en el mes anterior en UTC.
- **Nada de persistir el informe.** Se calcula en vivo sobre los gastos que hay. Si guardáramos un
  resumen del mes cerrado tendríamos un dato más que sincronizar, que puede quedar rancio y que
  contradiría a Gastos si él edita un movimiento viejo. Lo único que se guarda es «esta tarjeta ya
  la descartó», y eso va en `settings`.
- **Si el mes cerrado no tiene nada**, la tarjeta no sale. Un informe de 0 € es ruido.
- **Si no tiene presupuesto puesto**, se enseña el gasto y la categoría, sin inventarse un
  «te pasaste» contra un presupuesto que no existe.
- **Un mes ya descartado no vuelve**, ni al cambiar de pestaña ni al reiniciar. Y al cerrar el mes
  siguiente sí sale otra vez, con el mes nuevo.
- **`shareMonthReport` necesita saber de qué mes va**: hoy el nombre del fichero sale de
  `new Date()`. Pasarle el mes y que el nombre y el título lo respeten, sin romper la llamada
  actual (parámetro opcional, por defecto el mes en curso).

## Criterios de «hecho»

1. El día 1 (y los primeros días) sale la tarjeta con el mes cerrado; el resto del mes, no.
2. Las cifras de la tarjeta **coinciden con lo que enseñaba Gastos ese mes**, al céntimo.
3. Un gasto del mes NUEVO no se cuela en el informe del mes cerrado. Este es el test del tope.
4. Descartarla la quita para siempre; al cerrar el mes siguiente vuelve, con el mes nuevo.
5. Compartir genera el PNG **de ese mes cerrado**, con su nombre de fichero.
6. Sin presupuesto puesto: informa sin inventarse comparación.
7. Mes sin movimientos: no sale la tarjeta.
8. Tres idiomas, diálogos propios, sin `alert`.
9. `tests/informe-mes.test.mjs` en rojo antes, registrado en el runner. Y
   `presupuesto-servidor` sigue verde: el tope nuevo no puede haber cambiado el mes en curso.

## RELEASE_NOTES (en cristiano)

> **El resumen del mes te sale solo.** Al empezar el mes, Inicio te enseña cómo acabó el anterior:
> cuánto gastaste, en qué se te fue más y cuánto ahorraste. Con un toque lo compartes como imagen.
