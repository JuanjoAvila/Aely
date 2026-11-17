import { assertEquals } from "jsr:@std/assert";
import {
  categorizar, clasificar, extraerComercio, extraerConcepto, extraerImporte, extraerPersona, limpiarTexto,
  recompensaTR,
} from "../_shared/ingest_logic.ts";

// ---- El bar del padre y el gasto de Splau (2026-08-06) ----
// Dos formas de perder un gasto SIN DEJAR RASTRO, que es lo que las hacía indiagnosticables:
// un `ignorado` no se guarda ni avisa, y un INSERT rechazado solo deja un error en el panel.

Deno.test("el nombre del comercio NO se mira buscando ruido", () => {
  // «BAR STOP» picaba en "stop" y «BAR EL DEPÓSITO» en "deposito": el gasto se tiraba entero.
  assertEquals(clasificar("Has gastado 9,90 € en BAR STOP", "Trade Republic"), "gasto");
  assertEquals(clasificar("Has gastado 9,90 € en BAR EL DEPOSITO", "Trade Republic"), "gasto");
  assertEquals(clasificar("Has gastado 9,90 € en RESTAURANT EL LIMITE", ""), "gasto");
});

Deno.test("…y el ruido de TR se sigue tirando igual", () => {
  // El redondeo YA invertido dejó de ser ruido el 16/11/2026: entra en Inversión (ver abajo).
  assertEquals(clasificar("Se ha invertido tu redondeo de 0,42 € en iShares Core", ""), "inversion");
  assertEquals(clasificar("Tus intereses de 3,10 € ya están en tu cuenta", ""), "ignorado");
  assertEquals(clasificar("Tu plan de inversión ha ejecutado 50 € en Vanguard", ""), "ignorado");
  assertEquals(clasificar("Nuevo inicio de sesión en tu cuenta", ""), "ignorado");
});

Deno.test("comercio sucio del datáfono: se limpia, no tumba el INSERT", () => {
  const ctrl = String.fromCharCode(0x85);   // el invisible que salió en la compra de Splau
  const nul = String.fromCharCode(0);       // este además hace que Postgres RECHACE la fila
  assertEquals(
    extraerComercio("Has gastado 76,08 € en 10638 CORNELLA" + ctrl + " SPLAU SC", ""),
    "10638 CORNELLA SPLAU SC",
  );
  assertEquals(limpiarTexto("CORNELLA" + nul + " SPLAU").includes(nul), false);
});

Deno.test("extraerComercio: «en» de otra palabra no parte el nombre", () => {
  // Sin el \b, «Orden ejecutada en Apple» daba comercio = «ejecutada en Apple».
  assertEquals(extraerComercio("Orden ejecutada en Apple", ""), "Apple");
});

Deno.test("clasificar: bizum enviado vs recibido", () => {
  assertEquals(clasificar("Has enviado 12,50 € a María por bizum", ""), "gasto_nocard");
  assertEquals(clasificar("Has recibido 12,50 € de María por bizum", ""), "ingreso");
});

Deno.test("clasificar: 3DS ignorado (anti cobro doble)", () => {
  assertEquals(clasificar("Confirma el pago de 50,00 € en DGT Multas", "Autoriza el pago"), "ignorado");
});

Deno.test("extraerImporte: formato español con miles", () => {
  assertEquals(extraerImporte("Has pagado 1.234,56 € en Mercadona"), 1234.56);
});

Deno.test("categorizar: panadería → pan", () => {
  assertEquals(categorizar("PANADERIA LA ESQUINA"), "pan");
});

Deno.test("categorizar: parking → parking (no transporte)", () => {
  assertEquals(categorizar("PARKING SABA"), "parking");
});

// ---- CONCEPTO del movimiento (petición del padre, 2026-07-24) ----
// El mensaje del bizum viaja en la noti y se tiraba. Estos casos son las formas reales en que los
// bancos y TR lo mandan. Ojo con el último: si no hay concepto de verdad, mejor VACÍO que ruido.

