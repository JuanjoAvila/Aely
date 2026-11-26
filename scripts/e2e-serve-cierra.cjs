/* Precarga del servidor de los e2e (`node --require`, ver playwright.config.mjs).

   `serve` (serve-handler 6.1.7) manda cada fichero con `stream.pipe(response)`, y `pipe` NO cierra
   el origen si el navegador corta a medias (recarga, fin de test): el fichero se queda abierto para
   siempre. Windows deja unos 8192 por proceso, así que hacia el test 1285 el servidor moría con
   «EMFILE: too many open files» y los ~1000 tests siguientes caían con ERR_CONNECTION_REFUSED
   (26/11, dos pasadas completas seguidas). Aquí se cierra el fichero cuando la respuesta acaba,
   termine bien o la corten. */
const fs = require("fs");
const http = require("http");
const { finished } = require("stream");

const pipe = fs.ReadStream.prototype.pipe;
fs.ReadStream.prototype.pipe = function (destino, opciones) {
  const fichero = this;
  const salida = pipe.call(fichero, destino, opciones);
  // `finished` avisa también si la respuesta ya estaba cortada antes de empezar a mandar.
  if (destino instanceof http.ServerResponse) finished(destino, () => fichero.destroy());
  return salida;
};
