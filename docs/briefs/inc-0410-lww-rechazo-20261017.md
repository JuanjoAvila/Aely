# INC-0410 · segunda revisión de PR253

Sucesora privada sobre `3e5884c48d56508ab06c518995fee4f2a763be22`, misma PR253 y titular. Autoridad: revisión `7acaab1f8c1172dec034271d135250dffac2db22`, task `c2e6130bc30019cf9e80d6d93ef600fe784cdbc3` y admisión `acaf456d7f60bbd79ba797f4736040c7a6d1dc52`. Los results y fuentes anteriores permanecen inmutables. Esta revisión sustituye el contrato R1 de reservas y copia recuperable. PR253 sigue NO-GO, pendiente de entrega y revisión; no es ProductREADY.

## Contrato corregido

- Con base conocida, solo se rechaza la mezcla cuando ambos lados cambiaron reservas frente a esa base y los resultados son distintos. Un cambio unilateral o igual en ambos lados permite fusionar metas a tres vías. Reglas y log se conservan juntos del lado que los cambió; no se fusionan sus elementos. Sin base tras OTA se mantiene el camino LWW anterior, sin falso conflicto por tener reglas.
- Una divergencia real adopta la foto remota de metas/reglas/log. Se conserva el feed bancario local y una copia recuperable del estado local completo, incluidas cuentas, deudas, ajustes y campos desconocidos, excluyendo gastos, bankTx, históricos, perfil y metadata recursiva `_goalSync`.
- Los registros se limitan a tres, saneados y separados por modo/titular en la clave privada `_goal_conflicts`. La principal retiene base/revisión; carga y migración conservan el contrato. Los guardados ordinarios con los mismos registros reutilizan la caché sin una lectura adicional; resetSandbox elimina también su partición y caché, conservando el modo real.
- `saved,target,done,doneAt` siguen como unidad indivisible. Nunca se suman saldos absolutos. Nombre y demás campos disjuntos conservan el merge por campo; borrado frente a edición mantiene la edición.
- El ACK conserva `_savedAt`, la foto enviada y el debounce de una edición posterior. La metadata no crea un bucle de subidas.
- La notificación se marca durable antes de emitir el código cerrado y no se repite al reabrir. SIGNED_OUT limpia los registros del titular y bloquea su resurrección desde un volcado pendiente; otros titulares/modos se conservan. Un login válido reactiva al titular.
- La metadata queda fuera del push y backup diario. No se añade UI, servidor ni operaciones idempotentes en céntimos.

## Evidencia focal y límites

`tests/goals-review2-remates.test.mjs`, registrado en run-tests, reproduce seis rojos sobre R1 antes de corregir: aportación frente a regla en ambos órdenes de entrega, cambios de reservas iguales, copia local incompleta, reset y lectura extra. Los seis pasan tras la corrección. La aportación conserva exactamente 26001 céntimos; el caso de reservas iguales conserva 1002 y 26001. Cinco mutantes focales destruyen respectivamente la fusión unilateral, la selección de reservas, cuentas/deudas del registro, reset y la admisión de reservas iguales, y los cinco quedan muertos por aserciones causales.

Las regresiones R1 mantienen grupo financiero, ACK, privacidad, telemetría durable y SIGNED_OUT. M9 vuelve a fallar con cuatro pushes frente a uno; M12 con base 25 frente a 0. Las expectativas anteriores de rechazo unilateral y registro estrecho cambian solo por el contrato explícito R2. Los logs y manifiesto privado conservan los EXIT reales, incluido el rojo inicial, las mutaciones y cualquier gate sin ejecutar.

El HTML se genera desde fuentes y se incluye en el commit. VERSION, catálogo, caps, 09 y editor quedan fuera. El gate oficial de tamaño minificado sigue pendiente por falta del runtime esbuild autorizado; HTML/gzip crudos son observaciones separadas. Node/backend sintético no acreditan RLS, navegador/móvil, CI, integración ni artefacto servido. No se ejecutan suite completa, CPU6, Gradle, SQL vivo, bancos o deploy. La implementación permanece privada hasta un turno nuevo de entrega.
