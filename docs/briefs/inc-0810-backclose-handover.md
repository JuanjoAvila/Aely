# Historial Perfil → Ajustes · fuente local110 para revisión · 8/10/2026

Base exacta `8dcc5ed39b6e212ba1e34a90b550685794ce0bd5`. Trabajo local aislado;
runtime implementado, Node/build/18 DOM comprobados y presupuesto aislado aprobado con
caps asignados. Sin publicación ni aceptación móvil; integración sobre109 pendiente.
Objetivo propio `inc-0810-backclose-handover`, separado de Nav107 y del lag general.
El diseño recibió aprobación del coordinador; versión4.26.110 y notas esperan
los gates locales. VERSION/package siguen4.26.106; la beta publicada indicada al abrir
esta tarea era4.26.106.1. No se ha publicado nada desde esta unidad.

## Causa acreditada y alcance

El ensayo de navegador existente sobre la base registró esta secuencia:
`push Perfil → cleanup Perfil/back → push Ajustes → popstate/null con pila1 → ‹ → about:blank`.
El callback de transferencia cierra Perfil y abre Ajustes en el mismo commit React.
`history.back()` es asíncrono, pero el alta nueva hace `pushState` inmediatamente.
`_mcIgnorePop` ignora el evento sin comprobar qué entrada se ha consumido.
El resultado es un overlay vivo sin entrada que lo proteja; su cleanup retrocede fuera de la app.
Es evidencia previa leída, no una ejecución nueva de esta candidata. El informe y su traza
permanecen privados e ignorados; no se copian datos ni rutas de sesión al repositorio.

## Diseño aprobado

Centralizar altas, bajas y consumo en helpers junto a `useBackClose`:

1. Identidad propia por entrada, con padre y estado anterior conservado. Un booleano
   `mcOverlay:true` compartido no acredita propiedad. No reemplazar estado de otra ruta.
2. Una sola operación de retroceso pendiente, identificando origen y destino. Mientras existe,
   las altas se registran como pendientes y se arman sólo después del popstate correspondiente.
   No introducir timeout, espera de frames, clic forzado ni reparación del DOM.
3. Reconciliar altas/bajas al final del lote de efectos. Una transferencia dentro del mismo
   commit puede reutilizar la entrada propia superior retirada mediante `replaceState`, sin
   lanzar retroceso. El cierre simple consume su entrada real una sola vez.
4. Mantener separadas la pila de overlays vivos y las entradas propias físicas. Cerrar un padre
   cubierto no puede retroceder consumiendo al hijo. Cuando se alcanza una entrada retirada,
   consumirla dentro de la misma secuencia hasta el padre vivo o la ruta original, sin exigir
   otro gesto y sin atravesar estado externo. No atribuir cualquier popstate al overlay superior.
5. El popstate que abandona una entrada viva cierra únicamente su propietario. El que llega a
   una entrada propia desde una ruta externa no debe cerrar ese overlay por asociación.
   Error de pushState/back o identidad ausente nunca autoriza un back a ciegas.
6. Integrar el registro manual de `BillsAddWizard` con los mismos helpers. Su rearme entre
   pasos debe seguir después del consumo real. El callback nativo de App no produce popstate:
   no puede marcar `_byPop=true` como si ya hubiera consumido una entrada web. Delegar esa
   única rama en un helper compartido es el cambio propuesto indispensable en11-app-main.

Mantener `_mcIgnorePop` como señal compatible con el consumidor existente de Ayuda; el token
de operación, no el booleano, decide qué evento se ignora. No ampliar sus esperas ni añadir otras.
La cola tiene que poder vaciarse cuando un alta pendiente se cierra antes de armarse.

