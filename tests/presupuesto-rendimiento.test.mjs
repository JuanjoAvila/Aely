#!/usr/bin/env node
/**
 * PRESUPUESTO DE RENDIMIENTO — lo que pesa lo que se envía al móvil.
 *
 * El resto de pruebas de rendimiento (`e2e/rendimiento.spec.mjs`) miden que el trabajo no se
 * dispare con el histórico. Falta la otra mitad, la que nadie vigila porque crece de una en una:
 * el TAMAÑO. Cada tanda añade una pantalla, tres textos en tres idiomas y un bloque de CSS; nadie
 * mira nunca cuánto sube, y un día la app tarda cinco segundos en abrir con datos móviles y no
 * hay un solo commit al que señalar. Un presupuesto convierte eso en una decisión consciente:
 * cuando se pasa, o se recorta o se sube el número a propósito, escribiendo por qué.
 *
 * Se mide lo que se SIRVE de verdad:
 *   · index.html DESPUÉS de minificar (el CI minifica; medir la fuente legible sería mentirse),
 *   · y ese mismo fichero comprimido con gzip, que es lo que baja por la red.
 * Lo importante para el usuario es el gzip; el crudo importa porque es lo que el móvil tiene que
 * PARSEAR, y en una WebView eso son cientos de milisegundos de hilo principal.
 *
 * También se vigila el número de ficheros que hacen falta ANTES de pintar: la regla de la casa es
 * cero CDNs y todo auto-hospedado, y cada `<script src>` o `<link rel=preload>` nuevo es una
 * ronda más de red en la peor conexión.
 *
 * `--artifact` mide public/index.html ya sellado/minificado, sin reserva ni reconstrucción.
 * El publicador debe ejecutarlo después de inyectar su configuración real.
 *
 * Al pasarse: mirar primero si hay algo duplicado (pasó con `bkBrand`, que eran tres copias del
 * mismo bloque) antes de tocar el número.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/* PRESUPUESTOS. Fijados el 2026-07-25 con ~12 % de aire sobre lo medido ESE DÍA en la 4.10.0
   (números reales de la ejecución, no estimaciones), para que una tanda normal quepa y una
   regresión gorda no. Subirlos es legítimo — pero se hace aquí, a propósito y con el motivo
   escrito, no por accidente.

   SUBIDO 2026-08-03: la sesión "dale caña a todo" metió CUATRO tandas en un solo día (reservar
   dinero, tutorial de gestos, temporadas sin lluvia, swipe de Plan) — el tope de 310 KB se quedó
   corto por apenas 362 bytes. En vez de recortar código sano para arañar unos bytes, se sube con
   el mismo ~12 % de aire que se usó la primera vez, sobre lo medido HOY (317,8 KB gzip real).

   SUBIDO 2026-08-06 (solo el minificado): la 4.16.0 trae TRES tandas, y las tandas se pagan en
   texto — cada una lleva su título y su checklist en los tres idiomas, más los puntos que lee la
   familia en Novedades. Son ~7 KB de literales, no de código: el bundle minificado se pasó 7 KB
   del tope mientras el GZIP —que es lo que baja el móvil de verdad— se quedó en 330/340 KB, con
   margen. Recortar aquí sería recortar novedades o idiomas, y en esta casa eso no se toca. Se sube
   el tope del minificado a 1200 KB (~3 % de aire sobre los 1167 medidos hoy) y se deja el de gzip
   quieto, que es el que de verdad frena una regresión gorda.

   SUBIDO 2026-09-07 (minificado y gzip): la 4.19.0 suma ~8,5 KB min / ~2,7 KB gzip sobre un tip
   (4.18.7) que YA iba justo (1194,5 / 337,7). Casi la mitad del crecimiento es la nota de versión
   en tres idiomas; el resto es orden táctil en Gastos y el estado reactivo de Trade Republic —
   nada de eso es grasa, y recortar la nota sería lo que el 06/08 ya descartó. Se sube el
   minificado a 1240 KB (~3 % sobre los 1203 medidos hoy) y el gzip a 350 KB (~2,8 % sobre 340,4):
   el gzip se mueve poco a propósito, porque es lo que baja el móvil. El problema de fondo (las
   notas se acumulan para siempre en el bundle) queda para una tanda aparte.

   BAJADO 2026-09-07 (noche, 4.19.5): `RELEASE_NOTES_MAX=20` + truncado en build deja de arrastrar
   ~90 notas viejas. Medido tras el corte: ~1145 KB min / ~319 KB gzip. Se BAJAN los topes a
   1180 / 330 (~3 % de aire): recuperamos el margen que se había abierto «por las notas» esta
   misma tarde, en vez de dejar el presupuesto holgado. */
