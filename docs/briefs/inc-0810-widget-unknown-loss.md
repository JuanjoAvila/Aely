# Widget: conservar incertidumbre tras perder una identidad

Fuente candidata sobre beta102 `6b81279676d66337d7b34b7badc6d1ff2c66bc24`, todavía sin publicación. No entrega APK ni aprobación móvil. No copia la cabeza anterior NO-GO ni resuelve por sí sola el resto del widget.

## Reproducción y cambio

Java real en la base: un `unknownJournal` válido casi lleno rechaza la identidad de otro pago; una foto con ACK sólo de la identidad retenida borra `journalFull` y `unknownPending`. La prueba termina en `AssertionError`: desaparece incertidumbre sin cobertura del pago perdido.

La candidata conserva `unknownLoss` en preferencias cuando no cabe la identidad. App, cambios de banco/periodo y respuestas servidor no borran esa pérdida. El render conserva «sin dato»; los importes se mantienen sin inventar deltas. Si desborda el journal de deltas pero cabe la identidad compacta, se conserva ésta y un ACK/lápida exactos sí permiten recuperarla. Un journal ya bloqueado también conserva las nuevas identidades recibidas.

Segundo caso Java rojo en la primera candidata: al invalidar el alcance, la conversión del journal excede el límite y saveApp sólo guardaba journalFull. Una respuesta del periodo nuevo podía perder la identidad previa y un ACK de otras identidades borraba incertidumbre. La candidata final persiste los flags de pérdida mediante writeBlocked también al fallar saveApp; nunca guarda cifras o identidades parciales. El test ejecuta ese helper real y read/write tras reinicio.

El esquema antiguo no distingue bloqueo de formato de identidad perdida. Al releer una preferencia antigua con `journalFull:true` y sin `unknownLoss`, se conserva incertidumbre de forma conservadora. Una preferencia nueva con `unknownLoss:false` mantiene la recuperación habitual de indentación XML.

No existe un protocolo que demuestre cobertura de una identidad que ya se perdió. Por eso `unknownLoss` no se limpia mediante una foto ni ACK aparente; una recuperación explícita acreditada requiere otro encargo. Esta limitación reduce disponibilidad antes que mostrar certeza financiera sin evidencia.

## Pruebas y límites

`tests/widget-unknown-loss.test.mjs` compila el árbitro real y los métodos reales `read`/`write` del widget con preferencias sintéticas. Ejecutado con JDK real: pérdida, reinicio, ACK parcial/ajeno, lápida, periodo, fence, migración y bloqueo XML recuperable verdes. Registrado en `scripts/run-tests.mjs` y en los recortes Android/Supabase de `scripts/relevant-tests.mjs`; el guardián exige su inclusión en Android.

Suites existentes `widget-arbitraje`, `widget-coherente` y `relevant-tests` verdes. Comparación real de `betaRevision` contra la base: cambian las cinco superficies nativas `fin05-widget-reentrada`, `fin05-pago-cerrada`, `widget-banco`, `widget-app-cerrada` e `inc-2909-01-widget-periodo`; sus identidades publicadas no se han repinado.

Pendientes: revisión independiente fuerte del SHA exacto, suites existentes y CI exacta; identidades nuevas de todas las tandas nativas afectadas conservando historial y aceptación. Fuente/pruebas solamente: no VERSION, catálogo, APK, Edge, SQL, main ni beta. Los guardianes de identidad no se repinan ni se relajan; si fallan se conserva evidencia y candidato para una integración autorizada posterior.
