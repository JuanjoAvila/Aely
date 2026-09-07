<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (feedback-publicar-en-beta-sin-preguntar.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: feedback-publicar-en-beta-sin-preguntar
description: "⚠ Una tanda terminada y validada se SUBE A BETA sin pedirle permiso. Él solo aprueba o rechaza probándola. Main sigue necesitando su OK."
metadata:
  type: feedback
---

**2026-09-07, con un tirón de orejas:** *«daleeeeeee claude te dije que fueras subiendo a beta las
tandas... solo quiero aprobar o rechazar, el resto lo habláis entre vosotros pero hay que ir
sacando trabajo»*.

Yo había terminado la 4.19.0, la teníamos validada entre Cursor y yo, y me quedé **parado
esperando su permiso** para hacer el commit y el push. Eso no es prudencia, es hacerle de cuello
de botella.

**Why:** él es el único que puede decir si una versión está bien *usándola en su móvil*. Si le
pido permiso para publicar, le estoy pidiendo que apruebe algo que todavía no ha visto — y
mientras tanto el trabajo se para. Su veredicto llega **después** de probar, no antes de subir.

**How to apply:**
- Tanda terminada + validada por las dos IAs → **se publica en beta y se le avisa**, no se le
  pregunta. Se le cuenta qué lleva, qué probar y qué NO se ha probado.
- **⚠ Esto NO toca `main`.** Producción sigue necesitando su OK expreso, y eso no se mueve
  (ver [[feedback-canal-beta-siempre]] y [[promote-cada-cristo]]).
- Lo que sí se le sube siempre son las **decisiones de producto** que cambian lo que él ve —
  como «¿la categoría IA mueve el histórico?» —, no los pasos de fontanería.
- Si la CI de beta sale roja: avisar y mirar el log, nunca republicar encima. Su familia usa ese
  canal.
- Y antes de publicar, mirar que la suite no esté roja **por algo mío**: `memoria-espejo` se pone
  rojo en cuanto escribo memoria y no espejo, y `beta.yml` corre la suite en cada push
  (ver [[canal-equipo-tres-agentes]]).
