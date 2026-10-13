# Revocar al desconectar y respetar un callback nuevo — candidato13/10/2026

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
