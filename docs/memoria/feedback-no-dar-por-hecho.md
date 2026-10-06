> Vigencia: esta memoria conserva hechos históricos. Para trabajo actual prevalecen AGENTS.md y docs/COORDINACION-AGENTES.md de codex/coordinacion. Claude local está cerrado: no reactivar vigías, buzón ni relevos locales. La rutina Cloud solo ejecuta encargos con reserva propia confirmada.

<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (feedback-no-dar-por-hecho.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: feedback-no-dar-por-hecho
description: "⚠ No afirmar que algo está cubierto/verificado/subido sin haber VISTO la evidencia. Un grep vacío es un hallazgo. Una tabla de estado es una AFIRMACIÓN: en el disco ≠ en beta. Y usar a Cursor de contraste: él paga las dos."
metadata: 
  node_type: memory
  type: feedback
  modified: 2026-08-17T19:47:11.104Z
---

**El fallo (2026-08-17, el que más le quemó de la sesión).** Escribí `tests/widget-coherente.test.mjs`
y `tests/ob-renombrar.test.mjs`, los ejecuté a mano, pasaron — y los presenté como cubiertos por el
CI. **Nunca los añadí a `steps` en `scripts/run-tests.mjs`**, que es una lista a mano: `npm test` y
Actions no los ejecutaron jamás. Dos guardianes de bugs de dinero (el widget que se contradecía, el
gasto duplicado al renombrar) publicados en beta **dormidos**, con el verde de Actions diciendo que
vigilaban. Lo pilló **Cursor**, no yo.

**Y lo peor: tenía la prueba delante.** Filtré el log de la suite buscando
`ob-renombrar|widget-coherente|gastos-cajones` y no devolvió nada. Leí «138 verdes» y seguí. Ese
vacío ERA la respuesta.

**Why:** sus palabras — «esto no puede pasar nunca más, no des algo por hecho cuando no lo esté, ya
me lo has hecho más de una vez… y menos mal que le pregunté porque no me fío ni un pelo». Cuando lo
que se afirma es «esto está protegido», equivocarse es peor que no decir nada: retira la
desconfianza sana que le habría hecho comprobarlo.

**How to apply:**

1. **Antes de decir «verificado» o «lo cubre el CI», enseñar la evidencia:** el nombre del test en
   la salida del runner y el código de salida real. `npm test | tail` **no** da el código de salida
   (lo da el `tail`): redirigir a fichero y leer `$?`.
2. **Un `grep` que vuelve vacío cuando esperabas algo es un HALLAZGO.** Pararse ahí.
3. **Test nuevo → `steps` en `scripts/run-tests.mjs`.** Desde el 17/8 el runner **aborta** si
   encuentra un `tests/*.test.mjs` que nadie ejecuta (verificado plantando un huérfano de mentira),
   y la norma está en `AGENTS.md` §3 bis.
4. **Usar a Cursor de contraste a propósito**, no esperar a que le pille los fallos de rebote: él
   paga las dos y quiere que se aprovechen. Ver [[feedback-traspaso-a-cursor]] — en bugs duros
   Cursor me ha superado más de una vez.
5. **Una tabla de estado, un plan o un ROADMAP son AFIRMACIONES** — segunda vez el mismo día
   (17/8 noche): la tanda 3+4 se pintó como «EN 4.18.0 beta» estando solo en el working tree, sin
   commit y sin push. Norma de Cursor en `.cursor/rules/no-afirmar-sin-comprobar.mdc` +
   `EMPIEZA-AQUI.md`. **Cuatro escalones, y no se colapsan:** disco → `origin/beta` tiene el commit
   → `beta.yml` publicó `version.json` de ESA versión → `main`/Pages. Si solo está en el disco se
   dice **«en el working tree, sin commit»**, nunca disfrazado de canal. ⚠ Matiz mío: **push OK ≠
   CI OK** — el commit puede estar en `origin/beta` con `beta.yml` caído, y entonces su móvil sigue
   con lo viejo. Comprobar `gh run list --branch beta` antes de decir «lo puedes bajar».

⚠ **27/9: «privacidad PASS» también es mirar IMPORTES.** Di PASS a unos briefs de Codex buscando solo rutas/correos/tokens y se publicó en beta (repo público) el «Gastado [comparación omitida]» real del dueño. En cada revisión de docs: grep de cifras con decimales/€ y de números que aparezcan en su relato; si no son de fixture, fuera.