Hay dos contratos anteriores que se han conservado explícitamente al implementar:
el hook captura el callback del primer render y algunos callbacks cambian vista sin desmontar
el propietario. Refrescar indiscriminadamente la closure alteraría cierres de cuenta/Recibos/
copias. El arreglo debe conservar las closures vigentes donde dependen de refs y demostrar
rearme sólo para propietarios que permanecen abiertos; no presentar una corrección incidental
como identidad financiera previamente aprobada. La prueba de navegación principal no basta
para aprobar esos caminos.

## Auditoría de todos los registros actuales

| Módulo | Propietarios y contratos que hay que conservar |
|---|---|
| 02 | ExpenseCategorySheet: hijo de ficha/Apuntar, cierre por swipe animado. |
| 04 | GastosFilterSheet, PeriodMoreSheet, ExpenseDetailSheet, BudgetSheet: UI, fondo, swipe y browser; ficha puede tener categorías hija. |
| 05 | AskHost: cancelación resuelve una vez; diálogo encadenado lee cancelRef actual; un Ask sobre hijo conserva padre. |
| 07 | AccountSheet: cierre guarda saldo por callback/ref existente; no modificar cantidades ni duplicar el callback. |
| 09 | ContributeGoalSheet: cierre cancela; no convertirlo en aportación. |
| 10 | SyncReportSheet, BankHistoryImport, BankPanel/picker, BetaReviewPanel, ActivityPanel, PrivacyPanel, SharedPanel, FeedbackPanel, AutoBackupsPanel, WhatsNew, CurConverterPanel, SettingsPanel/manageBanks. Cierres simples, picker hijo, revisión y visor de copia tienen puertas y padres diferentes. |
| 11 | drawerOpen, profileOpen, addTab; transferencia Perfil/Ajustes; callback Capacitor/backButton; ruta base vuelve a Inicio o exitApp según contrato previo. |
| 14 | paidExpanded, BillsManagePush/hub y list/afford, BillsItemSheet, BillsAddWizard/manual, InvestmentsPush, ApuntarSheet. Wizard rearma tras cada paso; cierre simultáneo padre/hijos no deja entradas muertas. |
| 15 | ImportHoja: cancelación y desmontaje, sin importación ni escritura por cierre. |
| 16 | HelpAssistant/requestClose y afterClose: abrir bancos/Ajustes después del cierre; conservar estado financiero y foco. |

Otros escritores: los efectos de parámetros `canal`/`bank` de11-app-main usan `replaceState`
para limpiar una URL. No cambiarlos ni tratar su `null` como entrada propia. Auditar también
popstate web, backButton Capacitor, cierre predictivo Android por callbacks UI, Escape, botón,
fondo, swipe y desmontaje. La prueba con un doble Capacitor acredita JS, no Android real/APK.

## Diff preparado para revisión

02 implementa ocho helpers de slot/comparación/lote/alta/baja/armado/consumo más el
helper nativo. Cada slot tiene token de documento/id, estado anterior, URL anterior,
propietario y marcas de retiro/presencia. `_mcBackAt` sólo atribuye un pop que alcanza
un antecesor comprobable de la cadena propia. El token pendiente exige destino y URL;
un evento distinto libera la señal sin invocar el callback de otro propietario.
La comparación soporta objetos/arrays con ciclos, Date, Map/Set y buffers; tipos ajenos
no comparables se rechazan conservadoramente. History restaura el estado anterior,
sin copiarlo sobre otra ruta. Tokens retirados alcanzados por forward se compactan;
un push posterior descarta los slots forward consumidos para no acumularlos.

11 cambia sólo la rama de overlay del callback backButton: delega en `_mcBackCloseNative`.
14 elimina el escritor manual completo y entryRef; `stepBackRef` permanece y el hook
recibe `step` como identidad.05 añade `cur` como identidad y conserva `cancelRef`:
necesario para una cadena de Ask que no desmonta el propietario entre diálogos.
No hay otros cambios de runtime; en particular10 y los callbacks financieros quedan intactos.

