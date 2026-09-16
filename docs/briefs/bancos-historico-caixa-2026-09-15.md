# Bancos sin movimientos — diagnóstico y corrección

## Estado

16/9/2026. Rama `codex/bancos-historico-caixa`, rebasada sobre `641c1244` (4.24.4).
Versión preparada **4.25.0**, con tooling en commits separados. Sin publicar ni desplegar.
Claude y Cursor han revisado el diff; Cursor también ha ejecutado los afectados. El dueño ya
autorizó desplegar solo `bank-sync` junto a esta beta. Quedan el verde del SHA rebasado, publicar,
verificar el paquete vivo y la prueba móvil; no confundir autorización con despliegue ejecutado.
No se han sincronizado bancos reales ni modificado carteras para investigar.

Al comenzar se contrastó Pages 4.23.1, beta publicada 4.24.0.1 y el código desplegado de bank-sync mediante
la API de lectura de Supabase. El paquete desplegado conserva los fallos descritos aquí.

## Evidencia y límites

- La BD contiene enlaces CaixaBank activos y otro pendiente: un único diagnóstico «reconectar»
  no explica todos los casos. No se deben cambiar estados de enlaces para forzar una recuperación.
- Telemetría del histórico: `skippedUniq=1104` sigue apareciendo en 4.22.2.1. El cambio anterior
  que añadió el banco a una clave no acredita que esto esté cerrado. Sin las páginas originales
  no se puede atribuir ese contador a una sola causa.
