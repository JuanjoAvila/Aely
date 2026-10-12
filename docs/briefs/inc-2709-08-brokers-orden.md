# INC-2709-08 · Orden y despliegue de brókers

Candidata desde beta `c5f62d6603d016150afd9d0e20547b608b323045`, sin publicar. No acredita aceptación móvil ni integración. No modifica VERSION, notas de versión, catálogos fuente, backend o APK.

## Petición y auditoría

Literal del dueño conservado en `docs/BACKLOG-HISTORIA.md` de PR214, commit `76364e89e9d2057ac23bc56c128dfc8328613633`:

> Cartera sigue mostrando edición manual y explicación larga: edición debe vivir en «Ver todas tus inversiones». Ordenar bloques con pulsación mantenida como cuentas; al pulsar, desplegar inversiones escalonadas y fluidas. Auditar puertas antes de retirar UI, persistir orden y accesibilidad/reducir movimiento; prueba de DOM y A/B de frames en móvil.

Auditoría de fuente de beta: `Investments` vive en `06-sync-brokers.js`; `groups=groupsBase` mantiene ternas pero impone orden fijo. La portada todavía pinta Editar a mano. La hija ya contiene edición/alta/venta/borrado y vuelve a Cartera; Redondeo/Saveback sigue en la portada, Auto precios/Proyección en Ajustes. `.v4-inv-drop` anima el bloque completo, sin escalera por posición. Estos hallazgos son lectura de código: la auditoría DOM de la base está pendiente del recurso local.

La candidata solo completa esos huecos. Ambos modos usan `settings.invBrokerOrder`, opcional, sin modificar las posiciones ni cuentas/gastos. Se filtran ids ausentes/repetidos y los brókers nuevos se añaden al final; las ternas se conservan completas. El cliente anterior ignora el orden visual, mantiene el suyo y puede guardar el mismo estado: no se promete que una versión anterior pinte una función que no tenía.

Las únicas llamadas reales a `Investments` están en `14-v4-screens.js`, portada con `v4Embed` e hija con `fullMode`. El renderer v3 posterior a esas dos salidas no tenía puerta ni llamada: se retira junto con su ranking, automático y explicación antigua. Alta/edición/venta/borrado de la hija, Redondeo/Saveback de portada y Auto precios/Proyección de Ajustes conservan sus puertas y sus pruebas stock; su DOM está pendiente.

## Verificación y límites

- Build y sintaxis: exit0. Cuatro pruebas Node propias: 4 PASS, 0 FAIL/skip. Claves es/en/ca, mapa de e2e, seguridad y privacidad: exit0.
- Guardado/carga, `slimForCloud` y validación de nube ejecutados también con el cliente antiguo exacto de la base: PASS; conserva la preferencia opcional y los datos, sin atribuirle el nuevo orden visual.
- A/B de tamaño oficial, mismo sello `4.26.117.99999` y DSN sintético de 95 B: base 1.329.128 B minificados / 363.130 B gzip9; candidata 1.324.491 / 362.917 B. Delta −4.637 / −213 B tras retirar el renderer sin uso. Límites 1.329.152 / 363.520 B intactos; guard oficial exit0. Es medición local de esta fuente, no artefacto servido.
- DOM preparado, sin ejecución todavía: dos/tres brókers y todas sus posiciones en portada/hija; recarga sin resembrar; editor solo en hija; cancelar/scroll no guarda; orden por teclado/foco; sistema/ajuste de movimiento reducido y retrasos de 24 ms.
- A/B CPU6 preparado, sin ejecución todavía: mismo guion contra la base exacta y la candidata, cinco aperturas y cinco ventanas de reposo por pantalla; frames rAF crudos y umbral32 sin profiler ni sondeos dentro de la ventana. Un rojo se conserva para atribución; no se mejora el resultado eliminando muestras.
- Focal autorizado por la regla de Claude `25debdf6`, tras devoluciones expresas de Recibos `44c78c6b` e Inicio `ba4068c6`, confirmado por el coordinador. Antes de arrancar: commit congelado, censo fresco y lock atómico propio, workers1/retries0. El caso stock de apertura CPU6 se reserva para rendimiento, que necesita slot independiente; no queda autorizado por este focal.
- CI completa pendiente en `Tests/test.yml`, solo rama propia y SHA exacto. Sin PR ni push de fuente todavía. Los bloqueantes de integración (Catálogo117, frescura y tamaño) se miden y declaran sin modificar oráculos, versión o topes.
- Catálogo117 observa cambio de huella `inc-0810-nav-indicator` web al retirar `.v4-inv-drop` de la media global que comparte ese alcance: rojo preservado, sin cambiar el oráculo. Docs-frescura local salió0 antes de congelar; no se hereda a CI. El control histórico en el archivo exportado de la base queda indeterminado por falta de checkout propio: no equivale a una regresión de fuente.
- `npm run build` recalcula automáticamente el artefacto `public/beta-delivery.json`; las pruebas móviles del catálogo permanecen idénticas. No añade ni aprueba una tanda. El cierre no hereda recibos del código anterior.

## Pasos móviles cuando exista una beta de esta candidata

1. En Cartera, mantén un bróker y arrástralo sobre otro. Debe cambiar de sitio sin abrir las posiciones ni modificar importes. Cierra y abre: conserva el orden.
2. Toca cada bróker: sus posiciones aparecen en sucesión suave, con nombres e importes conservados. Comprueba carteras con dos y tres brókers.
3. Entra en «Ver todas tus inversiones»: mismo orden. Editar a mano, añadir, vender y borrar siguen accesibles aquí; la portada no muestra el editor.
4. Activa Reducir animaciones: las posiciones aparecen sin espera ni desplazamiento. Cancelar el arrastre o empezar deslizando debe dejar el orden intacto.

Estos pasos son un guion pendiente, no evidencia de uso real. Integración y publicación corresponden a Claude tras sus controles y la revisión humana.
