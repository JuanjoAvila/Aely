<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (feedback-el-ojo-suyo-gana-a-mis-medidas.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: feedback-el-ojo-suyo-gana-a-mis-medidas
description: "Si él dice que lo ve y mi medida sale perfecta, el que está mal es el instrumento — y hay que medir el gesto LENTO, no solo el rápido (10/9/2026, UX-01)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b6deade9-918e-4072-8b0e-1d259d1e48ca
  modified: 2026-09-10T19:22:06.302Z
---

**Cuando él dice que ve algo y mis números salen impecables, el que está equivocado soy yo.**
El 10 de septiembre de 2026 pasó **dos veces en la misma tarde**, con el tironcillo al pasar de
pestaña (UX-01), y las dos veces su ojo llegó antes que mis instrumentos:

1. Medí deltas de `rAF` en su móvil con su dedo: **6.046 frames, ni uno por encima de 16,7 ms,
   cero longtasks**. 120 Hz clavados. Y él: «igualmente yo lo veia y reproducia...». Tenía razón:
   el fallo no era un frame perdido, así que `rAF` no podía distinguir su caso bueno del malo.
   Cambiando a `layout-shift` con `sources` apareció al momento: **44 px de salto** en la mitad de
   los cambios de pestaña.
2. Con eso arreglado y verificado (7 saltos → 0), lo probó: «sigue igual, una
   pequeñiiiiiiiiiiisiima mejora, pero sigo notando el tironcillo». Y otra vez tenía razón: faltaba
   la otra mitad.

## La regla que sale de aquí, y es la que más caro sale olvidar

**MEDIR EL GESTO LENTO, NO SOLO EL RÁPIDO.** Todos mis arrastres eran de 200 ms. Su frase —
«si desplazas fluido no se nota apenas, **es ir lento** y ahí se nota el tirón, no va super
smooth»— valió más que seis horas de instrumentación. Arrastrando despacio salió el patrón:

```
-0,24  -0,25  -0,25  0  -0,25  0  -0,24  0  -0,25  0  -0,25  0 …
```

Un frame sí y otro no. A 0,25 px por frame eso es un temblor visible; a 3 px por frame no se ve
nada. **Un fallo puede vivir entero en el rango de velocidad que no estás probando.**

## Cómo trabajar con esto

- Su «yo lo veo» es un dato, no una impresión. No se contesta con una tabla de números.
- Antes de dar algo por medido: **¿este instrumento distingue su caso bueno de su caso malo?** Si
  con el fallo puesto sale verde, el instrumento no vale ([[depurar-webview-en-su-movil]]).
- Preguntarle **la velocidad y el gesto exacto**, no solo el gesto — hermano de
  [[feedback-scrollear-puede-ser-entre-pestanas]], donde lo que faltaba era «entre pestañas».
- Y decírselo yo primero cuando mis medidas no encuentran lo que él ve. «El que mide mal soy yo»
  ahorra la discusión entera.
