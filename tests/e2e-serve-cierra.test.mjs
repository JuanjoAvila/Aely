// El servidor de los e2e no puede quedarse un fichero abierto por cada descarga cortada: así moría
// la suite entera con EMFILE (26/11). Se prueba la precarga de scripts/e2e-serve-cierra.cjs.
import assert from "node:assert";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

createRequire(import.meta.url)("../scripts/e2e-serve-cierra.cjs");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-serve-"));
const grande = path.join(dir, "grande.bin");
fs.writeFileSync(grande, Buffer.alloc(8 * 1024 * 1024));

const abiertos = [];
const server = http.createServer((req, res) => {
  const manda = () => {
    const fichero = fs.createReadStream(grande);
    abiertos.push(fichero);
    fichero.pipe(res);
  };
  // «tarde»: la respuesta ya está cortada cuando se empieza a mandar.
  if (req.url === "/tarde") res.once("close", manda); else manda();
});
await new Promise(r => server.listen(0, "127.0.0.1", r));

const corta = (url) => new Promise(resolve => {
  const s = net.connect(server.address().port, "127.0.0.1", () => {
    s.write("GET " + url + " HTTP/1.1\r\nHost: x\r\n\r\n");
    if (url === "/tarde") setTimeout(() => s.destroy(), 20);
  });
  s.once("data", () => s.destroy());
  s.on("close", resolve);
});

for (const url of ["/", "/tarde"]) for (let i = 0; i < 5; i++) await corta(url);
const fin = Date.now() + 5000;
while ((abiertos.length < 10 || abiertos.some(f => !f.closed)) && Date.now() < fin) await new Promise(r => setTimeout(r, 20));

assert.strictEqual(abiertos.length, 10);
assert.strictEqual(abiertos.filter(f => !f.closed).length, 0, "quedan ficheros abiertos tras cortar la descarga");

server.close();
fs.rmSync(dir, { recursive: true, force: true });
console.log("✓ e2e-serve-cierra: 10 descargas cortadas, 0 ficheros abiertos");
