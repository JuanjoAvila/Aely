# Inicio: margen agotado y calendario de Madrid

Estado: candidato para integración por orden expresa del coordinador `a4328161`; sin publicar en beta/main, sin comprobación DOM ni CI final acreditada. Base de claim: beta123 `3625fa7e`; ejecución sobre Widget `6f161fc8`, autorizado por el titular. No acredita móvil, APK ni despliegue.

## Tarjeta del mes

En `cyclePaceState` de `src/modules/03-tab-dash.js`, primero se redondea al céntimo. Un gasto superior al límite sigue siendo exceso/coral. La igualdad ahora devuelve `tight/tan` antes de la salida verde de los primeros tres días. Se reutilizan `v42_cycle_tight` en es/en/ca y los colores existentes. Los umbrales de diferencia entre porcentaje gastado y tiempo transcurrido siguen en −15/10/40. El anillo sigue representando restante/presupuesto.

| Caso sintético | Antes | Candidato |
|---|---|---|
| 900 restantes, día15/30, presupuesto1000 | comfort/mint | igual |
| 200 restantes, día15/30 | tight/tan | igual |
| 0 restantes, día30/30 | good/mint | tight/tan |
| 0 restantes, día1/30 | start/mint | tight/tan |
| −0,01 restantes | over/coral | igual |
| Sin presupuesto | tarjeta vacía y acceso para configurarlo | igual |

## Fronteras del dinero

El productor Widget conserva la propiedad de `lastPaydayOf` (04); esta rama hereda su corrección de nómina. Se cambian exclusivamente `budgetPeriodOf` (08), la rama ciclo de `presetBoundsMs` (04) y el helper compartido `madridDayStartMs` (08). Los informes con fecha explícita siguen usando mes natural; el mes sin ciclo conserva su extremo abierto. Otros presets permanecen iguales.

Con nómina BOOK1800 y compra BOOK12,34 del1oct, a30sep22:01Z, el extremo local de UTC/Canarias ocultaba la compra del día civil de Madrid: gasto0/margen500. Tras compartir el extremo Madrid, Inicio, cabecera del ciclo de Gastos y el escritor real `nat.updateWidget` envían12,34 y dejan487,66. En Madrid las ocho filas del barrido antes/después conservan exactamente fronteras y cifras.

El guardián `tests/nomina-calendario-madrid.test.mjs`, registrado en `run-tests`, ejecuta procesos separados UTC/Madrid/Canarias: cambio de mes/año, bisiesto y DST marzo/octubre antes/después de ocho medianoches. Usa el importador real y el escritor web real del widget, con datos sintéticos; verifica BOOK, veto futura/PDNG/UNKNOWN/duplicada. La integración necesita 37 unidades de dependencia técnica en 19 alcances: 19 del helper, 9 del lector Madrid y 9 de su formatter. La propuesta privada detectó 57 mutaciones. Por orden `a4328161`, el autor retira todas las declaraciones de `beta-sources.json`; el fichero queda idéntico al de la base de ejecución. No se modifica ningún ID, nota, pasos de revisión ni retiro.

## Evidencia y límites actuales

- Tarjeta: rojo causal anterior; verde posterior en UTC/Madrid/Canarias. El test existente sigue matando sus24 mutaciones.
- Calendario: antes UTC48fallos/Canarias48/Madrid0; sólo presupuesto reduce a16/16/0; presupuesto+lista y comparación de payload real:0 en las tres zonas.
- Sintaxis, Gastos período y mes Madrid: EXIT0. Presupuesto de tamaño: EXIT0, 1384146B/380158B con reserva95B y sello123.99999, bajo 1384448/380928B. Topes intactos.
- Se han añadido18 casos DOM cero/negativo, tres idiomas y día1/15/30. NO ejecutados todavía; tampoco se atribuyen los tres rojos originales UTC a una reproducción DOM, ni suite local completa, CI final o aceptación móvil.
- El guardián focal con la propuesta de dependencias dio EXIT1: Catálogo123 congelaba los descriptores. El coordinador respondió que catálogo, retiros y VERSION pertenecen a integración: se entrega sin modificar guardianes ni declarar dependencias. `docs-frescura` da EXIT1 sólo por código candidato sin VERSION nueva; las versiones entre documentos sí cuadran y VERSION/notas pertenecen a la integración.
- FIN01 conserva su lease físico. No se lanza Chromium hasta devolución explícita y admisión propia. No se modifica su cerrojo, ni se adopta por reloj o ausencia de PID.

Inventario focal (15 archivos, grupos de hasta8): inicio-cargos, inicio-v42, inicio-v42-rendimiento, inicio-solape-gastos, inicio-offline, inicio-mes-natural, inicio-grafica-significado, nomina-anticipada, pulido-vacios, pulido-numpad, pulido-apuntar, presupuesto-fluido, presupuesto-bancos, widget-banco, gastos-categorias-presupuesto. La evidencia de cada ejecución y sus salidas reales se conservará antes del result.
