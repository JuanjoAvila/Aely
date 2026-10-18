# UX16 · hápticos de borde e Inicio

Candidata privada sobre beta `a9c9e45d`, sin publicación ni APK. El claim conserva su
base original; la implementación usa una rama nueva para revisión contra `beta`.
Decisión de coordinación `6a7b12f4` del 17/10/2026: señal web permitida, diagnóstico
con subclase de WebView descartado; el objetivo de Inicio es el anillo de Mi ciclo.

El observador pasivo detecta un empuje vertical de 10 px hacia fuera de un borde de
un scroller que ya usa la ola. Cuenta desde que el dedo llega al borde; no incluye
el recorrido anterior de scroll. Solo un toque por gesto, con rearme en touchstart.
No reclama scroll ni modifica su física. Flings sin dedo, cancelaciones, multitouch,
zonas stopSwipe, scroll horizontal, páginas sin scroll y gestos de navegación,
Perfil o Ajustes no producen hápticos. Los navegadores que retiran los eventos de
dedo al apropiarse del scroll pueden dejar de producir esta señal; comprobarlo
en el WebView real forma parte de la aceptación móvil pendiente.

El anillo llama a `fill` desde su `animationstart` real, después de la pausa del
splash y del delay CSS de 150 ms. Lee la duración efectiva de esa animación
(actualmente 1100 ms). Cada instancia de animación se consume una vez; un render o
volver a una pestaña que conserva su animación no la repite. El selector y nombre
del único objetivo están juntos en `MC_INICIO_HAPTIC`.

La web sin plugin, en segundo plano o con movimiento reducido guarda silencio.
El plugin Android usa `performHapticFeedback` sin flags de excepción. Para el
relleno, solo API 33+ con LOW_TICK soportado usa composición y USAGE_TOUCH; si no,
un único toque nativo. La duración estimada de cada primitiva se descuenta de las
pausas, con tope de 1200 ms y diez ticks de intensidad creciente. La duración
estimada no acredita sincronización física medida. No se sube ningún SDK ni
se añade dependencia; VIBRATE es un permiso normal necesario para composición.

Pruebas nuevas: `tests/ux16-haptics.test.mjs`,
`e2e/ux16-haptics.spec.mjs` y `HapticPlanTest` en el módulo Android.
El e2e usa DOM, CSS y navegación reales con un doble del transporte nativo; no
prueba el motor. El plan se puede probar en JVM sin compilar APK ni ejecutar
Gradle. ROJO, controles y mutantes privados se registran por fase en el checkpoint
del trabajador, con fuente y EXIT reales. No se hereda el modelo web anterior.

Pendientes: compilación y revisión del plugin completo por Claude, APK, proveedor
real, ajustes/intensidad/motor, aceptación móvil, CI general, tamaño oficial e
integración. No hay ProductREADY ni autorización de deploy.

Fuentes primarias de API:
[Composition](https://developer.android.com/reference/android/os/VibrationEffect.Composition),
[Vibrator](https://developer.android.com/reference/android/os/Vibrator),
[hápticos de Views](https://developer.android.com/develop/ui/views/haptics/haptic-feedback),
[plugins Capacitor 6](https://capacitorjs.com/docs/v6/android/custom-code).
