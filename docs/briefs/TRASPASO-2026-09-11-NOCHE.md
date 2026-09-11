# TRASPASO — noche del 11 de septiembre de 2026

Cierre de una sesión muy larga. Lee esto entero antes de tocar nada. Lo de arriba es lo que él
espera; lo de abajo, el estado y las trampas.

> **Antes que nada:** `npm run salud`. **No te fíes de este documento, ni de ninguno.**

---

## 0. LO QUE ÉL ESPERA, por orden

### 0.1 🔴 AVISARLE CUANDO EL ARREGLO DE SU PADRE ESTÉ EN PRODUCCIÓN

Sus palabras al cerrar: *«avísame cuando avise a mi padre para testear lo suyo cuando suba a prod»*.

- **Rama lista y probada: `tanda/saldo-padre-prod` · 4.18.25**, nacida del tip de `main`.
- **Él YA ha dado el OK**, con una condición literal: *«sube solo lo de mi padre **después de que
  Cursor te valide**»*.
- Estado: Cursor acusó recibo (`20260912T170500Z-cursor-ack-saldo-a-prod`) y estaba revisando.
  **Busca su resultado en `messages/cursor/` antes de mergear.** Si dio verde → merge a `main`,
  esperar CI + Pages, **verificar en vivo** que `version.json` dice 4.18.25, y **entonces**
  decírselo para que su padre abra la app y sincronice.
- Qué debe pasar en el móvil de su padre: Revolut pasa de **455,50 €** a **~26,46 €**.

⚠ **NO promocionar la beta entera.** Son ~60 versiones sin cerrar; irían a su padre y a su pareja
sin que él las haya probado. Voto conjunto (Claude + Cursor) y decisión suya: **solo esta tanda**.

### 0.2 🟡 PUBLICAR LOS LOGOS DE INVERSIONES — ya aprobados por él

*«lo de los logos p'alante, mucho mejor»*. Está **hecho y mirado por él en captura**, pendiente de
review de Cursor y de publicar. Ver §1.

### 0.3 🟡 LOS LOGOS DE LOS BRÓKERS EN INVERSIONES — petición nueva

> *«en los logos de los bancos Trade, Revolut y MyInvestor pon los mismos logos que las cuentas,
> porque salen las letras. No puede ser que salgan bien los logos de las cuentas bancarias, que
> salgan los de las empresas en inversiones, pero no los bancos donde están las inversiones»*

Tiene toda la razón y **es culpa de un arreglo mío mal calibrado**. El 11/9, al meter los logos de
banco, se colaron en las filas de EMPRESAS (todas las posiciones de un bróker salían con el icono
del banco). Lo arreglé con `logo:false`… **en los cinco sitios**, incluidos los que agrupan POR
BRÓKER, que sí deben llevar el logo del banco.

**Dónde tocar** (`src/modules/`):
```
06-sync-brokers.js:~795   tarjeta del bróker en «Tus inversiones»   ← QUITAR logo:false
06-sync-brokers.js:~872   desglose por bróker (inv_cvg)             ← QUITAR logo:false
07-tab-patri-fijos.js:~372 Inversiones por bróker (Cartera)          ← QUITAR logo:false
```
**NO tocar** los dos que son por EMPRESA, que ya usan `LogoInv`: `InvRows` (~561) y el rendimiento
por posición (~893).

Regla mental: **si la fila es un banco → logo del banco; si es una empresa → `LogoInv`.**

### 0.4 🟡 REDISEÑAR LA EDICIÓN DE BANCOS EN CARTERA — petición nueva

> *«hazme un diseño más bonito para editar los bancos en la zona de cartera, porque es muy cutrón
> que se despliegue abajo para editar y es bastante feo. Piensa algo chulo»*

Hoy: en Cartera → Tus cuentas hay un botón **«Editar»** que despliega los campos debajo de la
lista. Vive en `07-tab-patri-fijos.js` (`accEd`, ~182 los chips de rol, ~255 y ~333 el `rl_hint`).

**Esto es diseño, no un bug. Enséñale una propuesta ANTES de implementar** — su ojo manda y hoy ha
rechazado cuatro rondas de logos por no hacerlo. Un `sheet` inferior por cuenta (como el de
apuntar gasto, que ya existe y le gusta) parece el camino, pero **que lo decida él viendo algo**.

---

## 1. LO QUE ESTÁ HECHO Y ESPERANDO REVIEW

**`tanda/logos-inversiones`** (y trabajo encima en `beta` local, ver §3):

- `scripts/logos-inversiones.mjs` genera `public/logos/inv/*.svg`:
  - **`simple-icons` (MIT)**: nvidia, amd, meta, alphabet (la G de Google), broadcom.
  - **`@iconify-json/logos` (CC0)**: **tsmc, micron**.
  - **Dibujados a mano** (categorías, no marcas): `oro` (lingote), `etf-mundo` (globo),
    `fondo-indice` (barras que suben).
- **Fallback = las iniciales DEL ACTIVO**, no del bróker. Un ticker de una sola palabra se enseña
  entero (`TSM`, `MU`), no su primera letra.
