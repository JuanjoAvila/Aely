import assert from "node:assert/strict";

/* P3-09 (auditoría del 14/11): ninguna función devuelve al cliente el texto de una excepción ni el
   `error.message` de PostgREST. No llevaban secretos, pero describían el esquema y el estado del
   servidor (y a veces el código del proveedor) a quien llamara. Al cliente va un código cerrado
   («error», «rate_limit»…); la app ya enseña su propio texto con `errTxt`.
   Los mensajes que el proveedor dirige al usuario (MyInvestor al iniciar sesión) no entran aquí:
   son para él, no un volcado interno. */
const RAIZ = new URL("../", import.meta.url);
// bank-sync es de la ronda E (dinero): su catch final sigue pendiente y se quita de aquí al cerrarlo.
const PENDIENTES = new Set(["bank-sync/index.ts"]);
const FUGA = /jsonResp(?:Cors)?\([^;]*?(?:\(\s*e\s+as\s+Error\s*\)\??\.message|\berror\??\.message\b|\be\??\.message\b)/;

export function fugas(src: string): string[] {
  return src.split(/\r?\n/).filter((l) => FUGA.test(l)).map((l) => l.trim());
}

Deno.test("el oráculo reconoce las formas que había", () => {
  assert.equal(fugas('    return jsonResp({ ok: false, error: String((e as Error)?.message || e) }, 500);').length, 1);
  assert.equal(fugas('    if (error) return jsonResp({ ok: false, error: error.message }, 500);').length, 1);
  assert.equal(fugas('    return jsonResp({ ok: false, error: "error" }, 500);').length, 0);
  // El aviso que MyInvestor dirige al usuario al iniciar sesión no es un volcado interno.
  assert.equal(fugas('      return jsonResp({ ok: false, recaptcha: true, error: j?.status?.message || "x" });').length, 0);
});

Deno.test("ninguna función devuelve mensajes internos al cliente", () => {
  const vistas: string[] = [];
  const malas: string[] = [];
  for (const e of Deno.readDirSync(RAIZ)) {
    if (!e.isDirectory || e.name.startsWith("_")) continue;
    const rel = e.name + "/index.ts";
    let src: string;
    try { src = Deno.readTextFileSync(new URL(rel, RAIZ)); } catch { continue; }
    vistas.push(rel);
    if (PENDIENTES.has(rel)) continue;
    for (const l of fugas(src)) malas.push(rel + ": " + l);
  }
  assert.ok(vistas.includes("bank-connect/index.ts") && vistas.length >= 10, "no se recorrieron las funciones");
  assert.deepEqual(malas, []);
});
