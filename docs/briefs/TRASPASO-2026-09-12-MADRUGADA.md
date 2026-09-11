# TRASPASO — madrugada del 12 de septiembre de 2026

Sesión muy larga (de la 4.18.25 a la 4.19.74). Lee esto entero antes de tocar nada.

> **Antes que nada:** `npm run salud` y `node scripts/errores.mjs --kind=beta`.
> **No te fíes de este documento, ni de ninguno.** Aquí abajo hay un caso concreto de un aviso del
> propio repo que resultó ser falso y me hizo tomar tres decisiones malas.

---

## 0. LO PRIMERO: LO QUE ÉL ESPERA

### 0.1 ✅ EL ARREGLO DE SU PADRE ESTÁ EN PRODUCCIÓN

`tanda/saldo-padre-prod` mergeada a `main`. **Pages sirve 4.18.25**, comprobado con `curl` a
`version.json`, no con el verde de Actions. Ya se le avisó. Su padre tiene que abrir Aely y
sincronizar: Revolut pasa de 455,50 € a ~26,46 €.

### 0.2 🟡 TIENE 22 TANDAS ESPERANDO SU VEREDICTO

El panel se limpió a fondo esta noche a petición suya (*«no me sirve cosas que ya te he dicho por
aquí, ni cosas que sabes 100 % que no podré probar»*): de **56 tandas a 13**, y ha vuelto a crecer
a 22 con lo nuevo. Cómo se decide qué entra y qué no está en
[[panel-beta-solo-lo-probable]] (memoria) — **léelo antes de añadir nada al panel**.

Ya ha aprobado dos esta noche: `botnav-esconder` y `efectivo-billete`. Quitadas.

### 0.3 ❓ UNA PREGUNTA SUYA PENDIENTE, SIN INVENTAR LA RESPUESTA

**`NISTAL` le sale 31 veces en 90 días** y siempre cae en «Otros». Es el comercio donde más gasta
sin categoría. **No le inventes una**: pregúntale qué es.

---

## 1. ESTADO REAL AL CERRAR

| | versión |
|---|---|
| producción (`main`) | **4.18.25** · APK **4.18.22 (45)** |
| beta publicada | **4.19.72.1** |
| `beta` remota | `40433410` · **4.19.73** (publicándose al cerrar) |
| en local, sin pushear | **4.19.74** (`e917745e`), esperando review de Cursor |

Todo lo de esta sesión pasó por review de Cursor. **Nada mío fue a `beta` sin su verde.**

---

## 2. LO QUE SE HIZO, Y LO QUE SE APRENDIÓ DE CADA COSA

### 4.19.61 — los logos de los brókers
Culpa de un arreglo mío mal calibrado: al apagar los logos de banco en las filas de EMPRESA los
apagué en los cinco sitios, incluidos los tres que agrupan POR BRÓKER. Guardián nuevo que se pone
rojo **en las dos direcciones**.

### 4.19.62 + 4.19.69 + 4.19.71 — la barra de abajo (APROBADA por él)
*«el esconderse la barra de abajo ya no lo hace apenas nunca»*. `onPageScroll` abría con
`if(dragging.current) return;` y `dragging` se pone en el `touchstart` de CUALQUIER gesto: con el
dedo puesto se tiraban TODOS los eventos, así que se escondía con manotazo y nunca despacio.

**Tres lecciones, y las tres son de método:**
1. El test que existía movía el scroll con `scrollTop` por JS — **el único camino que nunca se
   rompió**. Llevaba desde agosto en verde con el fallo puesto.
2. Mi arreglo apretó el guardián de rendimiento que protege **su** rechazo 4.12.0.17. Saltó a 85 ms
   contra un tope de 80, **solo con la suite entera en paralelo**. En aislado pasaba 3 de 3.
3. Y el remedio de eso tenía un agujero que cazó Cursor: aplacé un `setState` y solo lo volcaba en
   `onEnd`, pero **en su móvil 174 de 185 gestos acaban en `touchcancel`**. Lo que quedaba era
   PEOR que no aplazar nada.

### 4.19.63 + 4.19.66 — los tres sustos de CaixaBank
Los tres salen de una línea: `bank-sync` consulta `.in("status", ["active","expired","error"])`, así
que un enlace **`pending`** no llega ni a la app. Arreglado en cliente (le llega por OTA) **y** en
servidor. Y al quitar un banco, su cuenta sale de Cartera — **decisión suya**, corrigiendo la mía.

### 4.19.65 — lo que se VE y lo que CUENTA son dos decisiones
*«TODAS las cuentas deben salir en el apartado de gastos aunque no esté marcado gasto diario»*.
El filtro arrancaba con `expenseBankEnts`, o sea los bancos que suman al presupuesto.

