# Cómo publicar Aely (sin calvarios)

Circuito oficial desde el incidente del **2026-08-06** (WEBDEBUG colado, Pages caído,
apk.json a releases fantasma, promote encolado…). Detalle técnico en `AGENTS.md` §6.

## Los 6 pasos

1. **Trabaja en `beta`** (`git push origin refs/heads/beta:refs/heads/beta` — hay tag `beta`).
2. **Él prueba en el móvil** y aprueba en Ajustes → Revisar esta beta.
3. **Promote:** `gh workflow run promote-beta.yml -f confirmar=SUBIR`  
   Si Actions está caído/encolado → merge manual `beta`→`main` y dilo en el parte.  
   Tras el promote: `npm run test:syntax` y revisa el diff `main` vs `beta` (`-X theirs` traga cosas).
4. **Espera Supabase verde** (migraciones + Edge Functions) antes de cantar Wallet/ingest.
5. **APK nativa (si tocó Java/Kotlin/iconos o quieres APK alineada):**
   ```bash
   # versionName = VERSION, versionCode += 1 en android/app/build.gradle
   # MICARTERA_WEBDEBUG=0 en android/local.properties
   npm run release:apk
   ```
   Eso prepara, compila, verifica firma `CN=Mi Cartera`, sube el asset a `v$VERSION` y escribe
   `public/apk.json` al URL **real**. Luego commit + push a `main` (o beta→promote) para que
   Pages sirva el manifiesto.
6. **Instala** con el checklist que imprime el script (adb push + `pm install -r`), o espera a
   que Pages actualice `apk.json` y salga el aviso en la app. Confirma Mis bancos → `vX.Y.Z`.

OTA web ≠ APK: un fix en `android/**` **no** llega por Pages.

## Puente OTA legacy `/Mi-Cartera` (2026-09-12)

Al renombrar el repo a **Aely**, GitHub Pages **no** redirige
`https://juanjoavila.github.io/Mi-Cartera/`. Los móviles con la base vieja cocida
(producción 4.18.25 y **APK ≤ 44**) pedían ahí y recibían **404**: padre, pareja y el
`OtaCheckWorker` nativo se quedaban sin canal.

Por eso existe el repo público **`JuanjoAvila/Mi-Cartera`** (distinto de Aely): solo sirve
Pages con `version.json` + `bundle.zip` en esa ruta. El manifiesto apunta al bundle real en
`/Aely/`.

⚠ **Mientras haya una APK 44 (o anterior) en circulación, ese repo / esa ruta no se borra.**
Es tirita, no cura: la cura es APK nueva con base `/Aely/` (desde 4.19.81 en código). En cada
promote de producción hay que actualizar el `version.json` del puente (mismo número + URL Aely).

Crear o tocar repos públicos en su cuenta **se pregunta antes** (feedback del mismo día).

## Qué NUNCA hacer

| Trampa | Por qué duele |
|--------|----------------|
| `MICARTERA_WEBDEBUG=1` al publicar | Socket de depuración en la APK real (barra rara bajo la cámara, 2026-08-06). `assembleRelease` y `release:apk` **abortan**. |
| `git add -A` / meter `tools/movil/_*.png` | Ruido y capturas en el repo público. |
| Escribir `apk.json` apuntando a un release que aún no existe | La familia pulsa actualizar y descarga 404 / nada. |
| Instalar `app-debug.apk` / `.debug` “sobre” la real | Es **otra app** (`com.micartera.app.debug`). No actualiza la de producción. |
| Copiar `public/` → `www/` a mano | Bundle con `APP_VERSION:"dev"` → ese móvil **nunca** vuelve a actualizar (2026-07-25). Usa `apk:prep` / `release:apk`. |
| Push a `main` de algo que él nota, sin beta | Padre y pareja hacen de banco de pruebas. |
| `git push origin beta` a secas | Ambiguo (rama + tag). Usa `refs/heads/beta`. |

## Si GitHub Actions / Pages están caídos

- Repo y release APK **sí** se pueden dejar listos (`release:apk` + commit).
- `version.json` / `apk.json` **live** no cambian hasta que Pages recupere.
- Reintenta `gh workflow run deploy.yml --ref main` con paciencia (backoff), no spamees.
- Parte claro: «APK en GitHub OK; OTA pendiente de outage».
- Desde el móvil / viaje: checklist lista en
  [`docs/briefs/brief-crucero-verificar-pages.md`](briefs/brief-crucero-verificar-pages.md).

## Comandos útiles

```bash
npm run salud          # qué dice el repo vs qué sirve Pages ahora
npm run release:apk    # APK de producción de punta a punta
npm run apk:prep       # solo prep (también exige WEBDEBUG off)
gh run list --workflow="Deploy a GitHub Pages" --limit 3
```
