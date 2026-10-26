# Rotación del token de ingest (legacy)

> Para usuarios nuevos o la pareja: **no hace falta este documento**. Cada persona genera su token en **Ajustes → Notificaciones → Apuntar aquí mis gastos de Trade Republic**. Eso crea una fila en `ingest_tokens` y el lector Android usa esa URL automáticamente.

Este documento cubre el **secreto legacy** `INGEST_TOKEN` + `INGEST_USER_ID` (single-user, MacroDroid antiguo o builds muy viejos del APK).

---

## Cuándo rotar

- Sospechas de que alguien vio el token (captura, repo público, log compartido).
- Quieres dejar de usar el token compartido y pasar a tokens por usuario (recomendado).
- Cambias de proyecto Supabase.

---

## Pasos (legacy)

1. **Genera un token nuevo** (32+ caracteres aleatorios). Ejemplo en PowerShell:
   ```powershell
   [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
   ```

2. **Actualiza el secreto en Supabase**
   - Dashboard → Project Settings → Edge Functions → Secrets
   - Edita `INGEST_TOKEN` con el valor nuevo
   - Redeploy de la función `ingest` si hace falta (push a `main` ya lo hace en CI)

3. **Actualiza quien envía gastos**
   - **App nativa (recomendado):** Ajustes → activa «Apuntar aquí mis gastos de TR» (genera token propio en `ingest_tokens`; el legacy deja de usarse).
   - **MacroDroid (jubilado):** cambia la URL del POST a  
     `https://<PROJECT_REF>.supabase.co/functions/v1/ingest?token=<NUEVO_TOKEN>`
   - **APK muy antiguo** con `BuildConfig.INGEST_URL` fijo: recompila con el token nuevo o migra al toggle multiusuario.

4. **Revoca el token antiguo** — al cambiar el secreto, el anterior deja de funcionar de inmediato.

5. **Comprueba** — haz un gasto de prueba en TR (o un POST manual) y verifica que aparece en la app tras sincronizar.

---

## Multi-usuario (estado actual)

| Mecanismo | Tabla / secreto | Quién lo usa |
|-----------|-----------------|--------------|
| Token por persona | `ingest_tokens` | Toggle en Ajustes + lector Android (`setIngestUrl`) |
| Legacy compartido | `INGEST_TOKEN` + `INGEST_USER_ID` | MacroDroid, APKs sin multiusuario |

La Edge Function `ingest` resuelve `?token=` → `user_id` en `ingest_tokens`; si no encuentra fila, cae al legacy.

---

## Referencias

- Setup Supabase: [SETUP-SUPABASE.md](SETUP-SUPABASE.md)
- App Android: [SETUP-ANDROID.md](SETUP-ANDROID.md)
- Migración multiusuario: `supabase/migrations/0008_ingest_tokens.sql`

## Identidad y reintentos de ingest (candidato SEC02 F2)

La huella pertenece al evento y al usuario del token, no al importe/comercio. El [contrato de ranuras y ACK](briefs/sec02-ingest-native-slots.md) documenta las colisiones, reintentos503, lectores y compatibilidad sin SQL. Android conserva un debounce previo de180s que queda fuera de este cambio.

### PR313 R2: lector antes de activar escritura

La fase 1 añade la marca nativa no bancaria con huella completa. La Edge solo la escribe con INGEST_NATIVE_TWINS=1; por defecto está OFF y conserva filas/céntimos legacy normales, reteniendo R1 failclosed/recovery/ACK. No activar por este candidato: la fase 2 es otra PR tras confirmación del dueño de todos los móviles actualizados. Contrato y matriz en [SEC02](briefs/sec02-ingest-native-slots.md).
