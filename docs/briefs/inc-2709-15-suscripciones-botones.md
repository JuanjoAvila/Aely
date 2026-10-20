# INC-2709-15 · Acciones de suscripciones en Gastos

Candidata desde `9370565008aa2c4df9fb0588b2bf4f97e2cdc726` (4.26.136),
sin publicación ni aceptación en móvil físico.

En la fila original, nombre, importe y acciones compartían columnas flex estrechas.
Los botones no encogían ni saltaban de línea. A 320 px, con dos comercios sintéticos
de nombres largos y cuotas de 12345,67 y 19,99, el segundo botón terminaba en
x=382,09 aunque la fila terminaba en x=283. Los ancestros lo recortaban y su centro
no recibía el toque. El ROJO se obtuvo antes de editar producto, con captura y DOM.

El cambio usa una cuadrícula local en `SubRow`: nombre y metadatos junto al icono,
importe en su propia línea y acciones con todo el ancho y salto de línea. El campo
de importe dispone de diez caracteres de ancho. Conserva los handlers de alta en
Fijos y descarte, los textos y el detector. No cambia cálculos ni sincronización.

## Prueba focal

`e2e/gastos-suscripciones-movil.spec.mjs`, registrado para `04-tab-gastos.js` en
`scripts/relevant-tests.mjs`, abre Gastos con sesión y red simuladas y reloj fijo.
Comprueba límites de fila/viewport, recorte de ancestros, texto dentro del botón,
solapamiento con el importe y recepción del toque. Casos: 320/es, 360/en, 390/ca y
414/es; cada uno contiene nombre largo con espacios y nombre largo sin espacios.
Los cuatro pasan con un worker y cero retries. Cada caso edita la cuota, la pasa a
Fijos, descarta la otra detección y verifica el estado persistido y los seis gastos.

La primera pasada tras el cambio pasó la geometría pero leyó el disco antes del
debounce de 400 ms: cuatro fallos de arnés conservados. Se corrigió la espera a
persistencia mediante `expect.poll` y `mcLoadRaw`, sin cambiar producto ni relajar
las aserciones. La única repetición de esa pasada pasó 4/4.

Mutación causal: restaurar exclusivamente el módulo original y ensamblarlo vuelve
a fallar el caso 320 por recorte geométrico, con ambos botones presentes. Se restauró
el módulo corregido, verificando su hash y ensamblando de nuevo. Evidencias privadas
con capturas, JSON de geometría e informes; no se incorporan al repositorio público.

No se ejecutó suite general, rendimiento/CPU6, CI, integración, beta, despliegue ni
prueba física. Su aceptación conserva sus propios gates; esta candidata no es ProductREADY.
