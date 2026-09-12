# Playwright en Windows (disco E:)

## El problema típico

Si abres CMD en `C:\Users\...` y haces `cd "E:\Aely"`, a veces falla por:

- comillas raras al pegar
- PowerShell vs CMD
- `npm` no encontrado en esa sesión

## Forma fiable (PowerShell)

1. Win + X → **Terminal** o **Windows PowerShell**
2. Pega **línea a línea**:

```powershell
E:
cd "\Aely"
pwd
npm install
npx playwright install chromium
npm test
```

`E:` cambia al disco. `cd "\Aely"` entra en la carpeta (ruta absoluta desde raíz del disco).

## Alternativa: abrir la carpeta en el Explorador

1. Abre `E:\Aely` en el Explorador
2. En la barra de dirección escribe `powershell` y Enter
3. Ya estás en la ruta correcta → `npm test`

## Si `npm` no existe

Instala Node LTS desde https://nodejs.org y **cierra/abre** la terminal.

## Sentry (foto del framework)

Elige **«Nope, Vanilla»** → Configure SDK → copia el **DSN** → GitHub Secrets `SENTRY_DSN`.  
No elijas React/Capacitor: el SDK ya va embebido en la app.
