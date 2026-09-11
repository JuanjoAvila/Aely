<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (logos-bancos-recortar-no-dibujar.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: logos-bancos-recortar-no-dibujar
description: "Los logos de banco se RECORTAN del PNG oficial, nunca se dibujan; cuatro intentos a mano los rechazó todos."
metadata: 
  node_type: memory
  type: project
  originSessionId: 7de23512-86c3-4aeb-94be-8333e759471e
  modified: 2026-09-11T14:36:08.362Z
---

⚠ 11/9/2026. Los logos de sus cinco bancos se intentaron **dibujar cuatro veces** y las cuatro
las rechazó:

1. Las iniciales (`S`, `R`, `T`, `M`) → *«qué puta mierda es esa, no son los logos»*.
2. Formas a ojo desde el lockup de Enable Banking.
3. Trazos medidos de una captura de su launcher (Cursor) → *«parecen logos de aliexpress»*.
4. Recorte del original pero **a escala de más** → *«la B gigante», «las olas esas en gigante»,
   «revolut cortado»*.

**Lo que funciona, y es lo único que ha funcionado: `scripts/logos-bancos.mjs`.** Recorta el
isotipo del PNG oficial de `docs/design/bancos/` (bajados del directorio de Enable Banking,
campo `logo` de `bank-aspsps` — la misma fuente por la que la app conecta con sus bancos).
`npm run logos` los regenera.

**Las tres reglas que costaron las cuatro rondas:**

- **No dibujar.** Con `<text>` de la fuente del sistema y curvas Bézier a mano sale una
  imitación, nunca un logotipo. Es el mismo error que con el logo de Aely, que también se
  rechazó dos veces y solo salió bien al medir el PNG.
- **Recortes EN PÍXELES, medidos con el detector de componentes** (columnas con tinta separadas
  por columnas vacías), nunca en porcentajes redondos. Un `0.135` puesto a ojo **cortó la R de
  Revolut 118 px**. Hay un guardián: si queda tinta pegada a la columna de fuera, el script
  falla. Excepción reconocida a mano en Revolut, donde la «e» empieza sin ni una columna en
  blanco (la R se mide por las filas ALTAS, que es el único glifo de altura completa).
- **El símbolo ocupa 0,66 del cuadro, no 0,88.** Un icono de app lleva aire. A 0,88 fue cuando
  dijo «gigante».
- **Sabadell es el «BS»** (bola azul con B + S negra), que es su icono del launcher, no la B sola.

**Van a `public/logos/*.png`, 13,3 KB, FUERA del bundle**: el gzip del index está al 99 % del
tope (326/330 KB) y un fichero aparte no cuenta. Viajan igual en el APK (`build-www` copia
`public/` entero) y en el bundle OTA (`zip -qr`), y están en el shell del service worker.
`Mono` los pinta con `<img>` y cae al monograma de siempre si el PNG no carga.

Ver [[feedback-el-ojo-suyo-gana-a-mis-medidas]]: aquí pasó cuatro veces seguidas.
