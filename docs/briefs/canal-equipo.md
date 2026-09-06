# Canal de coordinación del equipo

Acuerdo solicitado por el dueño el 2026-09-06. Este documento define el transporte de encargos;
el estado de producto sigue en `plan-vuelta-crucero.md` y cada incidencia tiene su brief.

## Roles y límites

- Codex recibe las peticiones del dueño, prioriza, diagnostica, dirige arquitectura y decide
  técnicamente si un cambio puede pasar a beta. Resume las respuestas del equipo al dueño.
- Cursor implementa e integra una tarea acotada por rama y PR, desde una revisión acordada de
  `refs/remotes/origin/beta`. No cambia de rama en un checkout que otro agente esté usando.
- Claude personal aporta historia y revisión independiente. Cursor no lanza otro Claude a su
  cargo. Una revisión debe identificar commit, casos límite, pruebas y veredicto.
- El dueño aprueba cambios de alcance y de alto riesgo, prueba la beta y decide producción.
  Sin trabajo ni merge directo a main; sin despliegues autónomos. Esta instrucción actual
  prevalece sobre las excepciones antiguas de los documentos del repo.
- Migraciones, sincronización bancaria, autenticación, permisos y despliegues requieren plan,
  pruebas y aprobación humana explícita. Una orden de diagnóstico NO autoriza implementación.

## Buzón compartido

En el checkout principal se usa `.claude/canal-equipo/`, una carpeta ya excluida por `.gitignore`.
La ubicación bajo `.claude` reutiliza la exclusión existente: el buzón pertenece a los tres agentes.
Cada agente resuelve una vez la ruta ABSOLUTA del checkout principal, incluso si trabaja desde
otro worktree. No crea una copia de su buzón en cada rama.

```text
.claude/canal-equipo/
  LEEME.md                  # instrucciones locales y ubicación del protocolo
  messages/
    codex/                  # solo escribe Codex
    cursor/                 # solo escribe Cursor
    claude/                 # solo escribe Claude personal
  state/
    codex.json              # solo escribe Codex
    cursor.json             # solo escribe Cursor
    claude.json             # solo escribe Claude
```

Los mensajes son JSON UTF-8, inmutables, un archivo por mensaje con ID único y autor.
Se publican mediante archivo temporal y renombrado al terminar; los lectores ignoran temporales.
Nunca se sobreescribe una respuesta ajena. Campos obligatorios:

```json
{
  "id": "20260906T120000Z-cursor-ejemplo",
  "from": "cursor",
  "to": ["codex"],
  "kind": "ack",
  "task": "CONEXION",
  "replyTo": "id-del-encargo",
  "createdAt": "2026-09-06T12:00:00Z",
  "authorization": "diagnosis-only",
  "body": "Ejemplo ficticio. Indicar capacidad real, rama, commit y archivos reservados."
}
```

Tipos: `task`, `ack`, `result`, `question`, `decision`, `blocked`. El texto describe el trabajo;
no es código que un watcher deba ejecutar. Validar autor/ruta/destinatario e ID antes de actuar.
El buzón es un mecanismo de colaboración local, no una frontera de autenticación.

Cada `state/<actor>.json` guarda `actor`, `lastPollAt`, `processedIds`, `watcher` y `activeTask`.
Anotar un ID como procesado después de publicar el acuse o resultado correspondiente. En un
reinicio, comprobar también las respuestas ya existentes por `replyTo` antes de repetir un trabajo.
Si una lectura falla o falta un archivo, no interpretar ese vacío como cancelación o aprobación.
No borrar mensajes ni reservas automáticamente por tiempo transcurrido.

## Activación y comprobación

1. Cada agente lee AGENTS, EMPIEZA-AQUI, este protocolo y su encargo inicial. Publica un acuse
   real indicando su mecanismo de watcher/loop, periodicidad y límites de sesión.
2. Codex usa una tarea programada de esta conversación para revisar el buzón cada treinta minutos.
   Los otros dos agentes habilitan el mecanismo disponible en SUS sesiones y lo describen;
   si no tienen autoactivación, lo comunican. No basta con escribir «watcher activo» en un archivo.
3. La primera respuesta acredita lectura manual/actual. Para acreditar reactivación, Codex envía
   después un desafío nuevo y espera respuesta de otra vuelta del loop, sin intervención del dueño.
4. Leer solo mensajes nuevos dirigidos al agente. No contestar acuses con otro acuse, ni escribir
   mensajes de «sin novedades». Los acuses no disparan nuevos encargos de investigación.
5. No hacer polling mediante nuevas sesiones de modelo a intervalos de segundos. Registrar el
   último sondeo en el estado propio, sin generar conversación ni notificaciones repetidas.

La programación local requiere equipo encendido y aplicación abierta. No garantiza acceso desde
el móvil ni cuando se cierra la sesión de otro agente. Referencia de la automatización de Codex:
[tareas programadas](https://learn.chatgpt.com/docs/automations?surface=app).

## Encargo, reserva y entrega

- Codex emite un ticket con alcance, autorización, base, archivos esperados, aceptación y pruebas.
- Cursor acusa recibo y propone rama/worktree y lista de archivos. Codex confirma la reserva antes
  de editar. Dos tickets con archivos comunes se serializan. Los diagnósticos de solo lectura
  pueden transcurrir a la vez; cada informe se escribe en el directorio de su autor.
- Cursor entrega commit/PR, diff, comandos y resultados reales, limitaciones y pendientes.
- Claude revisa el commit entregado de manera independiente; Codex resuelve técnicamente los
  desacuerdos con evidencia. Un cambio posterior invalida el visto bueno de lo afectado.
- CI/tests → revisión de Claude + revisión final de Codex → beta autorizada → validación del
  dueño. No automatizar el pase a producción. Referencias Git inequívocas; no borrar el tag beta.
- Decisiones duraderas y cambios de estado se incorporan al repo por PR, ya saneados. El buzón
  conserva el intercambio operativo, no sustituye a la documentación compartida.

## Privacidad y estado inicial

Ni capturas bancarias, nombres reales, saldos, credenciales ni extractos en mensajes o PR públicos.
Los casos de prueba usan identidades e importes ficticios. Evidencias originales permanecen fuera
del repo; los informes distinguen observación, hipótesis y reproducción sintética.

El 2026-09-06 se recibieron acuses e informes de Cursor y Claude personal. Cursor declara un shell
monitorizado en su sesión; Claude declara `/loop`. Ambos requieren sus sesiones abiertas. Codex
envió un desafío posterior: la reactivación autónoma aún necesita esa respuesta. El sondeo de Codex
se redujo de cinco a treinta minutos para moderar el consumo; se pidió el mismo cambio a los otros
dos. Sus acuses iniciales acreditan lectura, no todavía el intervalo nuevo ni servicio permanente.
Encargo financiero vigente: plan de contención derivado de
`incidencias-integridad-2026-09-06.md`, sin modificar la app ni datos remotos.
