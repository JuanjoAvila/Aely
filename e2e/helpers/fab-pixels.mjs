// Medición PNG del guardián FAB; capturas sintéticas, sin métricas de fluidez.
import zlib from "node:zlib";
export function decodePng(buf) {
  let pos = 8, w = 0, h = 0; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); }
    if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = 4, stride = w * bpp, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      let v = raw[y * (stride + 1) + 1 + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + x] = v & 255;
    }
  }
  return { w, h, px: out };
}
// Píxel de FAB: lo que se aleja del color de fondo del recorte (esquina). Umbral alto: la sombra
// del FAB es tenue y no debe contar como círculo.
export function fabPixels(png) {
  const bg = [png.px[0], png.px[1], png.px[2]];
  let n = 0;
  for (let i = 0; i < png.px.length; i += 4) { const d = Math.abs(png.px[i] - bg[0]) + Math.abs(png.px[i + 1] - bg[1]) + Math.abs(png.px[i + 2] - bg[2]); if (d > 150) n++; }
  return n;
}
