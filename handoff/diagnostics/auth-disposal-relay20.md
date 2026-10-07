# Diagnóstico auth disposal — fuente cacc2a0d

Fuente exacta: `cacc2a0dff55baa3859ddeedcbdcf862925f2fca`. Investigación sintética, sin cuentas, red ni datos reales. No hay cambio de producto, versión o entrega.

Reproducir desde este checkout: `node handoff/diagnostics/auth-disposal-relay20.mjs /tmp/auth-disposal-result.json`. El script extrae con `git show` los métodos reales `enabled/session/onAuth`, el planificador real `mcScheduleIdle` y el efecto completo entre los comentarios de sesión y de push. Ejecuta esos fragmentos en Node VM; no transcribe su lógica. Los hashes de fragmentos y la versión/runtime están en el JSON adjunto.

## Resultado causal

- `onAuth` devuelve `undefined` aunque el transporte devuelve una suscripción cancelable. Cancelar directamente ese handle sintético elimina el callback: control negativo del transporte.
- El efecto `useEffect(...,[])` no devuelve cleanup. Después de seis disposiciones y un montaje activo quedan siete suscripciones, cero unsubscribe. Un login produce seis callbacks y solicitudes de sync desde montajes dispuestos y una desde el montaje activo.
- Resolver `getSession` después de disponer provoca `setSession` y una solicitud de sync idle desde el montaje dispuesto. Resolver antes de disponer y ejecutar el idle después también provoca sync dispuesto.
- `SIGNED_OUT` y `PASSWORD_RECOVERY` después de disponer todavía invocan sus setters. El timer de splash y la rama de rechazo pendiente también sobreviven.
- Control activo sin remount: una suscripción, un sync inicial; `TOKEN_REFRESHED`/`INITIAL_SESSION` del mismo usuario no añaden sync. Login activo, cambio de usuario con `dropTx:true`, signout y nube desactivada conservan sus comportamientos esperados.
- Carrera independiente observada en montaje activo: una respuesta de sesión A pendiente que llega después de login B vuelve a asignar A y solicita otro sync. Un guard de disposición no resuelve esta carrera; no mezclar decisiones de identidad con el arreglo de lifecycle.

Son solicitudes/llamadas observadas a spies. `syncFromCloud` no se ejecuta: **cero escrituras reales**. El setter de estado se aplica solo a una fixture para observar `bankTx:[]`; no acredita persistencia ni daño financiero real. Tampoco mide rendimiento.

## Límite y remedio mínimo propuesto

La fuga depende de disponer/remontar el efecto. La fuente contiene un único montaje de App en `12-boot.js:507`, sin `StrictMode` o key de App, y el efecto tiene dependencias vacías. La navegación interna no acredita un remount: este guion no navega ni demuestra la causa de INC-2709-09/global lag.

Propuesta sin implementar: `cloud.onAuth` devuelve una función de unsubscribe (no-op si no hay cliente); el efecto conserva ese disposer, un booleano local de actividad y el timer. Cleanup desactiva primero, cancela timer y libera suscripción. Guardar ambos brazos de la Promise, el callback auth y el callback idle con ese booleano. El timer debe usar callback guardado también. No hace falta cambiar el planificador global: no devuelve handle, pero el idle local puede quedar inerte. Esto evita iniciar trabajo nuevo desde ese montaje dispuesto; no aborta pulls iniciados mientras estaba activo ni cambia cómo se decide la sesión vigente.

Impacto propuesto: exclusivamente `00-core.js:onAuth` y bloque mount de `11-app-main.js`; no tocar dinero, `syncFromCloud`, native101, bancos/cupo, Edge/SQL, APK, VERSION o beta. Solo existe un caller de onAuth. La comparación de códigos exactos de revisión debe calcularse antes de cualquier futura implementación; no heredar aprobación por esta diagnosis. Para eventual fix, incorporar guardián con runner/map y controles de login/switch/signout/recuperación activos, callback retenido tras unsubscribe, sesión tardía e idle tardío.

Revisión independiente virtual de selectores: una inserción de return en onAuth y una hipótesis de cleanup unsubscribe en App cambian **0/31 códigos** existentes. Los selectores actuales no cubren onAuth/este efecto: este resultado señala un hueco de cobertura de alcance, no inocuidad del cambio ni aprobación. Una futura candidata necesita alcance propio y auditoría de dependencias; no repinar otros códigos automáticamente. La comparación virtual no representa el remedio completo con todos los guards.

Este directorio es un checkpoint diagnóstico explícito de handoff, no un test permanente desconectado del runner ni una sonda de producto.
