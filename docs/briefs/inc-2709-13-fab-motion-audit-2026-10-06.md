# INC-2709-13 · auditoría de la transición FAB · 6/10/2026

**Estado: reproducción visual BLOQUEADA; mecanismo CSS candidato, sin fix ni GO de producto.**
Base `6f035b09bc873ed102029aad9ddfe89efa78bb40`, árbol
`e309f422fa2e3565c1a4c442d9a9185753420c62`. Tarea y reserva root comprobadas en
`codex/coordinacion` `9d800102b9aa44f7c64f15a86caf66cb7c8010c3` para
`inc-2709-13-fab-motion-audit-20261006`. AGENTS y EMPIEZA-AQUI leídos íntegros.
El BACKLOG identifica el recorte transitorio en su fila INC-2709-13; las búsquedas
locales no localizaron otro guion de esta auditoría. No se tocaron tandas ajenas.

## Fuente exacta y mecanismo leído

`src/shell.html` tiene blob Git `26e2795fefcd99c5075daa1624c62a0f6c5595af`,
idéntico al obtenido por API para beta `ca6f5e854c58ae7d73f24b604f20c8058b4b50a3`.
Esto acredita equivalencia de ese shell; no acredita equivalencia de todo el runtime.

- Líneas 715–758: en modo `scroll-host-on` la barra conserva `transform:none` y
  `bottom:0`; su máximo visible es `73px + safe-bottom`. Ocultar cambia el máximo a
  cero y ambos paddings a cero mediante transición de 550 ms. **`overflow:hidden`
  aparece en la misma clase oculta y no forma parte de esa transición.**
- Líneas 779 y 830–847: fila flex centrada, pestañas con mínimo de 54 px, FAB de
  58 × 58 px y margen superior de −26 px, con radio del 50 %. El botón sobresale
  del espacio normal de la fila. El margen −26 px **no demuestra un clip de 27 px**:
  centrado, padding, borde y alto real alteran su rectángulo. No se midió ningún clip.
- `src/modules/11-app-main.js`, líneas 87–132: `applyNavHide` añade la clase y
  `revealNav` la retira directamente. Al ocultar, el recorte rectangular puede
  empezar mientras el círculo y el alto aún son grandes; al revelar, desaparece
  el recorte antes de terminar la expansión. Es una hipótesis causal verificable,
  no una observación de frames ni una reproducción del móvil.
- Movimiento reducido: el ajuste de app apaga transiciones en el bloque de línea
  315; la preferencia del sistema incluye botnav en 1464–1466. Se deben contrastar
  por separado, conservando estados finales y área táctil.

Los comentarios geométricos antiguos del shell no se usan como medidas actuales.
La cantidad solicitada de **27 px queda desconocida** hasta obtener rectángulos y
capturas intermedias del círculo real.

## Cobertura y ejecución real

`e2e/botnav-esconder.spec.mjs` usa touch CDP y verifica ocultación, reaparición,
cancelación y restricciones de la ola. Su última prueba comprueba una duración
CSS superior a 0,2 s; no verifica contorno durante cada frame. `cyber-fab.spec.mjs`
compara la corriente Cyberpunk en estados quietos; su caso ocultar/revelar espera
700 ms en cada estado. Ambos están ya registrados como transversales.

| Acción efectivamente ejecutada | Exit | Evidencia / límite |
|---|---:|---|
| Consultar tarea/reserva y blob beta por API de lectura | éxito | Reserva root y shell equivalente confirmados |
| `chrome --version` sobre binario existente | 0 | Chrome for Testing 149.0.7827.55; solo versión |
| Build de copia temporal sin historia Git | 1 | El lector de fuentes históricas beta requiere Git; no se modificó para saltarlo |
| `node scripts/build-app.mjs` en copia con historia exacta | 0 | `public/index.html` SHA-256 `cdd42115e696f9fcb39e1805b1f23ff0e33ef348422664761e9ce0409937429c`, igual al artefacto de la base |
| Arrancar el guion temporal de captura con Playwright | 1 | Chromium abortó antes de crear página: `process_singleton_posix.cc`, `socket() failed: Operation not permitted`, SIGABRT |
| `node --check docs/briefs/inc-2709-13-fab-motion-probe.mjs` | 0 | Solo sintaxis del guion transportable; no ejecución de su captura |