Deno.test("extraerConcepto: etiqueta explícita «concepto:»", () => {
  assertEquals(extraerConcepto("Has recibido 40,00 € de María. Concepto: alquiler julio"), "alquiler julio");
  assertEquals(extraerConcepto("Bizum enviado. Motivo: cena del sábado"), "cena del sábado");
});

Deno.test("extraerConcepto: mensaje entrecomillado", () => {
  assertEquals(extraerConcepto('Has recibido 20 € de Pedro «gasolina del finde»'), "gasolina del finde");
  assertEquals(extraerConcepto('Bizum de Ana: "regalo de Luis"'), "regalo de Luis");
});

Deno.test("extraerConcepto: lo que va tras «por» al final", () => {
  assertEquals(extraerConcepto("Has recibido 15 € de Marta por la cena"), "la cena");
});

Deno.test("extraerConcepto: «por Bizum» NO es un concepto", () => {
  // Es el CÓMO, no el QUÉ: sacarlo en la lista sería ruido en todas las filas.
  assertEquals(extraerConcepto("Has recibido 20 € de María por Bizum"), "");
  assertEquals(extraerConcepto("Has enviado 15,00 € a Pedro por bizum"), "");
});

Deno.test("extraerConcepto: sin nada que decir, vacío (no inventar)", () => {
  assertEquals(extraerConcepto("Has gastado 12,50 € en Mercadona"), "");
  assertEquals(extraerConcepto(""), "");
});

Deno.test("extraerConcepto: recorta a 160", () => {
  assertEquals(extraerConcepto("Concepto: " + "x".repeat(400)).length, 160);
});

// ---- Bizum recibido con el nombre delante del verbo (2026-11-15) ----
Deno.test("extraerPersona: «NOMBRE te ha enviado un Bizum de X €» (formato real de TR)", () => {
  const t = "Ana Pérez Gómez te ha enviado un Bizum de 12,20 €.";
  assertEquals(clasificar(t, "Transferencia recibida"), "ingreso");
  assertEquals(extraerPersona(t, "de"), "Ana Pérez Gómez");
  assertEquals(extraerPersona("Íñigo te ha enviado un Bizum de 5 €.", "de"), "Íñigo");
  assertEquals(extraerPersona("Núria Soler t'ha enviat un Bizum de 5 €.", "de"), "Núria Soler");
});

Deno.test("extraerPersona: el formato viejo «… de NOMBRE» sigue igual", () => {
  assertEquals(extraerPersona("Has recibido 12,50 € de María por bizum", "de"), "María");
  assertEquals(extraerPersona("Has recibido 20 € de María López.", "de"), "María López");
  assertEquals(extraerPersona("Has enviado 12,50 € a Pedro Ruiz por bizum", "a"), "Pedro Ruiz");
});

Deno.test("extraerPersona: sin nombre claro devuelve vacío", () => {
  assertEquals(extraerPersona("Has recibido un Bizum de 12,20 €.", "de"), "");
  assertEquals(extraerPersona("Has recibido un Bizum.", "de"), "");
  assertEquals(extraerPersona("Trade Republic te ha enviado un Bizum de 3 €.", "de"), "");
  assertEquals(extraerPersona("Te ha enviado un Bizum de 3 €.", "de"), "");
});

// ---- Revisión 2026-11-16: tildes, iniciales, palabras de más y variantes de la frase ----
Deno.test("extraerPersona: nombres que EMPIEZAN como una palabra excluida no se pierden", () => {
  for (const n of ["Elías Romero", "Teófilo", "Tuñón", "Seún", "Hector Lara", "Unai", "Laia Roca"]) {
    assertEquals(extraerPersona(n + " te ha enviado un Bizum de 12,20 €.", "de"), n);
  }
});

Deno.test("extraerPersona: «Él», «Té», «Tú» y «Sé» con tilde NO son un nombre", () => {
  for (const n of ["Él", "Té", "Tú", "Sé", "Tú mismo"]) {
    assertEquals(extraerPersona(n + " te ha enviado un Bizum de 12,20 €.", "de"), "");
  }
});

