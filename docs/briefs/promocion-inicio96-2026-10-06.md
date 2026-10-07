# Promoción selectiva96 · Tres metas en Inicio · 6/10/2026

Candidata local, sin publicación. Autorización humana directa del dueño6/10 para `inc-0410-inicio-tres-metas`; encargo root `ops-0610-inicio96-production-exact-20261006`, claim confirmado en5fa84adc y precisión autoritativa para la nota96 y sus artefactos generados. Base main `537edc1c33433fe122266e21f0d158c7b943b625`, rama aislada `aely-prod96-prep`. No se incorpora beta completa.

Fuente aprobada beta4.26.96.1 `ca6f5e854c58ae7d73f24b604f20c8058b4b50a3`, huella `f74ec4d9155e1557`. El registro y su bloque exacto producen revisión web `06180d02b24123caf20a1ca188f1f5f63c12d2d20974a3917b8d3377dd6084d9` y revisión agregada `644e53e3d72722ee5503797dc3727bbacd0797d9b253d279c5479189ea231e0f`, idénticas al leer esa fuente por Git. No confundir la revisión web con el digest agregado.

## Alcance

- Único fichero runtime cambiado: `src/modules/03-tab-dash.js`, idéntico byte a byte a la fuente aprobada; filtra terminadas antes de limitar tres metas. Plan y el estado guardado conservan todas.
- Doce casos DOM exactos de `e2e/listas-render.spec.mjs`: es/en/ca y cero/una/tres/cinco activas, una terminada al principio, enlace a Plan, importes y estado intactos. Registro añadido a Inicio en `scripts/relevant-tests.mjs`; la cobertura anterior de Plan y el test de rendimiento sostenido de main se preservan.
- Scope exacto de la tanda añadido a `scripts/beta-sources.json`. PERSIST91 añade esa unidad de lectura a su lista explícita, conservando detección de llamadas reales a set, dieciocho alcances que escriben y sus mutantes. No se incorporan otros cambios de tests de beta.
- VERSION/package/package-lock96; nota96 es/en/ca con `tandas:[]`. Comparación estructural independiente confirma las215 notas anteriores completas, sin editar ninguna. README/ROADMAP/CHANGELOG/EMPIEZA-AQUI reflejan candidata local y límites.
- `public/index.html`, `public/release-notes.json` y `public/beta-delivery.json` proceden únicamente del build. Dos builds sucesivos produjeron bytes idénticos en los tres. No se copia catálogo beta ni se editan artefactos a mano.

## Verificación al cerrar la candidata

Todos los comandos siguientes terminaron con exit0: build; check-syntax (7 bloques); docs-frescura; docs-frescura-history (29 repositorios); guard-privacy; relevant-tests; beta-source-parse; persist-commit; dash-metricas; fechas-cache; i18n-keys; novedades-idiomas; release-notes-max; beta-tandas-vacias; beta-veredictos; security. Comprobación independiente de runtime, scope/revisión, notas anteriores y ausencia de deltas en Android/Edge/SQL/APK: exit0. Reproducibilidad de build: exit0.

`beta-sources.test.mjs` permanece activo al crear este commit; PERSIST91 y sus comprobaciones iniciales ya pasaron, pero no se acredita exit0 del proceso completo. El coordinador recibirá el resultado posterior contra el mismo commit. Suite completa y Deno pendientes de CI exacta, no ejecutados localmente.

Playwright descubre los doce casos nuevos (exit0 en `--list`). El intento real `chromium.launch()` falla con exit1 antes de abrir una página: no existe el binario esperado `chromium_headless_shell-1228`. No se instala ni descarga nada. Por tanto no se acredita DOM local; CI exacta debe ejecutar los doce casos y la cobertura pertinente antes de publicar. El antecedente del bloqueo por socket tampoco sirve como prueba de esta candidata.

## Límites y entrega

Revisión independiente del commit final, CI exacta y artefactos servidos pendientes del coordinador. No se ha publicado código, creado PR ni desplegado. Android, APK estable, versionCode, backend/Edge/SQL y el resto del runtime de main permanecen intactos. No hay sincronización bancaria automática ni operación de dinero real. INC-2709-09 acumulativo permanece abierto: reducir este resumen no certifica corregir la degradación por uso prolongado.
