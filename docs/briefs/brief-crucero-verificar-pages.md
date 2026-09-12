# Brief · Crucero — verificar que Pages ya sirve 4.16.1

**Para:** Claude del móvil (o cualquier agente), si él pregunta desde el viaje  
**Fecha:** 2026-08-06 (noche, justo antes del crucero)  
**Repo:** `E:/Mi cartera` · rama viva = `main` ya tiene **4.16.1**; lo que falta es solo el **espejo en Pages**  
**Canal:** producción (familia). **No abras tandas nuevas ni features.** Solo verificar / desatascar el deploy web.

---

## Qué le dices tú (frase lista para pegar)

> Mira `docs/briefs/brief-crucero-verificar-pages.md` y comprueba si Pages ya sirve la 4.16.1. Si no, relanza el deploy. No toques features ni la APK salvo que yo lo pida.

---

## Estado al salir (2026-08-06 ~20:35 hora península)

| Pieza | Estado |
|--------|--------|
| Código en `main` / `VERSION` | **4.16.1** (arreglo barra bajo cámara + Wallet + release hygiene) |
| APK GitHub | **39 / 4.16.1** → [v4.16.1](https://github.com/JuanjoAvila/Aely/releases/tag/v4.16.1) |
| Su móvil | Ya tiene release limpia (~38 o 39). **Si la app va bien, no reinstales.** |
| Supabase (migración 0020 + ingest Wallet) | **OK** — Google Pay / Wallet **sí se pueden probar** |
| Pages live | AÚN **`version.json` = 4.15.0** y **`apk.json` = 35** (outage de GitHub Actions/Pages, no cuota de minutos) |
| Antídoto deploys | `docs/RELEASE.md` + `npm run release:apk` + guardián WEBDEBUG |

**No era la cuota de Actions:** status.github.com marcó Actions/Pages en *major_outage*; hubo runs en verde el mismo día (si no hubiera minutos, no arrancarían).

---

## Checklist (hazlo en este orden)

### 1. ¿Ya está bien?

```bash
curl -sL https://juanjoavila.github.io/Aely/version.json
curl -sL https://juanjoavila.github.io/Aely/apk.json
```

**Listo** si ves `"version":"4.16.1"` (o al menos `4.16.0+`) **y** `apk.json` con `versionCode` **39** / `versionName` **4.16.1**.

Si está listo → dile: «Pages ya sirve 4.16.1; en Mis bancos debe salir v4.16.1; Wallet se puede probar; sin tipo de cambio en otra moneda no se apunta.» **Para.** No abras más frentes.

### 2. ¿GitHub ya no está caído?

Mira https://www.githubstatus.com (Actions + Pages).  
Si siguen en *outage* → dile «sigue caído GitHub, no es tu cuenta» y **no spamees** deploys. Reintenta más tarde.

### 3. Relanzar Pages (solo si el status ya es verde/amarillo y live sigue viejo)

```bash
gh workflow run deploy.yml --ref main
gh run list --workflow=deploy.yml --limit 3
```

Espera a que el run acabe en **success** y vuelve al paso 1.

Si el job muere al arrancar con `Service Unavailable` / 502 → es infra otra vez; no es el repo.

### 4. Supabase (solo si Wallet falla de verdad)

```bash
gh run list --workflow=supabase.yml --limit 3
```

Si hace falta: `gh workflow run supabase.yml --ref main`.  
Migración importante: `0020_expenses_divisa.sql`. Sin tipo FX en Ajustes → Dinero, un pago en ₺ **no se guarda** (a propósito).

---

## Qué NO hacer en el crucero

- **No** features, no backlog, no destello, no import histórico.
- **No** `MICARTERA_WEBDEBUG=1` al compilar release (el guardián aborta; ver `docs/RELEASE.md`).
- **No** instalar el paquete `.debug` ni confundirlo con la app real.
- **No** `git push origin beta` a secas → `git push origin refs/heads/beta:refs/heads/beta`.
- **No** tocar `apk.json` apuntando a un release que no existe.
- **No** gastar la sesión entera midiendo si Pages está caído: un curl + un status bastan.

---

## Cómo verifica él en el móvil

1. Mis bancos (o Ajustes) → versión web **v4.16.1** cuando Pages ya sirva.
2. Pago con Google Pay: debe entrar solo. Si es otra moneda → Ajustes → Dinero → tipo aplicado.
3. Si algo no entra: captura de la **noti** de Wallet (título + texto), no adivinar formatos.

---

## Al volver de viaje (semana siguiente)

Pendientes grandes **aparte** de este fleco: inventario en `docs/memoria/mi-cartera-backlog-2026-08.md` y `docs/ROADMAP.md`.  
Este brief **solo** cierra el espejo Pages / familia OTA de la 4.16.x.

### Parpadeo al tocar / deslizar pestañas (apuntado 2026-08-06 noche)

Él grabó vídeo (`tools/movil/_flicker_tabs.mp4`). **También le pasa a la pareja en 4.15.0** → no es
de la APK de Wallet de esta noche. En fotogramas se ve Inicio+Gastos a la vez (p. ej. barra en
Inicio mientras el cuerpo es Gastos) — misma familia que el host transparente / season-glow
(glow22). **Prueba barata al volver:** Ajustes → Apariencia → Temática → **Ninguna**; si el
parpadeo desaparece, el culpable es la ruta `html[data-season]`. No abrir fix gordo en el crucero.

**Pista 2026-08-06 21:55 (su captura):** en **Cartera** (última pestaña), si tiras **más a la
derecha** (no hay tab) y mantienes el dedo, se ve una **franja/capa negra** al borde derecho —
el contenido se desplaza y deja ver lo que hay detrás del carrusel (`.viewport` / portal
`.season-glow` / `--bg`). Sospecha suya: esa misma capa es la que **parpadea** al scrollear en
cualquier tab. Hipótesis de trabajo al volver:

1. El gesto de tabs **no clampa** el `translate` en el borde (rubber-band más allá de 0…n−1).
2. Al tocar / empezar gesto, un frame con host transparente o sin `visibility:hidden` en hermanas
   deja ver ese fondo negro → “flicker”.
3. Repro mínimo: Cartera → arrastrar hacia la derecha hasta ver la franja; A/B con temática Ninguna.

Captura de referencia: la que mandó por chat (Cartera con hueco negro a la derecha).
