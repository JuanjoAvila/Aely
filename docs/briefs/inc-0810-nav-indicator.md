# INC-2709-13: la rayita de la pestaña activa se queda con la barra oculta

Candidata local26 versión4.26.107: 27 regresiones existentes y12 combinaciones nuevas pasan
en Chromium sintético; la base falla12/12 por la rayita visible. Build, presupuesto, mapa y
sintaxis pasan. La CI del SHA exacto del PR es un gate independiente de integración. Sin
publicación ni aceptación móvil; el historial de Perfil a Ajustes conserva un hallazgo OPEN.

Base `8dcc5ed3`. Diagnóstico previo: `inc-0710-nav-hidden-marker-motion-diagnosis` (rama `codex/nav-hidden-diagnosis-relay21`).

## Causa y cambio

`.botnav-ind` (top:-9px, 3px) solo se ocultaba con `.hide` (drawer/perfil), nunca con la barra escondida. En el host de scroll la barra oculta colapsa a 0 pero conserva `overflow-clip-margin:30px`, así que la rayita seguía pintada. Cambio mínimo, solo CSS en `src/shell.html`: `.botnav-hidden .botnav-ind{opacity:0;transition:none}`. Se engancha a la clase que `applyNavHide`/`revealNav` ponen primero (sin esperar a `navHidden` de React). `.botnav::after` (corriente Cyberpunk), FAB, pestañas y callbacks no cambian.

Local26 une los dos selectores exhaustivos de la barra bajo `prefers-reduced-motion`: con y
sin `botnav-hidden`. Ambos tenían `transition:none`; la unión `.scroll-host-on.app-shell .botnav`
conserva la declaración en ambos estados: su especificidad baja de cuatro clases a tres,
pero la regla oculta de cuatro no declara transición; la base de tres está antes del media.
La spec exige duración calculada `0s` oculta y visible con reducción del sistema.
El orden de las clases distingue
el selector del marcador literal de otra unidad beta; duplicarlo abortaba el build con
`BETA_SCOPE_AMBIGUOUS`. La revisión nueva registra su propio alcance sin repinar aprobaciones.

Reserva oficial sintética: DSN de95 bytes y `APP_VERSION:4.26.107.99999`, mismo minificador,
gzip nivel 9. Se mide aparte del HTML legible que ejecutará Chromium.

| Variante | Minificado B | Gzip B | Delta frente a base |
|---|---:|---:|---|
| Base `8dcc5ed3` canónica LF | 1317888 | 359021 | — |
| Claude `9cd4aa9c` canónica LF | 1317941 | 359034 | +53 / +13 |
| Local26 final107 canónica LF | 1317857 | 359030 | -31 / +9 |

Las tres entradas se normalizan CRLF→LF ANTES del minificador original. El ahorro del selector
reducido es84 bytes minificados frente a Claude. El build final real
CRLF mide1317881/359048. Topes intactos:1317888/359424, margen real local26 7/376
(canónico LF31/394). Gzip incluye también la huella distinta del catálogo107. Build, presupuesto, sintaxis, mapa
y sintaxis de la spec terminan con salida 0. El primer build abortado no generó una candidata;
su posterior sintaxis verde correspondía al artefacto anterior y no se cuenta como validación.

Corrección de medición: inicialmente se comparó el `public/index.html` de Git, LF, contra
el build local CRLF. El blob base de 2060610 bytes y el reconstruido de 2088697 se vuelven
idénticos al normalizar sus 28087 CRLF. El minificador deja 24 saltos exteriores al script/style;
conservarlos como CRLF reproduce exactamente los 24 bytes y 17 gzip de diferencia:
base blob LF 1317888/359021 → base reconstruida CRLF 1317912/359038. El build candidato tiene
28093 CRLF; su minificado conserva24. La tabla usa normalización ANTES de minificar,
no una conversión posterior. No se atribuyen los24 saltos exteriores a ahorro de CSS.

33 códigos web comparados con la base: 32 idénticos; cambia realmente `inc-2709-13-fab-contorno`
de `7ca1346e56ef835fc348b5656707bb53015ddffc9e22b0896b06f671bd78e470` a
`78fbc4dc2e857c7a7a513ecb9f302feeaaf6f56ed47fb3030f26f3fdfbcd128c`. También se regenera
`public/beta-delivery.json` con ese alcance. Las33 pruebas previas del catálogo permanecen
iguales; se añade una revisión independiente34ª, `inc-0810-nav-indicator`, con instrucciones
es/en/ca para ocultar/revelar, Cyberpunk, movimiento reducido y entradas independientes a los
paneles. Conserva todos los alcances, auditorías y referencias anteriores.

El alcance nuevo tiene19 entradas: CSS de barra/indicador/FAB/corriente y preferencias,
safe-area, refs/controladores de scroll y gestos, geometría de slots, estados de paneles y
render de navegación. Incluye explícitamente `gestureAxis`, `GEST_LEAD`, `GEST_MAX` y
`tabOrderOf`; `unidades:true` estabiliza la identidad por unidades, no añade la closure
automáticamente. Los dos primeros guardianes completos detectaron la omisión de esos helpers
y datos; se corrigió el alcance nuevo, sin debilitar aserciones ni cambiar scopes anteriores.

