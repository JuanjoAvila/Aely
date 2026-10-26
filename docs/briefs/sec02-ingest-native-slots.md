# SEC02 PR313 R2: lector nativo y escritura en dos fases

Candidato privado sobre f62bd0794b509303cc0e4d579ccdbc0a70484214. El control de compatibilidad es 74ea9c63880b23a975f2a5852d82970f3cbffefd; no se afirma que sea el SHA de una Edge desplegada. Sin despliegue ni activación acreditados.

## Fase 1 de esta PR

El cliente y los lectores del presupuesto reconocen la marca propia no bancaria native:trade_republic#e<evento-codificado>#t<instante-original>#n<ranura>, con #dup mientras el gasto siga pendiente. El evento completo conserva origen y huella opaca; no contiene texto de la notificación. Se recuperan entidad TR, ordinal, identidad completa y hora original. La fila se lee como aviso macrodroid, nunca como fila OB ni manual: puede emparejar correctamente con OB llegue antes o después y conserva el refresco de categoría.

La escritura de esa marca en ingest requiere exactamente INGEST_NATIVE_TWINS=1. Variable ausente, 0, false o true permanecen OFF. Este candidato no configura ni activa la variable. La fase 2 será otra PR, únicamente después de que el dueño confirme que todos los móviles tienen el lector nuevo. No se despliega como parte de este trabajo.

## Huella, ranuras y carrera

La identidad es el evento completo, ligado al usuario del token y persistido en ingest_event_id y en source. El SHA256 completo propone una proyección 1..1000, usando todos sus bytes; esa proyección finita NO sustituye a la identidad y puede colisionar. Cada propuesta desplaza 0..999 ms cerca del instante original; el índice UNIQUE existente de user_id,fecha,importe,comercio arbitra la colisión. Tras comprobar el evento propio y la identidad nativa de la fila ocupante se prueba el siguiente desplazamiento. Hay como máximo ocho intentos, con desplazamiento máximo de1006 ms. Sin ocupante comprobado, ante fila manual/legacy, lectura incierta o agotamiento, se devuelve503 sin ACK ajeno.

Una proyección u ordinal repetido con horas distintas no funde filas: cliente y presupuesto distinguen la huella completa. Reenvíos y handlers nuevos recuperan el ACK del mismo evento, incluido el tercer ID después de colisiones. Se conservan el índice y los dos escritores cloud con su onConflict de cuatro columnas, sin SQL ni índice nuevo. Los dos escritores reales cloud.addExpense/addExpensesBatch conservan UUID y la columna ingest_event_id existente cuando la fila lleva la marca nativa. El conflicto sigue usando las mismas cuatro columnas. Además, source conserva por sí solo la identidad para lectores que no reciban esa columna.

Los milisegundos se suman solo si conservan simultáneamente los días UTC y Europe/Madrid; de lo contrario se prueban hacia atrás. Importe y comercio no cambian. Mes, año y DST quedan en el periodo original. Para emparejar TR/Wallet se usa el instante original de la marca, evitando que el desplazamiento altere el límite exacto de dos horas. Una Wallet solo se atribuye a TR cuando identifica esa tarjeta: no se modifica esa guarda para satisfacer fixtures.

## OFF y mejoras de seguridad R1

Con OFF se mantiene la política legacy de gemela, fecha, source y deduplicación. En caminos normales, BASE cliente por Edge nueva OFF conserva las mismas filas y céntimos que el control74ea. El cliente nuevo con servidor viejo conserva la interpretación de filas legacy: solo la marca nativa nueva añade la huella a la clave. No se presenta el OFF como solución a la multiplicidad histórica; ON sigue obligado a1990c por dos eventos reales y995c por reenvío exacto.

Se retienen las mejoras R1 también en OFF: fallo cerrado, recuperación estable de fila pendiente y ACK de la superviviente. Es una excepción explícita a la igualdad de respuestas de error con74ea. Una fila pendiente no se confirma con200 ni se usa para liberar un alias. Una respuesta perdida puede recuperarse sin cambiar source desde el doble. Estos caminos pueden ser más seguros que el control, nunca menos.

## Evidencia y límites

Los RED anteriores permanecen inmutables: B1 mostraba2985c frente a1990c con servidor f62 y BASE; B2 guardaba tres filas pero dos #n2, y race313 dejaba solo1990c frente a2985c. El oráculo313 original se detuvo en un fixture Wallet que no identifica tarjeta TR; se conserva ese fallo y no se afirma que su suite completa pase. Un oráculo B1 independiente y dirigido aisló el problema contable sin cambiar sus importes.

La matriz dirigida Node usa el handler real y las funciones reales de importación, mezcla, reconciliación y escritura cloud: ON1990c en ambos órdenes OB, UUID/full fingerprint por roundtrip, categoría, proyecciones SHA realmente colisionadas y reenvíos. Otra matriz privada carga el handler y cliente74ea controlados: siete caminos normales comparan filas/céntimos y status/ACK; errores R1 prueban por separado503, pendiente excluida y recuperación995c. No son pruebas de una BD viva.

Deno ejecuta el handler real con SDK y almacenamiento sintéticos, sin red. El run final de21 casos pasó completo con comprobación de tipos y strict:false del arnés. Incluye GREEN causal con las mismas tres huellas del RED, colisiones SHA reales, límite de ocho probes, frontera de dos horas, switch ausente/deshabilitado y las recuperaciones R1. Los fallos y runs intermedios se conservan; el arnés fuerza los prechecks de las carreras y usa created_at de inserción, no la fecha contable del pago. La evidencia no acredita un chequeo con strict:true ni PostgreSQL real.

Cada run tiene censo y admisión propios,1worker serial,0 retries del runner, parada al primer fallo y logs/EXIT/RETURN durables. Los reintentos del protocolo de ingest son un comportamiento bajo prueba. native-identity.test.ts y los tests Node están registrados en sus runners; Deno solo recibe las cinco variables sintéticas que sobrescribe, sin allow-net. El tipado estricto del handler, PostgreSQL/PostgREST reales, CI, beta servida y aceptación móvil no quedan acreditados por estos dobles.

## Fuera de alcance

Sin F1 callback, F3 paginación, SQL, Android, APK, versiones, dependencias, catálogo, merge ni deploy. El debounce Android180s es otra pieza posterior a F1/F3. La entrega exige candidato privado terminado con diff/bundle/manifest, revisión independiente ROOT y GO de SHA exacto antes del push normal a la misma PR313.

## Referencias

- [Pruebas de Edge Functions](https://supabase.com/docs/guides/functions/unit-test): separar pruebas del handler de una integración real.
- [Upsert de Supabase](https://supabase.com/docs/reference/javascript/upsert): conflicto por columnas y retorno mediante select.
- [Changelog de Supabase](https://supabase.com/changelog): revisado antes del cambio; sin cambio de SDK ni de esquema.