- El sync diario lee únicamente la primera página. Enable Banking permite **página vacía con
  continuation_key**: hay que seguir. [Contrato oficial](https://enablebanking.com/docs/faq/).
- Histórico: un fallo en la segunda página elimina del resultado la primera; los enlaces
  pendientes/caducados se omiten; el cliente ignora `accounts[].ok:false` y muestra «no hay».
- Un rango no admitido devuelve `WRONG_TRANSACTIONS_PERIOD`. El proveedor ofrece
  `strategy=longest` para buscar el periodo disponible; es un intento acotado, no una promesa
  de 90 días. [Documentación del proveedor](https://enablebanking.com/blog/2024/03/11/changelog-february-2024).
- El cliente corta a los 150 movimientos más recientes **de todos los bancos juntos**. Un banco
  con mucho movimiento puede expulsar a otro antes de la importación diaria.

Estas son reproducciones de defectos presentes en el código real. **Aún no demuestran qué
página devolvió CaixaBank en cada móvil afectado.** La validación final necesita el Edge corregido
y una consulta a demanda, sin importar ni borrar movimientos solo para probar.

## Cambio preparado

1. `fetchBankTransactions`: paginado compartido, parámetros consistentes, 12 páginas / 2000
   filas / 15 s por cuenta, incluyendo balance en el sync. Deadline global de 60 s: las cuentas
   que no caben se señalan sin llamar al banco. AbortSignal cancela el fetch pendiente.
   Cursor cíclico o tope → parcial.
2. Solo `WRONG_TRANSACTIONS_PERIOD` permite cambiar una vez a `strategy=longest`. Sin reintentos
   automáticos ante permisos, 403, caídas o timeout. Se conserva lo leído si una página posterior falla.
3. Histórico incluye enlaces inactivos sin consultar al banco ni escribir en BD. Avisos por banco,
   también con cero candidatos; error de transporte distinto de un resultado vacío correcto.
4. Compatibilidad con Edge antiguo: el cliente contrasta los enlaces esperados y señala los omitidos.
5. Fuera el cupo global 150. La ventana temporal, la identidad y el dedup diario permanecen iguales.

## Verificación final integrada

`npm test` sobre `1336fcb8` (bancos + tooling + categorías + ayuda), Chromium oficial 1228:
Europe/Madrid **EXIT 0**, Node + Deno verdes, **298 E2E correctos / 1 captura omitida / 0 fallos /
0 flaky**, 225,3 s. Incluye los nueve casos del histórico y siete mediciones de rendimiento.
UTC del mismo árbol: **EXIT 0**, los mismos 298 correctos / 1 omitido / 0 fallos / 0 flaky,
225,3 s. Se publica por bloques, bancos primero.

El fixture rápido expuso una carrera en `bancos-lista-fresca`: el doble ya cambia al conectar,
no por número de consultas. Mutación: quitar el listener hace fallar con una fila en lugar de
dos (EXIT 1); restaurado, PASS. El brief de tests explica también el aislamiento de rendimiento.
Claude y Cursor: verde leyendo paginado, ventana mensual, deadline, avisos y tooling.
Cursor sobre `bb55475a`: guardianes verdes, paginado 12/12 y TR en ambas zonas; **27/27 E2E en
Madrid y 27/27 en UTC**, incluidos histórico, refresco, Novedades, persistencia y espera de nube.

## Evidencia de implementación y primeras pasadas (previas a la integración)

- `node tests/bank-sync-paging.test.mjs`: 5 regresiones rojas en la base. Tras la corrección,
  12 casos verdes en local y UTC: paginado diario, rango, fallo parcial, cursor cíclico, deadLinks,
  aislamiento, timeout, parámetros, respuesta inválida, deadline global, ventana mensual y topes.
  Handler real con BD/banco simulados, sin datos personales.
- `node tests/tr-open-banking.test.mjs`: 12 casos verdes, incluido banco posterior al cupo 150.
- `i18n-keys`, `edge-sintaxis`, `relevant-tests`, `quitar-banco-y-pendiente`: verdes.
- Deno comprueba los tipos de `enablebanking.ts` y `bank-sync/index.ts`: EXIT 0.
- Siete suites de regresión histórica, identidad y conciliación de bancos: EXIT 0.
- `bancos-historico-filtro`: **9/9 E2E, EXIT 0**, navegador Chromium (Edge), puerto exclusivo.
  Se comprobó por HTTP que el servidor servía el código de esta rama.
- Fase completa Node + Deno del runner ejecutada en Europe/Madrid y UTC: todas las pruebas
  funcionales verdes; ambos procesos terminan con EXIT 1 solo por `memoria-espejo` (faltan
  `e2e-puerto-compartido.md` y `MEMORY.md` respecto a la memoria local de Claude). El mismo
  chequeo falla también en el checkout base. No se modifica memoria ajena para ocultarlo.
- E2E completos Europe/Madrid: **267 pasan, 1 omitido, 2 fallan; 22,3 min, EXIT 1**.
  Los fallos están en `indicador-arco` (ráfaga sin arco observado) y `tour-tutorial`
  (foco inicial más estrecho que el target). Los 9 casos bancarios pasan también dentro de esta batería.
- Repetición aislada, máquina libre: tutorial pasa; arco vuelve a fallar. El mismo test del
  arco falla también sobre el bundle **exacto de `c34fe81c`**, archivado y servido en otro puerto
  (contenido HTTP contrastado por SHA256). Es un fallo previo reproducible en este entorno,
  no una regresión introducida por el cambio bancario. No se oculta ni se llama «verde» al conjunto.
- En aquella fase no se había ejecutado el navegador UTC; ver validación integrada arriba.
- Segunda revisión de Claude leyendo `07c95bdc`: bloqueantes de presupuesto de tiempo y
  ventana de fechas resueltos. El rebase posterior sobre 4.24.3 conserva ese arreglo.

El fallo de arco de Edge no se reproduce con Chromium oficial 1228, que pasa los tres casos.
El obstáculo de memoria-espejo desapareció con la documentación actual de 4.24.3. Las primeras
pasadas rojas descritas arriba no son la validación final.

Mejora posterior fuera de esta tanda: el sync diario sigue descartando el saldo de una cuenta
si falla la primera página de transacciones, aunque el balance se hubiera recibido. Es previo
al cambio; separar ambos resultados necesita su propia prueba de compatibilidad.

## Integración y despliegue

Coordinar con las 4.24.x de Claude/Cursor; no integrar ni promover rondas pendientes de aprobación.
La parte cliente llega por **OTA**; no necesita APK. El paginado necesita desplegar **bank-sync**
con aprobación explícita del dueño, porque el servidor es común a beta y producción. No hay SQL,
migraciones ni backfill. Revisar diff completo antes de publicar; no afirmar «arreglado en móvil»
porque la rama o el CI estén verdes.

Guion móvil tras despliegue autorizado:

1. Anotar un cargo reciente conocido de CaixaBank/Sabadell sin compartir datos sensibles.
2. Sincronizar una vez desde Cuentas. Revisar Gastos en el periodo/banco adecuados.
3. Abrir Importaciones → Importar histórico → tres meses; comprobar ese cargo y otros conocidos.
4. Si algo falla, debe decir el banco y si falta autorización o la descarga quedó incompleta;
   los otros bancos siguen visibles. **No importar ni borrar para validar esta tanda.**
