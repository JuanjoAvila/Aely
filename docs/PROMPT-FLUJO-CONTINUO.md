# Prompt de continuidad autónoma · 28 de septiembre de 2026

Autorización del dueño: al terminar una tarea, abre tú mismo un chat nuevo de este proyecto con
un prompt operativo para la siguiente. No esperes a que él escriba «dale». El flujo se mantiene
hasta que pida pararlo o no quede trabajo independiente. **Una tarea, un objetivo por chat**:
cerrar y documentar la actual antes de crear la siguiente. No crear varios chats a la vez ni un
monitor periódico; el relevo ocurre al cerrar cada tarea.

## Prompt para cada chat nuevo

> Continúa Aely/MiCartera de forma autónoma. El dueño autorizó el 28/9/2026 un relevo automático
> entre chats y la publicación **selectiva** de las tandas que él haya aprobado en su móvil o
> expresamente en el chat. Lee completos `AGENTS.md`, `EMPIEZA-AQUI.md`,
> `docs/PROMPT-FLUJO-CONTINUO.md`, `docs/BACKLOG.md`, `docs/TESTING.md` y el relevo más reciente.
> Comprueba el estado actual de ramas, PR, Actions, manifiestos beta/producción y APK; las fotos
> de ayer no prueban qué sirve hoy. Trabaja en un worktree aislado y deja intacto el checkout
> compartido y todo trabajo ajeno.
>
> **Primera decisión:** ejecuta `npm run listo` en un checkout cuya fuente corresponda a la beta
> efectiva. Lee solo los veredictos necesarios y crúzalos por ID, versión, fecha y contenido
> exacto de la tanda con la beta instalada y el backlog. El script es orientativo: puede no ver
> una tanda si su entrada se trasladó a otra versión, si falta el secreto local o si cambió la
> fuente del canal. Un verde de CI, un PR, un «sin errores» o una aprobación de otra tanda no son
> aprobación. Si hay una o varias tandas **inequívocamente aprobadas y publicables**, la única
> tarea de este chat es preparar y ejecutar su promoción selectiva: candidato revisable, alcance
> exacto, revisión real de Claude sobre el SHA final cuando corresponda, tests, CI, diff de merge,
> manifiesto, bundle y service worker activos. La autorización del dueño de hoy permite ejecutar
> esa promoción sin pedir otro «dale», siempre que cada tanda concreta ya tenga su OK. Quita del
> panel solo las tandas efectivamente publicadas y conserva las pendientes en beta. Nunca mezcles
> por comodidad toda la beta, especialmente FIN-05, selector y Trade Republic mientras falte su
> validación por pago real. Si una tanda aprobada está mezclada o no es separable con seguridad,
> documenta el bloqueo y pasa a una tarea independiente; no fuerces un cherry-pick incierto.
>
> Si no hay aprobación nueva verificable, elige **un** objetivo pendiente de mayor prioridad de
> `docs/BACKLOG.md` y resuélvelo hasta beta con pruebas pertinentes, revisión y evidencia de
> publicación. El primer candidato del corte 27/9 es el crash de Cuotas de deuda (INC-2709-04);
> después, la incoherencia Inicio/Gastos/nómina (INC-2709-05) y los cargos CaixaBank ausentes
> (INC-2709-06). Revalida la prioridad y el estado antes de actuar. No declares cerrado un fallo
> financiero que exige una compra real hasta que el dueño la haya probado. Nunca inventes datos,
> repares filas reales, migres historia ni despliegues funciones/SQL compartidos por arrastre del
> cliente: aplica la autorización y verificación específicas de cada operación.
>
> Al cerrar, actualiza el estado en el repo con SHA, pruebas, canal realmente activo, límites y
> siguiente objetivo. Abre automáticamente **un** chat nuevo de este proyecto con un prompt
> autocontenido: primero repetirá la comprobación de aprobaciones; después elegirá el siguiente
> objetivo. Espera a que el nuevo chat arranque, enlázalo en tu cierre y no desarrolles aquí su
> tarea. Si hay un bloqueo, consérvalo y elige otra tarea independiente; si no existe ninguna o
> el dueño pide parar, termina sin crear otro chat.

`npm run listo` no publica nada y puede quedar desactualizado respecto a la beta servida. Para
promociones parciales, seguir [el contrato de tandas](TESTING.md#cómo-se-sube-solo-lo-aprobado)
y verificar que la candidata excluye todo lo no aprobado. El permiso general de continuidad no
convierte una beta pendiente en aprobada ni sustituye las comprobaciones de producción.