`useBackClose(open,onClose,identity)` conserva la closure de primera apertura con un
efecto `[open]`; otro efecto `[open,identity]` crea/retira el propietario. No reabre un
propietario por cualquier render mientras está saliendo con animación. El rearme explícito
sólo lo solicitan Wizard/Ask; sus callbacks iniciales ya leen refs del paso/diálogo actual.
Las limitaciones previas de callbacks no refrescados, incluido el visor de copias, no se
convierten en una corrección incidental de esta tanda. Sus pruebas existentes siguen obligatorias.

## Pruebas y evidencia local

`backclose-handover.spec.mjs` está registrado en CROSSCUTTING;18 casos pasan en ventana101.
Ocho casos principales: flujo DOM real es/en/ca con ‹ o browser back, retorno posterior al
Perfil y una ruta previa real que exige un único atrás después de cerrar. El oráculo comprueba
URL, navegaciones, app visible, overlays, pila vacía/señal consumida y porciones financieras.
No modifica estados de overlays ni añade espera previa al cierre para ocultar la carrera.

Diez adicionales: backButton de App con doble Capacitor; Ask encadenado con
contador de resolución real; Wizard con tres pasos en UI/browser/nativo; cinco fixtures
aislados de React real/hook de fuente/History real para hijo y padre, padre cubierto,
desmontaje múltiple, pushState fallido y estado externo con ruta real. Los fixtures tienen
botones propios y no reparan ni fuerzan el DOM/estado del producto. Hay18 DOM comprobados;
no acreditan Android físico.

`backclose-history.test.mjs`, registrado en run-tests, extrae controlador/hook REAL de02
y verifica20 contratos con cola separada de microtasks/tareas de History. El destino
del recorrido se fija al solicitarlo, conservando la carrera original. No copia el
algoritmo del controlador. Vigila alta cancelada durante back, fallos de replace/back,
closure inicial, identidad explícita, go(-2), forward, retención acotada de slots y
estado externo clonado con ciclo/Map/Date.20/20 Node pasan. El contrato adicional de
alcance muta los20 helpers/datos UI registrados de Brókers y exige invalidar su digest;
no reemplaza los mutantes financieros/persistencia de `beta-sources`.

La prueba de pop ajeno se endureció antes de congelar: un recorrido externo ya pedido
llega primero a otra ruta mientras el consumo propio está pendiente, libera la señal
sin cerrar al padre y conserva URL/estado; el recorrido propio posterior aterriza sin
otro callback. El primer ensayo del nuevo inventario UI incluyó por error useEdgePageClose
al mezclar offsets CRLF con los offsets LF del parser. Se corrigió el límite a LF; no
se quitaron helpers ni descriptores. El script privado de A/B tuvo un fallo inicial de
file URL con espacios antes de medir nada; corregido con fileURLToPath, sin tocar runtime.

Falta rojo realflow sobre base exacta y verde
sobre candidata usando el mismo guion y servidor; guardar informes privados por separado.

02 es CORE: la verificación final necesita los contratos afectados y todos los e2e pertinentes.
No ejecutar Chromium/build/minify/Node pesado sin concesión expresa del coordinador. No
modificar el archivo de lease ni recuperar por tiempo. El empaquetado deberá preservar los
20 controles financieros/persistencia y explicar identidades nuevas frente a las33 de base,
sin alias/repins. Medir raw/gzip con caps vigentes, sin quitar ayuda ni aumentar límite por
comodidad. Versión/package/notas familiares es/en/ca, README/ROADMAP/ARQUITECTURA/TESTING,
alcance de beta y pasos móviles propios se escribirán sólo con el runtime revisado y comprobado.

## Alcance beta y delta pendiente