const PRESUPUESTO = {
  /* 9/9 tarde: los dos arreglos de dinero de la ronda (FIN-01, el cierre de mes que le descontaba
     a Trade Republic lo pagado en efectivo y los recibos de otros bancos; FIN-02, el historico que
     descartaba pagos de meses distintos) suman ~2 KB minificados, casi todo notas de version en
     tres idiomas y el helper que agrupa los Fijos. Medido tras el cambio: 1183 KB.
     El tope anterior dejaba 1 KB de aire, que no es margen: es una trampa para el siguiente.
     Se sube a 1188 (~0,4 %). El gzip NO se toca y sigue en 330: medido 328, y es lo que de verdad
     baja el movil. Si el gzip se acerca al tope, se recorta; no se sube.
     12/9: mergeExpensesFromCloud + notas 4.19.77/78 → 1189 medido en CI. Tope a 1195 (~0,5 %).
     12/9 tarde (4.19.80): partir energia en agua/luz/gas. Delta medido +0,13 KB gzip irreducible
     (3 entradas CATEGORIES + 9 cadenas i18n = la petición suya del rayito en el agua). El tip
     ya venía con 0,10 KB de aire; no hay grasa que recortar sin tocar la función. Tope gzip a
     332 KB (~0,6 % sobre 330,03 medidos). Sigue sin aire de verdad: la próxima tanda de texto
     tendrá que recortar o volver a decidir.
     25/9 (4.26.47): la hoja de alta de Recibos rearma la ola nativa en cada paso y conserva
     la posición al volver. Medido: 1.223.845 bytes minificados, 165 sobre el tope anterior.
     Se añade solo 1 KB al límite crudo; gzip permanece en 332 KB.
     25/9 (4.26.49, FIN-05): el guardo de reentrada espera el pull y recalcula el mes al volver.
     Medido: 1.225.533 bytes minificados, 829 sobre el tope; gzip sigue en 325 KB. Se añade
     1 KB al crudo para este código de coherencia, sin mover el límite de descarga gzip.
     26/9 (4.26.50): selector persistente del banco del widget y textos de ayuda. Medido:
     1.226.948 bytes minificados (1.220 sobre el límite), gzip 325 KB. Se añaden 2 KB
     solo al crudo para este selector; el límite de descarga gzip permanece intacto.
     26/9 (4.26.51, FIN-06): catálogo BCE completo y consumidores que conservan originales,
     excluyen euros desconocidos y marcan totales parciales. Medido: 1.230.055 bytes crudos,
     +3.107 sobre 4.26.50; gzip 333.795 bytes (326 KB), sin mover su límite de 332 KB.
     Se añaden solo 3 KB al tope crudo para estos controles y las 14 monedas adicionales. */
  // TR 4.26.53: concepto separado del código bancario y MCC suman el clasificador seguro.
  // El candidato anterior medía 1.230.845 B: solo 3 B de margen, insuficiente al sellar versión.
  // Se añade 1 KB solo al crudo; el límite de descarga gzip permanece en 332 KB.
  // OPS-02 4.26.56: visor aislado, validador y comparación por UUID/campo; 1.242.123 B
  // minificados / 337.533 B gzip medidos. +12 KB solo al crudo; descarga sigue en 332 KB.
  // Quedan ~2 KB crudos para el sellado de beta, sin aflojar el presupuesto del móvil.
  // SEC-03 sobre beta: +6 KiB crudos para los filtros necesarios, sin ampliar gzip.
  // INC-2709-05 saldo: marcador, reanclaje y ambigüedad posterior miden 1.251.083 B
  // crudos, 779 B sobre el límite anterior; gzip 340.797 B permanece bajo 333 KiB.
  // Se añade 1 KiB solo al crudo para preservar el saldo al actualizar y en otro móvil.
  // Ciclo 4.26.63: ventana opcional del presupuesto, ajuste reversible y textos en tres
  // idiomas, más la exclusión de transferencias/Bizum señalada por Claude, miden
  // 1.254.924 B minificados y 341.990 B gzip, incluyendo la nómina en concepto bancario.
  // Se añaden 4/1 KiB frente a 4.26.62; quedan 500/26 B de margen medido.
  // INC-2809-02: resumen del cobro siempre visible, ayuda reversible por perfil y sus textos
  // miden 1.256.096 B minificados, 672 B sobre el tope; +1 KiB crudo. Gzip mide 342.346 B
  // y sigue bajo 335 KiB. El incremento evita esconder el ancla del periodo al plegar.
  // INC-2709-02: confirmar un saldo proyectado, conservar cuotas al archivar y recuperar
  // la ficha añaden 1.260.159 B minificados, 3.711 B sobre el tope anterior. +5 KiB
  // deja margen para el sello beta sin recortar los textos de tres idiomas.
  // Corrección de recibos sobre Inicio73: 1.275.031 B min / 347.850 B gzip medidos.
  // Vínculo explícito, prueba durable, banco real y textos: +10/4 KiB para ese contrato
  // y el sello beta; sin nuevas dependencias ni peticiones bloqueantes.
  // Rekey del editor y bruto real separado de previsión personal: +1 KiB medido,
  // sin cambiar el calendario ni inferir un coste propio a partir del cargo compartido.
  // Panel75 sobre Recibos74: 1.278.280 B min y 347.946 B gzip frente a
  // 1.275.031 / 346.752 B de la base. +3 KiB crudos conserva el historial y
  // las identidades por superficie; el gzip sigue bajo 340 KiB sin ampliación.
  // Panel76: motivos por superficie y filtrado selectivo, 1.279.382 / 348.250 B antes del sello.
  // Excede por406/90 B: +1 KiB mínimo en ambos topes, sin recortar los contratos.
  // Retirada79 sobre Nómina78 eaf55e4a: +8.519 B minificados y +1.997 B gzip;
  // sello79.99 mide 1.288.387 / 350.399 B. +9/+2 KiB mínimos conservan ACK,
  // identidad y conciliación del recibo; quedan 829/833 B sin recortar idiomas.
  // Widget80 sobre Retirada79: +1.699 B minificados en A/B sin sello (1.290.012 B),
  // 796 B sobre1259 KiB. +1 KiB mínimo; gzip350.981 B cabe en343 KiB.
  // Revalidar sello beta y manifiesto52 final sin recortar ACK ni textos.
  // Persistencia81: A/B real sellado contra955, mismo minificador/host:
  // 1.289.951/350.970 B →1.292.888/351.900 B (+2.937/+930).
  // Mínimos1263/344 KiB: márgenes424/356 B; sujeto a revisión de candidata.
  // INC-0210-01: A/B sellado82.99→83.99 final mide1.292.900/351.909→1.294.831/352.341 B
  // min/gzip (+1.931/+432 B). Mínimos1265/345 KiB autorizados; no se recortan idiomas
  // ni el contrato de cuotas. Margen529/939 B tras guardas centesimales y pago final.

  // INC-0210-03: ventana compartida y presupuesto histórico indeterminado, sin duplicar motor.
  // A/B sellado82.99→84.99: 1.292.833/351.893→1.294.456/352.299 B (+1.623/+406).
  // Mínimos +2/+1 KiB autorizados por coordinador; quedan904/981 B y3 bloqueantes iguales.
  // La integración conjunta exige su A/B propio; no acumular topes por arrastre.
  // Integración Plan83+Gastos84 sellada84.99: 1.296.387 B min / 352.741 B gzip;
  // +3.554/+848 B frente82.99. Mínimo1267 deja1.021 B; gzip345 conserva539 B.
  // Integración Plan83+Gastos84+Gasolina85, mismo host y sello85.99: 1.297.889 B min /
  // 353.265 B gzip; frente84.99 suma1.569/541 B. Catálogo85+84+83 e idiomas intactos.
  // Mínimo1268 deja543 B; gzip345 dejaría solo15 B, insuficientes para el sello real de
  // Actions con run más largo. Se decide346 para dejar1.039 B, sin recortar historia.
  // Integración Categoría86 sobre la beta 85 (cdfb2f2c), mismo host y minificador, sellos
  // 85.99→86.99: 1.297.925/353.252 B → 1.301.888/354.552 B (+3.963/+1.300). Es el código de la protección
  // de la categoría elegida (confirmación de escritura y reglas por comercio+banco+tarjeta) y
  // su nota en tres idiomas; no se recorta historia ni idiomas. Mínimos 1272/347 KiB autorizados
  // por el coordinador: márgenes 640/776 B con sello; 3 bloqueantes iguales.
  // Unión Metas87 sobre beta86 (49a219a7), mismo host/minificador y sellos86.99→87.99:
  // 1.301.821/354.536→1.303.649/355.027 B (+1.828/+491), con3 bloqueantes iguales.
  // Mínimo1274 KiB crudo deja927 B; gzip347 conserva301 B sin ampliar descarga,
  // manteniendo identidad de liberación, diálogo es/en/ca y todo el catálogo anterior.
  // OPS-0410, A/B oficial sellado90.99999→92.99999:1.304.252/355.202→1.307.848/356.153 B.
  // Cola de funciones estrenadas, refresco y último recibo público offline:+3.596/+951 B.
  // El primer arranque sin entrega comprobada añade un estado explícito con reintento,
  // en vez de ofrecerle el histórico como pruebas nuevas. Crudo1278; gzip348; tres bloqueantes.
  // No se recortan pasos, idiomas ni historial para ocultar las entregas pendientes.
  // INC-0410, alta de reglas de Metas, sobre beta be3081ab; mismo host y minificador, SIN
  // sello: 1.304.309/355.207 → 1.308.234/356.481 B min/gzip (+3.925/+1.274). La base solo
  // dejaba 267/121 B. Es el lector estricto de importes con céntimos exactos, la comprobación
  // de la meta al guardar y su confirmación, el estado del reparto, ocho textos en castellano
  // y el guardado del estado desde el commit (`mcPersistCommit`), que sustituye al del updater
  // (+225/+92 B de ese total, medido contra la versión local anterior sin él);
  // inglés y catalán viajan en sus JSON. 3 bloqueantes iguales, sin dependencias nuevas.
  // Esa parte no llegó a publicarse sola: viaja en la 4.26.94 junto al contrato mensual
  // (motor por regla y mes, asiento tras el pull de estado, línea por regla y ocho textos
  // más en castellano). Medida oficial sellada del coordinador sobre 8ff6402a, contra la
  // 93 servida (1.308.073/356.205): 1.316.330/358.513 B, +8.257/+2.308. Topes medidos
  // 1286/351 KiB autorizados (4/10). Después entraron el retorno nativo, la lectura
  // estricta de la nube y una puerta por pull: correcciones de validez, sin dependencias
  // nuevas. Medida oficial sellada sobre d8255941: 1.317.146/358.744 B (+816/+231 sobre
  // 8ff6402a), 282 B por encima del crudo. Tope crudo a 1287 KiB (quedan 742 B); gzip
  // sigue en 351 KiB (680 B). No se recortan guardas, notas ni idiomas para caber; un
  // cambio posterior exige medir de nuevo.
  // Coordinador8/10: 1291/352 KiB autorizados para Metas108, Inicio109 y navegación107.
  // Inicio109, A/B oficialLF con mismo sello y reserva95B:1.317.888/359.021→
  // 1.318.229/359.168 B (+341/+147). Conserva la ayuda financiera española de TR;
  // no se recortan textos ajenos ni se añaden dependencias. La unión debe medirse aparte.
  // Metas108 individual: +3.601/+1.019 B; navegación107: -31/+9 B.
  // Estas medidas individuales no acreditan el coste de la unión.
  // BackClose110 sobre109dded, mismo HTML oficial sellado110.99999 y DSN95B:
  // 1.321.823/360.174 → 1.325.185/361.297 B, gzipSync({level:9}), delta3.362/1.123.
  // Root autoriza1295/353 KiB el8/10 tras cotejar ambos hashes; márgenes895/175B,
  // 3 bloqueantes. La primera medida default6 se conserva corregida en el acta.
  // No sumar topes individuales ni recortar textos/datos financieros para esconder el coste.
  // Tras acotar performance en el fallback del token, artefacto final1.325.236/361.308 B:
  // delta3.413/1.134 sobre109, márgenes844/164 B; mantiene los topes autorizados.
  minificado: 1295 * 1024,
  // INC-2709-05: +141 B gzip sobre el tope anterior al añadir el contraste entre gasto y
  // balance y la comprobación del abono contabilizado. Se amplía 1 KiB (0,3 %) medido;
  // mantener la explicación en tres idiomas y no debilitar el criterio financiero.
  // INC-2809-01: la frase que explica gasto neto y disponible en Mi ciclo, con su
  // caso de exceso, deja 342.031 B gzip (15 B sobre 334 KiB). +1 KiB medido para
  // no ocultar cifras financieras ni recortar los tres idiomas; quedan 1.009 B.
  // La misma candidata mide 343.257 B gzip, 217 B sobre 335 KiB: +1 KiB medido.
  // Bienes completo y gráfica113: tras retirar las selecciones111/112 sustituidas,
  // el sello113.99999 con DSN sintético95 B mide361.889 B,417 B sobre353 KiB.
  // +1 KiB es el incremento mínimo por KiB; crudo1295 y3 bloqueantes intactos.
  gzip: 354 * 1024,
  bloqueantes: 3,           // medido 2026-07-25: 3 (supabase-js + las dos fuentes precargadas)
};

