# Port privado FIN10 sobre beta503

Estado: candidata privada desde `503d23267091eb5aa0b0e37dd94fac20ea37bd08`,
rama `codex/fin10-beta503-port-20261017`. Sin push, PR nueva ni result de esta
sucesora. El SHA final queda sellado en el manifiesto privado del titular.

Se porta SOLO el delta revisado `a9c9e45d` → `f872a24c`, con la regresión final
del comodín sin cuenta incluida. Aplicación de tres vías limpia, sin resolver conflictos
ni cambiar semántica financiera. Las adiciones/borrados de los ocho paths de fuente,
tests y registro coinciden exactamente con el delta aprobado; los cambios de beta140
se conservan. El lector servidor y los cuatro paths de tests/spec coinciden con f872.
PR259, GO anterior, fuente f872 y result eff27854 quedan congelados e inmutables.

Evidencia NUEVA de este port, sin trasladar verdes de la base anterior:

- ROJO antes del port de producto sobre503: 15 casos, 8 PASS y 7 FAIL, EXIT1.
- Fuente portada: 87/87 en UTC y 87/87 en Europe/Madrid, EXIT0 por zona; 87 únicos
  (38 FIN10, 17 FIN15, 32 Compras). Matriz12 cliente/servidor: v2 oculta5, v1 conserva12.
- Deno2.9 real, sin red ni instalación: 12 casos existentes de widget/lector y una
  prueba local directa del lector, EXIT0 (13/13). Esa prueba replica matriz12/v1,
  referencias distintas y comodín sin cuenta sin consumir a la superviviente:320c.
- E2E FIN15 y Compras sobre HTML propio cotejado por SHA256: 8/8, EXIT0,
  puerto48542 enlazado por este servidor, 1worker/0retry/0skip/0flaky/stopprimerfallo.
- Build y sintaxis: EXIT0. Oráculos y mutantes anteriores intactos; 676 comparaciones
  legacy FIN15 conservadas y mutante final del comodín muerto por0frente320.

Las pruebas se ejecutaron sobre los archivos portados antes del commit; los recibos
guardan el HEAD503 y el estado modificado real, junto con SHA256 de los inputs ejecutados.
El manifiesto coteja esos bytes con la candidata final: no se etiqueta como verde una
prueba del código viejo503 ni se repiten casos por crear el commit. Datos sintéticos.

El DOM utilizó el catálogo generado por el build. Después se preservaron los dos JSON
de catálogo exactos de503 por estar fuera del scope; el HTML probado no cambia.
El index conserva el sello del catálogo generado: **catálogo/sello requieren reconciliación
de Claude antes de publicar**. Estas pruebas focales no acreditan el panel de novedades.
Ningún VERSION, catálogo fuente, tope u oráculo se modifica para cerrar ese gate.

Pendientes: revisión de esta cabeza nueva por Claude, integración serial, CI general
exacta, docs-frescura, beta-sources, tamaño oficial, artefacto servido y aceptación móvil.
Sin suite general, CPU6, Gradle/APK, SQL/RLS, auth/config/esquema, bancos vivos o despliegue.
No se incorpora cola FIN11 ni FIN17. FIN11 espera el NUEVO FINAL exacto revisado, no503
sin portar ni el antiguo f872. INC1710 conserva prioridad1. Entrega y eventual PR nueva
contra beta/cierre de PR259 como sustituida requieren otro turno expresamente admitido.
Esta candidata no es ProductREADY.

---

## Corte anterior conservado como histórico: candidata sobre a9

# FIN10 / FIN15: candidata privada sobre beta a9c9e45d

Estado: port completo preparado para revisión y entrega serial posterior. Sin push,
PR nueva, result, integración ni publicación. PR250 y su fuente 8ebf9c37 quedan congeladas.
El SHA final de esta candidata consta en el manifiesto privado, fuera del repositorio.

## Base y contrato

- Padre exacto: `a9c9e45d76d0d92c2c529b0652c24496dea75300`.
- Fuente FIN10 completa: `8ebf9c375577500c5e0ab305e2fbd574b14e1e65`, comparada con su
  base original `a9916c3cdb21c93f9d3a47653c0608e630ce50ab`; no solo el último commit.
- Rama aislada: `codex/fin10-fin15-beta-coexistence-20261017`.
- Escritor y lectores nuevos: `ob-absorbed2|banco|referencia|ordinal|cuenta|dia`.
  El día es el literal almacenado. Las claves v1 conservan su conducta histórica.
