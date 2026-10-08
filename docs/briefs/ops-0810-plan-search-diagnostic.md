# Plan: evidencia del vaciado del buscador · 8/10/2026

Estado: diagnóstico de test preparado sobre `a4d0128199e496bba181edd4cfc661ed5b8407c3`;
requiere revisión y CI exacta. No cambia producto ni corrige el fallo intermitente.

La [CI 37719554158](https://github.com/JuanjoAvila/Aely/actions/runs/37719554158)
agotó 60 s esperando «Servicios y suministros» después de vaciar el buscador en
`plan-gestionar`. El mismo caso pasó al reintento. No había artefactos oficiales
descargables con foco/valor/eventos de la pasada fallida. La programación del foco
al título mediante rAF es una hipótesis; no queda acreditada como causa.

El único caso de búsqueda inexistente/nombre largo activa un registro acotado de
`focusin`, `input` y `change`: máximo 64 eventos y contador de los omitidos. Añade
cuatro instantáneas: tras escribir `zzzz`, antes y después del vaciado, y antes del
clic al grupo. Un hook `afterEach` captura el estado final incluso si el caso falla
y emite un único `PLAN_SEARCH_DIAGNOSTIC` con SHA y estado de la pasada. Ese hook
no consulta las páginas de otros casos. Los listeners y el global se retiran al
capturar; si la página ya no responde, la captura se declara `unavailable` en un
máximo de un segundo, sin extender el plazo del test. La página del caso se
destruye en el teardown normal de Playwright; ningún observador pasa a otra página.

Los valores se reducen a `empty`/`zzzz`/`other` y longitud. Sólo salen tags, clases
del código mediante lista cerrada, foco y contadores de buscadores/grupos/resultados
vacíos. No se emiten textos de inputs, almacenamiento, nombres, datos financieros,
URLs ni mensajes de error. Las sondas son listeners pasivos, sin lecturas por frame,
sin cambios de foco, sin estilos y sin esperar una condición nueva.

Se conservan todas las operaciones, selectores, aserciones de texto/ancho, tiempos
y retries originales. Las consultas añadidas al navegador pueden cambiar el orden
temporal de una carrera: una pasada verde con diagnóstico no demuestra que el fallo
desapareciera. En un fallo, el registro ayuda a separar ausencia del evento de vaciado,
foco desplazado y valor vacío con grupos todavía ausentes. Ninguna de esas señales
autoriza por sí sola un cambio de producto; habrá que reproducir la causa.

Comprobación Node del código del diagnóstico con DOM sintético: límite de eventos,
contador de omitidos, valor sin texto bruto, estado final/foco, retirada de listeners
y ausencia de sondeo en otros casos. Sintaxis, mapa de suites, privacidad y diff
comprobados. Chromium no está disponible localmente: DOM y CI de este SHA pendientes.
La corrección separada del fixture mensual de Metas no se modifica en esta rama.