const tmp = path.join(root, ".presupuesto.tmp.html");
const artifact = process.argv.includes("--artifact");
let fallos = 0;
console.log("presupuesto-rendimiento");

try {
  // Minificar a un fichero aparte: la fuente editable no se toca (ARQUITECTURA #2).
  if (!artifact) execFileSync(process.execPath, [path.join(root, "scripts", "minify-html.mjs"), "--out", tmp], { stdio: "pipe" });
  // El publicador añade configuración y una revisión beta: medir solo el build vacío
  // daba un falso verde con 6 B de margen. Se reserva el caso servido sin leer secretos.
  let empaquetado = fs.readFileSync(artifact ? path.join(root, "public", "index.html") : tmp, "utf8");
  const dsns = [...empaquetado.matchAll(/SENTRY_DSN:("(?:[^"\\]|\\.)*")/g)];
  if (dsns.length !== 1) throw new Error("Configuración de monitorización ausente o ambigua");
  const dsn = dsns[0];
  const fixture = "https://" + "0123456789abcdef".repeat(2) + "@" + "fedcba9876543210".repeat(2) + ".invalid/0123456789012";
  if (Buffer.byteLength(fixture) !== 95) throw new Error("Reserva sintética de configuración desalineada");
  // Una configuración real mayor se mide entera; nunca se sustituye por una menor.
  if (!artifact && Buffer.byteLength(dsn[1]) < Buffer.byteLength(JSON.stringify(fixture))) {
    empaquetado = empaquetado.replace(dsn[0], "SENTRY_DSN:" + JSON.stringify(fixture));
  }
  const version = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim() + ".99999";
  const versiones = [...empaquetado.matchAll(/APP_VERSION:"([^"]*)"/g)];
  if (versiones.length !== 1) throw new Error("Versión de paquete ausente o ambigua");
  empaquetado = empaquetado.replace(/APP_VERSION:"([^"]*)"/, function(full, actual) {
    return !artifact && actual.length < version.length ? "APP_VERSION:" + JSON.stringify(version) : full;
  });
  const min = Buffer.from(empaquetado);
  const gz = zlib.gzipSync(min, { level: 9 });

  const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
  // Lo que el navegador tiene que ir a buscar antes de poder pintar: scripts externos y precargas.
  const externos = (html.match(/<script[^>]*\bsrc\s*=/gi) || []).length;
  const precargas = (html.match(/<link[^>]*rel="preload"/gi) || []).length;
  const bloqueantes = externos + precargas;

  const fila = (nombre, valor, tope, fmt) => {
    const ok = valor <= tope;
    if (!ok) fallos++;
    const pct = ((valor / tope) * 100).toFixed(0);
    console.log(`  ${ok ? "✓" : "✕"} ${nombre.padEnd(22)} ${fmt(valor).padStart(9)} / ${fmt(tope).padStart(9)}  (${pct}% del presupuesto)`);
  };
  const kb = (b) => (b / 1024).toFixed(0) + " KB";
  const num = (n) => String(n);

  fila("index.html minificado", min.length, PRESUPUESTO.minificado, kb);
  fila("index.html gzip", gz.length, PRESUPUESTO.gzip, kb);
  fila("ficheros bloqueantes", bloqueantes, PRESUPUESTO.bloqueantes, num);
} finally {
  try { fs.unlinkSync(tmp); } catch { /* ya no está */ }
}

if (fallos) {
  console.error(`\n${fallos} presupuesto(s) rebasado(s). Recorta, o sube el tope en este fichero explicando por qué.`);
  process.exit(1);
}
console.log("\nTodo dentro de presupuesto");
