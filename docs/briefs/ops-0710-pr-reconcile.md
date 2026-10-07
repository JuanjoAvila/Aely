# Reconciliación de PR89/91/93/137/138 · 7/10/2026

## Decisión verificada

Las cinco PR quedaron cerradas **sin merge** el7/10/2026 a21:13UTC como fuentes absorbidas o superadas.
No queda un cambio útil exclusivo que deba injertarse desde sus heads examinados.
El cierre administrativo no equivale a una publicación nueva, ni acredita aprobación móvil,
ni resuelve INC-2709-09. El coordinador confirmó el cierre administrativo mediante herramienta oficial. No fusionó ni eliminó ramas o worktrees.

Corte inicial comprobado mediante lector oficial GitHub: las cinco PR estaban abiertas y draft. Sus heads se releyeron sin cambios antes del cierre; readback confirmó closed/merged:false para las cinco.
El coordinador releyó sus heads antes del cierre, sin cambios. Esta conclusión
no cubre nuevos deltas posteriores al corte. Los bodies y actas históricos se tratan como contexto, nunca como
prueba de entrega.

## Referencias congeladas

- main: `067371705615e9cc58923509e3f60c3d0c9003ff`, tree `9b4d215282c51b4b5254be2c948b2d73648ea3a5`.
- beta102: `6b81279676d66337d7b34b7badc6d1ff2c66bc24`, tree `839c975d8ba3ca7a9c3a7a53c1b474c01b160971`.
- Checkout de esta acta: aislado desde main; sólo documentación.

