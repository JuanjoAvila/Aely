# Volcado para el Claude personal de Juanjo — 12 de septiembre de 2026

Esto está escrito para **una sesión que NO tiene la memoria del Claude Code del PC**. Todo lo que
necesitas está en el repo; aquí va dónde y en qué orden.

> **Regla cero, y la que más caro sale saltarse:** no te fíes de ningún documento, incluido este.
> Antes de afirmar nada del estado, ejecuta `npm run salud`. Un documento envejece en horas.

---

## 1. LOS TRES COMANDOS CON LOS QUE SE EMPIEZA SIEMPRE

```bash
npm run salud                        # qué sirve producción y beta AHORA, no lo que dice el repo
node scripts/errores.mjs --kind=beta # sus veredictos: qué ha aprobado y qué ha rechazado
git status                           # puede haber trabajo sin commitear de otra sesión
```

⚠ **`node scripts/errores.mjs --kind=beta` va ANTES de tocar código.** El 1/8 se le entregó un
informe sin mirar dos tandas que él ya había rechazado, y hacerle repetir un fallo es lo que más le
quema.

---

## 2. TODA LA MEMORIA ESTÁ EN EL REPO: `docs/memoria/`

**56 ficheros**, espejo exacto de la memoria del Claude del PC, pasados por un filtro que tacha
datos personales (el repo es público). Empieza por `docs/memoria/MEMORY.md`: es el índice, una línea
por fichero.

Los que más te van a servir, por orden:

| fichero | para qué |
|---|---|
| `panel-beta-solo-lo-probable.md` | cómo se decide qué le pones a probar. **Léelo antes de tocar el panel.** |
| `feedback-no-dar-por-hecho.md` | enseñar el nombre del test y el código de salida REAL |
| `misma-regla-en-dos-sitios.md` | por qué hay que buscar si una fórmula ya existe antes de escribirla |
| `e2e-getbytext-pestanas-premontadas.md` | por qué un selector sin acotar mide la app entera |
| `mi-cartera-backlog-2026-08.md` | **el inventario único**: todo lo pendiente en un sitio |
| `servidor-al-dia-compara-fechas.md` | por qué «13 funciones atrasadas» puede ser mentira |
| `canal-equipo-tres-agentes.md` | cómo se reparte el trabajo con Cursor |

Y `AGENTS.md` en la raíz: las reglas de la casa, que Cursor lee solo.

---

## 3. DÓNDE ESTÁ CADA COSA AHORA MISMO (12/9, madrugada)

| | |
|---|---|
| producción (`main`) | **4.18.25** · APK **4.18.22 (código 45)** |
| beta publicada | **4.19.74.1** — con 22 tandas esperando su veredicto |
| sin subir | nada |

**Su padre y su pareja usan producción.** Nada que él note va a `main` sin pasar antes por `beta` y
su OK — esa norma no se negocia.

---

## 4. CÓMO SE TRABAJA AQUÍ (lo que él ha pedido explícitamente)

1. **De UNO EN UNO.** Nada de tandas paralelas desde el 4/8.
2. **Todo lo que se escribe lo revisa Cursor antes de ir a beta**, y revisar significa EJECUTAR los
   tests, no leer el diff. El canal es `.claude/canal-equipo/` (está fuera de git).
3. **Una tanda terminada y validada se publica y se le avisa**, sin pedirle permiso. Él aprueba o
   rechaza probándola. **Main sí necesita su OK.**
4. **Toda versión publicada lleva su entrada en Novedades**, en los tres idiomas, en cristiano y
   **nunca dirigida a él**: las lee toda la familia.
5. **Menos texto, más trabajo.** Resumen solo cuando lo pida.
6. **Nunca editar ficheros con PowerShell** (`Get-Content|Set-Content` corrompe UTF-8 y mete BOM:
   costó un APK inservible publicado a su familia). Usar las herramientas de edición.
7. Tras escribir en memoria: **`npm run memoria`**, que es lo que la sube al repo.

---

## 5. LO QUE PIDIÓ AL CERRAR ESTA NOCHE — SIN PROBAR TODAVÍA

Lo dijo de un tirón, «sin entrar a probar cosas como tal». Está también en el inventario
(`docs/memoria/mi-cartera-backlog-2026-08.md`, sección **2-QUATER**).

