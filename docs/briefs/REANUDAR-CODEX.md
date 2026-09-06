# Reanudar la coordinación de Mi Cartera

Punto de control: 2026-09-06, tras publicar 4.18.6.1. Es una foto; verificar Git, PR y canales antes de actuar.

## Entrada y autorización

Leer AGENTS.md, EMPIEZA-AQUI.md, canal-equipo.md e incidencias-integridad-2026-09-06.md.
Codex dirige; Cursor implementa una tarea/rama/PR desde beta; Claude revisa independientemente.
El dueño autorizó ejecutar tickets y publicar beta tras pruebas y doble revisión. Producción requiere
su aprobación posterior. Migraciones, sincronización bancaria, auth, permisos y despliegues de alto
riesgo necesitan plan y aprobación humana. No acceder a carteras reales ni publicar datos privados.

## Foto y siguiente acción

- PR #27: tests de reloj B03, integrado en beta en ae8a1016.
- PR #28: contención de borrados por similitud, integrado en beta en 557601e9. CI 34057158298 verde;
  salud verificó beta 4.18.6.1, Pages 4.18.3 y APK 42/4.18.3. No hubo pase a producción.
- PR #29: Cursor entrega B09-A, cabecera de Gastos que no recalcula al cambiar bancos/cuenta diaria.
  HEAD declarado 45fffa4e, base 557601e9, versión candidata 4.18.7. Pendiente revisión exacta de Claude
  y Codex, pruebas y publicación. No asumir que ya está aprobado. Worktree local cursor-b09-a.
- PR #26: documentación del canal y este punto de reanudación, rama codex/canal-equipo, pendiente.
- PR #24: documentación antigua; coordinar rebase y destino antes de integrar, solapa README/ROADMAP/plan.
- Siguientes diagnósticos: frontera de mes local/UTC; widget con dos escritores y safeLiq incremental;
  identidad de operaciones extremo a extremo y recuperación histórica por separado. No tratar una
  respuesta con un gasto menor como antigua: devoluciones y correcciones pueden reducir el total.

## Buzón y relevo entre conversaciones

En el checkout principal: .claude/canal-equipo/LEEME.md, messages/{codex,cursor,claude} y state/*.json.
Resolver la ruta desde el checkout principal; no crear otro buzón en un worktree. Leer mensajes nuevos
por ID/replyTo; no repetir encargos. Tolerar BOM al leer; escribir UTF-8 sin BOM. Los estados son
declaraciones del agente, no prueba por sí solos de que una sesión siga activa.

Automatización existente: coordinar-mi-cartera-con-cursor-y-claude, cada diez minutos, ligada a la
conversación anterior. Al cambiar de conversación, inspeccionarla y coordinar el traspaso para que
solo UNA conversación dirija el canal. No crear un segundo watcher ni dos coordinadores activos.
No asumir que una conversación nueva hereda el historial completo. Los worktrees y PR conservan el
trabajo, pero hay que contrastar sus cambios y reservas antes de editar. No borrar ramas/worktrees.

## Cada publicación beta debe acompañarse de instrucciones

Petición directa del dueño: antes de pedir veredicto, indicar versión, cambios perceptibles, pasos
concretos para probar, resultado esperado y limitaciones conocidas. Indicar OTA o APK requerida.
No pedir pruebas que borren evidencia financiera ni prometer que un ticket parcial resuelve todo.

Para 4.18.6.1: comprobar versión; observar movimientos que ya estén visibles antes y después de
cerrar/reabrir la app y de una sincronización manual habitual. Avisar de nuevas desapariciones.
No hacer pagos de prueba ni borrar movimientos reales. Pueden quedar duplicados y un total mayor:
se retiró la limpieza por similitud. El import/merge todavía puede omitir operaciones; este ticket
no recupera el histórico ni completa identidad. Un reporte de pérdida sigue siendo un fallo abierto.
