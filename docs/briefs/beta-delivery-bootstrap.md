# OPS-3009-03 · bootstrap del recibo de entrega web

Base exacta: main 12884f48107b82ffc8592c51180f2074a8546139, versión 4.26.67. El panel 4.26.75 queda en su rama independiente y no se acredita como entregado. Este PR añade un recibo de las fuentes web presentes: un número de versión no demuestra por sí solo qué revisión fue publicada. El código de la app, VERSION, paquetes, APK y Edge permanecen intactos.

A/B del build antes/después (SHA-256, bytes idénticos):

| Artefacto | SHA-256 |
|---|---|
| public/index.html | 613e596d471b62bb86bbf441923e7d32bb41e4426dd6b5a36409a4a967f62476 |
| public/i18n/en.json | e3642f7f4210ea643710d794a58558ba8dd41c8884ef53521d9d54008bc12dd7 |
| public/i18n/ca.json | a6ad92aa6542eb83dad4b3e8de0925127a8079490aa034c90d84c983e8f7a50c |
| public/release-notes.json | b14d98862b96b673b0aa5cf5af178fd260ca3d551410e9dc0f3d53f31a0450af |

El recibo local tiene sourceSha=null; el build de CI usa GITHUB_SHA. En esta base solo aparece inc-2709-01-arranque-red con digest a36616fb7c1f5520fe96d0384f3c73585762eb6805b9f4aef1897bb76a17889e: es diferente al aprobado en 4.26.69.1. Las funciones futuras ausentes se omiten. Ningún recibo acredita APK ni Edge. Una tanda moderna sin alcance o cualquier marcador ambiguo aborta.

Verificación inicial 5172cb4a: los cinco contratos beta-sources y el A/B pasaron. Claude dio GO exacto al bootstrap y al panel 483e8874 el 30/9 a las 23:02:59 UTC (1/10 01:02:59 Madrid). CI36788239594 falló antes de E2E por cuatro fixtures dependientes del mes actual, también reproducidas en main. Ese GO corresponde al candidato inicial; el nuevo injerto necesita revisión exacta propia.

Injerto de tests autorizado el 1/10: cuatro diffs Node de e01c75fb→e956cce1 y trece archivos E2E de e956cce1→3170a9aa (doce suites y fixtures.mjs), aplicados como parches sobre main. No se copiaron archivos completos de Recibos ni los dos escenarios de Inicio exclusivos de beta. Node usa mock.timers Date con fecha fija; el helper del navegador desplaza NativeDate a FIXTURE_NOW y conserva el avance del reloj real. No modifica requestAnimationFrame, performance ni temporizadores. Las suites con reloj propio usan own-clock para evitar que el helper lo sobrescriba. Se verificaron intactas todas las líneas de aserción; permanecen los importes, estados y expectativas originales de main.

Runner Node completo UTC tras el injerto: 14,1 s; los cuatro rojos previos pasan y solo falla memoria-espejo (10 fuentes externas locales, previo al cambio). Deno ausente; Chromium local omitido por coordinación. El A/B del build conserva los cuatro hashes de arriba. El diff contra main sigue vacío en módulos, shell, VERSION, paquetes, Android, Supabase, HTML, idiomas, notas, SW fuente, sellador y workflows. Se congela para CI completo del PR y GO de Claude sobre su nuevo SHA; no se declara todavía verde remoto ni entrega.

A/B de empaquetado con sello común controlado 4.26.67: todos los archivos public existentes resultan idénticos después de build, sellado y minificación; index minificado SHA-256 107472e5e2cfbb93798163086eca48f4eaac3d083a5bdd4373d58d58e23645ee. Única adición: beta-delivery.json. VERSION y paquetes idénticos. En el despliegue real cambia el SHA/fecha del sello del SW y el sidecar cambia la huella global y el ZIP; puede activar una señal de actualización PWA aunque no suba el número OTA. El sellador, el cálculo de huella y los workflows no se alteran para esconder ese efecto.

El coordinador mantiene el gate de main retenido por ese efecto real del despliegue. El bootstrap no es un requisito automático para publicar beta75: puede continuar pendiente de entrega hasta una promoción de tooling explícitamente aprobada. No fusionar ni desplegar sin GO exacto, CI y gate.
