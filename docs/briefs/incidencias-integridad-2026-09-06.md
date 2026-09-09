# Incidencias de integridad — 2026-09-06

Autor: Codex. Entrada nueva del dueño, con contraste inicial del código y capturas privadas.
Amplía las tandas 1a/1b/1c y añade 1d/1e del plan de vuelta; no da por resuelto lo que una versión
anterior anunció. Este brief tiene prioridad sobre la cola de evolutivos hasta resolver la integridad.
Su incorporación a la tabla principal debe coordinarse con Cursor, cuyo PR #24 toca ese plan.

## Evidencia y límites

- El dueño reporta desaparición de operaciones legítimas atribuidas a duplicados; dejó de usar
  la app por ello. Capturas del banco muestran varios ingresos independientes de igual importe
  en un mismo día; las secciones equivalentes de la app muestran menos filas y nombres genéricos.
- Las imágenes prueban una discrepancia visible, no distinguen por sí solas entre rechazo al
  importar, fusión local, filtro, lápida o DELETE remoto. Investigar toda esa cadena.
- Una inversión por redondeo aparece en la app como `Otros` y gasto computable. Otro movimiento
  de transferencia requiere verificar signo y categoría. Son observaciones separadas, no prueba
  de que todos los fallos compartan causa.
- Los tres usuarios reportan widget desalineado y gasto mensual de la app temporalmente mayor,
  corregido al sincronizar. El padre vuelve a reportar cifras incorrectas de Revolut. No se conoce
  todavía la revisión exacta de APK/bundle/backend de cada reproducción.
- Las evidencias originales se conservan fuera del repo. No copiar fotografías, nombres ni
  importes reales al canal, a los fixtures o a un PR público.

Base inspeccionada: `refs/remotes/origin/beta` en `2cec2796` (VERSION 4.18.5).
Foto de canales comprobada en el onboarding: Pages 4.18.3; beta publicada 4.18.5.1; APK anunciada
42 / 4.18.3. Esto no acredita qué revisión llevaba cada teléfono al capturar el fallo.

## Cola priorizada

| Prioridad / referencia | Impacto y causa probable | Riesgo y alcance | Aceptación | Estrategia de prueba |
|---|---|---|---|---|
| **P0 · 1d / B01 · Falsos duplicados** | Pérdida de confianza y movimientos legítimos ausentes. Claves día/importe/nombre y ventanas de similitud confunden identidad; hay pérdida reproducida incluso con IDs distintos. | Alto: cliente, ingest y persistencia. Primero diagnóstico y contrato de identidad; después tickets acotados, cada uno rama/PR. Recuperación histórica por separado. | Operaciones distintas sobreviven a importar, fusionar, recargar y sincronizar. Reentregar el mismo evento no lo duplica. Ningún borrado por mera semejanza. | Tres ingresos ficticios iguales el mismo día; IDs distintos, sin ID, mismo/otro banco, cuentas distintas, Wallet/TR/OB, fechas de operación y contabilización, renombrado, reintento y orden invertido. Ver DOM, peticiones, nube simulada y widget. |
| **P1 · 1a / B09 · Totales app/widget** | Los tres ven cifras inestables. Posibles entradas/instantáneas distintas, fusión destructiva, categorías neutras y orden de sincronización. No atribuirlo ya a la fórmula. | Alto si afecta ingest o contrato nativo. Comparar capas con la misma entrada y registrar versión por plano. | Con la misma instantánea, periodo y bancos, app y widget acuerdan gasto y disponible. Respuestas antiguas no sustituyen otras nuevas. Sin conexión se indica la antigüedad. | Notificación con app cerrada; abrir, segundo dispositivo, offline/reconexión, carreras de respuestas y cambio de mes; pagos neutros y bancos excluidos. Dispositivo real y backend aislado/simulado. |
| **P1 · 1b / B04 · Revolut incorrecto** | Reincidencia reportada por el padre; no asumir que el arreglo anterior basta. Semántica de saldos disponibles/contables, datos nulos y anclas son candidatos. | Alto financiero. Identificar campo y ruta que pintan la cifra antes de modificar. | El saldo corresponde al campo bancario acordado y a su fecha; nulo no se inventa como cero; un negativo válido no se descarta por su signo. | Fixtures saneados para ITAV/CLBD, nulo/cero/negativo, respuesta parcial, caducada y refresco. Contrastar con fuente bancaria autorizada, sin publicar datos. |
| **P1 · 1e · Clasificación de inversión/traspaso** | Un redondeo aparece como gasto normal; puede inflar el mes. Datos OB incompletos y clasificación por importe/nombre son candidatos. | Alto por presupuesto; no basta cambiar el icono. Separar clasificación de identidad. | Aporte/redondeo/traspaso verificados no consumen presupuesto ordinario; signo y efectivo siguen el movimiento real. Ambigüedad visible, sin asignación irreversible. | Round-up/saveback/aporte/transferencia y compras ordinarias del mismo importe; misma regla en cliente y servidor, render y widget. |
| **P1 · 1c / B02 · Cierre entre bancos** | Reproducción previa: un gasto de otra entidad afecta al saldo de la cuenta principal en `reconcileTR`. El fix de saldo corriente no acredita el cierre mensual. | Alto: saldo persistido. Ticket separado de deduplicación y de recuperación. | Cerrar cada mes imputa a la cuenta correcta, una sola vez; recargar no vuelve a descontar. | Mes atrasado, varias cuentas, ingresos, inversiones y replay de cierre; comparar saldo de cada cuenta y patrimonio. |
| **P1 · B03 · Pruebas ligadas al calendario** | `invest-category` falla al entrar septiembre con un ancla fija de julio. Impide un verde verificable actual. | Bajo en pruebas; no esconder fallos financieros. PR independiente. | Reloj explícito y escenarios que conservan su significado en cualquier mes. | Suite completa con reloj controlado; Deno y e2e declarados ejecutados u omitidos, nunca inferidos. |