Deno.test("extraerPersona: inicial con punto, nombre completo o vacío (nunca solo el apellido)", () => {
  assertEquals(extraerPersona("Ana M. Pérez te ha enviado un Bizum de 12,20 €.", "de"), "Ana M. Pérez");
  assertEquals(
    extraerPersona("Ana M. Pérez Gómez de la Torre Ruiz te ha enviado un Bizum de 12,20 €.", "de"),
    "Ana M. Pérez Gómez de la Torre Ruiz");
});

Deno.test("extraerPersona: siete o más palabras, vacío", () => {
  assertEquals(extraerPersona("Uno Dos Tres Cuatro Cinco Seis Siete te ha enviado un Bizum de 1 €.", "de"), "");
  assertEquals(extraerPersona("Uno Dos Tres Cuatro Cinco Seis te ha enviado un Bizum de 1 €.", "de"),
    "Uno Dos Tres Cuatro Cinco Seis");
});

Deno.test("extraerPersona: apóstrofo tipográfico, mayúsculas y minúsculas", () => {
  assertEquals(extraerPersona("Joan O’Brien t’ha enviat un Bizum de 5 €.", "de"), "Joan O’Brien");
  assertEquals(extraerPersona("ANA PÉREZ TE HA ENVIADO UN BIZUM DE 5 €.", "de"), "ANA PÉREZ");
  assertEquals(extraerPersona("ana pérez te ha enviado un bizum de 5 €.", "de"), "ana pérez");
});

Deno.test("extraerPersona: concepto o emoji detrás, «te ha hecho» y sin «un»", () => {
  assertEquals(extraerPersona("Ana Pérez te ha enviado un Bizum de 12,20 € por la cena 🎉", "de"), "Ana Pérez");
  assertEquals(extraerPersona("Ana Pérez te ha enviado un Bizum de 12,20 €. Concepto: «cena»", "de"), "Ana Pérez");
  assertEquals(extraerPersona("Ana Pérez te ha hecho un Bizum de 12,20 €.", "de"), "Ana Pérez");
  assertEquals(extraerPersona("Ana Pérez te ha enviado Bizum de 12,20 €.", "de"), "Ana Pérez");
});

Deno.test("extraerPersona: la frase nueva con «a», o una transferencia que no es Bizum, vacío", () => {
  assertEquals(extraerPersona("Ana Pérez te ha enviado un Bizum de 12,20 €.", "a"), "");
  assertEquals(extraerPersona("Ana Pérez te ha enviado una transferencia de 12,20 €.", "de"), "");
  assertEquals(extraerPersona("Ana Pérez te ha enviado un Bizumero de 12,20 €.", "de"), "");
});

// ---- Restos del parser de nombres (2026-11-16): partículas, nombres extranjeros, largos ----
Deno.test("extraerPersona: partículas y nombres de origen extranjero", () => {
  for (const n of ["El Hadji Diop", "De la Fuente", "Mª José García", "Jean-Luc Picard", "Sean O'Connor",
    "Maria d'Alba", "Ana de los Santos"]) {
    assertEquals(extraerPersona(n + " te ha enviado un Bizum de 12,20 €.", "de"), n);
  }
  assertEquals(extraerPersona("Aïcha El Amrani t'ha enviat un Bizum de 5 €.", "de"), "Aïcha El Amrani");
});

Deno.test("extraerPersona: el formato «de NOMBRE» también con partículas y extranjeros", () => {
  assertEquals(extraerPersona("Has recibido 20 € de De la Fuente por bizum", "de"), "De la Fuente");
  assertEquals(extraerPersona("Has recibido 20 € de Mª José.", "de"), "Mª José");
  assertEquals(extraerPersona("Has enviado 5 € a Jean-Luc O'Connor por bizum", "a"), "Jean-Luc O'Connor");
});

Deno.test("extraerPersona: nombres largos hasta 6 palabras «de verdad» y 10 en total", () => {
  assertEquals(extraerPersona("María del Carmen Pérez de la Torre y Ruiz te ha enviado un Bizum de 1 €.", "de"),
    "María del Carmen Pérez de la Torre y Ruiz");
  // Siete palabras sin partículas: eso ya es una frase, no un nombre.
  assertEquals(extraerPersona("Uno Dos Tres Cuatro Cinco Seis Siete te ha enviado un Bizum de 1 €.", "de"), "");
  // Once tokens: pasa del tope total aunque casi todo sean partículas.
  assertEquals(extraerPersona("Ana de la de la de la de la de Torre te ha enviado un Bizum de 1 €.", "de"), "");
});

