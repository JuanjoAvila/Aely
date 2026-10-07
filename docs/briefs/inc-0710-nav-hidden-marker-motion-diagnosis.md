# INC-2709-13 / UX-06: indicador oculto y movimiento de barra

Diagnóstico7/10/2026, fuente main `067371705615e9cc58923509e3f60c3d0c9003ff`. Sin cambiar producto, FAB, runtime financiero o despliegues. El encargo FAB externo conserva su titular; este documento separa indicador, corriente Cyberpunk y transición. La causa del caso humano y la aparición abrupta siguen **desconocidas**.

## Evidencia concreta

El indicador activo es `.botnav-ind`, no el pseudo-elemento de decoración Cyberpunk. En `11-app-main.js:3494`, su clase añade hide sólo por drawerOpen/profileOpen, aunque navHidden o su ref estén activos. En `shell:801`, ocupa top-9px y alto3px respecto de la fila. En host nativo, la barra oculta colapsa max-height y padding a0 pero mantiene overflow-clip-margin30px (`shell:750`): un contenido situado9px sobre una caja colapsada cabe dentro de ese margen. Es una hipótesis geométrica bien delimitada; no una captura de píxeles o color del teléfono.

La corriente Cyberpunk es `.botnav::after`, top-1px, animación cybercurrent, separada de `.botnav-ind span`. Ocultar el nav entero, opacity global o reducir a0 el margen de clip puede retirar esa decoración o afectar al FAB ajeno. El contrato pedido conserva la corriente mientras la barra está oculta, salvo la política de movimiento reducido, que en fuente apaga esa animación deliberadamente. La identidad del color amarillo no se acredita sólo con clases: theme/season y capturas reales aún faltan.

| Ruta | Fuente real | Qué demuestra / qué falta |
| --- | --- | --- |
| Ocultar y revelar durante scroll | applyNavHide/revealNav (`11:87–138`) cambian classList y ref primero; con dragging aplazan setNavHidden hasta flush. | Fixture literal verifica clase/ref y estado final tras inversión. No mide frames, React ni pintura. |
| Scroll vertical / inercia / borde | onPageScroll (`11:186–275`) ignora otra página y gesto de pestaña; dy<6 no actúa; tope revela/pin; final preserva estado y distingue rebote mediante dirección reciente del dedo. | Controles positivos de ruta alcanzable. No afirmar que sólo inercia oculta: fuente también admite scroll vertical con dedo. |
| Host nativo | `.app-shell.scroll-host-on .botnav` usa max-height/padding .55s, border-color .35s y transform:none. | Hay transición normal explícita; no prueba de ausencia de suavidad. |
| Fuera del host | `.botnav` usa transform .55s y hidden translateY120%. | Al cambiar de topología cambian propiedades y endpoints; max-height pasa de sin límite a valor finito. Candidato para discontinuidad, aún no reproducción. |
| Movimiento reducido | Media reduce elimina transiciones host; clase html.reduce-motion reduce duración global .001ms; cyber apaga pseudo-animación. | La aparición inmediata es intencionada en ese modo. Separar reporte normal de preferencia accesible. |
| Fondo/interacción | Fondo var(--bg-2) siempre sólido; hidden pointer-events:none. | No introducir fade de fondo ni reactivar botones ocultos para arreglar sólo el marcador. |

## Fixture reproducible y límites

Ejecutar desde la raíz `node docs/fixtures/inc-0710-nav-hidden-diagnosis.mjs "$PWD"`. Manifest público junto al fixture: `docs/fixtures/inc-0710-nav-hidden-diagnosis.json`. Se comprueban fuente intacta frente main067, hashes completos y fragmento literal de handlers/clase; VM, refs/classList/timers sintéticos, invocación directa de handlers y análisis de declaraciones CSS sin comentarios. **12 controles, exit0; DOM ejecutado0**.

Controles críticos: hide/reveal normal, inversión con dedo antes de flush y lectura de ref final, flush idempotente/discard, página inactiva/gesto tab, pin vencido, tope/movimiento pequeño, rebote al fondo/oposición real sintética, marcador con hidden y con overlays, banda dentro del margen, variante virtual selectiva que conserva pseudo Cyberpunk y contramodelo de margen0 que no admite la banda. El fixture no ejecuta onEnd/onCancel reales ni Shared DOM: invoca flush directamente y acredita ese método, no toda su reachability terminal.

Modelo de geometría: banda del marcador[-9,-6] dentro del margen superior[-30,0] de una caja colapsada. No resuelve borde transparente, fila, zoom, clipping efectivo ni coordenadas del viewport. La comprobación CSS es de declaraciones, no de cascade/computedStyle. El cambio virtual de clase prueba separación de contratos, no que se hayan ocultado píxeles.

No se encontró ejecutable Chromium en PATH/rutas estándar o caché Playwright local. No se instaló navegador, tomó reserva ajena ni lanzó suite. La ausencia limita esta comprobación; no declara imposible la validación en CI o runtime con navegador autorizado.

## Por qué los verdes anteriores no bastan

`e2e/botnav-fab-recorte.spec.mjs` apaga `.botnav::after` y `.botnav-fab::after` al medir píxeles del FAB. Ese aislamiento es útil para FAB pero no acredita conservar Cyberpunk con barra oculta ni retirar el marcador. Las pruebas de rebote verifican gesto/borde/overflow/altura; no sustituyen los tres contratos visuales nuevos. No duplicar el encargo FAB ni reabrir su revisión sólo para este indicador.

## Próxima prueba causal antes de producto

1. En DOM sintético real, baseline main067 y variante **sólo indicador**: positivo visible antes, oculto al final y durante hide, vuelve en show. Comparar contra mutante sin ocultación del marcador, conservando corriente Cyberpunk medible. Separar temas normal/cyber y safe-bottom0/34; no apagar pseudos globalmente en la prueba Cyberpunk.
2. Muestrear rectángulos/computedStyle/rAF naturalmente desde scroll/inercia; sin finish(), animaciones suspendidas ni snapshots tardíos como única prueba. Hide→show antes de550ms, cancel, final estable, drawer/perfil, interacción visible/oculta. Normal: continuidad espacial y frames; reduce del sistema y de app: retirada/aparición inmediata consistente, decoración apagada conforme contrato actual.
3. Registrar topología host al empezar y terminar; A/B mantener host frente salir/entrar a mitad de transición. Si sólo la segunda salta, una unidad coherente debe resolver propiedad/transición entre topologías, conservando ola nativa y sin transform en ancestros de page fixed. Si no discrimina, descartar esa atribución y perfilar frames/layout bajo scroll real.

NO-GO producto mientras no haya DOM causal y guardianes registrados, revisión independiente y CI del SHA exacto. No bajar tests, presupuesto, safe area, privacidad ni opacidad sólida. Nada de nueva beta/APK/Edge/SQL en esta auditoría. INC-2709-13 e INC-2709-09 permanecen abiertos.
