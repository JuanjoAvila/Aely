# Aely — Brand & UI brief (para Cursor / Claude / Codex)

Úsalo como fuente de verdad para rebrandear la app actual **Aely** → **Aely**.
No inventes otra identidad: aplica exactamente esto.

## Producto
- App Android de **control de gastos y presupuesto**
- Nombre de marca: **Aely**
- Sustituye todas las apariciones de "Aely" por **Aely** (UI, títulos, strings, metadata)

## Identidad visual (decidida)

### Estilo general
- **Dark-first**, vibe premium calmado (no banco frío, no cute/mascota)
- Sin mascota / monito en icono ni splash
- Vía media: **símbolo con personalidad + tipografía**

### Logo / icono (definitivo)
- Concepto: **A-Dot Badge**
- Descripción: letra **A** geométrica en menta; el travesaño es un **punto** circular; dentro de un **marco** rounded-square (badge)
- Color del símbolo: menta `#6CC688` sobre fondo oscuro forestal
- Archivo de referencia: `aely-icon-adot-badge.png`

### Wordmark (definitivo)
- Estilo: **Lockup** = icono A-Dot Badge + texto "Aely" a la derecha
- Tipografía del nombre: sans geométrica moderna (Inter / Plus Jakarta Sans / similar)
- Color del texto en header: blanco / off-white `#E8EEEC`
- Archivo de referencia: `aely-wordmark-lockup.png`
- Usar el lockup en el header del onboarding (donde ahora está el logo + "Aely")

## Paleta (tokens)

Anclada a la UI actual dark mint:

| Token | Hex | Uso |
|-------|-----|-----|
| `bg` | `#0B140F` | Fondo principal |
| `surface` | `#132119` | Cards / superficies |
| `accent` | `#6CC688` | CTAs, logo, bullets activos, links |
| `text` | `#FFFFFF` | Títulos / texto principal |
| `textMuted` | `#A7B3AD` | Texto secundario (aprox. gris suave legible) |
| `border` | `#1C2A22` | Bordes sutiles de cards |
| `danger` | `#E85D4C` | Alertas de gasto (no usar coral como acento de marca) |
| `success` | `#2BB673` | Éxito / ahorro |

### Tipografía
- Saludos / headlines editoriales (ej. "Bienvenido/a"): **serif moderna**
- UI, botones, body: **sans geométrica**
- Botones: pill (border-radius muy alto)

## Qué implementar ahora (checklist)
1. Renombrar marca Aely → Aely en strings/UI
2. Sustituir logo header por lockup Aely (badge + wordmark)
3. Icono de app / splash alineado a A-Dot Badge
4. Mantener layout y copy structure del onboarding; solo rebrand + ajustes de color si hace falta para tokens arriba
5. No añadir mascota

## Onboarding (referencia de aire)
Pantalla de bienvenida dark:
- Logo lockup arriba
- Headline serif tipo "Bienvenido/a"
- Cards de features con iconos
- CTA primario menta "Empezar"
- Secundario "Iniciar sesión"
- Paginación con dot activo en menta

## Play Store (cuando toque)
- Título app: `Aely: control de gastos` (o `Aely: presupuesto y gastos`)
- Short description (borrador): `Controla gastos e ingresos. Presupuesto mensual claro, sin bancos.`

## Instrucción para el agente de código
Aplica el rebrand de forma consistente en toda la app. Si falta un asset vectorial, usa los PNG de referencia y/o recrea el A-Dot Badge en vector (SVG/Compose/XML) fiel al concepto. Pregunta solo si hay ambigüedad real de producto; no redesign espontáneo.
