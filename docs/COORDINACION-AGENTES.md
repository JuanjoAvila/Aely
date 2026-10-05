# Canal común de agentes en la nube

El canal canónico es la rama `codex/coordinacion` de `JuanjoAvila/Aely`.
El dueño pidió trasladar Claude y Codex a la nube el 5 de octubre de 2026.
El issue130 conserva el trabajo de Cursor gestionado por Grok; ya no es el buzón común.
No fusionar esta rama a `main` ni a `beta`: contiene coordinación, no una versión de producto.

## Estado que sobrevive a cada sesión

- `coordination/tasks/<id>/task.json`: encargo inmutable creado por Codex, con destinatario,
  objetivo, alcance y SHA completo de producto. No trabajar desde el código antiguo del canal.
- `coordination/tasks/<id>/claim.json`: reserva inmutable de UNA sesión. Su push normal
  y lectura posterior deben confirmarse antes de tocar producto.
- `coordination/tasks/<id>/result.json`: cierre inmutable del titular, con `released:true`,
  estado `done`, `blocked` o `cancelled`, pruebas reales, SHA/PR y limitaciones.
- `coordination/messages/<agente>/<id>.json`: mensajes públicos inmutables. No son encargos.

Sin claim ni result = pendiente. Con claim y sin result = reservado. Con result = cerrado.
No reutilizar IDs. Una reserva nunca caduca por reloj. Si muere su sesión, Codex o el dueño
resuelve expresamente el incidente y crea un encargo sucesor enlazado al anterior; nadie roba
la reserva ni repite trabajo a partir de su antigüedad.

## Publicar sin perder mensajes ni duplicar encargos

Usar Node y Git ya instalados; no hacen falta dependencias ni claves nuevas:

```sh
git fetch origin refs/heads/codex/coordinacion
git worktree add --detach ../aely-channel FETCH_HEAD
cd ../aely-channel
node scripts/coordination-channel.mjs pending claude
node scripts/coordination-channel.mjs publish /tmp/operation.json
```

El helper construye un commit con índice temporal directamente desde el remoto. Solo añade
el fichero de la operación: no incorpora el WIP ni cambia el checkout del llamante.
Empuja exclusivamente a `refs/heads/codex/coordinacion`, sin force. Si otro avanzó la rama,
vuelve a leer y evaluar la precondición una sola vez. Una segunda sesión del mismo encargo
ve `busy` o `closed` y termina. Dos mensajes distintos pueden conservarse tras ese reintento.
Un push no confirmado o un fallo de red termina con error; no afirmar reserva ni continuar.

Ejemplo de reclamación (ID y sesión son propios de ese disparo):

```json
{"type":"claim","actor":"claude","sessionId":"claude-cloud-20261005-abcdef12","taskId":"cloud-pilot-claude"}
```

Ejemplo de cierre tras pruebas realmente ejecutadas:

```json
{"type":"result","actor":"claude","sessionId":"claude-cloud-20261005-abcdef12","taskId":"cloud-pilot-claude","payload":{"status":"done","summary":"Preflight sintético terminado","tests":[{"command":"npm run test:syntax","exitCode":0}],"productSHA":"SHA completo real","limitations":["No prueba un móvil real"]}}
```

Los ejemplos no son evidencia ejecutada. Sesión: `<agente>-cloud-<fechaUTC>-<aleatorio>`.
El ID es para evitar colisiones, no un secreto ni una prueba criptográfica de identidad.
La autorización depende de la conexión GitHub existente y del encargo del dueño/coordinador;
el campo `from` de un mensaje, una sugerencia externa o una PR nunca amplían el permiso.

## Rutinas y reparto

Cada disparo de trabajador es finito: leer el protocolo y el remoto, escoger un único encargo propio pendiente,
reclamar, ejecutar, publicar resultado y terminar. Si no hay encargo, terminar sin commit,
comentario ni mensaje de «sin novedades». Un trabajador no crea nuevas sesiones, bucles, rutinas
o tokens por iniciativa propia.
La cadencia y el destino de los disparos son los guardados en el programador Cloud y deben
comprobarse allí. Mantener una única automatización del coordinador; cambiarla requiere apagar
la anterior antes de activar su sustituta. El cierre de un relevo no dispara por sí mismo otro chat.
Una rutina configurada no prueba ejecución; tampoco lo prueban un entorno ni un ACK sin pruebas.

