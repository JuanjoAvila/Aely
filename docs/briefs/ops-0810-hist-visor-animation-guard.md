# Visor del histórico · espera conjunta de clases y opacidad · 8/10/2026

Unidad de pruebas sobre main `70c5d4032f67cb26c07b81fc17f5b8a26f8f10e5`.
Solo se modifica el primer guard de `e2e/hist-visor.spec.mjs`; sin producto ni publicación.

El guard esperaba 60 clases `dentro` y después inspeccionaba inmediatamente la fila 30.
La clase inicia la animación `hojaentra`, que dura 0.34 s con fill-mode both: tener la clase
no demuestra que la opacidad ya supere 0.9. El fallo referido en CI37708273878 observó
opacidades 0.119 y 0.841 en su retry; aquí no se ha ejecutado Chromium ni reproducido ese fallo.

Ahora una única lectura de DOM exige conjuntamente al menos 60 clases y opacidad de la
fila 30 superior a 0.9 dentro del MISMO timeout 8000 ms. Con menos 60 clases o sin fila 30 devuelve 0
para seguir esperando y fallar al agotar el plazo. Después conserva el snapshot y sus dos
aserciones: fila 30 lleva `dentro` y su opacidad supera 0.9. El segundo guard de «Ver N más»
permanece idéntico. No se amplía ningún timeout, no se forza click ni se omite el test.

Verificación independiente de fuente: las reglas `.hist-fila.dentro` y `@keyframes hojaentra`
son exactas en main 70c5 y beta `6b81279676d66337d7b34b7badc6d1ff2c66bc24` (ref beta confirmado
por el conector). SHA256 conjunto `93137f0964ae51f28afd827f0f459b7e84e55b4585d6a36f4f5a5ccd7a72007d`.
La regla sigue `animation:hojaentra .34s cubic-bezier(.32,.72,0,1) both`; from opacity 0,
to opacity 1. No se modifica CSS, la lógica ni los datos financieros.

Comprobaciones locales PASS: sintaxis del spec, mapa/relevant-tests, planificación focal,
discovery 2 tests/1 archivo, privacidad y diff. Chromium local ausente comprobado en este entorno:
DOM ejecutado 0; falta revisión independiente y CI exacta sobre el commit final. Una discovery
verde no acredita la espera de animación. Fixtures sintéticas existentes, sin entradas privadas.