Deno.test("extraerPersona: «El banco», «La empresa» y compañía NO son personas aunque lleven mayúscula", () => {
  for (const n of ["El banco", "El Banco", "EL BANCO", "La empresa", "La Empresa", "El hadji", "el Hadji Diop", "El", "La",
    "Trade Republic", "Hola Ana", "Él Hadji"]) {
    assertEquals(extraerPersona(n + " te ha enviado un Bizum de 12,20 €.", "de"), "");
  }
});

// ---- Round up y Saveback de TR (16/11/2026) ----
// Antes se tiraban como ruido; ahora entran en Inversión y la app los suma a la posición elegida.
// Frases inventadas con la forma de las reales (título + texto), en los tres idiomas de la app.
const RU = [
  ["Round up Invertido", "¡Has ahorrado e invertido 12,96 € en Round up!"],
  ["Round up invested", "You saved and invested 12,96 € with Round up!"],
  ["Round up invertit", "Has estalviat i invertit 12,96 € amb Round up!"],
  ["Trade Republic", "Se ha invertido tu redondeo de 12,96 € en tu plan"],
];
const SB = [
  ["Saveback invertido", "¡Has recibido 12,96 € de Saveback y se han invertido!"],
  ["Saveback invested", "You received 12,96 € Saveback and it was invested."],
  ["Saveback invertit", "Has rebut 12,96 € de Saveback i s'han invertit."],
  ["Trade Republic", "Tu Saveback de 12,96 € se ha invertido"],
];

Deno.test("recompensas: round up en es/en/ca entra como inversión", () => {
  for (const [ti, tx] of RU) {
    assertEquals(clasificar(tx, ti), "inversion", tx);
    assertEquals(recompensaTR(tx, ti), "roundup", tx);
    assertEquals(extraerImporte(tx), 12.96, tx);
  }
});

Deno.test("recompensas: saveback en es/en/ca entra como inversión", () => {
  for (const [ti, tx] of SB) {
    assertEquals(clasificar(tx, ti), "inversion", tx);
    assertEquals(recompensaTR(tx, ti), "saveback", tx);
    assertEquals(extraerImporte(tx), 12.96, tx);
  }
});

Deno.test("recompensas: importes con miles, céntimos sueltos y redondos", () => {
  assertEquals(extraerImporte("¡Has ahorrado e invertido 1.234,56 € en Round up!"), 1234.56);
  assertEquals(extraerImporte("¡Has ahorrado e invertido 0,04 € en Round up!"), 0.04);
  assertEquals(extraerImporte("¡Has recibido 15,00 € de Saveback y se han invertido!"), 15);
  assertEquals(recompensaTR("¡Has ahorrado e invertido 0,04 € en Round up!", "Round up Invertido"), "roundup");
});

Deno.test("recompensas: un aviso de lo que AÚN no se ha invertido no se apunta", () => {
  // Apuntarlo dejaría dos filas cuando llegue el de verdad.
  assertEquals(recompensaTR("Tu Saveback de 3,20 € se invertirá el día 2", "Saveback"), null);
  assertEquals(recompensaTR("Your Saveback of 3,20 € will be invested on the 2nd", "Saveback"), null);
  assertEquals(recompensaTR("Activa el Round up y redondea tus compras", "Round up"), null);
  assertEquals(clasificar("Tu Saveback de 3,20 € se invertirá el día 2", "Saveback"), "ignorado");
});

