<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (rechazo-anterior-al-arreglo.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: rechazo-anterior-al-arreglo
description: "⚠ Antes de re-diagnosticar algo que él rechazó, comparar la HORA del rechazo con la del arreglo. El 10/9 rechazó modo inicial a las 07:48 (4.19.22.1) y el arreglo entró a las 17:45 (4.19.26): nunca probó la versión buena, y yo le dije «lo di por arreglado y NO lo está», que era falso."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b6deade9-918e-4072-8b0e-1d259d1e48ca
  modified: 2026-09-11T00:59:23.904Z
---

**Un veredicto suyo es una foto de UNA compilación, no del estado de hoy.** `errores.mjs` da la
versión y la hora de cada rechazo. Antes de tocar nada:

```
node scripts/errores.mjs --kind=beta --json   →  {"tanda":"…","version":"4.19.22.1","created_at":"…"}
git log --format="%h %ad %s" --date=format:"%d/%m %H:%M" <rama-del-arreglo>
```

Si el arreglo es POSTERIOR al rechazo, lo que hay no es un bug vivo: es una versión que él no ha
probado. Eso cambia el trabajo entero — no hay que arreglar nada, hay que **verificarlo y decírselo**.

**El 10/9 esto me pasó con cuatro de sus cinco rechazos a la vez.** Rechazó por la mañana en la
4.19.22.1; los arreglos entraron esa misma tarde en la 4.19.26 y la 4.19.27. Yo le dije en su cara
*«el reset a 0 lo di por arreglado y no lo está»* — y era **mentira mía**, dicha por no mirar la hora.
Él ya estaba quemado; darle por bueno su cabreo sin comprobarlo no es humildad, es otra forma de no
mirar. Ver [[feedback-no-dar-por-hecho]].

**Verificar ≠ leer el diff.** Lo de modo inicial lo cerré ejecutándolo en el navegador contra su
escenario real (banco de pruebas YA usado, con gastos dentro — que es el caso que fallaba), con
recarga de verdad para que corriera el `pagehide`, y mirando las DOS mitades del estado partido
(`micartera_sandbox` y `micartera_sandbox_exp`). Y comprobando lo que de verdad importa: **que su
cartera real quedara intacta** (40 gastos, 500 €) en los tres caminos. Ver [[feedback-de-uno-en-uno]].

**Cómo contárselo:** no «ya estaba arreglado» (suena a que se equivocó él). Se le dice qué versión
probó, qué versión lo arregla, y qué tiene que tocar para comprobarlo.