P0 significa aquí bloqueante de confianza y prioridad de diagnóstico, no declaración de caída
general del servicio ni confirmación de borrado remoto de toda la evidencia. Metas, efectivo,
import histórico, diseño y Play Store conservan su lugar documental, pero no se adelantan a estos
problemas. El import histórico seguro sigue pendiente; no usarlo para reparar automáticamente.

## Hallazgos reproducidos y candidatos

1. `00-core.js`, `mergeExpenses`: la clave usa día, importe y comercio, sin ID ni banco. Aunque
   el comentario dice «aditivo, nunca borra», también deduplica `prevList`. Reproducción sintética
   sobre el artefacto actual: tres ingresos de 10 euros, IDs diferentes y horas diferentes del
   mismo día; `mergeExpenses(tres, [])` devuelve **una fila**.
2. `08-motor-bank.js`, `importObExpenses`: después del control por `tx.id` se aplica la misma
   clave secundaria. Tres operaciones de 10 euros, mismo día/nombre y tres IDs bancarios distintos
   devuelven **una fila**. Un ID distinto no protege frente a esa segunda regla.
3. `08-motor-bank.js`, `reconcileObDupes`: el emparejamiento de OB sin nombre con otras fuentes
   usa importe y ±3 días sin comprobar banco. Reproducción previa: cargo ficticio de Revolut hace
   desaparecer el de TR. `11-app-main.js` envía sus candidatos a `cloud.deleteExpense`.
4. `supabase/functions/ingest/index.ts`: dedup de ±10 minutos por importe ±2 céntimos sin banco,
   y otro por día/comercio/importe. Candidatos leídos, no reproducidos contra backend real.
5. Inspeccionar también `filasComoLaApp` del presupuesto servidor, el índice de `expenses` y
   serialización/relectura de IDs. Corregir solo una función puede dejar intacta otra pérdida.

Contradicción histórica que Claude debe resolver: el plan del 17/8 prescribe día/importe/comercio
para detener avisos dobles de Wallet/TR y descarta añadir la hora. Esa decisión responde a un
duplicado real, pero no cubre pagos legítimos repetidos. No basta añadir la hora a todo ni quitar
la deduplicación: distinguir **identidad de evento**, **operación bancaria** y **similitud**.
El test `ob-renombrar` llamado «dos cargos iguales de verdad» usa días distintos; no protege este
nuevo caso del mismo día.

## Primer encargo enviado: diagnóstico de identidad (1d-DIAG)

**Estado:** diagnóstico autorizado por el encargo de onboarding y estas incidencias. Implementación
financiera, migración, reparación de datos y despliegue NO autorizados en este ticket.

**Cursor:** rastrear captura → ingest → expenses → pull/merge → conciliación → render/widget.
Entregar matriz de cada capa (clave, campos disponibles, descarta/fusiona/borra, reversibilidad,
test existente), reproducción aislada y propuesta del primer cambio acotado. Informar rama/PR
y archivos en curso; coordinar la incorporación de estas incidencias al plan y la microtarea DOC-01.