// Revisión de dinero 236 (P2-C): ante la duda NO es recompensa. Ninguna de estas es una inversión
// hecha; apuntarla restaría o sumaría dinero que no se ha movido y luego contaría dos veces.
Deno.test("recompensas: futuros en plural, gerundios y en/ca no se apuntan", () => {
  for (const [tx, ti] of [
    ["Has recibido 12,96 € de Saveback que se invertirán el día 2", "Saveback"],
    ["Has rebut 12,96 € de Saveback que s'invertiran el dia 2", "Saveback"],
    ["Your round up of €3.20 is being invested", "Round up"],
    ["Your round up of €3.20 is going to be invested on Monday", "Round up"],
    ["You have earned €3.20 Saveback, which we'll invest on the 2nd", "Saveback"],
    ["Tu Round up de 3,20 € está pendiente de invertirse", "Round up"],
  ]) {
    assertEquals(recompensaTR(tx, ti), null, tx);
    assertEquals(clasificar(tx, ti), "ignorado", tx);
  }
});

Deno.test("recompensas: negadas, canceladas o fallidas no se apuntan", () => {
  for (const tx of [
    "Tu Saveback de 3,20 € no se ha invertido por fondos insuficientes",
    "Se ha cancelado tu Saveback invertido de 3,20 €",
    "Your Round up of €3.20 could not be invested",
    "Round up invested failed: 3,20 €",
  ]) assertEquals(recompensaTR(tx, "Trade Republic"), null, tx);
});

Deno.test("recompensas: un cashback al efectivo no es Saveback, y una compra con redondeo es la compra", () => {
  // «cashback» va al efectivo, no al fondo: fuera de recompensas (sigue siendo ruido).
  assertEquals(recompensaTR("Has recibido 5,00 € de cashback por tu compra en Amazon", "Trade Republic"), null);
  assertEquals(recompensaTR("Tu cashback de 12,96 € se ha invertido", "Trade Republic"), null);
  // Una compra que menciona su redondeo: no es Round up (perdería la compra y subiría 4,50 la posición).
  assertEquals(recompensaTR("Compra de 4,50 € en ROUND UP CAFE. Has ahorrado 0,50 € con redondeo invertido", "Trade Republic"), null);
  // Sin el verbo invertir en pasado no basta con «recibido» o «ahorrado».
  assertEquals(recompensaTR("Has recibido 12,96 € de Saveback", "Saveback"), null);
  assertEquals(recompensaTR("Has ahorrado 12,96 € con Round up", "Round up"), null);
  // Los dos productos en la misma frase: no se sabe a qué posición va.
  assertEquals(recompensaTR("Round up y Saveback invertidos: 3,20 €", "Trade Republic"), null);
});

Deno.test("extraerImporte: € delante con coma de miles (inglés)", () => {
  assertEquals(extraerImporte("You saved and invested €1,234.56 with Round up"), 1234.56);
  assertEquals(extraerImporte("You saved and invested €12.96 with Round up"), 12.96);
  // Los formatos de siempre no cambian.
  assertEquals(extraerImporte("Has pagado 1.234,56 € en Mercadona"), 1234.56);
  assertEquals(extraerImporte("Has pagado 0,04 € en Mercadona"), 0.04);
});

Deno.test("recompensas: no se confunden con otras notificaciones de TR", () => {
  // Compra con tarjeta, aunque el comercio se llame así, sigue siendo un gasto.
  assertEquals(recompensaTR("Has gastado 12,96 € en Mercadona", "Trade Republic"), null);
  assertEquals(clasificar("Has gastado 12,96 € en ROUND UP BAR", "Trade Republic"), "gasto");
  assertEquals(clasificar("Has pagado 4,50 € en CASHBACK STORE", "Trade Republic"), "gasto");
  // Bizum recibido: ingreso, no recompensa.
  assertEquals(recompensaTR("Has recibido 12,96 € de María por bizum", "Trade Republic"), null);
  assertEquals(clasificar("Has recibido 12,96 € de María por bizum", "Trade Republic"), "ingreso");
  // Un plan de inversión sin redondeo ni saveback sigue siendo ruido.
  assertEquals(clasificar("Tu plan de inversión ha ejecutado 50 € en Vanguard", ""), "ignorado");
  // Wallet nunca trae recompensas de TR: su título es el comercio.
  assertEquals(clasificar("12,96 € con Trade Republic Visa Card", "ROUND UP INVESTED BAR", "wallet"), "gasto");
});
