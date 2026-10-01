# Integración UI · candidata 4.26.77 (Cyberpunk, Preguntar, Perfil)

Estado a 2026-10-01: implementación en `claude/ui-77-integracion` (propietario: Claude, por encargo del coordinador `20261001T071201Z`), una sola versión **4.26.77** con tres tandas separadas. Montada sobre la fuente del panel76 `351053b9` (PR97, todavía sin publicar: si esa fuente cambia, hay que revisar el delta). Sin push a beta, sin publicación y sin prueba móvil. Los números 79/80/81 de más abajo y de las actas de origen eran reservas provisionales: no existen como entrega.

Qué cambia respecto a la preparación de Codex (`7f7010d0` + `8906a9f5`, injertados tal cual): las notas provisionales de `ui-79-81-notas.json` pasan a una entrada real 4.26.77 de `src/data/release-notes.json` con sus tres guiones (el fichero provisional se borra); VERSION/package/lock, CHANGELOG, README, ROADMAP, TESTING y EMPIEZA-AQUI alineados; y se absorbe la corrección de fixture cromática de `e2e/cyber-fab.spec.mjs` que quedó sin commit en el worktree 53d9, junto con su acta del lease21. Runtime idéntico a `31e1a4c3` en `src/shell.html`, `14-v4-screens.js` y `16-help-assistant.js` (diff vacío).

## Preparación previa (Codex, histórico)

Estado entonces: preparación local en `codex/ui-79-81-integracion`, sobre panel75 `e975c4a2` y fixture `569d7922`. Sin bump final, push, CI ni publicación. Base definitiva pendiente del coordinador después de78. No se altera runtime financiero, Android, Edge, SQL ni APK.

Fuentes: Cyberpunk PR89/runtime1c6793f3/docs c76e1f94; Preguntar PR91/runtime7122afe2/docs6d823e9b; Perfil PR93/8236a769. Cadena Claude local36b6e54b/315560b8/f9bbe115/acta31e1a4c3 sobre74. Se injerta exclusivamente el diff fuente/specs/mapa contra9ecd6a17, conservando CORE de panel75. No se importan versiones ni artefactos generados ajenos.

Runtime conservado: `.botnav-fab` Cyberpunk con z-index1; `.v4-sheet.aely-help-sheet` con padding-bottom0, zona segura en composer sin teclado y10px con teclado; `.pr-val-empty` propia del perfil, todas las filas/acciones intactas. No consultas reales ni estado financiero real en pruebas.

Los tres guiones y notas es/en/ca están preparados en `ui-79-81-notas.json`;79/80/81 son reservas provisionales, todavía fuera de RELEASE_NOTES activo. En la publicación final se trasladan las tres entradas al histórico real sin sustituir las notas75–78. El gate final exige VERSION/package/README/ROADMAP/CHANGELOG alineados y build nuevo.

Alcances de `beta-sources.json`: Cyberpunk cubre corriente/botón/animaciones, geometría y safe-area; Preguntar cubre CSS específico, regla general que colisionaba, safe-area y detector visualViewport con atributos/estilo; Perfil cubre CSS de filas, `profileOf` y `ProfilePanel` completos. Cierre transitivo de funciones/datos00/01/08 calculado con el lector75: ninguna dependencia financiera adicional en estos tres bloques. Ocho mutantes semánticos de reglas/lectores comprueban invalidación del digest en el guardián existente.

Evidencia original declarada por Claude: Cyber4RED→4GREEN+8repetición; Preguntar15RED→15GREEN; Perfil9RED→23GREEN junto a regresiones. No sustituyen la ejecución propia de integración, que ha encontrado tres rojos Cyberpunk. Pendientes su diagnóstico, base78, revisión independiente del coordinador sobre SHA final y CI exacta. Teclado Android e inercia reales requieren móvil.

## Verificación propia de preparación

Build y sintaxis pasan. Las huellas de todas las tandas previas son iguales a569d7922, cotejadas por Git real. Nuevas huellas web: Cyber `f5af79726a5840ea52b63ab826990d3f5e85a06613d98ad27e826532b49232ec`; Preguntar `a79d190557e2d220bd91b744690b688d77a531bd4c63c78c3771804a0aa21f9d`; Perfil `17d05a5f6af319668c361a293e6566f7183555ccab581f907329bf61e6f08d25`. Son mayores alcances que los hashes iniciales de Claude, con reglas/lector añadidos; no cambia runtime para forzar coincidencias.

