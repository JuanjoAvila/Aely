# Cómo publicar Aely (sin calvarios)

Circuito oficial desde el incidente del **2026-08-06** (WEBDEBUG colado, Pages caído,
apk.json a releases fantasma, promote encolado…). Detalle técnico en `AGENTS.md` §6.

Prioridad del dueño (4/10): cerrar primero la entrega a producción de las aprobadas vigentes; después retirar esas tandas del catálogo beta conservando arrays vacíos, notas y veredictos. No estrenar otra ronda mientras se deja lo aprobado esperando sin un bloqueo concreto. El recibo web no sustituye APK ni Edge; sus entregas se acreditan por separado.

## InicioAhora y una referencia rechazada · candidata4.26.112

La versión4.26.112 añade `inc-0910-inicio-solo-actual` al catálogo229.109 conserva rechazo, f4ff/B90/d05 y guion original como referencia de sólo lectura; queda fuera de web/pruebas vigentes. SHA histórico ausente, pin o guion distinto abortan la construcción. Los dos consumidores del motor no heredan OK antiguo; ops-0410 sigue retirado. Recientes106 conserva su expresión e identidad y Nómina el cuerpo111 de seedFlows.

Presupuesto oficial del paquete integrado PASS:1.321.606 bytes minificados/360.945 gzip/3 cargas frente a topes1.326.080/361.472/3 intactos. El A/B conserva el fallo previo y mide1.328.880/362.544→1.321.606/360.945: ahorro7.274/1.599 bytes y527 de margen gzip. Validación del candidato integrado: guardián completo57 casos/1.792 mutaciones de funciones/713 de datos PASS;131 DOM de Inicio/panel/reapertura/Tour/vacíos PASS. La continuación funcional aporta728 PASS y1 captura opcional omitida, además de92 casos previos y12 del FAB;963 PASS y1 omisión en total, con12 casos del indicador abiertos por salida inesperada del documento en Chromium local. Rendimiento13 PASS serial, sin reintentos.130 de131 etapas Node pasan; el espejo local de memoria aborta por privacidad y Deno no está instalado. No se atribuye suite local completa verde. CI de la fuente exacta y cotejo de artefactos se acreditan antes de la entrega; aceptación móvil, producción y APK nuevo requieren sus gates propios.

VERSION, package/lock y documentación describen4.26.112 del canal beta. Build genera index, notas y recibo. La entrega exige CI terminal de la fuente exacta, manifiesto/ZIP/HTML/SW/catálogo/recibo coherentes y bytes cotejados en ambos espejos. La corrección112 necesita aprobación móvil propia;109 REJECTED permanece. APK, Edge y producción se acreditan por separado.

## Los 6 pasos

1. **Trabaja en `beta`** (`git push origin refs/heads/beta:refs/heads/beta` — hay tag `beta`).
2. **Él prueba en el móvil** y aprueba en Ajustes → Revisar esta beta.
3. **Promote:** `gh workflow run promote-beta.yml -f confirmar=SUBIR`  
   Si Actions está caído/encolado → merge manual `beta`→`main` y dilo en el parte.  
   El promote espera al run de `deploy.yml` del SHA recién fusionado. Si su suite tarda,
   continúa esperando; si el run termina rojo, falla de inmediato. Tras el verde comprueba
   `version.json` y el sello del Service Worker de ese SHA en Pages. No relances el deploy por
   un promote aún en curso. Tras el promote: `npm run test:syntax` y revisa el diff `main` vs
   `beta` (`-X theirs` traga cosas).
4. **Supabase solo manual:** push/promote no activa backend. Si cambia Wallet/ingest, requiere autorización separada, referencia revisada y una función concreta en `supabase.yml`, `migraciones=no` por defecto. Verifica la fuente activa tras el despliegue. SQL conserva `continue-on-error`: el verde general no acredita migraciones.
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
Pages con `version.json` + `bundle.zip` + `apk.json` en esa ruta, y **releases espejo**
(`beta`, `vX.Y.Z` con el APK) porque crear el repo **mata** el redirect automático de
GitHub Releases del nombre viejo. El manifiesto apunta a assets reales en **Aely** cuando
se pueda; si no, el espejo en el puente evita el 404.

⚠ **Mientras haya una APK 44 (o anterior) en circulación, ese repo / esa ruta / esas
releases espejo no se borran.** Es tirita, no cura: la cura es APK nueva con base `/Aely/`
(desde 4.19.81 en código). En cada promote hay que actualizar el puente (mismos manifiestos
+ release `beta` espejo).
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

## Checksum del OTA (4.26.243)

