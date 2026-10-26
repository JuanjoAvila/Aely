# SEC02 F1 · Guardado de la generación consumida

Si `bank-connect` reconecta la misma fila mientras un callback espera al proveedor,
el callback antiguo no puede guardar su sesión sobre la autorización nueva. El
consumo previo de `state` ya era condicional, pero el guardado final filtraba solo
por `id` y podía mezclar sesión/cuentas antiguas con el state y la emisión nuevos.

El UPDATE final exige en la misma operación `id`, propietario, `state IS NULL` y
la emisión original. Para la emisión legacy nula usa `IS NULL`; para una emisión
conocida, igualdad. También hace falta la emisión cuando el callback de la nueva
generación ya consumió su propio state. Se conserva el acuse previo de exactamente
una fila con el id esperado. Cero filas, error, respuesta perdida, nula o ambigua
cierran con error y nunca con `bank=ok`.

No se restaura state ni se reintenta el canje/guardado. No se borra ni revoca una
sesión externa al detectar la carrera: no hay autoridad para esos efectos, y una
respuesta perdida tampoco acredita qué operación quedó confirmada. Cuentas,
cursor, cifrado, cuotas, caducidad y puente web/APK mantienen su contrato.

## Pruebas dirigidas

`supabase/functions/bank-callback/generation-fence.test.ts` carga y ejecuta el
TypeScript real del handler en Deno. Las importaciones de fronteras se sustituyen
por SDK, proveedor, almacenamiento, cifrado y runtime sintéticos; la decisión de
cursor y los validadores de entrada son los reales. Sin permisos de red ni entorno.
Cada SELECT devuelve una copia separada de la fila viva. La BD doble evalúa todos
los filtros sobre esa fila al escribir, sin prefiltrar el escenario según el fix.

El RED sobre la base previa al arreglo espera el canje de A, reconecta B sobre el
mismo id/propietario y demuestra que A sobrescribe sesión/cuentas/status de B.
El mismo oráculo GREEN compara la fila B completa y exige una vuelta cerrada.
Los 20 casos incluyen guardado normal web/APK, emisión conocida y legacy nula,
cambios aislados de state/emisión/propietario justo al escribir, acuses finales
inválidos y guardas de consumo anteriores al canje. Tres mutantes dirigidos
(sin state, sin emisión y `eq(null)` para legacy) fallan en sus oráculos respectivos.
Los logs RED y de mutantes conservan sus exits fallidos; no son fallos del GREEN.

```sh
node scripts/run-deno-tests.mjs supabase/functions/bank-callback/generation-fence.test.ts
```

Está registrado en ambos runners, con lectura limitada a `supabase/functions`,
resolución sin node_modules y parada al primer fallo. Las corridas son seriales,
un worker, cero reintentos, con censo, admisión, stdout/stderr, EXIT y RETURN propios.
No se repiten la auditoría ni pruebas cerradas de otros alcances.

Estos dobles no prueban PostgreSQL/PostgREST, concurrencia del gateway, proveedor
real, despliegue ni móvil físico. La entrega de fuente no acredita una beta servida.

Contrato contrastado con la documentación de [UPDATE y representación devuelta](https://supabase.com/docs/reference/javascript/update)
y [filtro IS para NULL](https://supabase.com/docs/reference/javascript/is), tras consultar
el [changelog oficial](https://supabase.com/changelog). No se cambia el esquema ni se
añaden dependencias.
