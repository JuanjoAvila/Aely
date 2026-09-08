# Relevo para Claude y Cursor — 8 de septiembre de 2026

**Lectura de entrada para esta tanda.** Encargo del dueño: Claude dirige y revisa; Cursor
implementa y prueba. Codex queda para arquitectura y bloqueos puntuales, sin watcher diario.
Este relevo documenta una auditoría y una decisión de arquitectura; **no implementa ni despliega
la nueva identidad de gastos**. No hace falta esperar a Codex para ejecutar el plan acordado.
El antiguo heartbeat `coordinar-mi-cartera-con-cursor-y-claude` quedó **PAUSED**, verificado en
la configuración local; no reactivarlo para coordinación rutinaria.

## Foto contrastada

- Base auditada: `c37be5ee8e0643da44743f890ccc95efe6ff4ee3`, igual a `origin/beta` tras fetch.
- Pages responde **4.18.7**; manifiesto beta **4.19.5.1**; APK anunciada **4.18.3 / 42**, asset HTTP 200.
- [Run beta 34157409335](https://github.com/JuanjoAvila/Mi-Cartera/actions/runs/34157409335):
  terminado y verde para ese SHA. El run anterior falló; no usarlo como estado actual.
- Consulta de veredictos de las últimas 24 horas: siete eventos del 8/9, entre 12:12 y 12:30
  Europe/Madrid. Sugerencias consultadas: la más reciente es del 26/7; no apareció una nueva.
- El árbol arrancó limpio, en HEAD separado sobre ese SHA. El relevo se guarda en
  `codex/relevo-arquitectura-2026-09-08`; volver a comprobar rama y árbol antes de trabajar.

Esta foto caduca. Al retomar: `git fetch origin`, `npm run salud`,
`node scripts/errores.mjs --kind=beta --since=24h --limit=30` y comprobar el último run.
El texto genérico de `salud` «pendiente de su veredicto» NO interpreta aprobaciones por tanda.
No copiar a documentación pública el JSON crudo de eventos: contiene identidades personales.

## Veredictos que sí existen

Todos corresponden a **4.19.5.1 / APK 42**. Una aprobación parcial no autoriza promocionar la ronda.

| Tanda | Último resultado consultado | Acción |
|---|---|---|
| `4.19.0/posible-repetido` | Aprobada, 3/3 | Conservar el comportamiento aprobado; la prueba NO valida reinstalación/nube. Ver bloqueo de identidad. |
| `4.19.0/multicuenta` | Aprobada, 1/1 | No reabrir la UI; falta proteger identidad por cuenta en la siguiente arquitectura. |
| `4.19.3/panel-ronda` | Aprobada, 2/2 | Mantener. |
| `4.19.4/arranque-suelto` | Aprobada, 2/2 | Mantener. |
| `4.19.5/notas-20` | Aprobada, 1/1 | Mantener tope de notas y presupuesto de tamaño. |
| `4.19.0/tr-reactivo` | Rechazada, 1 OK / 1 fallo | Ya aparece conectado; falta aviso claro de conexión conseguida. |
| `4.19.1/avisos-presupuesto` | Rechazada, 0 OK / 1 fallo / 1 no probable | Quitar TR no cambió gastos/filtros; el objetivo del guion no se entendió. |

Sin evento en esta consulta: `4.19.0/categoria-ia`, `4.19.0/orden-gastos`,
`4.19.1/id-fila`, `4.19.2/ventana-mes`. No afirmar que están aprobadas ni rechazadas.

## Reparto y orden de ejecución

**1. Claude: cerrar el alcance de los dos rechazos; Cursor: correcciones pequeñas + DOM real.**

- **TR:** revisar `markTrConnected` en `11-app-main.js` y el consumidor `mc-tr-status` en
  `10-app-components.js`. El feedback confirma que el estado pasa a conectado: no diagnosticar
  como caída de sesión ni rehacer autenticación. Avisar una vez al completar la acción manual;
  no en cada consulta de estado ni ante un error. E2E con puente simulado: éxito, fallo y repetición
  del evento; texto en es/en/ca. Claude contrasta el diff final y que no introduce sync OB automático.
- **Presupuesto:** `expenseBankEnts` (`01-i18n.js`) une los extras con el banco del rol diario.
  `BankPanel.toggleEnt` (`10-app-components.js`) cambia solo `settings.expenseBanks` y tampoco
  quita el último. Desmarcar el banco principal puede no tener efecto por contrato actual.
  Reproducido en lógica pura, pero **no demostrado que ese fuera el estado del móvil del dueño**.
  Desconectar un enlace bancario tampoco debe borrar movimientos históricos.
  Primera propuesta: hacer explícita en la UI la cuenta principal obligatoria y probar añadir/quitar
  un banco EXTRA; no cambiar silenciosamente la definición financiera para hacer pasar el guion.
  Si se quiere permitir excluir la principal, eso es otro cambio funcional que debe acordarse.
- El guion de presupuesto debe separar tres cosas: histórico conservado, bancos que cuentan para
  presupuesto, y filtro visual. Fixture aislada: principal A, extra B con gasto de 20 y presupuesto
  100; A aporta 40. Activar B produce 40→60 y cruza 50; desactivar vuelve a 40 sin borrar filas.
  Hacer variantes 70→90, 90→97 y 97→102 para los otros umbrales, verificando aviso una vez.
  Abrir la pantalla y esperar a que desaparezca `#mc-load` antes de manipular el reloj. No repetir
  el atasco de congelar temporizadores durante el arranque. Registrar el E2E en `E2E_MAP`.
  El guardián `budget-notis-deps` solo lee fuente: no sustituye esta prueba.

**2. Identidad financiera: Claude prepara backend/contrato; Cursor cliente y pruebas; revisión mutua.**

Decisión y secuencia concreta: [Identidad de gastos](arquitectura-identidad-gastos.md).
El bloqueo es de toda la cadena, no un SQL suelto. Antes de publicar cualquier corrección de esta
zona deben pasar los casos de dos filas distintas, reintento, borrado y vuelta de nube.
Preparar migraciones en desarrollo; **no aplicar a Supabase real** sin aprobación de producción.
Un cambio de Edge Function afecta al Supabase compartido, aunque la web esté en beta.

**3. Después:** cerrar las cuatro tandas sin veredicto con guiones concretos. IA únicamente para
movimientos nuevos; NO recategorizar el histórico de Ocio. B09-C/safeLiq del widget requiere APK;
llevarlo aparte y no presentarlo como arreglo que viaja por OTA.

## Riesgos de coordinación que siguen abiertos

- PR #26 (`codex/canal-equipo` → beta) contiene los antiguos documentos de canal/reanudación;
  NO están en esta base. No gastar tiempo buscándolos en la raíz ni mezclar ciegamente la PR:
  sus roles/estado preceden al relevo a Claude. Este documento es la entrada actual.
- PR #24 (`cursor/tandas-huecos-conocidos-cbf2` → main), documental, sigue abierta. Claude debe
  contrastar vigencia/rebase antes de incorporarla. No borrar ramas/worktrees sin preguntar.
- `test.yml` todavía filtra PRs a `main`; una PR contra `beta` no tiene ese check automático.
  Cursor puede preparar un ajuste de CI aparte; hasta entonces revisión y pruebas ANTES del merge,
  y run de publicación DESPUÉS. No confundir ausencia de checks con aprobación.
- Evitar que dos agentes cambien la rama del mismo checkout. Usar worktrees separados o un único
  escritor con reserva de ficheros; un solo integrador (Claude) hace versión y publicación.
- Cero acuses/latidos narrados. Entrega = SHA, ficheros, comandos/resultados, límite pendiente.
  Para escalar a Codex: una pregunta acotada, reproducción, intentos de ambos y referencias al diff.

## Evidencia y límites de esta revisión

Ejecutados con éxito: build, sintaxis, `expense-id-cloud`, `ob-ingresos`, `ob-renombrar`,
`budget-notis-deps`. Tras build se reprodujeron los fallos de identidad con datos sintéticos
(guion en la decisión de arquitectura). Los tests existentes pasan y NO cubren esos casos.
No se ha ejecutado aquí una migración SQL, Deno ni una nueva prueba en móvil/navegador: esta entrega
solo modifica documentación. El run verde acredita la base, no la futura solución.
La consulta JSON de eventos imprimió los siete eventos completos y luego Node falló con
`UV_HANDLE_CLOSING` al cerrar; la consulta normal corroboró los resultados. No es un error de la app.

Para entregar una beta al dueño: versión exacta, pasos, resultado esperado, límites y OTA/APK.
La ronda completa sigue sin autorización de producción; no promover tandas sueltas con cherry-picks.
