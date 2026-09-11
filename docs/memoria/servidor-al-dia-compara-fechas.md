<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (servidor-al-dia-compara-fechas.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: servidor-al-dia-compara-fechas
description: "«npm run servidor» dice «13 de 13 funciones con el repo por delante» comparando FECHAS DE COMMIT, no contenido. El 11/9 aparqué tres tandas del panel de beta por eso y ninguna estaba bloqueada."
metadata: 
  node_type: memory
  type: project
  originSessionId: 0026af41-cbf3-4394-a3f1-3117babc2995
  modified: 2026-09-11T20:48:45.320Z
---

**11/9/2026.** `npm run servidor` (y el bloque de `npm run salud`) decían **«13 de 13 funciones con
el repo POR DELANTE de lo desplegado»**, con `_shared/` sin desplegar desde hacía versiones. Cursor
y yo lo dimos los dos por bueno. Yo **aparqué tres tandas del panel de beta** por eso (efectivo,
widget/posible repetido, apuntes manuales que no se fusionan), porque las tres dependen de `ingest`.

Al desplegar `ingest` de verdad, Supabase contestó en una línea:

```
No change found in Function: ingest
```

**Ya estaba al día.** Ese script compara **la fecha del último commit que tocó su código** con **la
fecha del último despliegue**, y `_shared/` lo rozan commits que no cambian nada de lo que `ingest`
compila. Así que marca las trece como atrasadas en cuanto alguien toca ese directorio.

**Cómo se comprueba de verdad, y cuesta 30 segundos:**

```bash
gh workflow run supabase.yml -f funcion=ingest -f migraciones=no
```

Si sale `No change found`, estaba al día. Si despliega, no lo estaba. **Una fecha no es una
comprobación** — ver [[feedback-no-dar-por-hecho]].

⚠ **El CLI desde su máquina da 403** («Your account does not have the necessary privileges»),
incluso tras `supabase login` y sin `SUPABASE_ACCESS_TOKEN` en el entorno. `supabase projects list`
**sí** ve el proyecto, así que es permiso de ESCRITURA, no cuenta equivocada. El camino que funciona
es **Actions con el secret del repo** (es de junio y con él se desplegaba antes).

⚠ **El workflow acepta desde el 11/9 dos inputs**, y los dos importan:
- `funcion`: vacío = las TRECE. Desplegar trece para arreglar una es como se rompen las otras doce.
- `migraciones`: por defecto **`no`**. Tocan la BASE DE DATOS y eso es otra autorización distinta
  de «despliega una función». El disparo automático por push a `supabase/**` se quedó como estaba.

Plan completo y vuelta atrás: `docs/briefs/plan-despliegue-edge-2026-09-10.md`. La copia del cuerpo
anterior se baja con `GET /v1/projects/{ref}/functions/ingest/body` **antes** de tocar nada.