| PR | Head examinado | Tree |
|---|---|---|
| [#89](https://github.com/JuanjoAvila/Aely/pull/89) | `c76e1f94c6711533f005ddb7d5a9e7c7a2516c00` | `5571f829740c4353d0b1f4e6ba68dc2c4f765c74` |
| [#91](https://github.com/JuanjoAvila/Aely/pull/91) | `6d823e9bb6c00aa74daf34fbd2d5f2f9cf8d5d8d` | `80ac0bfb350fffd6e79b9137c8da139e1d78cca3` |
| [#93](https://github.com/JuanjoAvila/Aely/pull/93) | `8236a769ba6d4c3ee05db2260c2de6a0d0c9ddaa` | `dc60450aa6128da4dee1b4d8bc9b49422b58ed2b` |
| [#137](https://github.com/JuanjoAvila/Aely/pull/137) | `5cf28328d7c061aa1d99fb6f466512aaef8531ae` | `35fdac3183b60675265b2d977576ed90fa8a7d3a` |
| [#138](https://github.com/JuanjoAvila/Aely/pull/138) | `085b215175a7904c9bc39c98879225d9a3bf43d2` | `8553727a36bf5e5ff13374d6c7c106b71306f7c2` |

Se leyeron oficialmente PR, lista completa de archivos y árboles recursivos sin truncamiento.
Las comparaciones de producto usan los patches originales y la fuente actual, no igualdad
del archivo completo: main/beta contienen otros cambios válidos posteriores.
Los blobs de test y evidencia permiten distinguir absorción exacta de mantenimiento posterior.

## Producto: fuentes89/91/93 absorbidas

| PR | Delta original comprobado en main y beta | Test actual | Residuo que no se debe mezclar |
|---|---|---|---|
|89 · Cyberpunk +|En `src/shell.html`, regla Cyber `.botnav-fab` con `position:relative;z-index:1` y comentario causal originales.|Registrado en CROSSCUTTING. Escenarios conservados; fixture cromática mantenida después.|Metadatos y artefactos de versión provisional79; estado histórico de preparación.|
|91 · Preguntar al borde|Selector `.v4-sheet.aely-help-sheet` con padding inferior0; compositor con `var(--safe-bottom)`; teclado `[data-help-kb="1"]` con padding inferior10px.|Archivo completo idéntico por blob, registrado bajo módulo16.|Metadatos y artefactos de versión provisional80.|
|93 · Perfil vacío|Clase propia `pr-val-empty` en ProfilePanel del módulo14 y selector CSS correspondiente, con comentarios originales.|Archivo completo idéntico por blob, registrado bajo módulo14.|Metadatos y artefactos de versión provisional81.|

Las líneas añadidas de runtime de esas PR se verificaron individualmente en main.
Las líneas CSS también se verificaron en el shell beta leído oficialmente.
El módulo14 tiene el mismo blob en main/beta:
`c7f36c8683df9187511aa03e09f6aa229d666a5e`.

Las tres identidades `inc-2709-12-cyber-fab`, `inc-2709-14-preguntar` y
`inc-2709-10-perfil` están en la entrada **4.26.77** del catálogo actual.
`docs/briefs/ui-77-integracion.md` explica la consolidación y la reserva provisional79/80/81.
Esa explicación concuerda con la fuente y el catálogo comprobados; el acta sola no prueba
que el móvil esté actualizado ni autoriza ninguna promoción.

| Spec | Blob head original | Blob main = beta |
|---|---|---|
|cyber-fab|1ce34ceec836d33f31a8ba013d665161850de68e|5f3f82f3d1a9078e08beca5a3bfcd83ea83c924d|
|help-preguntar-borde|f4447ddd331911b5a8f8ec3df2087d8f1e61c925|f4447ddd331911b5a8f8ec3df2087d8f1e61c925|
|perfil-filas-vacias|d8b782731144eed50bbc8928aeedd22415d391e4|d8b782731144eed50bbc8928aeedd22415d391e4|

El delta de cyber-fab espera fuentes, congela decoración antes de medir y neutraliza dithering
del degradado con fondo opaco del mismo tema. Conserva el control de ocultar la corriente y
los casos originales. No recuperar la fixture anterior como si fuera un test perdido.
Las tres actas fuente siguen conservadas con cabecera de evidencia provisional; sus frases
de CI/publicación pendientes describen el corte histórico, no el estado de main de hoy.

Los otros archivos originales son bumps79/80/81, README/ROADMAP/TESTING/EMPIEZA/CHANGELOG,
notas y `public/index.html` generado. No se debe sustituir documentación actual ni bajar
versiones/recuperar esos artefactos obsoletos para cerrar las PR. No hay cálculo financiero
nuevo en sus patches de producto.

## Tooling:137/138 absorbidas y mantenidas

Ambas PR cambian pruebas/documentación/runners, sin módulos de producto, shell, catálogo
funcional, VERSION, APK, Edge o SQL. PR137 introduce GC5/natural v1/v2 y la campaña sostenida.
PR138 conserva esas evidencias y añade lifecycle/network v3, warmup, atribución por acción,
contadores de transporte y los controles de banco sólo a demanda y cero reescrituras del
histórico. Esos controles actuales están presentes, no se trasladaron sólo los briefs.

| Elemento | Resultado de comparación |
|---|---|
|Seis informes/guiones históricos GC5/v1/v2|Blobs idénticos en ambos heads, main y beta.|
|Spec137 v2|Preservado exactamente como guion-natural-v2.mjs.txt; spec activo evolucionado a v3.|
|Spec138 v3|Texto íntegro actual idéntico salvo fórmula de timeout de campaña; mismo blob actual main/beta.|
|Registro y runner|rendimiento-sostenido en CROSSCUTTING; regex de rendimiento incluye sostenido y ejecución serial.|
|Acta repro137|Contenido conservado, con cabecera que diferencia evidencia histórica de campaña v3.|
|Acta repro138|Blob completo idéntico en main/beta.|
|Acta v3 y TESTING|Documentación posterior añade base main separable, timeout y límites de serie larga; no hay tarea exclusiva por rescatar.|

Spec138 original `54610925f0b237eeba347fa74c251b39bab34917`;
actual main/beta `2542f1534a888a1fdffacf836bd4a21d305b0a57`.
Único delta funcional de ese archivo:
`Math.max(240000,cycles*22000+180000)` pasa a
`Math.max(240000,cycles*30000+300000)`.
La comparación de texto completo tras esa sustitución pasa; no cambian aserciones,
datos ni métricas por ese delta. El acta explica que la fórmula anterior no alojaba80 ciclos
de22,6–23,2s. No se ejecutó ni se repitió esa campaña en esta auditoría.

Los seis blobs preservados son:
- gc5.json: `d75259d71819e989518e5e5fa8a5c32ae9c695e0`.
- guion-gc5: `d42a344fe5ca186b23e87bece8c4dc4bbfc7b4ea`.
- guion-natural-v1: `ef5ae68477321a5726f780a46fbee2e358a431f5`.
- guion-natural-v2: `02657efab0b5cf6a6371dc75727356188c7481f3`.
- natural-3000.json: `266f8d1219c7ee32b9a04c363a4d833768a45353`.
- natural-5200.json: `f2c8580c61fd61f9021441e212347365b28ea63a`.

La integración de tooling PR144, commit `0d64c1ab35a6ef48a4bbc11c97c33f31b2062fda`,
es ancestro comprobado de main067. Esta auditoría comprueba los contenidos posteriores
directamente; no hereda un verde de los heads137/138 ni presume que los datos de v2 sean de v3.

## Criterios aplicados al cierre y límites vigentes

1. Releer estado/head de cada PR y referencias main/beta; ante delta nuevo, detener el cierre
   de esa PR y revisar sólo ese delta.
2. Cerrar sin merge con referencia a esta acta y a la absorción; preservar branches/worktrees
   y evidencia. No ejecutar CI de los heads obsoletos para fabricar una entrega nueva.
3. Mantener INC-2709-09 abierto. La campaña es sintética de escritorio; no acredita causa,
   resolución del lag humano, WebView, suspensión del SO ni transporte/auth/realtime reales.
4. Cualquier corrección nueva conserva revisión independiente, pruebas del alcance exacto,
   CI/publicador y beta/OK móvil propios. APK/Edge/SQL/dinero real tienen gates separados.

Verificación de esta acta: patches añadidos de producto preservados; blobs idénticos91/93;
seis evidencias137/138 idénticas; spec138 exacto salvo timeout documentado; registros y
tres identidades77 presentes; ancestro PR144 confirmado. No se modificó producto, no se
ejecutaron suites globales ni navegador. No se leyó dato privado ni se contactó backend.

