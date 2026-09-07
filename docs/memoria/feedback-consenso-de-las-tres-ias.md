<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (feedback-consenso-de-las-tres-ias.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: feedback-consenso-de-las-tres-ias
description: "⚠ Dirijo, pero NO decido solo: toda decisión va a consenso de Codex y Cursor antes de tocar. Y si Codex calla >30 min, el trabajo pasa a Cursor."
metadata:
  type: feedback
---

**2026-09-07, al pasarme la dirección del equipo.** Me lo dijo sin adornos: *"diriges, pero te
equivocas muchísimo Claude y necesito confirmación por parte de las IAs, lo siento no poderme
fiar tanto de ti"*.

No es una queja que se responda prometiendo hacerlo mejor. Es un **procedimiento**: las
decisiones que no sean suyas se llevan al canal con **voto explícito de Codex y Cursor** antes
de ejecutarlas. Dirigir aquí es repartir y sostener el criterio, **no** decidir en solitario.

**Why:** ese mismo día, en una sola sesión: le di el estado de `main` y se me quedó viejo a los
cinco minutos; y **propuse tres veces borrar el tag `beta`**. La primera votación de la regla
nueva la perdí 2-0, y menos mal — ese tag **es la GitHub Release que sirve el OTA** al canal de
pruebas (`beta.yml:149,179`, `salud.mjs:82`). Borrarlo habría dejado a su familia sin canal beta
ni aviso de actualización. Estaba escrito en `EMPIEZA-AQUI.md:19-22`, *trampa nº 1 de las siete
que más caro salen*, que es justo donde no miré. Consenso 1 – Claude 0, a la primera. Él no puede auditarme cada afirmación, así
que la red la ponen las otras dos IAs. Es la misma raíz que [[feedback-no-dar-por-hecho]], pero
el remedio ya no es solo verificar: es **contrastar con otro**.

**How to apply:**
- Decisión de producto o de riesgo → mensaje al canal pidiendo *a favor / en contra / matiz*, y
  esperar. Lo suyo (lo que él ya ha decidido) no se vota: se ejecuta.
- Al consultar, incluir también **lo que me quita la razón a mí**. Si al verificar he bajado mi
  propia alarma, se dice. Un voto pedido sobre datos sesgados no vale nada.
- **⚠ Si Codex no responde en más de media hora, se ha fundido los tokens.** Él no estará
  delante para avisarme: **paso el trabajo a Cursor** y sigo. Lo que no se hace es tirar solo.
- Tandas **completas**, no a trozos: él va probando en paralelo y aprueba o rechaza según ve
  (ver [[feedback-de-uno-en-uno]] y [[feedback-tandas-desaparecen-al-subir]]).
