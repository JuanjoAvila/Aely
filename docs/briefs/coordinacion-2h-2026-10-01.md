# Coordinación Aely en tramos de dos horas

Petición humana de 1/10/2026: conservar la coordinación y el objetivo, trabajar dos horas por chat y abrir un único sucesor de otras dos horas, sucesivamente. Cada sucesor recibe este relevo actualizado, sin copiar el historial entero. Esta petición sustituye la duración anterior. Se continúa hasta que el usuario lo detenga; el tiempo nunca constituye aprobación de producto.

Prioridad inmediata nueva: corregir que las tandas aprobadas vuelven a aparecer pendientes al implementar otra entrega. El propietario del panel ya recibió el encargo completo: reproducir sobre beta80.1, corregir, registrar tests y preparar PR. Criterio DOM: aprobar A, añadir B sin cambiar A, actualizar/reiniciar y comprobar A aprobada/plegada y solo B pendiente. Conservar rechazo/revocación posterior y reabrir exclusivamente la tanda cuyo alcance funcional o guion haya cambiado realmente. Auditar scopes, digests, recibo, identidad, bootstrap y migración con datos sintéticos; no borrar veredictos ni fabricar aprobaciones. No repetir todas las validaciones por un cambio ajeno, versión o sello global.

## Estado recibido

Implementación, revisión y entrega técnica cerradas para Panel76, UI77, Nómina78, Retirada79 y Widget80/APK52. Registro completo: [coordinacion-entregas-2026-10-01.md](coordinacion-entregas-2026-10-01.md), rama `codex/coordinacion-entregas-0110`, cierre `d0787970`.

- Beta actual 4.26.80.1: fuente `22396f9a0951c0f5a61eb8d59d7e65bb0385edf3`; merge exclusivo beta `955765a9ec0ad96d20140a8f12da00c9fa04985c`, árboles iguales. PR101 integrada; CI36840523060 SUCCESS (639 DOM, 7 rendimiento, una captura opcional omitida), publicación36843848043 SUCCESS.
- Manifiesto, ZIP, HTML, SW, recibo, notas y apk.json dentro/fuera cotejados. Huella `50b3327daf00a8d0`; ZIP SHA256 `fdfe03827279cfd7c0ce3c551e2c31bcbe07e33e13fb70e59c4caafe993c51b9`.
- APK beta52/4.26.80 real: asset602882554, SHA256 `4abfa5b19d8d46bc10239162c20f8a5aa74020d343607fff421ccf61d9ade4d3`, firma CN=Mi Cartera, depuración desactivada. El manifiesto beta apunta a binario beta: excluirlo o sustituirlo en cualquier futura promoción estable expresamente aprobada.
- Main/Pages permanecen 4.26.67, main `12884f48107b82ffc8592c51180f2074a8546139`, APK estable48/4.26.32. Ninguna instalación ni despliegue Edge/SQL.
- Siguen abiertas las comprobaciones móviles de panel/teclado/gestos, nómina/PDNG real, Retirada/PostgREST/dos dispositivos y FIN05/pago/reentrada. CI y entrega técnica no las cierran. Widget52 cubre Inicio/presupuesto; Balance/modos Gastos/backend v2 son otro alcance.

## Operación y rotación

Un solo coordinador serializa versiones, revisiones por SHA, merges, publicaciones y Chromium. Claude sigue como único colaborador externo; reutilizar chats existentes y worktrees aislados, respetando cambios locales. No borrar ramas/worktrees sin autorización. Leer AGENTS, EMPIEZA-AQUI y PROMPT-FLUJO-CONTINUO. Mantener privacidad, guiones separados y evidencia realmente servida. Promover solo tandas expresamente aprobadas y separables; nunca beta completa por inercia ni APK/Edge/SQL implícitos.

Al empezar cada chat: crear su objetivo de coordinación de dos horas, leer reloj UTC y guardar inicio/plazo exactos. Mantener un único aviso heartbeat para ese coordinador. Si acaba una tarea antes, seguir coordinando trabajo útil dentro del mismo tramo; no abrir otro coordinador antes del plazo. Al cumplir dos horas: detener nuevos encargos, dejar operaciones en un punto seguro, actualizar este relevo con hechos/pending/lease/heartbeat, comprobar que no existe ya sucesor, abrir exactamente uno con el mismo objetivo y plazo nuevo calculado desde su comienzo, transferir el control y el aviso, comprobar arranque y cerrar el objetivo de este tramo. No heredar un plazo vencido. Si recibe una parada humana, cesar la cadena. Un retraso de herramienta exige cerrar con seguridad, no cortar una publicación a medias.

Los encargos concretos y revisiones continúan en sus chats aunque cambie el coordinador. El relevo incluye referencias mínimas a fuentes y verificaciones; no reproduce logs completos ni contexto acumulado. El aviso no debe duplicar un sucesor ya creado ni reactivar un coordinador retirado.
