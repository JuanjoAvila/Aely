<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (panel-beta-solo-lo-probable.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: panel-beta-solo-lo-probable
description: "El panel «Revisar esta beta» solo puede llevar cosas que él PUEDA probar hoy, con pasos numerados. El 11/9 se había acumulado a 56 tandas y me lo hizo limpiar: fuera lo ya juzgado, lo invisible, lo meta y lo que depende de servidor sin desplegar."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0026af41-cbf3-4394-a3f1-3117babc2995
  modified: 2026-09-11T18:09:27.762Z
---

**Suyo, 11/9/2026 por la noche:** *«actualizarme la lista de cosas que verdaderamente puedo probar,
no me sirve cosas que ya te he dicho por aquí, ni me sirve cosas que sabes 100 % que no podré
probar… y actualizarme las descripciones de paso por paso lo que tengo que hacer para probar las
cosas como si fuera tontico».*

Había **56 tandas** acumuladas desde la 4.19.0. Nadie se lee eso en un móvil. Quedaron **13**.

**Why:** el panel es el único canal por el que él dictamina. Si está lleno de ruido, no lo usa —
y entonces las tandas buenas se quedan sin veredicto y la beta no avanza. Y hacerle re-probar algo
que ya dictaminó es de las cosas que más le queman ([[feedback-leer-sus-veredictos-primero]]).

**How to apply — los cinco filtros, todos comprobables y ninguno «a ojo»:**

1. **Lo que ya tiene veredicto suyo, fuera.** Se leen sus propios eventos:
   `node scripts/errores.mjs --kind=beta --limit=200`. Aprobado o rechazado, da igual: fuera.
2. **Lo que no se ve, fuera.** Si el texto de la tanda dice «no deberías notar nada distinto», eso
   es instrumentación mía (rastros, sondas de diagnóstico), no algo que él pueda juzgar.
3. **Lo meta, fuera.** Nada de pedirle que pruebe el propio panel desde dentro del panel.
4. **Lo que depende de código SIN desplegar, fuera.** `npm run servidor` dice qué Edge Functions
   van por detrás del repo. Si la mitad de la tanda vive ahí, pedirle que la pruebe es pedirle que
   encuentre un fallo mío. Se APARCA, no se borra, y se le dice por qué.
5. **Una saga, una tanda.** Seis rondas de logos o tres del tirón de pestañas se quedan en la del
   estado de HOY.

**Un RECHAZO no vuelve tal cual.** Su arreglo se le devuelve como un paso más dentro de la tanda
que de verdad lo arregla, **citando su frase**. Re-probar la compilación que ya rechazó no vale
para nada. Ver [[rechazo-anterior-al-arreglo]].

**Los pasos, numerados y con la ruta entera**: «1. Cartera → Tus cuentas → Editar…», qué mirar, y
qué significa que esté MAL. El guardián `tests/beta-tandas-vacias.test.mjs` exige que cada punto
empiece por un número.

⚠ **Cómo se quita una tanda:** poniendo `tandas: []` en su versión de `src/data/release-notes.json`.
Borrar la propiedad entera NO es lo mismo: la versión resucita como `<v>/todo` y le vuelve a salir
sin aprobar (su bug del 8/9). El guardián lo clava.

⚠ **Y los guardianes caducan.** `beta-tandas-vacias`, `release-notes-max` y el e2e `revisar-beta`
llevaban congelada la foto del 8/9: daban por «pendientes» tandas que él aprobó el 10/9, y los tres
acusaron de regresión a una limpieza correcta. Un guardián de esto se escribe contra la **forma**
(que nada juzgado vuelva, que la ronda abarque varias versiones), nunca contra una lista de
versiones concretas.

⚠ **CADA VERSIÓN QUE SE PUBLICA A BETA NECESITA AL MENOS UNA TANDA.** El e2e `revisar-beta` pide
que la versión EN CURSO traiga checklist: con `tandas: []` en el tip, el panel se queda mudo y el
test se pone rojo. Me mordió **dos veces el 11/9** (4.19.66 y 4.19.70). Y la salida correcta NO es
inventarse una tanda nueva: cuando la versión solo remata lo de la anterior, **se MUEVE la tanda**
a la versión donde la conducta queda como él la va a probar, y la vieja se queda a cero. Pedirle
dos veces la misma prueba es justo lo que hay que evitar.