Medida minificada propia:1.278.374B/gzip9347.957B (+94/+11 sobre panel75). Quedan203B hasta el cap gzip348.160; la base76–78 exige medición nueva. Sin aumentar límites ni eliminar textos para encajar. Se reutilizan dependencias existentes mediante enlace local ignorado, sin instalación.

Primera pasada Node completa UTC130s encuentra tres fallos de resolución esbuild antes de reutilizar dependencias, un mutante que rompía el propio ancla en vez de cambiar el umbral, y memoria externa desfasada. Las tres suites de dependencias repetidas pasan; el mutante ahora cambia el umbral visualViewport real24→240 y el guardián final pasa15/15,629 funciones y209 datos mutados más8 UI. Todos los demás steps de la pasada completa pasan; queda únicamente memoria-espejo externa de10fuentes tras esas repeticiones. No se reclama npm test completo verde ni Deno/DOM ejecutados. Sintaxis7bloques y mapa relevante12guardianes pasan. Informes locales ignorados: `test-results/ui-node.log`, `ui-scopes-final.log`, `ui-scopes.json`.

Cotejo runtime: `git diff31e1a4c3 -- src/shell.html src/modules/14-v4-screens.js` vacío; los otros módulos, Android/Supabase/APK no cambian frente a569d7922. E2E3specs importados sin modificación. El candidato local será revisable porSHA; la excepción de bump reservado es deliberada hasta gate, no autoriza publicar75con estas fuentes.

La revisión automática rechazó el envío de avances al chat coordinador por faltar autorización humana verificable para mensajería entre chats. Autorización solicitada al usuario; no se reintenta ni se usa otro canal para eludirla. No Chromium hasta lease canónico con este chat como owner.

## DOM propio · lease19

Coordinador concedió lease19 sobre fuente7f7010d08214c2659f64cc1b1c96ca0fd117ae66. Owner canónico comprobado antes de lanzar Chromium1228 ya instalado, UTC/unworker, una sola pasada de los tres specs UI más profile-anim/listas-render. Resultado39/42PASS,3FAIL,0flaky/skip/retry; duración1,3min. Informe `test-results/ui19-dom.json` y log `ui19-dom.log`.

Preguntar15/15PASS es/en/ca con zona segura/letra grande y teclado simulado. Perfil9/9PASS es/en/ca tres tamaños; profile-anim4/4PASS y listas-render10/10PASS. Cyberpunk1/4PASS: falla igualdad binaria de las capturas de franja con/sin corriente en Gastos320px, Gastos430px y letra enorme+safe34. El ancho393px con cuatro pestañas pasa. Se conserva la aserción y el runtime exacto; no se atribuyen los rojos al entorno ni a fixture sin evidencia. No hay nueva reproducción ni parche después de la única pasada concedida.

Lease19 liberado explícitamente en comentario al concluir la sesión; Chromium/servidor de esta pasada terminados. Solo root escribe el lease canónico. Cyberpunk necesita diagnóstico posterior con turno nuevo antes de GO; ni las notas preparadas ni los verdes originales acreditan los tres rojos de integración.

## Diagnóstico de capturas · lease21

Una pasada de los cuatro Cyberpunk, UTC/unworker con PNG con/sin corriente, rects y diferencias por píxel:3/4PASS. El único rojo cambia al ancho393, en Plan; los tres escenarios rojos de19 pasan ahora. Geometría fab/nav idéntica antes/después de ambas capturas; aro con opacidad0.57de576píxeles difieren, máximo1nivel RGB, repartidos por las8filas físicas del recorte (DPR2,75), sin desplazamiento ni trazo concentrado. La igualdad binaria detecta ruido de rasterizado del degradado al cambiar las operaciones de pintura; el contraste correctivo debe comprobar esa hipótesis sin aumentar tolerancia.

Lease21 liberado explícitamente tras terminar los cuatro casos. Banco preparado: color opaco `var(--cyber-mag)` y aro quieto, manteniendo forma/z-index/geometría; corriente congelada antes de medir. Comparación PNG sigue exacta. `origin/main`12884f48 conserva el CSS del FAB sin z-index, por tanto valorauto; se prepara override temporal únicamente para contrastar ese estado RED contra candidatoz1GREEN. A/B pendiente delease23. PNG/sondas temporales se recogerán tras extraer evidencia al acta; no se ha cambiado runtime.