`deploy.yml` y `beta.yml` escriben en `version.json` el `checksum` = SHA-256 de `bundle.zip`, y la app (`mcBundleOpts` en `12-boot`) se lo pasa al actualizador, que recalcula el SHA-256 del zip descargado y lo tira si no casa. Un manifiesto sin `checksum` válido se trata como antes (manifiestos viejos y el repo puente). Por eso **el puente tiene que copiar `version.json` y `bundle.zip` JUNTOS**, del mismo despliegue: con el manifiesto nuevo y el zip viejo, el móvil ya no instala el bundle viejo con número nuevo (lo que pasaba antes), sino que falla la descarga. En estable el zip lleva `?v=<versión>` para que la caché de Pages no sirva el zip viejo con el manifiesto nuevo. Es integridad, no autenticidad: la firma queda para la APK.

## Firma del OTA (SEG-01, lado APK desde la 65)

El dueño dijo sí a firmar el OTA con clave propia (18/11). El checksum de arriba solo demuestra que el zip es el que dice el manifiesto; quien pudiera escribir los dos a la vez colaría su código en los móviles. Con la firma, solo quien tiene la clave PRIVADA puede publicar una OTA que la APK acepte.

**Dónde está cada mitad:**

| Pieza | Dónde | Quién la usa |
|---|---|---|
| Clave **pública** (RSA-2048, PKCS#1) | `capacitor.config.json` → `plugins.CapacitorUpdater.publicKey` (repo, es pública) | La APK: `npx cap sync` la copia a `android/app/src/main/assets/` |
| Clave **privada** | `C:/Users/<usuario>/.micartera/capgo-ota-privada.pem` en el PC de casa, junto al keystore. **NUNCA al repo** (es público; `apk-puente-seguro` falla si aparece un `PRIVATE KEY` versionado) | El CI de Pages, como secreto de GitHub (ver abajo) |
| Copia de la pública | `C:/Users/<usuario>/.micartera/capgo-ota-publica.pem` | Para comprobar a mano |

Generada el 19/11/2026 con `crypto.generateKeyPairSync("rsa", {modulusLength:2048, …pkcs1…})` de Node (sin dependencias). Su identificador (lo que devuelve `MiCartera.appInfo().otaKeyId` y calcula el propio updater) es `MIIBCgKCAQEA3/1VToEJ`. **Haz copia de la privada** igual que del keystore: si se pierde, hay que generar otra pareja y sacar APK nueva; hasta entonces las APK con la clave vieja no aceptan ninguna OTA firmada con la nueva.

**Pendiente del dueño (no lo puede hacer un agente):** crear el secreto de Actions con la privada (por ejemplo `OTA_SIGNING_KEY`, en *Settings → Secrets and variables → Actions*, pegando el contenido del `.pem`). Sin ese secreto, la ronda C no puede firmar en CI.

**Cómo se firma (para la ronda C, `deploy.yml`/`beta.yml` + `12-boot.js`).** Comprobado contra el `CryptoCipher` real del updater 6.50.1 compilado con javac: acepta la firma y rechaza un checksum sin firmar.

1. CI: `sha = sha256(bundle.zip)` en bruto (32 bytes) y `firma = crypto.privateEncrypt({key, padding: RSA_PKCS1_PADDING}, sha).toString("hex")` (512 caracteres). Va a `version.json` en un campo propio (p. ej. `signature`), además del `checksum` de siempre.
2. Cliente: si `appInfo().otaKeyId` no está vacío, `up.download({url, version, checksum: firma, sessionKey: "firmado"})`. `sessionKey` tiene que ir NO vacío y SIN `:` (así el updater no intenta descifrar el zip, pero sí exige que el checksum venga firmado con la privada); con `otaKeyId` y sin `signature` en el manifiesto, **no se descarga** (si no, un manifiesto con checksum en claro seguiría valiendo y la firma no protegería nada).
3. Con `otaKeyId` vacío (APK 64 o anterior) sigue el checksum en claro de hoy: la firma no casaría con su SHA-256 y la OTA fallaría.

**⚠ Lo que cambia la APK con la clave aunque la web no se toque:** con `publicKey` presente el updater **rechaza cualquier descarga sin `checksum`** («Checksum required when public key is present»). Desde la 4.26.243 `version.json` lo lleva y `mcBundleOpts` lo pasa, así que la OTA de hoy sigue funcionando; pero un manifiesto viejo sin `checksum` (el repo puente `/Mi-Cartera` si se queda atrás, un despliegue a mano) deja a ese móvil sin OTA hasta que llegue uno bueno. Antes de publicar la APK 65: comprobar que el `version.json` servido en estable, beta y el puente lleva `checksum`.
