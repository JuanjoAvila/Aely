# Brief — sugerir la categoría mientras escribes el concepto

**Petición suya (12/9, 13:27, desde la app):** *«en cuanto añadas un gasto, que te salga lo de
sugerir categoría con IA en cuanto añadas el concepto, que no tengas que ir a otros… guardar…
abrir el gasto… y ahí sugerir IA, porque es un coñazo»*.

Estado: **brief, sin código.** Acordado con Cursor (12/9): brief antes de picar.

---

## 1. Cómo está hoy (leído en `main` a5c885ab)

- **Apuntar (+)** (`14-v4-screens.js`, `ApuntarSheet`): la categoría arranca en `super`
  (`useState("super")`) y **no mira el concepto** que escribes. Si no tocas los chips, todo es
  Supermercado.
- **La sugerencia existe, pero escondida:** solo en la ficha de un gasto YA guardado
  (`04-tab-gastos.js` → `suggestAi`). Primero palabras clave locales (`autoCategory`) y, si dan
  «otros», la Edge `categorize` (palabras clave del servidor → LLM acotado a la lista de
  categorías). Solo con el ajuste `settings.aiCat` encendido.
- **`categorize` no tiene limitador** (SEC-02: solo `ingest` y `myinvestor-connect` lo usan) y
  cada llamada al LLM cuesta. Hoy da igual porque se pide a mano y de uno en uno.

## 2. Qué se propone

**Dos niveles, y el caro nunca por tecla:**

1. **Palabras clave locales, al escribir — gratis e instantáneo.** Con ≥3 letras y 400 ms sin
   teclear, `autoCategory(concepto)`. Si da algo que no sea «otros», **se selecciona ese chip**
   y se marca con un ✨ pequeño («sugerida»). Cubre la mayoría: Mercadona, Repsol, Netflix,
   farmacia, Bizum…
2. **IA, solo si las palabras clave no saben (dan «otros") y `aiCat` está encendido.** Con
   900 ms sin teclear, UNA llamada a `categorize`. Si responde con algo útil, **aparece un chip
   «✨ IA: Restaurantes»** junto a los de categoría; un toque lo aplica. No se aplica sola.
   - Se descarta la respuesta si el concepto ha cambiado mientras tanto.
   - Como mucho una llamada por concepto distinto y por apertura de la hoja.

**La regla que no se rompe:** si **tú** tocas un chip de categoría, la sugerencia deja de moverlo.
Lo que eliges a mano manda siempre.

## 3. Lo que tiene que decidir él (una pregunta)

**¿La IA se aplica sola o te la ofrece con un toque?**

- **A — la ofrece (recomendado):** chip «✨ IA: X». Un toque. Nunca guarda una categoría que no
  has visto, y no gasta llamadas si ya sabías cuál querías.
- **B — se aplica sola:** menos toques, pero una IA equivocada se guarda sin que te des cuenta,
  y cada concepto raro es una llamada pagada.

Las palabras clave (nivel 1) se aplican solas en los dos casos: son las mismas que ya usa la app
para los gastos que llegan del banco.

## 4. Antes de picar

- **Limitador en `categorize`** (SEC-02) antes de exponerla al teclado: mismo `_shared/ratelimit.ts`
  que `ingest`. Desplegar va con su OK.
- **Cero cadenas nuevas si se puede:** reutilizar `ai_cat_ok` / `catName`. Si hace falta el
  «sugerida», 3 idiomas.
- **Tests:** unit de la decisión (manual > IA > palabras clave, respuesta vieja descartada) y e2e
  en Apuntar: escribir «Mercadona» → chip Supermercado activo con ✨; tocar otro chip → escribir
  más no lo mueve.
- **Reparto propuesto:** UI de Apuntar = Cursor (14 es su zona hoy); limitador + función pura de
  decisión = Claude.
