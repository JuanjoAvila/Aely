/* Precarga del servidor de los e2e (`node --require`, ver playwright.config.mjs).

   `serve` (serve-handler 6.1.7) abre el fichero ANTES de saber si lo va a mandar. Si el navegador
   ya lo tiene (If-None-Match) contesta 304 y no lo cierra nunca; si corta la descarga a medias,
   `pipe` tampoco. Windows deja unos 8192 por proceso, así que hacia el test 1285 el servidor moría
   con «EMFILE: too many open files» y los ~1000 tests siguientes caían con ERR_CONNECTION_REFUSED
   (26/11). El primer arreglo se colgaba de `pipe` y no veía los 304, que eran los de la suite.
   Por eso se ata la APERTURA a su petición: todo fichero abierto para contestarla se cierra cuando
   la respuesta acaba, se haya mandado o no.

   Va antes que `serve`: serve-handler se queda con `fs.createReadStream` al cargarse. */
const fs = require("fs");
const http = require("http");
const { AsyncLocalStorage } = require("async_hooks");
const { finished } = require("stream");

const peticion = new AsyncLocalStorage();

const emit = http.Server.prototype.emit;
http.Server.prototype.emit = function (evento, ...args) {
  if (evento !== "request") return emit.call(this, evento, ...args);
  return peticion.run(args[1], () => emit.call(this, evento, ...args));
};

const abre = fs.createReadStream;
fs.createReadStream = function (...args) {
  const fichero = abre.apply(this, args);
  const respuesta = peticion.getStore();
  // `finished` avisa también si la respuesta ya estaba cortada antes de abrir el fichero.
  if (respuesta) finished(respuesta, () => fichero.destroy());
  return fichero;
};
