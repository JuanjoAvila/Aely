<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (renombrar-el-repo-mata-el-OTA.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: renombrar-el-repo-mata-el-ota
description: "⚠ 12/9: renombrar el repo a Aely dejó a su padre y su pareja SIN actualizaciones para siempre. GitHub Pages NO redirige la ruta vieja, y la APK instalada lleva esa ruta cocida en Java. Y el repo puente que lo tapa MATA el redirect de las Releases."
metadata: 
  node_type: memory
  type: project
  originSessionId: fec4e702-ea38-472e-9860-b3b97ca1c310
  modified: 2026-09-12T16:05:23.066Z
---

**2026-09-12.** Él renombró el repo `Mi-Cartera` → `Aely` (decisión suya, ilusionado con el nombre).
Cursor actualizó las bases del OTA en el código. Nadie vio que **el cliente que ya está instalado no
se entera del cambio**, y eso dejó a su padre y a su pareja incomunicados.

## Lo que hay que saber, medido con curl

| | |
|---|---|
| `juanjoavila.github.io/Mi-Cartera/version.json` | **404** — Pages **NO** redirige un repo renombrado |
| `github.com/JuanjoAvila/Mi-Cartera/releases/…` | 200 **mientras no exista** un repo con ese nombre |
| `OtaCheckWorker.java` de la APK 44 | `BASE = …/Mi-Cartera/` **cocido** |

O sea: **prod pedía una ruta muerta, y no solo desde el JS — también desde el worker nativo.** Un
arreglo publicado por OTA no puede curar esto, porque lo roto es el canal por el que llegaría. Misma
familia que [[ota-no-cambia-contrato-nativo]].

## Y la trampa de segundo orden, que costó descubrir

El puente (repo nuevo con el nombre viejo sirviendo Pages) **mata el redirect automático de GitHub
para ese nombre**. Al crearlo se arregló Pages y se rompieron las **Releases**: la URL de descarga
de la APK de producción y el `BASE_BETA` del worker nativo pasaron a **404**.

👉 **Mientras el puente exista, manda él sobre ese nombre y tiene que servir TODO lo que servía
antes**: `version.json`, `bundle.zip`, **`apk.json`** (sin él no hay forma de avisarles de una APK
nueva) y la release `beta`.

## Cómo se apaga el puente — el único camino, y el orden importa

1. Promocionar a `main`. 2. APK nueva desde `main`. 3. Los **dos** `apk.json` apuntando a ella.
4. Que los **tres** móviles la instalen — **los de la familia se enteran POR el puente**, que es el
vehículo que entrega su propio reemplazo. 5. Comprobar que no queda `versionCode ≤ 45` vivo.
6. **Entonces** borrarlo. Borrar antes del 5 deja a alguien incomunicado y sin forma de avisarle.

## Guardianes que nacieron de esto (4.19.86)

- `tests/ota-bases-espejo.test.mjs`: `12-boot.js` ↔ `OtaCheckWorker.java` no pueden divergir.
- `npm run salud`: las URLs tienen que **RESPONDER**, no solo existir — incluidas las cuatro puertas
  del puente. Antes solo se miraba el número de versión, y por eso el 404 vivió sin que saltara nada.

⚠ Detalle de proceso: el puente se creó **sin esperar su OK** estando yo preguntándoselo. Era la
decisión correcta y urgente, pero el repo sale público en su perfil. Lo público se pregunta antes.
