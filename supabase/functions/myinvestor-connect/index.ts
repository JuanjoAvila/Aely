// ============================================================
// Edge Function: myinvestor-connect  (verify_jwt = true)
// La llama la app (usuario logueado en Aely). Hace el login en la API de MyInvestor
// y guarda SOLO los tokens de sesión (nunca la contraseña) en myinvestor_links.
//
// Flujo (dos pasos posibles, como la app oficial):
//   1) body { customerId, password, deviceId }  → login
//        · 200 → tokens guardados, { ok:true, connected:true }
//        · 202 → pide OTP (SMS): { ok:true, otp:true, otpId, signatureRequestId }
//        · 403 SECURITY_001 → reCAPTCHA condicional: { ok:false, recaptcha:true }
//        · 400 → credenciales incorrectas
//   2) body { customerId, password, deviceId, otpId, signatureRequestId, code } → valida OTP
//
// La CONTRASEÑA se usa de paso para el login (MyInvestor la re-pide en el paso OTP) y NUNCA
// se guarda ni se loguea. verify_jwt ata el enlace al usuario de Aely.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResp, MI_BASE, miHeaders } from "../_shared/myinvestor.ts";
import { miTokensToRow } from "../_shared/token_store.ts";
import { withCors } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/ratelimit.ts";

Deno.serve(withCors(async (req: Request) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supa = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return jsonResp({ ok: false, error: "sin sesión" }, 401);

    /* FRENO POR USUARIO (2026-07-25). Aquí van usuario y CONTRASEÑA reales hacia MyInvestor:
       si algo entra en bucle —un reintento del cliente, un dedo nervioso con el OTP— el banco
       puede BLOQUEAR la cuenta del usuario por intentos fallidos. Así que el límite no está
       solo para frenar a un atacante: está para que la app no pueda dejar a nadie fuera de su
       propio banco. 10 intentos cada 10 minutos da de sobra para equivocarse un par de veces
       con la contraseña y el OTP. Ver 0019_rate_limit.sql. */
    const admin0 = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const gate = await rateLimit(admin0, "mi-login:" + user.id, 10, 600);
    if (!gate.ok) return jsonResp({ ok: false, error: "Demasiados intentos seguidos. Espera unos minutos antes de volver a probar (tu banco bloquea la cuenta si insistes)." }, 429);

    const body = await req.json().catch(() => ({}));

    // Modo «guardar tokens» (v4.0.12): el login se hizo EN EL MÓVIL (CapacitorHttp, IP
    // residencial — el reCAPTCHA condicional salta casi siempre desde la IP de datacenter de
    // Supabase y casi nunca desde la del usuario, que es la vía de la app oficial). Aquí NO
    // llega ninguna contraseña: solo los tokens, y se VALIDAN contra la API antes de guardar
    // (nunca a ciegas: un token corrupto rompería sync y keepalive en silencio).
    if (body?.storeTokens) {
      const devId = String(body?.deviceId || "").trim();
      const access = String(body?.accessToken || "");
      const refresh = body?.refreshToken ? String(body.refreshToken) : null;
      const refreshSecs = Number(body?.refreshExpiresIn || 0);
      if (!devId || !access) return jsonResp({ ok: false, error: "faltan datos" }, 400);
      const chk = await fetch(MI_BASE + "/cperf-server/api/v2/securities-accounts/self-basic", {
        headers: miHeaders(devId, access),
      });
      if (chk.status !== 200) return jsonResp({ ok: false, error: "el token del móvil no valida (HTTP " + chk.status + ") — reintenta el login" }, 400);
      const refreshExp = refreshSecs > 0 ? new Date(Date.now() + refreshSecs * 1000).toISOString() : null;
      const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const enc = await miTokensToRow(access, refresh);
      await admin.from("myinvestor_links").upsert({
        user_id: user.id,
        device_id: devId,
        access_token: enc.access_token,
        refresh_token: enc.refresh_token,
        refresh_expires_at: refreshExp,
        status: "active",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      return jsonResp({ ok: true, connected: true });
    }

    const customerId = String(body?.customerId || "").trim();
    const password = String(body?.password || "");
    const deviceId = String(body?.deviceId || "").trim();
    const otpId = body?.otpId ? String(body.otpId) : null;
    const signatureRequestId = body?.signatureRequestId ? String(body.signatureRequestId) : null;
    const code = body?.code ? String(body.code).trim() : null;
    if (!customerId || !password || !deviceId) return jsonResp({ ok: false, error: "faltan datos" }, 400);

    // Cuerpo del login: base + (si es el paso OTP) los tres campos de OTP.
    // deno-lint-ignore no-explicit-any
    const loginBody: any = { customerId, password };
    if (code && otpId && signatureRequestId) {
      loginBody.otpId = otpId;
      loginBody.signatureRequestId = signatureRequestId;
      loginBody.code = code;
    }

    const res = await fetch(MI_BASE + "/login/api/v2/auth/token", {
      method: "POST",
      headers: miHeaders(deviceId),
      body: JSON.stringify(loginBody),
    });
    const text = await res.text();
    // deno-lint-ignore no-explicit-any
    let j: any = {}; try { j = JSON.parse(text); } catch { /* deja {} */ }

    // 202 → pide OTP por SMS
    if (res.status === 202) {
      const d = (j && j.payload && j.payload.data) || {};
      return jsonResp({ ok: true, otp: true, otpId: d.otpId || null, signatureRequestId: d.signatureRequestId || null });
    }
    // 403 SECURITY_001 → reCAPTCHA condicional (no lo resolvemos aquí)
    if (res.status === 403 && j?.status?.code === "SECURITY_001") {
      return jsonResp({ ok: false, recaptcha: true, error: j?.status?.message || "MyInvestor pide una verificación extra (reCAPTCHA). Inténtalo de nuevo en un rato." });
    }
    // 200/201 → éxito: guarda tokens
    if (res.status === 200 || res.status === 201) {
      const d = (j && j.payload && j.payload.data) || {};
      const access = d.accessToken;
      const refresh = d.refreshToken;
      const refreshSecs = Number(d.refreshExpiresIn || 0);
      if (!access) return jsonResp({ ok: false, error: "respuesta de login sin token" }, 502);
      const refreshExp = refreshSecs > 0 ? new Date(Date.now() + refreshSecs * 1000).toISOString() : null;
      const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const enc = await miTokensToRow(access, refresh || null);
      await admin.from("myinvestor_links").upsert({
        user_id: user.id,
        device_id: deviceId,
        access_token: enc.access_token,
        refresh_token: enc.refresh_token,
        refresh_expires_at: refreshExp,
        status: "active",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      return jsonResp({ ok: true, connected: true });
    }
    // 400 u otros → credenciales/entrada inválidas
    const msg = (j?.status?.message) || (j?.payload?.data?.message) || ("login HTTP " + res.status);
    return jsonResp({ ok: false, status: res.status, error: msg });
  } catch (e) {
    return jsonResp({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
}));
