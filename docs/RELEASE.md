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

### ⚠ La segunda trampa: el puente MATA el redirect de las Releases

GitHub redirige el nombre viejo de un repo renombrado **solo mientras no exista otro repo con
ese nombre**. Al crear el puente, ese redirect murió y saltaron dos 404 nuevos, medidos el mismo
día:

```
github.com/JuanjoAvila/Mi-Cartera/releases/download/v4.18.22/…apk   → 404  (la APK que anuncia prod)
github.com/JuanjoAvila/Mi-Cartera/releases/download/beta/version.json → 404  (BASE_BETA del worker nativo)
```

O sea: **mientras el puente exista, es él quien manda sobre ese nombre y tiene que servir TODO lo
que servía antes** — Pages *y* Releases. Hoy sirve las cuatro puertas que usa un cliente antiguo:

| puerta | quién la pide |
|---|---|
| `/Mi-Cartera/version.json` (Pages) | el JS del bundle viejo |
| `/Mi-Cartera/bundle.zip` (Pages) | la descarga del OTA |
| `/Mi-Cartera/apk.json` (Pages) | **el aviso de APK nueva** — sin esto no hay forma de sacarles de la APK vieja |
| release `beta` del repo puente | `BASE_BETA` cocido en el `OtaCheckWorker` de la APK ≤45 |

`npm run salud` comprueba las cuatro en cada vuelta, y también que el `url` del `version.json` y
del `apk.json` de producción **respondan**, no solo que existan. Antes solo se miraba el número de
versión, y por eso el 404 vivió sin que saltara nada.

### Cómo se apaga el puente (el único camino)

1. Arreglar los bloqueos de promote y promocionar a `main`.
2. Compilar la **APK nueva desde `main`** (base `/Aely/`, ya en código desde 4.19.81) y publicarla
   como release **de Aely**.
3. Apuntar a esa release los **dos** `apk.json`: el de Aely y el del puente.
4. Que los **tres** móviles la instalen. Los de la familia se enteran **por el puente**: es el
   vehículo que entrega su propio reemplazo.
5. Comprobar por telemetría que no queda ningún `versionCode ≤ 45` vivo.
6. **Entonces** borrar el repo puente. El redirect de Releases vuelve solo, y la ruta vieja de
   Pages ya no la pide nadie. Y con él se borra el bloque «Puente» de `scripts/salud.mjs`.

No se puede saltar ningún paso, y el orden importa: borrar antes del 5 deja a alguien incomunicado
sin forma de avisarle.

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
