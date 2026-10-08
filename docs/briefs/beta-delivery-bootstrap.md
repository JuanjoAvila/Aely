# OPS-3009-03: recibo de entrega web — rescate histórico

> Rescate del 8/10/2026 desde PR92, head `2f045a1e21e55b612b4483e63e9633f7ccf79235`, blob `3738ccf707bee3343511053bc50ae2d6a76e583d`. El experimento fue sobre main `12884f48107b82ffc8592c51180f2074a8546139` /4.26.67. No se repitió el build ni se publicaron sus archivos.

## Evidencia que se perdería al cerrar la PR sin rescate

El bootstrap añadía beta-delivery.json para acreditar qué fuentes web se habían construido. Un número VERSION no demostraba esa revisión. El A/B original conservó bytes de los cuatro archivos preexistentes:

| Archivo | SHA256 histórico antes/después |
|---|---|
| public/index.html | `613e596d471b62bb86bbf441923e7d32bb41e4426dd6b5a36409a4a967f62476` |
| public/i18n/en.json | `e3642f7f4210ea643710d794a58558ba8dd41c8884ef53521d9d54008bc12dd7` |
| public/i18n/ca.json | `a6ad92aa6542eb83dad4b3e8de0925127a8079490aa034c90d84c983e8f7a50c` |
| public/release-notes.json | `b14d98862b96b673b0aa5cf5af178fd260ca3d551410e9dc0f3d53f31a0450af` |

Con sello común controlado, todos los archivos public anteriores continuaban iguales y el index minificado era `107472e5e2cfbb93798163086eca48f4eaac3d083a5bdd4373d58d58e23645ee`. **En una publicación real cambia el sello SHA/fecha del SW y el sidecar modifica la huella global y ZIP**: podía aparecer aviso de actualización PWA aun manteniendo VERSION. No ocultar ese efecto diciendo que “sólo son docs/tooling”.

El build local registraba sourceSha=null; CI empleaba GITHUB_SHA. Las funciones ausentes se omitían y el marcador ambiguo/alcance moderno ausente abortaba. El recibo web no acreditaba APK ni Edge.

## Reloj de fixtures y CI final

La primera CI falló en cuatro fixtures sensibles al cambio de mes, también reproducidas en main. El injerto posterior fijó Date en Node y NativeDate en el navegador, preservando avance del reloj, requestAnimationFrame, performance y temporizadores; own-clock evitaba sobrescribir suites con reloj propio. Conservó las aserciones financieras y no copió los escenarios exclusivos de Inicio de beta.

[CI36790590843](https://github.com/JuanjoAvila/Aely/actions/runs/36790590843) se ha comprobado ahora **completed/SUCCESS**, head2f045a1e exacto. Es el final que faltaba en el texto original; no un GO nuevo para su antigua base. Node local con memoria-espejo externa/Deno ausente y omisión local de Chromium eran límites del experimento, no resultados de esa CI.

En las refs actuales congeladas por la [matriz de rescate](ops-0810-rescate-documental-local26.md), el recibo web y los fixtures tienen continuidad. El [inventario](ops-0810-inventario-rescates-local26.md) conserva el cotejo de artefactos del8/10. Este documento no ordena integrar PR92 ni volver a construir su VERSION67; preserva el A/B, el rojo inicial y el efecto real de reseal.
