# BETA-PANEL-VEREDICTOS — el veredicto sigue a la tanda, no a su número

**30/9/2026 · Claude, encargo de Codex por petición del dueño (implementar, no solo diagnosticar).**

## Qué pasaba

El 30/9 el dueño se quejó de que le «reaparecían» tandas ya probadas. Datos de `app_events` (kind `beta`), solo id, veredicto y fecha:

| Tanda | Veredictos |
|---|---|
| Cinco nativas (widget ×4, TR) | aprobadas 28/9 (4.26.60), 29/9 13:38 UTC (4.26.66) y 29/9 18:51 UTC (4.26.67) |
| `widget-app-cerrada` | rechazada 26/9 en 4.26.49, antes de la APK 51 |

Cada promoción web movía esas tandas de versión (4.26.60 → 66 → 67 → 68) con el **mismo texto**. Panel y `npm run listo` casaban el parte por `versión/id` exacto: tras cada traslado, «sin probar».

Comprobado en el historial de `src/data/release-notes.json`: el texto de las cinco es idéntico desde su primera aparición hasta 4.26.68.

## Contrato nuevo

- **Identidad = huella**: `betaHuella(id, título, pasos en castellano, rev)`, FNV-1a de 8 hex.
  - Mover una tanda no cambia la huella.
  - Cambiar el guion o subir `rev` sí la cambia. `rev` es para un cambio de código con el mismo guion.
- **Casado** (`betaVerdictFor`, igual en panel y `listo`): el parte **más reciente** que aplica.
  - Si el parte tiene huella, solo vale para la misma revisión.
  - Si no la tiene (partes antiguos), vale el id exacto o un alias `desde`.
  - El último rechazo veta la aprobación anterior.
- **Alias auditados**: `desde:["4.26.67/<id>"]` y `huella` fijada en las cinco nativas.
  - Si el guion cambia, el alias deja de valer solo.
  - `beta-veredictos` falla hasta que se retire.
  - Solo puede apuntar a la misma tanda (mismo id corto).
- **Entrega**: `apk: 51` en las cinco nativas. Siguen en la ronda hasta que el `apk.json` de Pages (APK estable) llegue a 51, aunque la web de producción las adelante. Sin dato, pendientes. Aprobar no es publicar: el veredicto no saca nada del panel.

## Evidencia

- `listo` con datos reales (APK estable 48, producción 4.26.67): las cinco salen **aprobadas**. Cada una con «veredicto de 4.26.67/<id>, mismo contenido» y «pendiente de entrega: la APK estable no llega a 51». Recibos sigue ⛔ y el resto igual.
- `tests/beta-veredictos.test.mjs`: 13 casos. Sin el cambio de `src/` caen 10 de los 12 originales.
  - Traslado.
  - Revisión nueva.
  - Rechazo posterior.
  - Alias con huella caducada.
  - Web por delante con APK atrasada.
  - Sin dato de APK.
  - Entrega completa.
  - Aprobar no es publicar.
  - Datos reales de 4.26.68.
  - Auditoría de alias.
  - Filtro del parte.
  - «Cambiar de opinión» retira la aprobación anterior.
- `beta-tandas-vacias`: «producción al día → cero» ahora exige también la APK al día. Con la APK atrasada solo quedan tandas con `apk`.
- `e2e/revisar-beta.spec.mjs`: dos pruebas nuevas en el DOM.
  - Aprobadas en 4.26.67 salen «aprobada» en 4.26.68.
  - La web en 4.26.69 con APK 48 retira «Ayuda de Mi ciclo» pero no las nativas.
  - Las dos caen con `src/modules` de beta 96b9210b.

## Límites

- `rev` depende de quien corrige: si se cambia el código de una tanda sin tocar su guion y sin subir `rev`, hereda la aprobación. Queda escrito en `docs/TESTING.md` y `EMPIEZA-AQUI.md`.
- Las cinco nativas se marcan `apk: 51` siguiendo el encargo. `tr-descripcion-clasificacion` es sobre todo servidor (`bank-sync` ya desplegado) y cliente; si no dependiera de la APK, basta con quitarle `apk`.
- Presupuesto: +474 B gzip medidos (344.373 B) → tope 337 KiB; +1 KiB crudo.
- Sin Edge, SQL, APK ni workflows.