Entorno Cloud. Node informó `America/New_York`; `date -u` confirmó el reloj UTC
`2026-10-06T11:07:03Z`. El guion configuraría el contexto de navegador en UTC,
pero el aborto precedió a su creación: no se atribuye esa zona a una captura real.
El protocolo Cloud permite Chromium sintético
en VM sin lease del PC; root confirmó exclusión de otro navegador. El lanzamiento
fallido no creó página: **cero frames, gestos, screenshots, medidas de clip o
contorno ejecutados**. No hubo segundo intento, escalación ni workaround del
bloqueo. No se ejecutaron e2e existentes ni se afirma un rojo visual.

## Guion propuesto y decisión pendiente

La revisión independiente rechazó el primer transporte `de6b7320`: la comparación
de prefijos permitía un hermano de `public/` o un puerto distinto y no impedía
salidas por symlink. Esta corrección limita rutas mediante `path.relative` antes
y después de `realpath`, rechaza enlaces hacia fuera, captura decode inválido con
400 y compara `URL.origin` exacto. No hubo otro intento de navegador ni cambio de
runtime. Pruebas sintéticas importando los helpers sin ejecutar `main`: 14 casos
de archivos (incluidos hermano, traversal codificado, symlink de archivo/directorio,
root alias, decode inválido/NUL y ausente), 6 de origen y 1 protocolo válido frente
a 3 inválidos; todas salieron 0. Sintaxis y diff también salieron 0. Estos controles
no acreditan ninguna captura del navegador ni una protección frente a modificaciones
concurrentes del checkout entre resolver y leer el archivo.

El archivo hermano `inc-2709-13-fab-motion-probe.mjs` queda por instrucción de root
para transportarlo a un entorno con navegador. Es un instrumento de auditoría,
no un guardián aceptado ni un fix. Se ejecutaría desde el checkout adecuado con
sus dependencias existentes:

```sh
node docs/briefs/inc-2709-13-fab-motion-probe.mjs
```

`PLAYWRIGHT_CHROMIUM_PATH` puede seleccionar un navegador ya disponible;
`AELY_AUDIT_CAPTURE=1` añadiría capturas sintéticas temporales. Por defecto están
apagadas; al activarlas el reporte marca `captureEnabled` y `timingContaminated`:
la espera de screenshot puede alterar los tiempos y no sirve para afirmar fluidez.
El guion comprueba
el blob del shell, sirve solo ese `public/` en puerto propio, aborta red externa,
desactiva Service Workers con `serviceWorkers:'block'` (el routing no cubre todas
sus peticiones) y **no prueba su registro, caché ni lifecycle**,
siembra los fixtures inventados existentes y registra rAF con rectángulos,
overflow, transform, bottom, altura, scroll y **intersección rectangular**. `clipTop`
y `clipBottom` no miden contorno circular ni prueban por sí solos su aspecto pintado.
Propone ida/vuelta
con touch CDP y touchcancel, Green/Cyberpunk, anchos 320/393/430, safe-bottom 0/34 y
movimiento reducido por ajuste y sistema separados. Exige que el dedo mueva el
host para no confundir un fixture sin scroll con una reproducción. Distingue fases
de dedo y de espera final; registra `touchActive` enviado, eventos táctiles observados
y tipo de espera, incluidas pausas/capturas mientras el dedo sigue enviado. Valida
dirección de scroll y estado final de hide/reveal/cancel antes de admitir interpretación;
un protocolo inválido queda marcado y sale con error. El `touchcancel` sintético de
esta secuencia **no fuerza ni acredita el borde, rubber-band o stretch Android**.
Su servidor y
navegador se cierran también ante fallo. Las capturas y trazas quedarían fuera del
repo; revisar privacidad antes de cualquier transporte.

Antes de implementar, pedir un rojo que muestre círculo parcialmente visible
recortado mientras el alto transiciona, y registrar el primer frame, duración,
clip superior/inferior y contorno. Comparar con una intervención temporal aislada
que elimine únicamente ese recorte, sin atribuir ese contraste a Android real.

La propuesta mínima de diseño es separar el contorno/animación del FAB del área
rectangular que colapsa, manteniendo el espacio de recorte de la barra. **No**
poner `overflow:visible` a toda la barra oculta: sus hijos podrían quedar por
debajo del viewport. **No** volver a translate/bottom negativo: rompería las
restricciones que protegen el stretch del WebView. Una futura candidata deberá
conservar nav `transform:none`, `bottom:0`, ausencia de overflow inferior y
guardianes de cancelación/estado; la secuencia exacta aún requiere medición.

No se editan runtime, VERSION, mapas, producto servido ni Android. Chromium
sintético tampoco acreditaría la ola/inercia Android. INC-2709-09 permanece
abierto e independiente. No datos reales, bancos, sincronización automática,
publicación, nueva PR de producto ni lectura de memoria privada.
