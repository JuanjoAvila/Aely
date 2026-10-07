# INC-2709-09 · Auditoría acotada de ciclo de pantallas

Diagnóstico sobre fuente `0fe497db07f0cd8e2e2e3e947032c13b7ab25d2a`, árbol
`839c975d8ba3ca7a9c3a7a53c1b474c01b160971`. Sin cambios de producto, nueva
versión, publicación ni reasignación de identidades de beta. El lag acumulativo
humano permanece abierto: este resultado no acredita su causa.

## Hallazgo discriminante

`PlanTab`, en `src/modules/14-v4-screens.js`, efecto de entrada dependiente de
`[seg]`: registra `animationend`, añade `v4-seg-enter-down/up` y programa una
salvaguarda de 500 ms. `clear()` retira clase y listener; el cleanup del efecto
sólo cancela el temporizador. Si el efecto se limpia antes del evento y antes
de esa salvaguarda, queda el listener junto con la clase. No se procesa ni se
inventan datos de cuentas para demostrarlo.

El gesto vertical confirmado por el código asigna `enterDirRef` antes de
`setSeg(nextId)`. Los segmentos montados conservan su nodo mediante `capa()` y
se ocultan con `contentVisibility:"hidden"`, sin desmontar. Tocar directamente
un botón no inicia otra entrada, pero sí cambia `[seg]` y puede interrumpir la
entrada previa. No se afirma que ocultar el segmento siempre cancele la
animación: depende del motor CSS y requiere navegador. La regla real de
`prefers-reduced-motion:reduce` pone estas animaciones a `none`; ése es un
camino concreto sin `animationend` que debe probarse en la UI.

## Contraprueba del fragmento real

Se extrajo literalmente el efecto (SHA256
`f9766f17eca6d87368fce4d26a7b3c88e4d1f83b00ae6aa78c166caa94ea9296`) y se
ejecutó en Node `vm` con nodos persistentes, classList, eventos y temporizadores
sintéticos. No es React real ni un motor CSS. Los cambios/cleanups se entregan
sin transcurrir 500 ms y sin emitir `animationend`, representando el contrato
de ese caso; no se mide una cadencia de gestos humanos.

| Caso | Listener final | Clases finales | Timers finales |
|---|---:|---:|---:|
| Evento normal seguido de cleanup | 0 | 0 | 0 |
| Fallback de 500 ms seguido de cleanup | 0 | 0 | 0 |
| 12 entradas y cleanups anticipados, tres nodos persistentes | 12 | 3 | 0 |
| Mismos 12 ciclos, cleanup virtual con `clear()` | 0 | 0 | 0 |

El recuento de listeners retenidos crece exactamente 1..12. La clase es un
Set: se acumulan callbacks, no doce nombres de clase. Un evento posterior
puede retirar los callbacks antiguos; no se sostiene una fuga irreversible
en todo uso. La contraprueba también comprueba cleanup repetido idempotente,
retornos `undefined` y un evento con target hijo. El handler existente ignora
el target y se limpia también ante bubbling; la variante virtual conserva esa
conducta, sin introducir un filtro nuevo.

Evidencia recuperable: `plan-segment-lifecycle.mjs` y `result.json` en el
paquete de diagnóstico externo al producto. Comando explícito:

```sh
node plan-segment-lifecycle.mjs /ruta/al/checkout
```

Exit 0. Se conserva como evidencia externa reproducible, sin dejar sondas de
un solo uso ni tests huérfanos dentro del repo.

## Remedio mínimo propuesto, sin implementar

Invocar el `clear()` existente después de `clearTimeout(to)` en el cleanup.
No requiere cambiar callbacks, clases, duración ni dirección. Se mantiene el
retorno void y la limpieza es idempotente con DOM normal. Revisar que retirar
la clase al cambiar segmento no afecta el final visible de otra animación;
el callback captura su propio nodo y clase, y React entrega cleanup antes del
efecto siguiente. Un eventual cambio de producto necesita identidad nueva
para los alcances afectados, revisión independiente y gates normales: ningún
OK anterior se hereda mediante repins.

Antes de implementar/publicar, cubrir en Chromium la ruta real: abrir Plan,
gesto vertical válido, cambio por botón antes de 500 ms, repetir segmentos
persistentes con reduced-motion; comparar conteos y clases antes/después.
Controles sin reduced-motion: dejar terminar el evento, fallback sin evento,
bubbling de animación hija, salir/volver y touchcancel. Comprobar movimiento
visual y eventos, no sólo el fragmento. Chromium ausente: **0 DOM ejecutados**.
No medir mejora de frames/memoria ni cerrar INC-2709-09 con estos conteos.

## Otros contratos inspeccionados

Inventario estático acotado, no certificado exhaustivo de toda la app:

- Gastos: scroll retira handler y timer; IntersectionObserver se desconecta
  en un efecto separado de desmontaje.
- Cuentas: listeners touch se retiran mediante `listCleanRef`, tanto antes de
  sustituirlos como al desmontar; timer del arrastre se cancela.
- Ayuda: keydown y listeners de visualViewport/resize tienen baja; la espera
  history de 20 ms se limita a 21 vueltas, no un intervalo sin techo.
- Plan: los cuatro handlers del gesto y el rAF se retiran; el fallo aislado es
  el cleanup del efecto de entrada, no la baja de los gestos.

AppState100, bankNotif101 y auth102 están fuera de este encargo. No se repite
la campaña de 30 minutos ni se deduce estado de otros claims.
