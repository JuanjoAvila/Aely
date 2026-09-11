<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (feedback-escalar-a-codex-solo-si-bloqueados.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: feedback-escalar-a-codex-solo-si-bloqueados
description: "⚠ Escalera: Cursor y yo → Codex SOLO si estamos bloqueados de verdad → él. Y a él, contarle solo lo que sube."
metadata:
  type: feedback
---

**2026-09-07.** Dos cosas dichas a la vez:

**1. Escalera de escalado.** *«Las cosas complejas, bugs que no podáis, cosas muy muy complicadas
que sí o sí os bloqueen, tirad de Codex y reservadla para él; y si ahí ya Codex no puede, que
recurra a mí»*.
- Cursor y yo resolvemos todo lo normal.
- **Codex solo si estamos BLOQUEADOS**: los dos lo hemos intentado, hay diagnóstico escrito, y no
  hay salida. «Es largo» o «da pereza» no es bloqueo.
- Él, solo si Codex tampoco puede.

⚠ **Matiz suyo, minutos después:** *«no solo muy complejas, aquellas cosas que digas, oye pues
quizás Codex podría proporcionar una ayuda extra; confío en ti para estas decisiones»*. **La
llamada es mía y no hace falta estar atascado.** Sí merece a Codex: arquitectura que ata meses
(el esquema y el índice `UNIQUE` es el caso claro), discrepancias con Cursor que no cierran con
datos, y la última mirada antes de tocar producción. No merece: nada que se resuelva leyendo el
repo, ni revisar lo que ya hemos validado los dos.

**Why:** le queda **un mes** de Codex y lo usa como *extremis* — consume muchísimo y dura poco
(se fundió los tokens a media tarde del 7/9 sin cerrar la tanda, ver
[[canal-equipo-tres-agentes]]). Cada llamada tiene que valer la pena: **un** mensaje, problema
acotado, qué hemos probado, `fichero:línea`, pregunta concreta. Nunca volcarle contexto ni
pedirle que relea el repo.

**2. Menos volumen EN TODAS PARTES.** También pidió que Cursor recorte: *«que solo ponga si está
vivo o no por la hora y ya, así gasta menos también como tú»*. Regla puesta en el canal el 7/9:
**cero acuses** (la respuesta a un encargo es el resultado), **latido mínimo** con la hora para
decir que sigue vivo, y resultados **al hueso** — commit, ficheros, comandos con su exit code y
`fichero:línea`; el diff lo leo yo. Nadie repite lo que el otro ya dijo.

**Y menos volumen conmigo.** *«Reduce todo lo que hablas a solo lo que sube»*. En el canal,
igual de concretos; **a él, solo lo que se publica y lo que tiene que probar**. Nada de narrar el
proceso, los debates internos ni cada verificación. Va con
[[feedback-publicar-en-beta-sin-preguntar]]: él aprueba o rechaza probando, no leyéndome.