### Bugs
1. **El botón «Editar» de Cartera sigue apareciendo.** Para él es un resto del rediseño de esta
   noche. Está ahí a propósito —es la única puerta a las cuentas EXTRA de Open Banking— pero eso él
   no lo sabe ni tiene por qué. Lo suyo: que solo salga si hay cuentas que promocionar. **Es de una
   línea, y es lo más rápido que se le puede dar.**
2. **Mantener pulsado un banco no lo mueve.** No es un bug: **está sin implementar**, lo lleva
   Cursor. Él ya lo da por prometido.
3. **★ El tironcillo vuelve al abrir Ajustes.** Textual: *«el tironcillo que arreglamos, que costó
   mucho, al scrollear de manera lenta, se reproduce exactamente igual al abrir las settings»*.
   **Hipótesis con base:** misma familia que la barra de abajo — un `setState` a mitad de gesto
   repinta App entera. Se arregló para la barra en 4.19.69/71 aplazando el `setState` hasta soltar
   el dedo (`flushNavHide` en `11-app-main.js`). Mira si Ajustes tiene su equivalente. **Y escribe
   el test ANTES de tocar**: `rendimiento-tabs` ya mide el caso del perfil.

### Extras
4. **Que la app sea más fluida**, con la referencia buena que dio él: *«como cuando se oculta la
   barra»*. Sitios: desplegar categorías del mes, abrir el sheet de apuntar gasto, botones que
   despliegan, entrar en Gastos, y cerrar cualquier ventana. Es una tanda entera.
5. **Temporada de PRIMAVERA y de OTOÑO.** Lo pide su pareja. El mecanismo ya existe.
6. **★ Los 5.303 € del Inicio: que se puedan tocar y ver de dónde salen.** Textual: *«creo que se
   inventa cosas»*. **Esto no es diseño: es que no se fía del número.** Trátalo como tal.
7. **Ficha de una inversión estilo Revolut** (tocar NVIDIA y ver gráfico, compras, ventas). Él ya
   dice que es tarea gorda. Hay posiciones y snapshots (`recordInvSnapshot`), pero **no** hay
   operaciones individuales: mira qué se puede reconstruir de verdad antes de prometer nada.

---

## 6. LO QUE LLEVA CURSOR AHORA MISMO (no se lo pises)

Tiene reservados `src/modules/07-tab-patri-fijos.js` y `src/shell.html`.

1. **Los ingresos que le faltan a su móvil.** Medido: gastos 781,45 € en su móvil y en la nube
   —cuadra al céntimo— pero ingresos **314,22 € en el móvil contra 601,62 € en la nube**. Como su
   presupuesto va en modo «neto» (los ingresos restan), con los ingresos completos la app diría
   **179,83 €**, que es justo lo que él calculó a mano con la calculadora. **No le fallaban las
   mates.** Herramienta: `node scripts/diag-mes.mjs 2026-09`.
2. **El long-press para ordenar las cuentas**, con su condición: *«que se eleve con un efecto chulo
   de movimiento que se note smooth»*.
3. **La ola nativa de Android al llegar al final de una lista**, que sigue abierta.

---

## 7. PENDIENTE DE UNA DECISIÓN SUYA

- **Desplegar las otras 12 Edge Functions.** Solo se desplegó `ingest`, con su OK.
- **Los traspasos internos** que caen en «Otros» (`To Cuenta Remunerada`, `Exchanged to EUR`…).
  **No se tocaron a propósito:** `traspaso` es una categoría neutra y adivinarla por comercio le
  movería totales de meses ya cerrados.
- **Los pasos 1-3 de los Bizums**, que tocan el índice único de `expenses`.
- **Limpieza del repo:** hay **65 worktrees** y **90 ramas locales** acumuladas entre los tres
  agentes. Algunas pueden tener trabajo sin subir, así que **no se borra nada sin preguntarle**.
- **Qué es `NISTAL`**, que le sale 31 veces en 90 días y siempre cae en «Otros». Es el comercio
  donde más gasta sin categoría. **No le inventes una categoría.**

---

## 8. EL TRASPASO LARGO DE ESTA SESIÓN

`docs/briefs/TRASPASO-2026-09-12-MADRUGADA.md` — qué se hizo entre la 4.18.25 y la 4.19.74, y sobre
todo su §3: las cuatro lecciones de método que más caro salieron esa noche, incluidas **dos veces en
que escribí un test que no podía fallar**.