**Claude:** emitir diagnóstico independiente primero; aportar historia y riesgos del arreglo
de Wallet/TR, refutar o confirmar los casos anteriores con pruebas, y revisar el contrato propuesto.
Publicar veredicto y escenarios bloqueantes antes de leer la conclusión de Cursor; después contrastar.

**Archivos esperados de lectura:** `00-core.js`, `08-motor-bank.js`, `11-app-main.js`, carga/migración
en `01-i18n.js`, `supabase/functions/ingest/index.ts`, helpers de presupuesto e ingest, esquema de
expenses y listeners Android. Esto no reserva esos archivos para edición. Cada informe se escribe
solo en el buzón de su autor.

**Done del diagnóstico:** explicar por qué tres operaciones distintas pueden convertirse en una;
localizar cada punto de pérdida y separar ausencia visual de borrado persistente; definir identidad
con y sin ID fiable, compatibilidad y recuperación; proponer el menor PR coherente con aceptación
y pruebas. Codex consolida y presenta el plan financiero concreto al dueño para aprobarlo.

## Contraste recibido y decisión de Codex

Cursor y Claude personal han entregado sus diagnósticos el 2026-09-06. Ambos reproducen la pérdida
en merge/import y el cruce entre bancos. Cursor aporta la matriz de ingest/presupuesto/esquema;
Claude identifica la amplificación de las lápidas por día y después corrige su afirmación inicial
sobre DELETE masivo. Se conservaron tanto el informe como su corrección en el canal.

Comprobaciones adicionales de Codex contra el código:

- `deleteExpense` compara el instante completo. El índice UNIQUE vigente en el esquema del repo
  impide varias filas con esos mismos atributos para un usuario. **No está probado que un DELETE
  borre varias filas equivalentes**; la afirmación inicial de Claude queda retirada.
- La lápida usa día/importe/comercio: puede ocultar varios movimientos de horas distintas aunque
  permanezcan en el servidor. Ocultación persistente no equivale a destrucción irrecuperable.
- OB genera la fecha a las 12:00 locales; dos operaciones iguales de ese día colisionan también
  en el índice. `cloud.addExpense` no envía `id` ni `extId` y hace `ignoreDuplicates:true` sobre
  esa clave. Una mejora de merge/import por sí sola no preserva ambas operaciones en la nube.
- Añadir solo banco al índice no distingue operaciones del MISMO banco. Inventar horas diferentes
  para sortearlo falsificaría el dato. La revisión de identidad debe distinguir ID de fila, ID de
  evento e ID bancario, y persistir lo que luego utiliza para reconciliar.
- La colisión del esquema se deriva del SQL y de la escritura actual; no se ha consultado ni
  mutado la base real para probar qué migraciones hay desplegadas. Puede probarse en PostgreSQL
  aislado con datos ficticios; no hace falta usar una cartera real para validar el diseño.

**No se aprueba 1d-FIX-A de Cursor como entrega aislada.** Se ha encargado a Cursor un plan acotado
de contención de borrados por similitud y lápidas amplias, con revisión independiente de Claude.
Debe explicar cómo conserva los movimientos sin inflar el presupuesto con gemelos Wallet/TR.
El siguiente bloque será identidad de extremo a extremo (cliente, esquema, ingest, widget, legado).
La recuperación histórica mantiene ticket propio. La ambigüedad de OB sin identificador fiable
requiere tratar multiplicidad, paginación y respuestas parciales; un ordinal aislado tampoco es
prueba suficiente de identidad.

El 2026-09-06 Juanjo autorizó ejecutar el backlog por tandas y publicar cada tarea terminada en
beta para su prueba. Producción permanece bloqueada hasta su aprobación expresa posterior. Se
autoriza primero B03, en rama/PR propio, y después la contención 1d, en otra rama/PR. El contrato
de identidad, su migración y la recuperación histórica requieren todavía sus tickets concretos,
doble revisión y pruebas antes de ejecutarse; esta autorización no permite mezclar esos alcances.

**Validación documental de esta rama:** `guard-privacy` y `docs-frescura` pasan. `memoria-espejo`
falla por diferencias con la memoria local actual de Claude, incluida su nueva nota del canal.
No se ejecuta el espejo ni se incorporan decenas de documentos ajenos en esta tarea. Cursor/Claude
deben coordinar ese saneado por separado. La selección documental omite build, Deno y e2e; no se
presenta como una suite completa verde. El guard de privacidad automático revisa el artefacto de
la app; estos dos briefs se revisan adicionalmente a mano para excluir evidencia privada.