- Punto 3 ratificado: si la cuenta falta en la lápida **o** en la candidata, hay
  comodín de cuenta para el mismo banco/referencia/ordinal/día. Una lápida sin
  cuenta también oculta OTRA CUENTA conocida ese día. Nunca alcanza otro día.
  Dos cuentas conocidas distintas quedan separadas por una lápida v2 con cuenta.
- El escritor usa el mismo predicado antes de lapidar para proteger la superviviente.
  El índice cliente se cachea por el mapa de lápidas; el servidor calcula dos índices
  una vez. `#acc` viaja por el source OB/histórico; un pull legacy no borra una cuenta conocida.
- El servidor conserva `referenciaOb`, el `Map<string, Set<string>>` y el conjunto de
  referencias FIN15: banco/referencia estable deduplica PDNG→BOOK entre fechas.
  Las lápidas se aplican antes de consumir identidad; referencias distintas siguen distintas.

## Evidencia focal privada

Logs y comandos con EXIT real en `outputs/fin10-beta140-private/` del chat dueño.

- Control FIN15 en la base exacta, antes del port: 15/15, EXIT0.
- ROJO FIN10 antes de producto: 15 casos, 8 pasan y 7 fallan, EXIT1. La matriz
  ya registraba ambos lectores por separado: la base ignoraba las cinco coincidencias v2.
- Final Node en UTC y Europe/Madrid: 86/86 por zona, EXIT0. Son 38 FIN10,
  16 FIN15 y 32 compras-identicas-ids; no se presentan como 172 casos distintos.
- Matriz explícita de 12 casos en cliente y servidor: cuenta de lápida A/ausente ×
  candidata A/B/ausente × mismo/otro día. V2 oculta 5/12 y v1 12/12.
- FIN10 conserva sus diez mutantes de identidad, transporte, simetría y coste.
  FIN15 mata 11/11: la mutación de absorción antigua apunta ahora al lector v1;
  otra independiente elimina el lector v2. No se cambia ningún oráculo de céntimos.
- Compatibilidad FIN15 legacy: 676 comparaciones exactas contra `9370565`, sin `#ref`.
  Caso conjunto nuevo: una retirada de 99 € no consume la referencia antes de una
  BOOK de 3,20 € del día siguiente; ambos órdenes conservan exactamente 320 céntimos.
- E2E reales `compras-identicas-ids` y `fin15-pendiente-contabilizada`: 8/8,
  EXIT0, un worker, cero reintentos, cero omitidos y parada al primer fallo.
  FIN10 aporta tres casos DOM dentro del spec FIN15 ya registrado: otra cuenta,
  otro día y absorbida propia. El hook coteja SHA256 del HTML servido con este checkout.
- Build, presupuesto-servidor y sintaxis: EXIT0. El runtime reutiliza exclusivamente
  los módulos propios del predecesor de este mismo worker, sin instalaciones ni enlaces.

Los intentos fallidos se conservan: resolución inicial del runtime, port intermedio
antes de completar el servidor y mutación FIN15 que aún apuntaba al lector antiguo.
No son verdes ni evidencia de otro commit. El primer arranque E2E falló al cargar
la configuración ESM, sin ejecutar casos ni abrir Chromium; se corrigió esa resolución
local y la única ejecución de los ocho casos pasó sin reintentos.

## Límites y relevo

El build genera nuevas huellas de catálogo. Se preservan como evidencia privada;
`public/release-notes.json` y `public/beta-delivery.json` se mantienen exactamente
como en la base, por la prohibición de modificar catálogo o repinar. El index procede
del build real y conserva su sello del catálogo generado: **el catálogo y su sello
requieren reconciliación del integrador antes de publicar**. No se edita el HTML a mano.
El verde focal financiero no acredita ese gate ni el correcto panel de novedades.

El unitario FIN10 queda registrado en `steps`; el mapa E2E existente ya incluye el
spec FIN15 en Gastos y los cambios de núcleo exigen la suite general en integración.
No se amplía ni se debilita ese mapa para obtener un verde focal.

No ejecutados/autorizados aquí: suite general, CPU6, CI del SHA final, docs-frescura,
beta-sources, presupuesto de tamaño, Deno, SQL/bancos vivos, migraciones, despliegue,
Gradle/APK y aceptación física móvil. Sin cambios en 09/editor, VERSION, registros
de catálogo, topes ni FIN11. FIN11 sigue HOLD hasta nueva fuente final y admisión/GO.
La siguiente entrega necesita turno exclusivo, PR nueva en borrador contra beta,
revisión independiente y los gates de integración. Esta candidata no es ProductREADY.
