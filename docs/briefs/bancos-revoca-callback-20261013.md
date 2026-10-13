# Revocación y carreras: revisión de reservas13/10/2026

Task vigente: `bancos-revoca-callback-revision-reservas-codex-20261013`.
Claim/base124 `f5904735b514751ee926d25c22c92195b6ce3653` inmutable.
Rebase expresamente ordenado de los DOS commits propios sobre la dependencia REMOTA
`2d53ab24dc32a83faf17ce08c3b2d50b304d8e55`, VERSION4.26.122. Los commits propios
2c2084d6/0a1cef0c quedan reaplicados como4e77f31c/37d457f3; la rama de Claude no cambia.
No es un rollback publicado de beta124. El result históricoffeaf se conserva sin reapertura.
A terminó y se liberó en58f158f7 antes del claim nuevo de B: no hay dos CODE propios activos.

## Cambios y decisión de carrera

sameLinkVersion protege las SEIS escrituras por enlace: sin cuentas, consumir acuse, ancla null,
estado final, tramo terminado y tramo sellado legacy. Conserva payloads, lt/is de cursor y orden119.
Compara ciphertext original y state_issued_at en el UPDATE atómico; null requiere IS NULL.
No toca el catch/consulta de sesión de Claude, demand-window, callback, keepsCursor o paginación.

DELETE del proveedor está limitado a8000ms con AbortController y Promise.race; ni un transporte
que ignore abort puede retener el borrado local indefinidamente. El timeout registra TIEMPO,
sin id/ciphertext/JWT/error libre. La eliminación local sigue siendo posible al fallar proveedor,
clave o registro, si la fila continúa siendo la misma.

Se elige NO borrar una autorización que cambió durante la desconexión. El DELETE local filtra
usuario, banco, id y ambas marcas originales, y pide sólo el id de la fila eliminada.
Si no casa devuelve409 con mensaje fijo, sin ids: el usuario puede repetir sobre la conexión
vigente. Revocar la nueva tras otra lectura permitiría otra carrera y sería revocar una conexión
que el usuario acaba de completar. Sin fila en la foto inicial no se hace un borrado tardío.

## Evidencia sintética y límites

Deno nativo con handlers/SDK reales y HTTP interceptado:8 PASS/8 FAIL antes,16 PASS/0 FAIL después,
incluidos connect/callback reales entre snapshot y SQL, ambos cursores legacy, acuse, ancla null,
usuario ajeno primero, fallo503, conexión insertada tarde y timeout REAL de8segundos.
El primer arnés daba9/7 porque el acuse sin recoverGaps no se activaba; se corrigió el fixture
antes de medir el rojo causal8/8. Tipos y sanitizadores permanecen activos.
Node20 PASS/0 FAIL también prueba cifrado/legacy, usuario/tipo/mensaje de registro y cambios independientes de
sesión/emisión. Diez mutantes son rechazados, incluidos EQ NULL con SDK/semántica SQL reales.
El grupo nativo lifecycle/crypto/demand-window termina29 PASS/0 FAIL.
Los bytes de fuente se restauran exactos; log y EXIT se conservan en evidencia privada.

Estos resultados no prueban Postgres desplegado, consentimiento real ni móvil.
La siguiente comprobación es sólo una plantilla para el coordinador DESPUÉS de desplegar.

## Consulta de comprobación posdespliegue — preparada, NO ejecutada

Sustituir privadamente los dos placeholders; no copiar valores de usuario a este repo/log.
Ejecutar la misma lectura antes y después de UN sync manual normal de un enlace activo con
cuentas, sesión cifrada y autorización sin cambios (sin reconectar mientras se prueba).

```sql
select status, updated_at, last_sync,
       coalesce(session_id like 'enc:v1:%', false) as session_encrypted
from public.bank_links
where user_id = '<USER_UUID>'::uuid
  and aspsp_name = '<BANK_NAME>';
```

Esperar exactamente una fila, session_encrypted=true y status=active. Guardar el updated_at
previo, esperar al menos un segundo y pedir el sync normal; el updated_at posterior debe ser
mayor. Esto comprueba que el guard eq con ciphertext casa en el PostgREST/Postgres real.
last_sync NO tiene que avanzar aún si el cliente usa acuse119. Si no mueve updated_at, conservar
el fallo y revisar estado/resultado de la función; nunca retirar el filtro ni forzar el cursor.
La consulta no devuelve ciphertext, session_id, referencias de cuenta, movimientos o saldos.

Sin SQL/RLS/migraciones/DB/proveedor reales, despliegue, APK, beta/main, VERSION/notas/catálogo
o topes. FIN01 ajeno retenido y sin RETURN permanece intacto. Revisión e integración a Claude;
se declaran solapes bank-sync con su catch/consulta y A PR223 (paginación/diagnóstico).

## Primera entrega, evidencia histórica (no es el estado de esta revisión)

### Revocar al desconectar y respetar un callback nuevo — candidato13/10/2026

Task `bancos-desconectar-revoca-y-carrera-callback-codex-20261013`.
Base inmutable de task/claim:123, `3625fa7ed5134cfbc5e364adc4f588bfdaf670c0`.
Ejecución autorizada sobre `claude/brokers-falsa-caducidad`,
`2d53ab24dc32a83faf17ce08c3b2d50b304d8e55`, publicada y verificada.
Rebase posterior autorizado por `beta-124-publicada-rebasar-20261013` sobre beta124,
`f5904735b514751ee926d25c22c92195b6ce3653`. Las dos dependencias de Claude quedan
reaplicadas como `62eb6572c` y `dd195b2d8`; el diff propio se revisa contra este último.
El claim conserva su base123; la rama original de Claude no se modifica.
Sólo candidato para revisión de Claude; no desplegado ni publicado en beta/main.

