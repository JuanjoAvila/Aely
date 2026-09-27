# OPS-02 — restauración y siguiente pull, ensayo del 27/9/2026

**Ensayo ejecutado; contrato de recuperación pendiente de decisión.** Base remota verificada:
`origin/beta f7b66aef5fc35b8e3b3b17327c46309a421f22a7`. Rama aislada
`codex/ops02-restauracion`. Este cambio añade pruebas/documentación, no modifica la app,
no publica versión ni restaura datos reales. FIN-03/08 y la compra real de FIN-05 siguen separados.

## Qué demuestra ahora el código

La afirmación del 9/9 «restaurar NO toca la nube» era demasiado amplia. El callback de
`AutoBackupsPanel` no escribe la tabla de gastos, pero cambia el estado de App. Esto activa
el push de `app_state` a los 1,2 s. Después, `syncCloudExpenses` filtra lápidas, sube por
backfill gastos locales ausentes y mezcla el pull. Por tanto, **no es un rebobinado de toda la
cartera ni una operación puramente local**. Tampoco conserva necesariamente la foto restaurada.

Fuentes ejecutadas sin extraer/reimplementar lógica de App:

- `10-app-components.js`, `AutoBackupsPanel`: solo exige `data.accounts` truthy; escribe
  `mcSaveRaw` y llama al `set` real. Confirmación única; el comentario antiguo de «dos pasos»
  no describe este flujo.
- `00-core.js`, `mcSaveRaw`/`mcLoadRaw`: gastos a `_exp`, resto a clave principal.
- `11-app-main.js`, `set`: vuelve a sellar `_savedAt`; push debounced llama a `slimForCloud`.
- `slimForCloud`: excluye `expenses` y `bankTx`; cuentas, presupuesto y lápidas sí viajan.
- `syncCloudExpenses`: ausencia no significa borrado, hay backfill y merge aditivo.
- `refreshExpenseFromCloud`: refresca marcas `#dup`, importe y notas no editadas; conserva
  nota humana y categoría manual. `possibleDupOf` y `extId` no se reconstruyen desde la tabla.
- `keyOfExpense`: OB aún usa día/importe/comercio. Cambiar importe cambia la clave aunque el
  UUID sea el mismo. El ensayo no intenta reparar ese contrato ni empareja por parecido.

## Cómo repetir

Con las dependencias existentes del proyecto y Chromium instalado:

```text
npm run build
npm run test:e2e -- e2e/backup-restauracion.spec.mjs e2e/persistencia.spec.mjs --workers=1
node tests/relevant-tests.test.mjs
node tests/merge-expenses-cloud.test.mjs
node tests/expense-id-cloud.test.mjs
node tests/docs-frescura.test.mjs
npm run test:syntax
npm run test:privacy
```

Si hace falta, fijar `PLAYWRIGHT_CHROMIUM_PATH` al navegador ya instalado. No instalar otro.
El puerto deriva del worktree. `e2e/backup-restauracion.spec.mjs` está registrado para el módulo
10 en `E2E_MAP`; el núcleo 00/11 obliga a suite completa. El runner existente ejecuta todos
los specs registrados. El doble auxiliar `e2e/ops02-backup-cloud.mjs` no es un spec huérfano.

El ensayo abre Ajustes → Copia de seguridad → Copias automáticas y confirma con AskHost real.
Dos contextos independientes de Chromium comparten un almacén **solo en memoria del test**.
Se ejecutan los métodos cloud reales contra un cliente Supabase ficticio mutable, con filtros,
escrituras y respuestas. Todas las peticiones fuera de localhost están bloqueadas. El segundo
cliente inicia sesión explícitamente para ejercitar `freshLogin`, sin una cartera local nueva
que compita por last-write-wins. Recargar no vuelve a sembrar el estado local.

No es integración PostgreSQL: el doble no demuestra RLS, concurrencia SQL, constraints reales,
transacciones, caducidad de sesión, cuota de storage ni despliegue del servidor. No usar un verde
de este ensayo como autorización para restaurar una cartera real o activar un backend.

## Matriz ejecutada