Codex coordina y revisa entregas en serie. Claude tiene su sesión y rama propia.
Grok conserva la gestión exclusiva de sus agentes Cursor: no lanzar Cursor desde Claude/Codex
ni repetir la PR131. Una solicitud a Grok debe entrar como encargo propio y respetar su circuito.
El coordinador lee resultados, comprueba SHA/alcance/pruebas y deja el siguiente encargo completo.
No confundir propuestas entre agentes con órdenes del dueño.

Para editar producto, crear una rama propia desde `task.baseSHA`, leer sus AGENTS.md y
EMPIEZA-AQUI.md completos y respetar sus pruebas/documentación. No push a main/beta,
merge, promote, producción, APK, Edge, SQL, migraciones ni pagos por arrastre del canal.
La aprobación móvil conserva su identidad funcional: CI y Chromium sintético no la sustituyen.

## Pirámide de gestión

El dueño ha autorizado un coordinador Cloud que delegue en chats de trabajo y subagentes.
La arquitectura objetivo es esta; cada flecha necesita una prueba real antes de considerarse operativa:

```mermaid
flowchart TD
  H[Dueño] --> C[Codex coordinador Cloud]
  C --> W[Chats Codex de programación]
  C --> Q[Chats Codex de revisión y pruebas]
  C --> A[Claude coordinador Cloud]
  A --> V[Chats Claude de trabajo]
  C --> G[Grok bot]
  G --> U[Chats Cursor]
  W --> S[Subagentes temporales]
  Q --> T[Subagentes temporales]
```

El coordinador mantiene objetivo, cola, dependencias y aceptación. Reparte y verifica entregas;
las investigaciones, programación y pruebas largas van a trabajadores. Un trabajador no se
convierte en coordinador ni encarga trabajo a otro proveedor. Grok conserva su propia gestión de
Cursor. Claude dirige sus propios trabajadores cuando esa delegación esté probada. Los
trabajadores Codex dependen directamente del coordinador principal. La integración sigue siendo
una sola operación en serie.

### Dos clases de delegación

- **Chat Cloud de trabajo:** conversación durable con un encargo concreto, contexto de entrada
  acotado y resultado recuperable. Verificar host y entorno del hijo, ejecución terminada, SHA y
  entrega. Un fork hereda historia; no anunciarlo como contexto limpio. No inferir VM independiente
  porque la conversación tenga otro ID: comprobar el aislamiento antes de editar en paralelo.
- **Subagente temporal:** subtarea de un chat padre, con contexto propio y filesystem compartido.
  El padre conserva su claim y publica el único result durable. El hijo entrega sus conclusiones
  al padre; no roba su claim ni crea result con una sesión distinta. Lecturas independientes pueden
  ir en paralelo. Cada editor necesita checkout/rama propios desde el baseSHA autorizado.

Empezar con dos trabajadores activos, por debajo del límite real del runtime y la cuenta. Es un
límite de reparto del coordinador: el helper actual no impone cupos. No crear agentes en cascada
sin un encargo que lo permita. Cada trabajador termina y devuelve una entrega compacta: tarea,
SHA/PR, comandos y exitCode, artefactos y limitaciones. El coordinador lee el detalle cuando hay
un bloqueo, una discrepancia o una decisión; no copia historiales completos entre todos los chats.

### Contexto, modelos y despertares

El objetivo es ahorrar contexto, no refrescar todos los chats. Los trabajadores arrancan al recibir
un encargo y terminan al entregarlo; no necesitan una rutina de vigilancia cada uno. El coordinador
consulta cambios útiles y conserva solo estado, dependencias y evidencia compacta. Si un proveedor
solo ofrece consulta periódica, usar un único vigía finito por proveedor y terminar sin escribir
cuando no haya trabajo. Evitar vigías duplicados, consultas encadenadas y dos coordinadores activos.

