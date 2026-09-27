# OPS-01 B · Bizum como forma de pago · 2026-09-27

Estado: candidato local preparado; sin activación. Solo `categorize`, migraciones=`no`.
Base main remota verificada: `f5e6b514a00b767a07e7ef8d58cf158fe75e93b9`; beta
`5d5b8d0f0d8ea12b5521009d3fef9b54f6fd85e9` queda fuera. La auditoría
`8f6830e67d1e24c6940457d00397c2114110f23d` permanece intacta.

## Fuente activa y delta

La API de gestión, sin invocar la función, confirmó hoy `categorize16`, ACTIVE y JWT=true.
Descarga: 331619 bytes, SHA-256
`270f6598b948a114ab64b4e426f562574081bd10845f6c52d19d277af956ae65`, idéntico a la auditoría.
Se extrajeron los cuatro `sourcesContent` del paquete descargado y se contrastaron con
`git show 6f61bfc690f53e849b22b659dd0fe607b1a90043:supabase/functions/<ruta>`:
`categorize/index.ts`, `_shared/ingest_logic.ts`, `_shared/cors.ts`, `_shared/ratelimit.ts`.
Cada fuente original coincide byte a byte; hashes anteriores y candidatos en
`supabase/packages/ops01-categorize/manifest.json`.

Main ya retiró Bizum de ALLOWED/HINTS/KW, pero su cierre incluye `clasificarConMotivo`, ausente
en categorize16 y ajeno a esta función. Por eso se conserva el cierre activo congelado y se
prepara un proyecto separado. El delta de fuentes es exactamente el parche B de la auditoría:
dos sustituciones en el handler y eliminación de una línea KW; CORS, rateLimit y el resto
del módulo permanecen íntegros. No se toca `supabase/functions`, ingest, Wallet, cliente,
consentimiento, flags de pago, APK, categorías históricas ni migraciones.

El alias remoto del SDK `@2` resolvía a `@2.116.0` en el bundle activo. El import map del paquete
fija esa misma versión para no incorporar una actualización accidental. El empaquetador y las
dependencias transitivas remotas pueden producir un bundle con otro hash: la verificación
posterior exige igualdad de las cuatro fuentes propias y compara las resoluciones externas;
un cambio externo no explicado impide declarar el despliegue equivalente.

## Preparación y activación eventual

Trabajar en un checkout limpio del SHA final revisado indicado por la entrega y comprobar
`git rev-parse HEAD`, `git status --short` y los tests antes de preparar:

```bash
node tests/categorize-handler.test.mjs
node scripts/prepare-categorize-package.mjs candidate --out /ruta/vacia/categorize-candidate
node scripts/prepare-categorize-package.mjs rollback --out /ruta/vacia/categorize-rollback
```

La salida solo contiene `supabase/config.toml`, `functions/categorize/index.ts`, su import map
y los tres módulos compartidos anteriores. No contiene SQL, otras funciones ni credenciales.
Las rutas deben estar vacías; la herramienta rechaza una salida ocupada.

**No ejecutado. Requiere el OK explícito final del dueño**, porque Supabase sirve producción y
beta a la vez. Con el SHA revisado y los hashes del candidato confirmados, el único comando
de activación de B sería, usando el proyecto autorizado en la variable de entorno:

```bash
supabase functions deploy categorize --workdir /ruta/categorize-candidate --project-ref "$SUPABASE_PROJECT_REF" --use-api
```

El entrypoint es `/ruta/categorize-candidate/supabase/functions/categorize/index.ts`; config
mantiene `verify_jwt=true` e import map propio. Migraciones=`no`: el comando no hace `link`,
`db push`, reparaciones del registro ni SQL. No se cambia ningún secreto. No se utiliza
`supabase.yml`: C despliega desde el árbol raíz y enviaría otro cierre. Sus controles siguen
intactos. Referencia del comando: [CLI oficial](https://supabase.com/docs/reference/cli/supabase-functions-deploy)
y [dependencias por función](https://supabase.com/docs/guides/functions/dependencies).

Antes de activarlo: repetir GET de metadatos/cuerpo, comprobar que la descarga sigue teniendo
el hash anterior; si cambió, detenerse y revisar el nuevo delta. Después: volver a descargar
solo categorize, contrastar cada `sourcesContent` con los hashes candidatos, JWT, resolución
externa, y estabilidad de metadatos antes/después. Ejecutar otra vez los fixtures contra esas
fuentes descargadas, con fetch y BD simulados. No invocar LLM real ni escribir movimientos para
probar. La versión remota nueva y un Action verde solos no acreditan igualdad de fuentes.

## Rollback

El proyecto preparado con `rollback` conserva las cuatro fuentes de categorize16, sin cambios.
Tras autorización explícita de rollback, desplegar **solo categorize** con el mismo comando,
cambiando `--workdir` a `/ruta/categorize-rollback`. Migraciones=`no`; cotejar los hashes baseline
y repetir fixtures del baseline. El contador remoto será otro: no debe volver necesariamente
a 16 ni repetir el hash de empaquetado. El rollback no recategoriza sugerencias ya aceptadas ni
deshace datos reales. No enviar ingest ni el árbol completo.

## Verificación y límites

- `npm run build`: PASS, sin cambios generados.
- `node tests/categorize-handler.test.mjs`: 15 grupos PASS, incluida aplicación independiente del parche auditado. Ejecuta handler, CORS y rateLimit
  completos del cierre candidato con clientes/fetch simulados: Bizum→otros, Mercadona→super,
  ATM→traspaso; KW sin IA, falta de clave, Bizum del modelo rechazado, finalidad válida aceptada,
  error de red/HTTP, auth ausente/rechazada, limitador, JSON/categoría inválidos, método, merchant
  y preflight. Catálogo coincidente con cliente, histórico Bizum conservado y clasificación de
  pago intacta. Ninguna tabla real ni LLM remoto.
- Paquetes físicos candidato/rollback preparados y hash verificado; una sola función, JWT=true,
  sin migraciones; salida ocupada rechazada. Registro en `steps` y `STEPS_SUPABASE`.
- `npm test` local: unitarios ejecutados; único fallo `memoria-espejo` por desfase local
  preexistente de cuatro documentos. No se arregla memoria ni se incluye trabajo ajeno.
  Deno no instalado: omitido. E2E no arrancó porque el runner bloquea tras un fallo unitario.
  Esto no es un verde completo local; la suite completa se comprobará en CI de la entrega.
- `npm run salud`: HTTP confirmó OTA estable 4.26.52, beta 4.26.53.1 y APK estable 4.26.32/code48.
  Edge y app_events omitidos sin credenciales en este checkout. El cierre activo de categorize
  se demuestra con la descarga de gestión anterior, no con el mensaje general de salud.

No se activa una versión de app: las notas de Bizum y el rechazo del cliente ya se publicaron
en 4.26.42. Se prepara la alineación del servidor con ese contrato existente, sin nuevo bump,
OTA ni notas de una publicación que aún no ha ocurrido. SHA, revisión real de Claude y CI
finales se registran en la evidencia de esta entrega. FIN-06 sigue pendiente de pago real;
FIN-05, selector y compra TR también. A, OPS-02, FIN-08 y SEC no forman parte de B.
