<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (release-notes-recorte-falla-mudo.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: release-notes-recorte-falla-mudo
description: Editar RELEASE_NOTES a mano puede desactivar EN SILENCIO el recorte a 20 versiones y colar +72 KB a toda la familia; ningún test lo caza.
metadata: 
  node_type: memory
  type: project
  originSessionId: cb603bff-19ee-4f94-bbfa-b137c585f4d1
  modified: 2026-09-08T16:25:43.757Z
---

⚠ 2026-09-08. El build recorta `RELEASE_NOTES` a las 20 versiones más nuevas
(`scripts/release-notes-max.mjs`, tanda `notas-20` que él aprobó esa misma mañana). El recorte
**falla mudo**: `extraerLiteralReleaseNotes` / `partirObjetosTop` escanean llaves y corchetes, y
si el array queda **desequilibrado** dejan de ver las entradas, no lanzan error, y el bundle se
lleva **las 95 versiones enteras** (+72 KB para toda la familia). El único síntoma es que
**desaparece la línea `· RELEASE_NOTES: N → 20 (tope 20)` del log del build**. `npm test` pasa
entero: ni `release-notes-max` ni `huella-bundle` lo cazan.

Me pasó cortando tandas con un `str.find('   ],\n')` de Python: `        ],` **contiene** ese
substring, así que el corte se comió media entrada. Lo vi solo porque medí el tamaño del bundle
contra una build limpia de `origin/beta`.

**Cómo tocar RELEASE_NOTES sin romperlo:**
1. Nunca cortar por substring ni por indentación. Usar el parser del propio repo
   (`extraerLiteralReleaseNotes` + `partirObjetosTop`) o un escaneo balanceado propio.
2. Después de editar, comprobar el número de entradas con ese parser (`94 → 95`, no `3`).
3. Y que el build imprime la línea del recorte.

Dos trampas más de esa sesión: `io.open(p,'w')` de Python **trunca antes de escribir**, así que
un `UnicodeEncodeError` a mitad deja el fichero **a 0 bytes** (se recupera con
`git checkout -m -- <fichero>` si estás en medio de un merge, que devuelve los marcadores). Y no
meter `📊` como escapes en una cadena de Python: salen surrogates sueltos que UTF-8 no
puede codificar — pegar el emoji de verdad, o usar la herramienta Edit.

Relacionado: [[feedback-nunca-editar-con-powershell]], [[misma-regla-en-dos-sitios]].