## Implementación 4.26.77 · Claude · 2026-10-01

Rama `claude/ui-77-integracion` sobre `351053b9` (fuente del panel76). Primero se preparó sobre beta 75 `ca7b97d4` (injerto de `7f7010d0` y `8906a9f5`, corrección de fixture de `cyber-fab` leída del worktree 53d9 sin modificarlo, bump y documentación; queda en la rama local `claude/ui-77-sobre75`); al dar el coordinador la base 76, el resultado se reaplicó como un único cambio a tres bandas, tomando de la 76 los ficheros de versión y rehaciendo encima nota, CHANGELOG, README y ROADMAP. Los generados de `public/` se reconstruyen, no se arrastran.

Las cifras de Node, alcances y tamaño de esta lista se midieron sobre la base 75; las de la base 76 están en la sección siguiente.

- Runtime: `git diff 31e1a4c3 -- src/shell.html src/modules/14-v4-screens.js src/modules/16-help-assistant.js` vacío.
- Node completo en UTC, sin etapa de navegador: todo verde salvo `memoria-espejo`, que compara con la memoria local de esta máquina y no depende de la rama. `docs-frescura` verde sobre el commit (antes de commitear da rojo por diseño: mira el último bump en Git).
- Alcances: `beta-sources` 15/15; sonda independiente de cierre transitivo, 629 dependencias y 0 sin vigilar; las tres tandas de UI tienen 0 dependencias de 00/01/08.
- Tamaño medido: 1.278.374 B minificado / 347.957 B gzip 9. Margen: 602 B y 203 B bajo los topes vigentes (1249 KiB / 340 KiB). Hay que volver a medir tras rebasar sobre la 76.

Teclado Android e inercia reales solo se acreditan en móvil.

## Sobre la fuente del panel76 · Claude · 2026-10-01

Base `351053b9` (PR97). Su CI terminó en rojo por un único caso de fixture de `revisar-beta` (esperaba 2 tandas y recibió 12) que repara su autor; no es de esta integración y aquí no se toca. El padre publicado de la 76 todavía no existe: esta candidata no lo afirma.

- Frente a la preparación sobre la 75, `src`, `e2e`, `scripts` y `tests` solo difieren en lo que trae el propio panel76.
- Node completo en UTC sin etapa de navegador: todo verde salvo `memoria-espejo` (memoria local de la máquina).
- DOM con lease25, un worker, UTC: 42/42 en una pasada, sin reintentos (Cyberpunk 4, Preguntar 15, Perfil 9, `profile-anim` 4, `listas-render` 10).
- Tamaño: 1.279.476 B minificado / 348.261 B gzip 9; +94 / +11 B sobre el panel76 sin sellar (1.279.382 / 348.250). Márgenes 524 B y 923 B bajo los topes de la 76 (1250 / 341 KiB), sin tocarlos.

### Reparación de alcances (NO-GO del revisor a `4c97b43d`)

Renombrar `className:"botnav-fab"` en `11-app-main.js` o `className:"aely-help-composer"` en `16-help-assistant.js` rompe el vínculo con el CSS corregido y no movía la huella de su tanda. Se añaden dos mutantes al guardián y, con ellos en rojo por ese motivo exacto («cambio UI sin vigilar», primero Cyberpunk y después Preguntar), dos bloques al registro: el hueco del botón en la barra y el compositor de Pregúntame hasta el final de su componente. El ancla del compositor empieza en la línea anterior a propósito: si incluyera el nombre de la clase, el mutante haría abortar el lector en vez de cambiar la huella. Guardián 15/15 con diez mutantes de UI; cierre transitivo: 0 dependencias de 00/01/08 en las tres tandas, 629 en total y 0 sin vigilar. Sin cambio de runtime ni de expectativas.

Huellas web: Cyberpunk `0f112133480508f63ebc5946b48143afb55192091176fb02e87bed8e1bb4c150`; Preguntar `fb692532c9fcf7980773f4c2a86fe4f3976c4ef71bcadc54007f08595acb227b`; Perfil `17d05a5f6af319668c361a293e6566f7183555ccab581f907329bf61e6f08d25` (igual que en la preparación: su alcance no cambia).

Límites: escritorio con Chromium y teclado simulado por `visualViewport`. No acredita teclado Android real ni la inercia que esconde la barra; eso solo se ve en el móvil.
