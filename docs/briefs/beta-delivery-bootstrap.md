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

Verificación local: los cinco contratos beta-sources pasan; todos los pasos Node del runner se ejecutaron en 14,3 s. Solo falla memoria-espejo (10 fuentes locales externas desalineadas, previo al cambio). Deno no instalado; Chromium omitido por coordinación, no se declara suite completa. El PR dispara Tests completo en CI contra main: los posibles fallos de reloj ya existentes los corrige el coordinador en su tanda separada. La publicación exige GO de Claude sobre SHA exacto, CI y gate explícito del coordinador; no se ha fusionado ni desplegado.
