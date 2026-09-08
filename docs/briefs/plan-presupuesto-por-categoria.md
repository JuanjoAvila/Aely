# Presupuesto por categoría — un límite en Súper, Bares u Ocio

> Idea §5.2 del backlog histórico («al usuario LE GUSTAN TODAS», 2026-07-13). Claude dijo en su
> día que su pareja lo usaría seguro y él no lo negó. Diseñado el 2026-09-08.
> **La mitad del modelo ya existe y nadie la usa.**

## Lo que ya está

`state.categoryBudgets` se inicializa desde 2026-07 (`01-i18n.js`, dos sitios: el estado vacío y
la migración) con el comentario «límites €/mes por categoría (§5)». **Y no lo lee nadie.** Es un
objeto vacío que viaja a la nube en cada guardado sin hacer nada. Esta tanda le da uso; no hay que
inventar dónde guardar nada ni migrar.

## Qué se añade

Un límite opcional por categoría, con su barrita, sin tocar el presupuesto general.

- En Gastos: desglose del mes por categoría, ordenado de más a menos. Hoy **no existe** ningún
  desglose por categoría en la app: hay que escribirlo, y es la mitad del trabajo de la tanda.
- Poner un límite a una categoría desde ahí. Sin límite, solo se ve el gasto.
- Barrita por categoría con el mismo lenguaje visual que el presupuesto general.

## Decisiones tomadas (reversibles si dice otra cosa)

- **No cambia el presupuesto general.** Un límite de categoría es informativo: no resta, no
  bloquea, no cambia «lo que puedes gastar». Si algún día quiere que sí, es otra conversación.
- **Cuenta lo mismo que la cabecera de Gastos**, o sea `expenseCountsBudget`. Un gasto que no
  cuenta para el presupuesto tampoco cuenta para el límite de su categoría. Si no, un recibo de
  otro banco llenaría la barrita de «Hogar» sin mover la cifra de arriba, y eso es incoherente.
- **Cero avisos en esta tanda.** Los avisos del presupuesto los manda el SERVIDOR (`ingest`), y
  meter ahí los límites por categoría obliga a desplegar la Edge Function del Supabase compartido
  —que es de producción también— y a duplicar la regla en dos sitios otra vez. Primero que lo vea
  y decida si los quiere; los avisos van aparte y con su OK.
- **Sin límite = sin barrita**, solo la cifra. Nada de inventar un límite por defecto.

## Las trampas

- **La ventana del mes es la de la casa** (`inicioDeMesMs`). Y ahora también hay tope superior
  (`hastaMs`, 4.19.12): el desglose del informe del mes cerrado tiene que usar el mismo, o dirá
  una cosa distinta de la tarjeta que está justo al lado.
- **Categorías neutras fuera.** Inversión y traspaso no son gasto; no pueden aparecer en el
  desglose ni llenar una barra.
- **Una categoría sin gastos este mes no ocupa sitio**, pero si tiene límite puesto sí debe
  verse (a 0), o parecerá que se ha borrado el límite.
- **`categoryBudgets` viaja en `app_state`**, que se sube entero cada 1,2 s. Guardar un objeto por
  categoría es barato, pero no meter ahí nada que crezca sin tope (histórico, por ejemplo).
- **Renombrar o borrar una categoría** no puede dejar un límite huérfano cobrando en la sombra.

## Criterios de «hecho»

1. Gastos enseña el desglose del mes por categoría, de más a menos, y la suma de las que cuentan
   coincide **al céntimo** con la cifra de la cabecera.
2. Inversión y traspaso no salen en el desglose.
3. Poner 200 € a Súper: barrita que se llena con lo gastado en Súper ese mes, y nada más cambia
   —ni el presupuesto general, ni el widget, ni los avisos.
4. Quitar el límite deja la categoría con su cifra y sin barra.
5. Un gasto de un banco que no cuenta para el presupuesto **tampoco** llena la barra de su categoría.
6. Un límite de una categoría que ya no existe no rompe la pantalla ni suma en ningún sitio.
7. El desglose del mes CERRADO (el del informe) da los mismos números que dio ese mes.
8. Tres idiomas, diálogos propios, sin `alert`.
9. `tests/presupuesto-categoria.test.mjs` en rojo antes, registrado en el runner. Y
   `presupuesto-servidor` sigue verde: esto no puede haber movido la cifra general.

## RELEASE_NOTES (en cristiano)

> **Ponle tope a lo que más se te va.** En Gastos ves en qué se te va el mes por categorías, y
> puedes ponerle un límite a las que quieras —Súper, Bares, Ocio— con su barrita. Es solo para
> verlo: no cambia tu presupuesto ni te bloquea nada.
