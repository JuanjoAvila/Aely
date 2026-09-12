# Pack de diseño — Aely v4.0

Contenido para implementar el rediseño. Soltar esta carpeta en `docs/design/` del repo.

## Archivos
- `SPEC-v4.md` — LA especificación completa (30 secciones): tokens, navegación, las 5 pantallas, sheets, pantallas secundarias, motion, accesibilidad, copys y checklist de QA. **Fuente de verdad.**
- `mockup-mi-cartera-v4.html` — mockup interactivo standalone (abrir en navegador, no necesita servidor). Navegable: 5 tabs, sheet Apuntar con teclado, Plan segmentado, Ajustes (avatar), onboarding (prop `pantalla`).
- `capturas/` — referencias visuales exactas:
  - `01-app.png` Inicio
  - `02-app.png` Gastos
  - `03-app.png` Plan › Recibos
  - `04-app.png` Plan › Deudas
  - `05-app.png` Plan › Metas
  - `06-app.png` Cartera
  - `07-app.png` Ajustes
  - `08-app.png` Sheet «Apuntar» (FAB) con importe tecleado
  - `01/02/03-onboarding.png` Onboarding pasos 1-3

## Cómo usarlo (Cursor)
1. Lee `SPEC-v4.md` entero antes de tocar código. El §12 da el orden de implementación sobre los módulos existentes (`src/modules/*`).
2. Las capturas mandan sobre cualquier duda de espaciado/color; el mockup HTML permite inspeccionar los estilos computados reales (todo es inline).
3. No inventar cifras ni copys: los textos de ejemplo están en la spec §29 y en el mockup.
4. Criterio de aceptación: pantalla implementada al lado de su captura → indistinguible.
