# Ayuda híbrida de Aely — 15/09/2026

## Petición y estado

El usuario eligió expresamente un asistente con pregunta escrita, guía y botones a la pantalla
adecuada, con ayuda básica sin conexión. Preparado en `codex/asistente-hibrido`, integrado sobre `fd31aa20` (4.24.3), bancos y categorías;
versión propuesta 4.27.0, posterior a categorías 4.26 y bancos 4.25. No publicado ni activado.

## Primera entrega

- Botón visible en Inicio y Ajustes. No sustituye ni elimina el tutorial existente.
- Siete temas: efectivo, metas, deudas, bancos, histórico, categorías y recibos. Texto revisado
  es/en/ca. Reconocimiento local por palabras; ante duda ofrece el catálogo y pide concretar.
- Los botones abren Apuntar, Cartera, segmentos reales de Plan, Mis bancos o Histórico.
  Apuntar preselecciona Efectivo solo si existe esa cuenta. Si falta, dirige a Cartera.
  Pantallas ocultas o modo sencillo dirigen a Ajustes; no cambia preferencias por sorpresa.
- Abrir una guía/destino no sincroniza bancos ni guarda movimientos. Se usan los formularios
  existentes con su revisión. La consulta no se persiste al cerrar el panel.
- Consulta opcional con IA: se pulsa después de una explicación clara del envío a OpenAI.
  Recibe únicamente la duda que la persona ha escrito. No se adjuntan saldos, movimientos,
  comercios extraídos de la cartera, identificadores de cuenta ni reglas personales.

La versión inicial busca guías, no mantiene una conversación general ni analiza el presupuesto.
Una pregunta sin correspondencia se reconoce como tal; no inventa cifras o instrucciones.

## Contrato remoto y coste para decidir la activación

`help-assistant` verifica JWT y `getUser`. Acepta una pregunta de hasta 600 caracteres y cuerpo
de hasta 4096 bytes; ignora datos extras. No consulta tablas financieras ni escribe app_events.
La respuesta contiene hasta tres ids conocidos; el cliente no ejecuta texto del modelo.

Proveedor: OpenAI Responses, snapshot fijo `gpt-4o-mini-2024-07-18`, `store:false`, salida de
hasta 200 tokens, timeout 12 s, JSON schema estricto. También se rechazan manualmente ids
desconocidos, JSON inválido, rechazo del modelo o respuesta incompleta.
[Contrato Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

Está **apagado por defecto**: exige `AELY_HELP_AI_ENABLED=true` además de `OPENAI_API_KEY`.
Reutiliza el limitador existente: 15 preguntas/10 min y 30/24 h por usuario; 1000/24 h global.
Si falla el contador, no permite la llamada de pago. El límite se aplica a las ventanas del
limitador compartido, no a un día local del teléfono. La ayuda local sigue disponible.

Tarifa consultada el 15/09/2026: 0,15 USD/millón de tokens de entrada y 0,60 USD/millón de salida.
Escenario conservador **estimado**, 4096 tokens de entrada y 200 de salida: 0,0007344 USD por
pregunta; 1000 preguntas equivaldrían a unos 0,74 USD de modelo (unos 22 USD si se agotase ese
tope todos los días durante 30 días). No incluye Edge/BD, impuestos,
ni cambios de tarifa. No es un límite de facturación de la cuenta OpenAI.
[Modelo, tarifas y compatibilidad](https://developers.openai.com/api/docs/models/gpt-4o-mini).

La elección de ayuda híbrida autoriza preparar y probar la integración; no se han activado
gastos de API ni enviado preguntas reales. Antes de activarla, aprobar este coste y el
despliegue final. No requiere APK ni migraciones; cliente por OTA y Edge separada.

## Verificación

- Handler real con proveedor, autenticación y limitador simulados: verde. Incluye límites
  individuales/global, falta de clave/activación/sesión, fallo del contador y aislamiento del
  cuerpo remitido al proveedor. Catálogo cliente/servidor comparado por el test.
- `deno check --no-lock`, edge-sintaxis, sintaxis del bundle, i18n, mapa y seguridad: verdes.
- **10 E2E verdes**: efectivo offline sin escritura, tres segmentos de Plan, modo sencillo,
  histórico, consulta explícita, ids inválidos/foco y función ausente (404) o apagada (503).
  En ambos fallos remotos la guía y sus botones siguen usables, sin exponer el error crudo.
- `npm test` completo de `1336fcb8`, Chromium oficial 1228, **EXIT 0 Madrid y UTC**. Node + Deno
  verdes; **298 E2E correctos / 1 captura ya omitida / 0 fallos / 0 flaky** en cada pasada.
  Duración total: 225,263 s y 225,276 s. Incluye las siete pruebas de categorías y las de bancos.
- Revisión visual de la guía de efectivo a tamaño móvil: botón principal destacado, lectura y
  desplazamiento correctos. El formulario abre Efectivo y no guarda hasta la confirmación normal.
- Claude y Cursor: verde leyendo. Revisión ejecutada de ayuda/categorías en curso tras la de bancos.
  Los rebases posteriores solo incorporan documentación: fuente, tests y bundle idénticos al
  árbol que pasó las dos completas (comparación Git excluyendo `docs/`).
- Integración local terminada con commits por bloque. Banco 4.25 primero, categorías 4.26 y ayuda
  4.27 después. Ninguno de estos bloques se ha publicado todavía ni se ha activado IA de pago.