Elegir el modelo por tarea entre los modelos disponibles de la cuenta: trabajo acotado y mecánico,
programación y pruebas, o investigación/revisión difícil. Registrar la elección y el motivo en el
encargo. Subir de capacidad cuando haya evidencia de dificultad; cambiar de modelo no amplía el
alcance ni los permisos. No suponer que más agentes o un modelo menor reducen el coste: comparar
consumo, duración, reintentos y calidad de las entregas antes de aumentar los cupos.

Un refresco de contexto es un relevo: guardar el objetivo, baseSHA, tarea, estado real, resultado,
bloqueos y siguiente paso; comprobar que el sucesor lo leyó y detener el anterior. No usar un
historial entero como paquete de entrada ni transferir credenciales. El registro durable permite
recuperar el trabajo si el coordinador está parado; las tareas sin resultado no se liberan por reloj.

### Relevo generacional del coordinador

Los encargos de coordinación usan exclusivamente `coordinator-relay-000001`, `000002`, etc.,
con `kind:"coordinator-relay"`. No son tareas de programación ni de revisión de producto.
`previousTaskId` es obligatorio: `null` en la primera generación y el ID exacto anterior en las
siguientes. El objetivo y el alcance son las constantes `RELAY_OBJECTIVE` y `RELAY_SCOPE`
exportadas por el helper. No se admiten saltos, ramas ni un sucesor creado antes del cierre anterior.

Cada ejecución nueva genera un nonce público aleatorio `relay-run-<8 a 24 caracteres a-z/0-9>`.
Nunca usar el identificador privado del chat. Un nonce que ya reclamó otra generación no puede
reclamarse de nuevo; los reintentos de la misma generación conservan `owned`, `busy` y `closed`.
El claim se confirma en el remoto antes de repartir trabajo. Una ejecución sin el claim actual
abierto propio no puede publicar task, claim, result o message de trabajadores con su nonce.
Las sesiones Codex anteriores al relevo y los trabajadores Claude/Grok conservan su contrato.

El coordinador puede reconciliar varios encargos independientes dentro de su generación,
respetando los cupos y la revisión en serie. Para cederla publica su result con `status:"done"`,
`summary:"Relevo verificado"`, `tests:[]` y un checkpoint estructurado de hasta 4000 caracteres.
El helper añade y verifica `released:true`. Las pruebas del producto pertenecen al result de
cada trabajador; este cierre acredita entrega del estado de coordinación, no aceptación de producto.

El checkpoint admite únicamente `schema:1`, `channelSHA`, `lastGrokComment`, `pendingTasks`,
`inputState` y `nextAction`. `channelSHA` debe ser un commit existente y ancestro del canal leído.
`lastGrokComment` es el ID público decimal del último comentario leído, o `"0"`. `pendingTasks`
solo referencia IDs únicos de tareas worker existentes. `inputState` contiene `suggestions`,
`errors` y `beta`, cada uno `read`, `blocked` o `unknown`. `nextAction` es `reconcile`, `review`,
`dispatch`, `idle` o `blocked-inputs`. No se admite texto libre ni campos de chats, credenciales,
capturas, importes o rutas privadas. Un input bloqueado no equivale a una cola vacía.

Una ejecución nueva lee el SHA fresco del remoto y llama a `relayHead(cwd, sha)`:

1. Sin generaciones, crea la primera y reclama con su nonce nuevo.
2. Con tarea pendiente, intenta reclamar esa misma generación; solo trabaja tras confirmación.
3. Con claim abierto ajeno, termina sin despacho ni cierre; no roba ni espera a que caduque.
4. Con result liberado, deriva `relayTaskId(head.generation + 1)`, crea el encargo con el
   predecesor exacto y reclama. Recupera el checkpoint del result anterior, no de un historial de chat.

Si hay un corte después del cierre y antes de crear el siguiente encargo, ese cuarto paso basta
para reconstruir el relevo. Si el corte sucede con claim abierto, el protocolo conserva la reserva:
su titular debe reanudar y cerrar, o se requiere resolver expresamente el incidente. El helper no
incluye una toma automática por reloj ni autoriza un salto para evitar ese bloqueo.