La base contiene33 descriptores. El único que declara explícitamente `useBackClose`
es `inc-0310-broker-resultados`; se han añadido sus ocho helpers transitivos y siete
datos nuevos, sin retirar funciones/datos anteriores ni cambiar auditorías o pins.
La auditoría calcula las33 identidades sobre el SHA base y la fuente actual: cambia
únicamente el descriptor/código de Brókers; los otros32 descriptores y códigos son iguales.
El código de Brókers pasa de
`6d25f317bbfe11956d2f4939437665027ea649f71c3040f1b14028a82512ba05` a
`0e7a9d51aae5c84c08ba9a48a925218e613bf9a49f8f8c678d65e5b1cad1293d`.
Su web pasa de `7c1d6a802f458a9f9b779dffedc1d6fc41899e8c49d64b53b9211d0596d0e4f4`
a `463b75596246fb7e26b754a7a612969c51771e277c8da1cacff75007759a38ae`.
Son identidades nuevas reales; no se conserva un OK por alias ni se repina historia.
La suite beta-sources completa termina con exit0:1.731 funciones y684 datos mutados.
Conserva los contratos financieros/persistencia, no sustituye sus mutantes por los20 UI.
La diferencia con el inventario posterior del integrador es de fuente: esta rama sigue
sobre8dcc, sin las nuevas unidades/tooling del lote107/108/109.
El alcance nuevo110 se preparará completo tras esa revisión, sin alias para retener un OK.
No se han cambiado beta-revisions/beta-source-code, notas ni clasificación de aprobaciones.

## Gates y presupuesto A/B · runtime congelado para el futuro causal

Pasan build, mapas, sintaxis del HTML ensamblado, claves/placeholders i18n, i18n-bundle,
privacidad, seguridad y docs-frescura;20 contratos Node y20 mutantes UI. No Chromium.
El presupuesto falla: no se considera un GO ni se han cambiado caps.

Mismo host, esbuild0.25.5, HTML normalizado a LF, DSN sintético95B y sello106.99999:

| Variante | Crudo minificado | Gzip | Bloqueantes |
|---|---:|---:|---:|
| Base8dcc | 1.317.888 B | 359.021 B | 3 |
| Runtime110 sin empaquetado | 1.321.250 B | 360.165 B | 3 |
| Delta propio | +3.362 B | +1.144 B | 0 |
| Caps actuales1287/351 KiB | 1.317.888 B | 359.424 B | 3 |
| Exceso | 3.362 B | 741 B | 0 |

El delta corresponde a helpers/estado del controlador y las integraciones05/11/14.
No se recortaron textos ni funciones ajenas. El build no lleva nueva tanda/version110:
el presupuesto definitivo tras integrar el lote actual, añadir alcance/nota y sellar
necesitará medición y revisión propias. Los topes autorizados para otra candidata no
se heredan automáticamente. Informes detallados privados conservados bajo test-results.

Hashes SHA256 del runtime congelado, antes del causal pendiente:

| Módulo | SHA256 |
|---|---|
|02|`27af8ef8bb344126cffa75e287981befd945aead908751f431a2d6c6c50b6884`|
|05|`f00550f0ecf6763d50146005ae0952d2c00c1b29eab5be657cf482974f939d27`|
|11|`e2723392de272815a848c45907e15d29403fe3fb717f2f1a74077043aa67bdf7`|
|14|`d87b9a4038b3dfe02fdc3813812cc7e93e37dd83dd3e5798a95dec38d8cfa588`|

HTML del build legible SHA256 `8ee02d0b3ec27e72be7529f43cf5c09efb689f88d31bd4bd3235eaafa86510dd`.
No es un artefacto servido ni una aceptación de móvil.

## Preparación para ventana100 · artefacto aislado

Root asignó expresamente los caps existentes1291/352 KiB/3 bloqueantes al candidato
aislado sobre8dcc. Se reflejan en el test de presupuesto con la medición y motivo;
no se suman presupuestos de las tandas107/108/109. La tabla anterior conserva el
fallo real contra1287/351 y el A/B canónico, no se oculta ni se reescribe como verde.