| Caso | Resultado observado |
|---|---|
| Copia diaria | `backupState` conserva gastos, marcas, referencia al gemelo, lápidas y `bankTx`; mismo día reemplaza copia anterior; poda la copia ficticia de 2000. No escribe `expenses`. No se midió el disparador diario con la app cerrada. |
| Restaurar | Sustituye cuentas, presupuesto, gastos y lápidas localmente; ambas mitades se leen de vuelta; base sin `expenses`. |
| Después de restaurar, antes del pull | `app_state` recibe presupuesto/cuentas/lápidas restaurados; excluye `expenses` y `bankTx`. Tabla de gastos aún idéntica a la anterior. |
| Siguiente pull | Añade una fila creada después de la copia; refresca nota/categoría y decisiones remotas; sube una fila restaurada que ya no existe en tabla. |
| Lápida de la copia | Oculta la fila remota correspondiente en A, pero no la borra de tabla. Viaja por `app_state` al segundo cliente. |
| Pendiente en copia, distinto en cloud | El pull quita `possibleDup`; A retiene `possibleDupOf` local aunque deje de estar pendiente. |
| Distinto en copia, pendiente en cloud | El pull vuelve a marcar pendiente: no preserva la decisión de la copia. |
| «Es el mismo» después de la copia | Se pulsa desde Gastos real; elimina el UUID exacto y crea lápida. Restaurar la copia anterior quita esa lápida; el pull vuelve a subir la fila como `#dup`. La decisión posterior se deshace. |
| Reinicio de A | Conserva la mezcla posterior al pull, no vuelve a la foto original. |
| Segundo cliente B con login | Recupera UUID y suma de la mezcla; no recupera `possibleDupOf` ni `extId`. Sí recupera nota humana, flag de nota editada, divisa/importes originales, `noCard` y nombre OB de la fila subida. |
| Importe cambiado después | Con UUID igual, local 10 y cloud 11 generan dos entradas locales de ese mismo UUID; suma local 21, tabla conserva una fila 11. Nota humana de la entrada restaurada sigue local. Defecto de identidad, no solucionado aquí. |
| Cancelar | No consulta `getBackup`, no sustituye estado. |
| Copia corrupta sin accounts | Se rechaza; estado intacto. |
| Copia corrupta con accounts y expenses string | Pasa el guardia, escribe string en `_exp` y provoca la pantalla de error de App. No existe validación suficiente. |
| Sin red al listar/descargar | Aviso de error; no hay sustitución. Al fallar lista no hay botón Restaurar. |
| Sin red después de restaurar, reinicio y reconexión | La foto permanece local durante el fallo de transporte; al reconectar, pull añade otra vez la fila posterior y backfill sube la restaurada. No existe aislamiento permanente. |

La ausencia de red se simula con error de transporte en el cliente ficticio. No se afirma que
se haya medido un Android en modo avión ni el comportamiento de `navigator.onLine`.

## UUID, campos y sumas por separado

Todos los importes son ficticios. UUID abreviados aquí por su sufijo; en el test se comparan completos.
Los campos comprobados incluyen fecha, comercio, origen, banco, categoría, importe, nota y edición,
tarjeta, importe/divisa originales, nombre OB, `extId`, deuda, pendiente y gemelo.

| Etapa principal | UUID | Suma cruda | Suma excluyendo pending |
|---|---|---:|---:|
| Copia y restauración inmediata | 001,002,003,004 | 100 | 80 |
| Después de pull y reinicio A | 001,002,003,004,006 | 160 | 130 |
| B con login | 001,002,003,004,006 | 160 | 130 |

**A y B tienen iguales sumas/UUID, pero diferentes campos**: B carece del gemelo local y `extId`.
Otro guardián compara dos filas distintas de importe 10: suma igual, UUID/campos diferentes.
Estas sumas son controles sobre filas, no una afirmación de Disponible/widget/FX ni un cálculo
de presupuesto completo. El test adjunta JSON sintético de cada etapa en `test-results` (ignorado).

## Propuesta concreta para decidir antes de programar

Recomendación: sustituir el actual reemplazo conectado por **abrir la copia en una vista aislada
de recuperación**, validarla y compararla con la cartera actual. Ninguna fila ausente de una copia
es candidata automática a DELETE; ninguna coincidencia de atributos decide identidad.

Primera entrega acotada, cliente web, sin backend ni cambios de identidad:

1. Validar objeto raíz, arrays de estado requeridos, objetos de fila, UUID/id legado conservado,
   importes finitos, fechas válidas y forma de lápidas/ajustes antes de aceptar la copia. Rechazar
   UUID repetidos y errores de forma con motivo; no arreglarlos ni inventar datos.