## Defectos reproducidos

En2d53ab24, `bank-disconnect/index.ts:41` enviaba el `session_id` cifrado directamente a
`DELETE /sessions`; su catch lo ignoraba y el borrado local seguía. También un id legacy con
caracteres reservados escapaba de su ruta. Se reutiliza `decryptSessionId`, el mismo helper de
Claude, sin cambiar clave o formato. El DELETE codifica su resultado. Ante error de descifrado,
preparación o proveedor, un `app_events` best-effort registra sólo paso y código/HTTP cerrado.
Ni el id guardado, ni el descifrado, JWT, URL o texto libre salen al registro o respuesta.
La eliminación local sigue filtrada por usuario/banco y no depende de la revocación o del log.

En `bank-sync/index.ts:383-388`, un snapshot previo a una reconexión actualizaba la fila por
`id` después de que el callback la hubiese autorizado de nuevo. Podía dejarla `expired`, o
adelantar el cursor de una sesión nueva con el resultado de la antigua. Sólo cambia ese bloque:
el UPDATE conserva su payload y exige sesión guardada y emisión originales en la propia
escritura. Si cambió cualquiera, no coincide. Null se compara con `IS NULL`, no `EQ NULL`.
No hay comprobación seguida de otro UPDATE desprotegido ni SELECT/consulta adicional.

## Fronteras y solapes

- `bank-sync`: fuera del bloque final, prefijo y sufijo normalizados a LF son idénticos a2d53ab24
  (comparación SHA256 guardada en evidencia). Catch/consulta de sesión de Claude, paginación,
  `allRead`, acuses y otros bloques de cursor permanecen intactos.
- `bank-callback`, `keepsCursor`, `_shared/crypto.ts` y `token_store.ts` no se editan. El callback
  real se ejecuta intercalado en los tests y se comprueba que conserva el cursor de las mismas
  cuentas antes y después de liberar el sync antiguo.
- Solape de fichero con `claude/brokers-falsa-caducidad` (2d53ab24, dependencia incluida) y
  PR223 (`f236a2f4668929ea635ebeba4f3d96a91dc28727`) en `bank-sync/index.ts`. El hunk propio
  es el UPDATE final; PR223 cambia paginación/diagnóstico y Claude el catch/consulta de sesión.
  Declarar el fichero compartido al integrar, sin sustituir sus superficies.
- `scripts/run-tests.mjs`, `scripts/relevant-tests.mjs` y `tests/logs-privacidad.test.mjs` también
  comparten registro/inventario con PR223 y futuras tandas. Se añaden entradas, no se recortan.
- Sin VERSION, notas, catálogo, topes, src/UI, Android, SQL, RLS, migraciones o nuevas dependencias.
  Los imports de SDK usados por Deno ya eran los del backend; sólo se completó su caché local.
- La decisión Madrid se conserva: aquí los timestamps de autorización son instantes absolutos.
  No se cambia el calendario del dinero ni las funciones reservadas a Widget45/tarjeta del mes.

## Evidencia causal sintética

| Ejecución | Base2d53ab24 | Candidato |
|---|---|---|
| Node, handlers reales/cifrado real/DB y API dobles |4 PASS /10 FAIL, EXIT1|14 PASS /0 FAIL, EXIT0|
| Deno real, handlers y SDK reales, HTTP interceptado |1 PASS /5 FAIL, EXIT1|6 PASS /0 FAIL, EXIT0|

Los dos callback/sync prueban resultado antiguo caducado y correcto sin acuse: no se puede
pisar ni estado ni cursor119 de la autorización nueva. Se prueban también cambios independientes
de sesión/emisión, cifrado/legacy, fallo503, errores de clave, registro caído y aislamiento por
usuario/banco. Los snapshots SELECT son copias: nunca referencias a la fila que cambia.

Tras el rebase124 se repitieron Node (14/0), Deno nativo (19/0 entre lifecycle, crypto y
demand-window), acuses/reconexión/progreso/paginación, privacidad, seguridad, mapa y sintaxis
Edge: EXIT0. El guard de privacidad también pasó. docs-frescura dio EXIT1 exclusivamente por
fuentes candidatas posteriores al ancla124 sin VERSION autorizada; los números están alineados.
Ese gate queda explícito para integración, sin cambiar la versión para ocultarlo.

Siete mutaciones dieron EXIT1: enviar ciphertext, quitar URL encoding, registrar texto libre,
retirar filtro de sesión, retirar filtro de emisión y usar `EQ NULL` en cada campo. Las dos
últimas se ejecutan en Deno con SDK/REST reales modelados, porque un doble que aceptara igualdad
null como JS ocultaría el fallo SQL. Se restauró cada archivo byte por byte.

Privacidad y seguridad permanecen verdes. La matriz del logger cuenta el destino nuevo y prueba
errores con identificadores/datos hostiles. Los dos fixtures antiguos que no implementaban
`IS NULL` daban500; ahora aplican su predicado. El transporte Deno rechazaba inicialmente `in.`
como operación no modelada; se corrigió a comparación de pertenencia, sin permitir cualquier
consulta ni desactivar tipos/sanitizadores. Se conservan los exits anteriores en evidencia privada.

Se registran Node y Deno en el runner y en el recorte de Supabase. Ningún navegador o runner
pesado local ejecutado; el recurso ajeno retenido no se tocó. CI remota exacta sobre el SHA final
y su log se consignan en PR/result: este acta no afirma su resultado antes de terminar. No hay
servicio real, cartera real, despliegue, consentimiento vivo revocado o aceptación de móvil.