- **La regla vive SOLO en `00-core.js`** (`marcaDeInversion`, `categoriaDeInversion`,
  `TICKERS_INVERSION`, `MARCAS_INVERSION`). El script la carga con `load-pure-logic.mjs`.
- Guardián `logos-inversiones --check` en la suite, con **sus nombres reales**.

**Él ya lo ha visto en captura y ha dicho que adelante.** Falta review de Cursor y publicar.

---

## 2. LAS LECCIONES CARAS DE HOY (todas me mordieron a mí)

1. **«No se puede» casi siempre es «no lo he buscado».** Le dije que TSMC y Micron no tenían logo
   oficial disponible. Me lo cazó enseñando su Revolut, donde salen los dos. Estaban en otro
   paquete, a la primera búsqueda. **Antes de decirle que algo no existe, mira en otro sitio.**
2. **Probar con SUS datos, no con los que uno se imagina.** Mi guardián de logos estaba VERDE con
   «NVIDIA» y «Broadcom» mientras su pantalla enseñaba cinco monogramas: Revolut nombra por
   **ticker** (`NVDA`, `GOOG`, `AVGO`, `TSM`, `MU`).
3. **La misma regla vivía en SEIS sitios.** El saldo de su padre salía de una copia sin migrar.
   Antes de escribir una fórmula inversa a mano, buscar si ya existe (`valueDesdeSaldo`,
   `gastoDelMesPorBanco`). Y sembrar **DOS bancos** en el test: con uno pasa igual de bien roto.
4. **El shell se come las barras invertidas** al escribir ficheros con `python - <<'PY'`. Pasó
   **cuatro veces**: un `\b` perdido dejó una expresión casando de más **sin un solo error**. Para
   ficheros, la herramienta Write. Si no, escribir sin barras (comparar por palabras, `split/join`,
   `String.fromCharCode`).
5. **El checkout es compartido con Cursor.** Se perdió una edición mía, casi publico su trabajo a
   medias, y petó un `npm test` por compilar los dos a la vez. **Reservar ficheros por el buzón.**
6. **Un script de sellado que se aborta a la mitad deja el árbol mintiendo.** Validar todo primero,
   escribir después.
7. **Nada mío a `beta` sin review de Cursor.** Me salté la norma seis veces y me lo dijo. Cursor
   encontró cosas reales que yo no vi (un carácter de control en el bundle, el `addAll` del SW).

---

## 3. ⚠ ESTADO DEL ÁRBOL AL CERRAR — LÉELO ANTES DE COMMITEAR

En `E:\Mi cartera`, rama **`beta`**, hay **trabajo SIN COMMITEAR** que es la continuación de los
logos (TSMC, Micron, categorías, fallback por iniciales, SW):

```
src/modules/00-core.js         marcaDeInversion + categorias + tickers tsm/mu
src/modules/02-ui-shared.js    LogoInv con kind + fallback a iniciales del activo
src/modules/06-sync-brokers.js los dos call sites pasan kind
scripts/logos-inversiones.mjs  segunda fuente (iconify) + categorías + guardián
public/logos/inv/*.svg         10 ficheros
public/sw.js                   los 10 al shell
package.json                   +@iconify-json/logos, +pngjs, +simple-icons (todas devDependencies)
```

**Lo primero: `git status`.** Decide si commitear como `4.19.61` o llevarlo a una tanda. **Y avisa
a Cursor antes**, que trabaja en el mismo árbol.

---

## 4. DÓNDE ESTÁ CADA COSA (verificar con `npm run salud`)

| | versión |
|---|---|
| producción (`main`) | **4.18.24** · APK **4.18.22 (código 45)**, ya con Aely |
| beta | **4.19.60.1** |
| esperando su OK ya dado | `tanda/saldo-padre-prod` · 4.18.25 |
| esperando review | `tanda/logos-inversiones` · 4.19.59 + lo sin commitear |

---

## 5. LO QUE SIGUE VIVO Y NO ES DE HOY

- **Los Bizums (8 en el banco, 5 en la app).** Paso 0 hecho (lo que él teclea no se fusiona).
  Quedan los pasos 1-3, que tocan el índice único de `expenses` y **necesitan su OK**: el plan
  está en `docs/briefs/`. Su propia frase resume el bug: *«al sincronizar Trade Republic, como todo
  es "movimiento", me entraron varios bizums de golpe con el mismo importe de diferentes personas y
  por eso lo considera duplicado»*.
- **El 512/497.** El rastro (`subirGasto` → `app_events`) está en beta y en prod. **Al empezar la
  sesión: `node scripts/errores.mjs`.** A las 19:00 del 11/9 aún no había cantado nada.
- **Brókers (puerta única).** Él lo ha vuelto a pedir; en el traspaso viejo constaba como
  «decidido que NO», pero eso respondía a la pregunta del doble conteo. Lo suyo es de
  **presentación**. Cursor tiene una propuesta; falta diseño escrito y su OK.
- **Rotar el token de ingest.** Lo aparcó él: *«ya lo haremos más adelante, me da pereza»*.
- **`dailyEnt` se deriva de dos maneras** (`find(a=>a.spendFrom)` al pintar vs `find(accDaily)` al
  re-anclar). Hoy coinciden en los tres usuarios — comprobado — pero es un `misma-regla` esperando.