### 4.19.67 — la ficha de cada cuenta
El rediseño que aprobó viendo la maqueta. **Sus decisiones, que no se tocan:** nada de cartilla
única, fuera la flecha del importe, saldo con candado en las conectadas, cada rol con su frase.

### 4.19.68 + 4.19.70 + 4.19.73 — el categorizador
`barcelo` (la cadena de hoteles) casaba dentro de **BARCELONA**, y él vive ahí: la factura del agua
salía como «Viajes». Cursor encontró tres más, **medidas**: `saba`⊂SABADELL (su banco → «Parking»),
`zara`⊂ZARAGOZA, `hospital`⊂HOSPITALET. Y al revés: `"dia "` con espacio detrás no reconocía el
súper **Dia** a secas.

### 4.19.72 + 4.19.74 — el día partido en dos
Lo vi en una captura suya, **sin que él lo reportara**: «DOMINGO, 6 SEPT» dos veces seguidas.
`dayKey` agrupaba en UTC y la etiqueta en local. Y la otra mitad: **arrastrar un gasto de madrugada
por el asa no hacía absolutamente nada**, sin aviso.

---

## 3. ⚠ LO QUE MÁS IMPORTA QUE NO REPITAS

### `npm run servidor` MIENTE
Dice «13 de 13 funciones con el repo por delante» comparando **fechas de commit**, no contenido.
Yo **aparqué tres tandas del panel** por eso. Al desplegar `ingest` de verdad, Supabase contestó
**«No change found in Function: ingest»**: llevaba días al día. Detalle y la vía que funciona
(Actions, porque el CLI da 403 desde su máquina) en [[servidor-al-dia-compara-fechas]].

### UN TEST QUE NO PUEDE FALLAR NO VALE, y me pasó DOS VECES la misma noche
1. Escribí un test para un ámbar de Cursor que buscaba el chip equivocado: volví a meter el fallo
   y **siguió verde**.
2. Y otro con una **copia local** de `dayKey` «por si no está expuesta»: con el fallo puesto, los
   cuatro casos de conducta **siguieron verdes**, porque probaban mi copia y no la app.

**Comprueba siempre el test rompiéndolo a mano.** Y si lo rompes «a medias», tampoco vale: la
primera vez solo revertí una de las dos líneas y el test seguía verde por eso.

### UN SELECTOR SIN ACOTAR MIDE LA APP ENTERA
Cambiar las filas de cuenta de `div` a `button` rompió **tres** e2e que contaban `button.v4-mov`
**de toda la página** — y las pestañas vecinas van premontadas. Tercera vez que muerde lo mismo:
[[e2e-getbytext-pestanas-premontadas]].

### CADA VERSIÓN QUE SE PUBLICA NECESITA AL MENOS UNA TANDA
El e2e `revisar-beta` lo exige. Me mordió **dos veces**. La salida correcta no es inventarse una
tanda: es **MOVER** la del remate a la versión donde la conducta queda como él la va a probar.

---

## 4. QUIÉN LLEVA QUÉ AHORA MISMO

**Cursor** (ficheros reservados: `07-tab-patri-fijos.js` y `shell.html`):
- **Los ingresos que le faltan a su móvil.** Medido: gastos 781,45 € en los dos sitios, pero
  ingresos **314,22 € en su móvil contra 601,62 € en la nube**. Con los ingresos completos la app
  diría 179,83 €, que es justo lo que él calculó a mano. Herramienta: `scripts/diag-mes.mjs`.
  Pista: 601,62 − 314,22 = **287,40**, y los bizums grandes del 5-6 (81,80 + 72,10 + 42,30) más las
  transferencias de Sabadell (4,33 ×4 + 18,09 + 14,33) suman **286,31**.
- **El long-press para ordenar las cuentas**, con el efecto que él pidió: *«que se eleve con un
  efecto chulo de movimiento que se note smooth»*.
- **La ola nativa de Android**, que sigue abierta. Su hipótesis: `leaveScrollHost()` al reclamar el
  eje X apaga el mecanismo nativo a mitad de gesto. Le falta CDP en el móvil.

**Pendiente de decisión suya:**
- Desplegar las otras 12 Edge Functions (solo se desplegó `ingest`).
- Los traspasos internos (`To Cuenta Remunerada`, `Exchanged to EUR`…) que caen en «Otros». **No se
  tocaron a propósito**: `traspaso` es neutra y adivinarla por comercio le movería totales de meses
  ya cerrados.
- Los pasos 1-3 de los Bizums, que tocan el índice único de `expenses`.
