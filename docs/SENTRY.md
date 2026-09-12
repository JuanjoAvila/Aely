# Sentry — guía paso a paso (Aely)

## ¿Es de pago?

**No obligatoriamente.** Sentry tiene:

| Plan | Qué incluye |
|------|-------------|
| **Trial 14 días** | Todo ilimitado mientras pruebas |
| **Developer (gratis para siempre)** | ~5.000 errores/mes — de sobra para uso personal/familiar |

Después del trial **no te cobran solos** si no metes tarjeta. Pasas al plan gratis con límite de volumen.

---

## ¿Para qué sirve?

Cuando la app **petardea en el móvil de alguien** (pantalla blanca, crash raro), Sentry te manda:

- mensaje del error
- versión de la app
- móvil / navegador
- **sin** datos financieros del usuario

Es la “caja negra” en producción. Playwright prueba antes de publicar; Sentry avisa cuando falla en la calle.

---

## ⚠️ NO uses el «Loader Script» de Sentry

La pantalla de Sentry te pide pegar algo así:

```html
<script src="https://js-de.sentry-cdn.com/….min.js" …>
```

**No lo pegues en Aely.** Motivos:

1. La app **ya lleva** Sentry auto-hospedado en `public/vendor/sentry.bundle.min.js` (offline + sin CDN de terceros).
2. El CI inyecta tu DSN al construir (`SENTRY_DSN`).

### Qué hacer en esa pantalla

1. Arriba a la derecha → botón **«Copy DSN»** (no el script).
2. El DSN es una URL tipo:  
   `https://xxxx@oNNNN.ingest.de.sentry.io/NNNN`
3. Si ya lo pusiste en GitHub Secrets como `SENTRY_DSN` → **listo** (en este repo **ya está** desde 2026-07-16).
4. Puedes pulsar **Skip** / cerrar el wizard. El «Waiting for error…» se puede ignorar: el primer crash real en producción aparecerá en **Issues**.
5. En la app publicada (con DSN inyectado): **Ajustes → Sentry → Enviar error de prueba** para ver un Issue sin petar la app.

---

## Pasos (resumen)

### 1. Proyecto Sentry

- Browser JavaScript → **Nope, Vanilla** → solo Error monitoring → **Copy DSN**

### 2. Secreto en GitHub

1. Repo **Aely** → **Settings** → **Secrets and variables** → **Actions**
2. Secret: `SENTRY_DSN` = el DSN completo

### 3. Deploy

Push a `main` → el workflow `deploy.yml` pasa el secreto a `build-app.mjs` → la web publicada ya reporta.

### Local (opcional)

```powershell
cd "E:\Aely"
$env:SENTRY_DSN="https://…@….ingest.sentry.io/…"
npm run build
```

Sin DSN: la app funciona igual; Sentry no hace nada.

---

## Regenerar vendor

```bash
npm run build:sentry
```

Ver también [TESTING.md](TESTING.md) · [PLAYWRIGHT-WIN.md](PLAYWRIGHT-WIN.md).