| Aprobada | ID | Código antes = después |
|---|---|---|
| 106 | inc-0810-dashboard-recents-memo | dd837d5ba06e28cd5e39e0509d51cec49e00c8be6683cd1191869c04cd65698a |
| 102 | inc-0710-auth-disposal | c3b1513a343e11e1d8f0f2701c3dbec925bcc52263693178fe9e6f8ac15ed4e0 |
| 101 | inc-0710-banknotif-cleanup | b59cef0907892dc1d9de916dae649de39c515b5deeb158e5e4abf03574c5421c |
| 100 | inc-0710-appstate-listener-cleanup | 39dc65f520162e271906514543169e9ecbde165d244989427992afdeb1124bbe |
| 99 | inc-0710-gastos-mes-madrid | 97f952fac1f6a3ee22513195f0ca3de85eedf371f14073318330005df4b3ebf1 |

`transition:none` es deliberado: con la opacidad animada, `botnav-fab-recorte` (cyber, normal) bajó de ≥0,98 a 0,77/0,69 porque pausa todas las animaciones de la barra a 1 ms. Con `none` vuelve a pasar.

## Pruebas

Evidencia anterior declarada por Claude sobre `9cd4aa9c`: 6 casos de estilo calculado y un
arrastre, rojo 6/6 contra la base, verde en su candidata; FAB 12/12. No se atribuye a local26.

La spec local26 está registrada en `CROSSCUTTING`: 12 combinaciones de green/cyber × safe0/34
× normal/reducido app/reducido sistema. Gestos de ocultar y revelar, `touchcancel`, re-render,
perfil, ajustes y FAB real. Incluye comparación PNG de la rayita visible y oculta y geometría
de barra/FAB. Los pseudos permanecen intactos; `cybercurrent` se comprueba en su reloj natural,
y las preferencias reducidas conservan su apagado deliberado. Resultado final12/12;27
regresiones existentes también pasan. Contra la base12/12 fallan antes de los paneles con
`oculta:true`, `indHide:false`, `opacity:1` en vez de0. No se cambia el umbral PNG.

DOM ejecutado con HTML SHA-256 `a1dcdaa33eee9089f2dadc45909343f84f0b6be33d395f954a25f0ad2d03a874`.
El packaging final es `033589d351e8824359479dd035deebc683798aecaa08aafbbb210c952fe0776d`;
comparación byte a byte acredita que solo cambia `_rnSha` tras completar alcance/guiones.
El catálogo final tiene SHA-256 `a8cacec274db3fd23bd0b9ab3157de3c2851a963aee714a2cf49707995fe5b56`.

Los guardianes Auth conservan runtime y mutantes actuales. Sus auditorías de notas/registro106
leen el corte histórico fijo `8dcc5ed3`, con caché; no pueden exigir que106 siga siendo la
primera nota de107. Ambos focales pasan, manteniendo7 funciones/9 datos y8 mutantes causales.
El guardián actual de107 comprueba las33 definiciones previas y32 códigos idénticos, además
del cambio real de contorno y los15 mutantes nuevos. La suite completa de `beta-sources`
vigila las llamadas y datos transitivos reales: final27645 salida0,1732 mutaciones de
funciones y686 de datos. No acredita que se haya ejecutado localmente toda la suite Node/Deno;
la CI Linux completa del SHA exacto del PR es el gate de esa suite.

## Limitaciones

### Hallazgo de historial previo, OPEN

El flujo Perfil → «Ir a Ajustes» → «‹» navega a `about:blank`, con documento vacío. Se
reprodujo en la base exacta `8dcc5ed39b6e212ba1e34a90b550685794ce0bd5`, HTML SHA-256
`e8878d31d48c0a374a192f633a82524d514dc68c408726196c7be574334f990b`, y en la candidata107
con HTML `a1dcdaa33eee9089f2dadc45909343f84f0b6be33d395f954a25f0ad2d03a874`. La
pasada inicial tuvo27 PASS y12 FAIL al comprobar la barra después del cierre; todas las
aserciones anteriores de rayita, PNG, cancelación, re-render, perfil y Ajustes abierto pasaron.
La prueba causal mínima contra la base terminó1. No es una regresión de este CSS.

Historial observado, sin forzar sus entradas: `pushState` al abrir Perfil; `back` al cerrarlo;
`pushState` al abrir Ajustes; `popstate` deja `history.state:null` con un overlay en la pila;
el siguiente cierre con «‹» navega a `about:blank`. En el documento nuevo se deniega
`sessionStorage`; no es la causa original. `useBackClose` de `02-ui-shared.js` queda para
otra unidad. Indicador107 no cambia ese módulo ni declara reparada la transferencia.

Reproducción: servir el `public/` del SHA indicado, sembrar `seedLoggedInDashboard`, esperar
al splash y cerrar Novedades; pulsar `.v4-avatar`, el botón «Ir a Ajustes» y
`.settings-push-h .back`; comprobar URL y presencia de `.botnav`. La instrumentación temporal
de historial y el servidor se retiran al terminar; la observación permanece aquí.

No acredita el host nativo, un móvil real ni fluidez. La spec de FAB mantiene sus guardianes
de contorno, recorrido y reversión dentro de550 ms y sus12 casos pasan sobre local26.
El coordinador asignó VERSION4.26.107 y autorizó su packaging completo; serializa la promoción
de las aprobadas y la entrega de esta nueva candidata. No se fusiona a main/beta desde este PR.
