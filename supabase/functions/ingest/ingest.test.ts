import { assertEquals } from "jsr:@std/assert";
import {
  categorizar, clasificar, extraerComercio, extraerConcepto, extraerImporte, extraerPersona, limpiarTexto,
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
  assertEquals(clasificar("Se ha invertido tu redondeo de 0,42 € en iShares Core", ""), "ignorado");
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
