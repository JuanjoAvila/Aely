// SEG-22: recuperar contraseña por CÓDIGO (verifyOtp recovery) sin romper el enlace de siempre.
// Con PKCE el enlace del correo solo canjea en el navegador que lo pidió (en la APK se abre en
// Chrome, no en la WebView): el código tecleado es lo que sobrevive. Mientras la plantilla del
// panel de Supabase siga siendo la de enlace, el cliente tiene que seguir aceptando el enlace.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.env.AELY_TEST_ROOT || new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const core = read("src/modules/00-core.js"), comps = read("src/modules/10-app-components.js");

const a = core.indexOf("function recoveryCodeClean"), b0 = core.indexOf("const cloud = (function(){");
const b = core.indexOf("\n})();", b0);
assert.ok(a >= 0 && b0 > a && b > b0, "bloque recoveryCodeClean + cloud no encontrado");
const block = core.slice(a, b + 6);

function boot() {
  const calls = { create: [], verifyOtp: [], reset: [] };
  const sb = { auth: {
    verifyOtp: async (p) => { calls.verifyOtp.push(p); return calls.otpResult || { data: { session: { user: { id: "u1" } } }, error: null }; },
    resetPasswordForEmail: async (e, o) => { calls.reset.push([e, o]); return { error: null }; },
    onAuthStateChange() {}, getSession: async () => ({ data: { session: null } }),
  } };
  const ctx = { window: { supabase: { createClient: (...args) => { calls.create.push(args); return sb; } } },
    CONFIG: { SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon" },
    location: { href: "https://app.example/index.html#access_token=zz" }, console, Map, Error };
  vm.createContext(ctx);
  vm.runInContext(block + ";this.cloud=cloud;this.recoveryCodeClean=recoveryCodeClean;", ctx);
  return { ctx, calls };
}

// 1. El cliente no cambia de flujo: el enlace de hoy sigue valiendo (PKCE va DESPUÉS de cambiar la plantilla).
{
  const { calls } = boot();
  assert.equal(calls.create[0].length, 2, "createClient sin opciones de auth (flujo implícito de hoy)");
}
// 2. El envío del correo no cambia (no rompe la recuperación actual).
{
  const { ctx, calls } = boot();
  await ctx.cloud.resetPassword("  a@b.es ");
  assert.equal(calls.reset.length, 1);
  assert.equal(calls.reset[0][0], "a@b.es");
  assert.equal(calls.reset[0][1].redirectTo, "https://app.example/index.html", "redirectTo sin el # con tokens");
}
// 3. El código: limpia espacios y guiones, exige 6-10 dígitos, manda type recovery.
{
  const { ctx, calls } = boot();
  assert.equal(ctx.recoveryCodeClean(" 123 456 "), "123456");
  assert.equal(ctx.recoveryCodeClean("123-456"), "123456");
  for (const bad of ["", "12345", "abcdef", "12345678901", null, undefined, "123456'; drop"]) assert.equal(ctx.recoveryCodeClean(bad), "", String(bad));
  const ses = await ctx.cloud.verifyRecoveryCode(" a@b.es ", "123 456");
  assert.deepEqual(JSON.parse(JSON.stringify(calls.verifyOtp)), [{ email: "a@b.es", token: "123456", type: "recovery" }]);
  assert.equal(ses.user.id, "u1");
  // Código mal formado: ni siquiera sale a la red.
  await assert.rejects(() => ctx.cloud.verifyRecoveryCode("a@b.es", "abc"), /invalid_code/);
  assert.equal(calls.verifyOtp.length, 1);
  // Error del servidor (caducado/incorrecto): se propaga, no se finge sesión.
  calls.otpResult = { data: { session: null }, error: new Error("Token has expired or is invalid") };
  await assert.rejects(() => ctx.cloud.verifyRecoveryCode("a@b.es", "654321"), /expired/);
}
// 4. La pantalla: tras pedir el correo se pasa al código; el código va ANTES de la rama de cuenta
//    (verifyOtp deja sesión) y al validar se pasa a «contraseña nueva».
{
  assert.match(comps, /showToast\(t\("au_reset_sent"\)\); setCode\(""\); setMode\("code"\)/);
  const iCode = comps.indexOf('if(mode==="code")'), iUid = comps.indexOf("  if(uid){", iCode), iNew = comps.indexOf('if(mode==="newpass")');
  assert.ok(iCode > 0 && iUid > iCode && iNew > iCode, "orden de ramas: code < newpass < cuenta");
  assert.match(comps, /cloud\.verifyRecoveryCode\(email,code\)\s*\.then\(function\(\)\{ setPass\(""\); setMode\("newpass"\); \}\)/);
}
console.log("recovery-otp: ok");