Baseline recuperado byte a byte del `public/index.html` del commit8dcc, SHA256
`e8878d31d48c0a374a192f633a82524d514dc68c408726196c7be574334f990b`.
El hashB6B6 del build reconstruido previo era la variante CRLF; el baseline del
causal es el original Git/LF, exactamente el informado por Nav107.

Candidato congelado en snapshot privado con stamp-version/minify-html oficiales,
esbuild0.25.5, DSN95B sintético y sello4.26.106.99999; VERSION/package siguen106.
SHA256 HTML `cd22615d760922eec4bb90793b4cf2e43b4a78c32e933ef4ab8f3d7d784b471a`.
Medición del artefacto real:1321274 B crudos /360181 B gzip; márgenes710/267 B.
Gate `presupuesto-rendimiento --artifact` termina0 con1291/352/3. Los24/16 B
de diferencia frente al A/B canónico son del empaquetado real sin normalizar el HTML,
no otro cambio de runtime. Los cuatro hashes de módulo anteriores permanecen congelados.

Puerto propio4432 libre y configurado sin reuse; servidor comprueba el hash del archivo
y verifica por HTTP200 el HTML servido antes de marcar ready. `webServer.cwd` es el
worktree absoluto. Configuración bloquea Chromium si el JSON canónico no concede lease101
al propietario de esta unidad. La prevista100 se reasignó al focal de Chart109; no arrancó
servidor/Chromium en esta preparación.
Scripts de preparación y copias del tooling se retiran; snapshots públicos sintéticos,
config/server necesarios para la ventana y los informes quedan privados e ignorados.

Estado: Node/build/beta-sources acreditados; presupuesto aislado pasa con caps asignados,
18 DOM pasan y el baseline reproduce rojo realflow en ventana101. No VERSION110 ni nueva unidad/notas/PR/CI.
La integración futura sobre109 necesita rebase, identidad y presupuesto conjunto nuevos antes
de publicar110. El gate aislado no aprueba esa unión ni acredita el móvil.
Procesos propios y servidor se comprueban terminales al liberar expresamente101.
No autorizado en este chat: push/merge/publicación, APK, Edge, SQL, dependencias ni automatizaciones.

## Causal físico de ventana101

El servidor exige HTTP200, Content-Type HTML y SHA256 del cuerpo servido iguales al
snapshot antes de dar ready. Dos arranques sandbox terminaron1 antes de ningún caso:
localhost4432 denegado EACCES. La ejecución autorizada fuera del sandbox resolvió ese límite.

Baseline8 inicial, sesión32947: exit1, ocho fallos reales. Seis cierres de Ajustes salieron
a about:blank; dos con ruta anterior salieron a privacy.html antes del atrás adicional.
Candidato18 inicial, sesión44943: exit1,16PASS/2fallos antes de abrir Perfil en catalán:
el helper heredado no reconocía «Entesos!» y Novedades interceptaba el avatar. Se conserva
ese informe privado. El spec cierra ese panel por su botón real usando t("wn_close");
no modifica estado del producto, callback de cierre ni el timing observado del handover.

Candidato18 final, sesión43592: exit0,18PASS en59.6s,0skips/0flaky/0retries, workers1.
Los ocho flujos de producto y el botón App, Ask y Recibos verifican DOM/URL, consumo del
historial y cancelación sin guardar. Los cinco hosts React aislados validan ciclo de vida.
Baseline8 final usa el mismo guion y snapshots, sesión44596: exit1,8fallos causales en67.1s,
los mismos seis about:blank/dos privacy.html prematuros,0skips/0flaky/0retries. Después de
ambos terminales, preflight elevado propio acredita0 procesos Chromium/runner/servidor y
0 listeners4432. Liberación expresa101 en el ACK privado; sólo root cambia el JSON canónico.
Hashes de HTML/runtime permanecen los congelados; no se hizo build/minificación adicional.