2. `AutoBackupsPanel` conserva `preview` como estado propio y abre un componente de solo lectura.
   No llama al `set` de App, `mcSaveRaw` ni cambia `mcStateKey`. No usar el modo sandbox existente
   como garantía implícita: sus lecturas/persistencia tienen otro contrato.
3. Comparación por UUID exacto; mostrar presentes/ausentes/campos distintos y sumas separadas.
   Filas con ID legado o identidad ambigua quedan para revisión, sin correspondencia inferida.
4. Salir devuelve a la cartera intacta. Guardar/exportar la evidencia es una acción local explícita.
   Aplicar una recuperación compartida queda desactivado, con explicación del límite.
5. Recuperación que escriba cloud se diseña aparte después de FIN-03/08: revisión esperada,
   operaciones por UUID, decisiones persistidas, ACK y tratamiento de operaciones posteriores.
   No restaurar con DELETE masivo + upsert ni sobrescribir `app_state` sin comparar revisiones.

### Diff de contrato propuesto (NO aplicado)

Esta es la sustitución revisable del punto que hoy cambia la cartera; no es un parche publicable
hasta implementar y probar el validador y el visor indicados:

```diff
 function AutoBackupsPanel({state, set, showToast, uid, onClose}){
+  const [preview,setPreview]=useState(null);
   // al recibir la copia:
-  if(!data || !data.accounts){ showToast("✕ "+t("st_badfile")); return; }
-  mcSaveRaw(mcStateKey(), data); set(function(){ return data; });
-  showToast(t("st_imported")); onClose();
+  const checked=validateBackupSnapshot(data);
+  if(!checked.ok){ showToast(tf("bk_invalid_reason",{reason:checked.reason})); return; }
+  setPreview(data);
   // render propio, sin montar App ni sus efectos de sync:
+  if(preview) return React.createElement(BackupRecoveryPreview,{
+    snapshot:preview,current:state,onClose:function(){setPreview(null);}
+  });
 }
```

Archivos previstos: validador puro en `00-core.js`, panel/visor en `10-app-components.js`, textos
es/en/ca en `01-i18n.js`, los guardianes registrados y documentación/metadatos de una nueva beta.
El visor puede empezar como tabla de filas; no rediseñar otras pantallas ni implementar FIN-03.

**Aceptación:** cero llamadas adicionales de escritura atribuibles a abrir/cerrar el visor;
estado activo y ambas claves iguales antes/después; el visor sobrevive a un pull de App sin
aplicarse; invalidación antes de persistir; comparación por UUID/campo/suma; cancelación/error
sin sustitución; B intacto; offline con copia ya disponible; ninguna operación financiera de
recuperación automática. Tests DOM y unitarios registrados; beta publicada y prueba móvil del
dueño antes de producción. Distinguir escrituras ordinarias de App de las provocadas por el visor.

**Rollback de esa futura entrega:** cerrar visor y descartar su estado, sin tocar cartera/cloud.
Antes de publicar conservar el SHA previo. Si hay defecto, desactivar apertura del visor en la
siguiente beta; no volver a ofrecer silenciosamente el reemplazo conectado inseguro. No hay
migración que revertir. Una futura recuperación cloud requerirá su propio rollback y autorización.

## Estado de entrega y límites

La caracterización tiene diez casos; se verificó además la suite de persistencia (nueve casos).
La decisión same se comprobó también aisladamente desde la UI real tras sustituir el primer
ensayo de primitivas. El plan `npm test -- --plan` ejecutó todos los pasos Node existentes:
su único fallo fue `memoria-espejo`, por documentos locales ajenos ya desfasados. No se regeneró
el espejo ni se incorporó trabajo ajeno para fabricar un verde. Ese fallo impide al runner lanzar
E2E; los 19 casos se ejecutan por CLI directo. Deno omitido expresamente; no hay cambios Edge.
Sintaxis, privacidad, frescura de documentación, mapa, identidad y mezcla PASS.
La revisión independiente del SHA exacto se solicita por el canal de archivos de Claude.
No afirmar suite completa, CI remoto, beta ni prueba móvil por un ensayo local.

OTA/APK: no necesarias para estos tests/docs; comportamiento publicado sin cambios.
Próximo paso único: decidir el contrato de vista aislada anterior. OPS-02 tiene el ensayo terminado,
pero la recuperación fiable compartida permanece abierta. No se convierte este informe en una
orden de restauración real ni de reparación FIN-08.
