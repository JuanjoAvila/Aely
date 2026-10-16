# UX15 · Actualizar gastos

Candidata sobre `main` `9370565008aa2c4df9fb0588b2bf4f97e2cdc726` (4.26.136),
sin versión nueva ni publicación. Tarea `ux15-sincronizar-gastos-codex-20261016`.
La consulta `ux15-consulta-texto-sincronizar-20261016` quedó publicada en
`b0b56cbd063799ea3d1022c3da0d090848edbaa9`; Claude aprobó explícitamente la
opción 1 y sus textos en `60e6aaff` antes del cambio de producto.

## Qué actualiza

`Expenses` (`04-tab-gastos.js`) recibe `onSync` desde el render de Gastos en
`11-app-main.js`. Ese callback llama a `syncCloudExpenses`, que recupera las
filas de gastos de la nube y mezcla todos los orígenes ya guardados, incluidas
las notificaciones. Si hay parejas de movimientos, también lee su estado.
Conserva el backfill y la reconciliación existentes. No llama a `bankSync` ni
a `bankSyncHistory`: pulsarlo no solicita otra lectura del banco.

El botón pasa de «Sincronizar» a «Actualizar gastos», con estado ocupado y
explicación siempre visible en español, inglés y catalán. El aviso aclara el
origen en nube y que no consulta bancos. `aria-describedby` enlaza la misma
explicación con el botón. Son tres claves nuevas por idioma; las antiguas
`g_sync` y `g_syncing` permanecen intactas (Brókers comparte `g_syncing`).
No cambia `onClick`, su guardia de ocupado ni la conducta del callback.
Los mensajes de resultado de `onSync` permanecen fuera de este alcance.

## Verificación focal

`e2e/gastos-sincronizar-alcance.spec.mjs`, registrado en el mapa de Gastos,
abre la pantalla real con fixture sintética en los tres idiomas. Comprueba
el texto visible, etiqueta exacta, descripción accesible, estado ocupado,
retorno a disponible y permanencia de la explicación. Envuelve el lector
real para comprobar una lectura por pulsación y verifica que el mock de
funciones no recibe `bank-sync`.

ROJO previo al producto: tres fallos semánticos por explicación ausente;
la pantalla y el botón sí estaban visibles. Un worker, cero reintentos.
La evidencia local conserva el informe JSON, comandos, EXIT y hashes.
GREEN final: 3/3, EXIT0, sin reintentos, omisiones ni flaky. Durante la
preparación se corrigió el campo del registro del mock de funciones (`name`);
solo la pasada final y la mutación siguiente acreditan esa aserción bancaria.

Dos mutaciones temporales de `04-tab-gastos.js`, ambas retiradas:

- Eliminar la explicación: 3/3 ROJO por texto semántico ausente, EXIT1.
- Añadir `cloud.bankSync({})` al pulsar: 3/3 ROJO al detectar la invocación
  `bank-sync` en el mock, EXIT1. Ninguna conexión bancaria real.

Restaurada la fuente, nuevo build EXIT0 y DOM 3/3 EXIT0. Sintaxis del HTML,
claves de idioma, mapa de pruebas, privacidad y seguridad: EXIT0.
El script de mutación detectó primero un patrón de salto de línea que no
coincidía; abortó antes de ejecutar pruebas y se corrigió el patrón. No se
repitió ningún fallo de infraestructura ni se reclamó un lease.

## Límites

No suite general: el coordinador integra beta137 y mantiene prioridad
FIN15 → FIN12. Sin evidencia de CI general, integración, beta servida,
Android ni aceptación móvil. Sin cambios de VERSION, notas, catálogo,
caps, MyInvestor, Deudas/Metas, servidor o despliegue. El texto no acredita
una conexión bancaria real ni corrige su frescura.