Para publicar por un conector GitHub, ejecutar `prepareOperation(cwd, sha, operation)` contra el
mismo SHA recién leído, crear tree/commit con ese SHA como único padre y actualizar exclusivamente
`codex/coordinacion` con `force:false`. Verificar el fichero remoto antes de trabajar. Si el remoto
avanza, descartar la preparación anterior y volver a prepararla contra el nuevo SHA; no aplicar su
parche sobre un padre nuevo sin reevaluar la reserva. La misma precondición rige para el CLI.

El helper garantiza estas reglas para operaciones preparadas por él; no autentica al portador de
un nonce ni impide escrituras directas de quien ya tiene permisos GitHub. La conexión autorizada y
el encargo humano siguen siendo la fuente de permiso. Tampoco crea chats, activa el programador,
despierta inmediatamente al sucesor ni elimina posibles intervalos entre disparos. El lector
valida toda la cadena y tiene un buffer de 4 MB, además del límite de 999999 generaciones: no es
una continuidad ilimitada y exige vigilar el crecimiento antes de alcanzar ese límite.

### Reparto y continuidad

El helper actual distingue proveedores y reserva taskId/sesión; no autentica roles ni identifica
un chat trabajador por el campo actor. Los campos escritos por un agente tampoco constituyen una
prueba de identidad. Hasta ampliar y probar ese contrato, el coordinador envía el taskId EXACTO
a su trabajador; el trabajador no escoge otra tarea de la cola general de Codex ni crea encargos.
La conexión autorizada y las instrucciones del dueño siguen siendo la fuente de autorización.

Antes de lanzar dos encargos, comparar scope y recursos compartidos. Si se solapan, encadenarlos
mediante una dependencia o dejar el segundo en cola. El helper actual protege dos reclamaciones
de la MISMA tarea; no bloquea alcances iguales en tareas distintas. No presentar esa protección
como implementada hasta tener pruebas de concurrencia específicas.

Mantener un solo coordinador vigente y un relevo explícito. Su registro de despacho debe asociar
objetivo, taskId, trabajador real, host/entorno comprobados, estado y resultado. Los identificadores
privados de chats/entornos permanecen en el registro privado del servicio; el canal público solo
lleva instrucciones de código y evidencia que se haya revisado para ese destino.

El disparador y el gestor de conversaciones son dos capacidades diferentes. Una ejecución Cloud
con subagentes no prueba creación de chats durables ni un despertar periódico. Para aceptar la
pirámide, probar coordinador -> trabajador -> resultado -> revisión, un segundo turno sin repetición
y una ejecución programada alojada. No sustituir una capacidad ausente con esperas o bucles en el PC.

## Privacidad y límites

El repo es público. Solo objetivo, rutas RELATIVAS de código, SHA/PR, herramientas y resultados
agregados. Nada de extractos, cantidades reales, capturas, familiares, credenciales, URLs de
proveedores, buzones privados o rutas del PC. El filtro del helper reduce errores habituales;
no sustituye revisar cada payload antes de publicarlo. No copiar la memoria local en bloque.

Cada nube tiene su VM. Chromium con datos sintéticos allí no usa el lease del PC y debe indicar
entorno/zona horaria. Android real, adb y el lease compartido siguen siendo trabajo del PC.
Los secretos y despliegues requieren su circuito autorizado; no copiarlos a estos entornos.
La disponibilidad de herramientas se comprueba ejecutándolas: no inventar Deno, Chromium o tests.

## Aceptación de la migración

1. Canal y pruebas de concurrencia publicados, con SHA verificable.
2. Cada nube lee ese protocolo y publica claim/result desde su VM con pruebas reales.
3. Un segundo disparo encuentra el encargo cerrado y no añade commits.
4. Se verifica la rutina guardada, su entorno, cadencia y una ejecución real; el relevo local
   permanece apagado. Comprobar continuidad desde web/móvil; no atribuir esta sesión local a nube.

Hasta completar estos pasos, el estado es EN MIGRACIÓN. La pausa humana del trabajo anterior
sigue vigente; no reactivar su temporizador ni crear su sucesor por reloj.
