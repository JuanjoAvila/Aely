# Aviso nativo por sesión · candidata101

Base exacta a56ab25be46985a0e78eca45146729027757b3ab, árbol daa5e1f11d67ec2438966c60ab8cc4e8a970d6ad. Registro independiente, sin repin ni retiro del historial. La tanda100 repara `appStateChange`; esta unidad repara exclusivamente `bankNotif`.

El cleanup anterior lee `h` antes de que resuelva el puente; el handle tardío no se retira. La fuente real aislada deja seis registros vivos tras seis retiradas previas a la resolución; la corrección libera los seis y bloquea callbacks retirados. Altas/retiradas fallidas y uid ausente tienen guardianes. El DOM usa transporte sintético diferido, sin operaciones ni red bancaria real.

La acumulación requiere cambios de uid o desmontaje antes de resolver el alta; navegar, perfil y scroll no reejecutan este efecto. Opción expresa, enlace, cupo diario y mutex de sincronización siguen intactos. No se atribuyen llamadas PSD2 múltiples ni causa del lag global: INC-2709-09 sigue abierto.

Fuente local sin publicación. Revisión independiente, CI exacta, presupuesto del artefacto real, entrega de catálogo precedente y aceptación móvil pendientes. Sin APK, Edge, SQL ni credenciales.

Verificación local: guardián Node causal verde para alta inmediata/diferida/síncrona, callback retirado, seis handles tardíos, altas/retiradas throw/reject, uid ausente, gates y mutantes del alcance. Contraprueba de la base exacta deja seis handles y callback activo. Cleanup100, mapas, sintaxis, privacidad, seguridad, idiomas y catálogo de notas verdes. Las220notas previas y30revisiones completas coinciden exactamente con la base. DOM: discovery2, ejecución pendiente por ausencia de Chromium; la nueva prueba tiene control positivo de callback activo y sustituye programación por contador, sin banco real.

Presupuesto sintético con95bytes reservados para DSN y sello101.99999:1317867bytes crudos/358949gzip9, márgenes21/475bytes,3bloqueantes. Guard por defecto y modalidad `--artifact` sobre ese artefacto sintético verdes; no acreditan la configuración real del publicador. No se suben límites ni recorta historial. Artefactos de trabajo restaurados a builddev; SW/APK intactos. CI exacta debe ejecutar el DOM y medir el paquete real antes de publicar.
