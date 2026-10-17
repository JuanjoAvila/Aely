# INC-0410 · remates del NO-GO de PR253

Fuente sucesora privada sobre `e3bbd92c41ad7168786ddb5550e35b95f686b3d3`, misma PR253 y titular. El result anterior permanece inmutable. Autoridad: revisión `fa83f1c681750095c017f8448e2353040cb91456`, task `3172486d15ff9b4aae43986583ce51b423635b30` y admisión `acaf456d7f60bbd79ba797f4736040c7a6d1dc52`. Pendiente de turno de publicación y nueva revisión; no es entrega lista ni ProductREADY. Este contrato sustituye el primer intento descrito en las notas de arquitectura de la fuente anterior.

## Contrato corregido

- Sin base tras la OTA se siembra la base con nube y se conserva el camino LWW anterior, sin falso conflicto por tener reglas. Si solo cambió la rama local de reservas, se respeta `localNewer`: un push fallido seguido de reapertura no borra la regla/presupuesto del mismo móvil.
- Una divergencia remota de reservas frente a la base, junto con cambios locales, rechaza la mezcla financiera. Se adopta la foto coherente remota de metas/reglas/log pero se parte de `prev` para preservar datos solo locales como `bankTx`. No se fusionan reglas ni asientos.
- `saved,target,done,doneAt` forman una unidad indivisible del merge. Una decisión de nube sobre ese grupo conserva sus cuatro campos; nunca se suman saldos absolutos. Nombre y demás campos disjuntos conservan el merge por campo. Borrado frente a edición mantiene la edición.
- Los registros se sanean: no contienen gastos, feed bancario, históricos ni perfil. Se limitan a tres y se guardan mediante `mcSaveRaw`/`mcLoadRaw` en la clave propia por modo `_goal_conflicts`, ligada al titular. La clave principal solo conserva base/revisión; al cargar registros antiguos se migran y reescribe la parte ligera.
- El ACK usa `setStateRaw` para conservar `_savedAt` y retiene la foto enviada, no la edición posterior al envío. La metadata no rearma la subida ni cancela el debounce pendiente de una edición posterior.
- La notificación de conflicto se marca durable antes de emitir el código cerrado. Reabrir no la repite. `SIGNED_OUT` limpia los registros del titular y bloquea su resurrección desde un volcado pendiente; otras cuentas/modos se conservan. Un nuevo login válido reactiva el escritor de su titular.
- La metadata sigue excluida del push y del backup diario. Esta fase no añade UI de resolución, cambios de servidor ni operaciones idempotentes en céntimos.

## Evidencia focal y límites

`tests/goals-review-remates.test.mjs` está registrado en `run-tests`. Sus primeros rojos sobre e3bbd92c reproducen ocho defectos del NO-GO (2 controles pasan). El circuito real `pushAppState` y el efecto de subida con reloj controlado matan M9 contando pushes y M12 comprobando la foto enviada. La sonda de persistencia usa 2000 gastos sintéticos, cinco conflictos y mide bytes realmente escritos en principal; antes supera 1 MB por escritura, después queda por debajo de 500 bytes, con tres registros en la partición separada.

Los tests existentes se adaptan a los cambios explícitos del NO-GO: registro saneado, grupo financiero indivisible y excepción de la rama solo local. No cambian oráculos de gastos ni suman aportaciones. Se conserva el rojo de cancelación de debounce del primer envío y la evidencia de fases anteriores.

El HTML se genera desde las fuentes y forma parte de esta candidata. VERSION, catálogo, caps, 09 y hoja de edición quedan fuera. Node y backend sintético no acreditan RLS, navegador/móvil, CI, integración ni artefacto servido. El manifiesto privado distingue bytes HTML/gzip medidos del gate oficial minificado y declara cualquier runtime/gate pendiente. No se ejecutan suite completa, CPU6, SQL vivo, bancos o deploy.
