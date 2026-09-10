# Plan de despliegue de las Edge Functions — pendiente de su OK

**10 de septiembre de 2026.** Preparado, **no ejecutado**. Desplegar toca producción y lo ven su
padre y su pareja: requiere OK expreso suyo.

## Por qué hay que desplegar

Su widget puso **475 €** y la app **460 €** el mismo día. Cargando las dos implementaciones del
repo —cliente y servidor— sobre el mismo escenario, **dan el mismo número**. El descuadre no está
en el código: el servidor que corre no es este código.

Comprobado por **tres vías independientes**:

1. Panel de Supabase: las 13 funciones ponen «updated 24 days ago».
2. Código desplegado a la vista: el `import` de `ingest` **no incluye `inicioDeMesMs`**.
3. API de gestión (`GET /v1/projects/{ref}/functions/ingest/body`): el cuerpo desplegado
   **no contiene `inicioDeMesMs` ni `#dup`**.

| función | versión | desplegada |
|---|---|---|
| `ingest` | 35 | 2026-08-17 21:08 |
| `bank-*` (5) · `categorize` · `delete-account` · `myinvestor-*` (4) | — | 2026-08-17 15:25 |
| `bank-aspsps` | 5 | 2026-08-03 |
| `prices` | 11 | 2026-07-25 |

⚠ **Precisión, porque mi primer escaneo sobredecía**: busqué tres marcas de septiembre
(`inicioDeMesMs`, `#dup`, `cajero`) en las trece y salieron «ausentes» en todas. Eso no significa
nada para doce de ellas: **solo `ingest` importa `_shared/presupuesto.ts`**, así que las demás
nunca tuvieron ese código. Lo que sí es cierto de las trece es la fecha.

## Qué gana la familia al desplegar

- **El widget deja de contradecir a la app.** `#dup`: el servidor excluye el posible repetido, como
  ya hace el cliente. Es el 475 contra 460.
- **La compra del día 1 pasada la medianoche** cuenta en el mes correcto en los dos sitios
  (`inicioDeMesMs`, ventana Europe/Madrid).
- Detección de cajero del lado del servidor.

Y desbloquea **tres tandas que hoy él NO puede aprobar** aunque la app esté bien, porque le piden
mirar el widget con la app cerrada: `4.19.6/repetido-widget`, `4.19.2/ventana-mes` y
`4.19.6/widget-al-volver`.

## Cómo se despliega

```bash
supabase functions deploy ingest --project-ref sfyfjagbnhbplrljpbvh
```

Empezar **solo por `ingest`**: es la que arregla lo suyo y la única que depende del código
compartido nuevo. Las otras doce pueden esperar a otro día — desplegar trece cosas a la vez para
arreglar una es cómo se rompen las otras doce.

## Vuelta atrás

Supabase guarda las versiones anteriores: `ingest` está en la **35** y quedaría en la 36. Si algo
va mal, se vuelve a desplegar el cuerpo de la 35 (descargable con
`GET /v1/projects/{ref}/functions/ingest/body` **antes** de tocar nada — hacerlo y guardarlo en el
scratchpad como red).

## Riesgos, dichos antes y no después

- **El token de hoy es de SOLO LECTURA**, a propósito. Con él no se puede desplegar: hace falta que
  lo lance él, o que amplíe permisos en ese momento.
- `ingest` es la puerta por la que entran sus gastos automáticos. Si el despliegue sale mal, deja
  de entrar dinero en la app hasta la vuelta atrás. **No desplegar de madrugada ni sin él delante.**
- Después de desplegar hay que comprobarlo con un caso REAL suyo, no con uno sintético: nada de
  meterle un movimiento falso en su cuenta para probar.

## Guardián para que no vuelva a pasar

`npm run servidor` (y una sección nueva en `npm run salud`) compara la fecha de despliegue de cada
función con el último commit que tocó su código. Hoy: **13 de 13 atrasadas, la más vieja 47 días**.

⚠ Esto no lo podía cazar `presupuesto-servidor.test.mjs`, que compara el cliente del repo con el
servidor **del repo**: lo que escribimos contra lo que escribimos. Puede estar verde para siempre
mientras la familia usa código de hace un mes.
