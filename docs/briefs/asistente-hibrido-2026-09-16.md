# Pregúntame híbrido — cierre de implementación 16/09/2026

## Qué se entrega

«Pregúntame» es una hoja propia, accesible desde Inicio y Ajustes, con la misma superficie,
tipografía y botones del rediseño v4.1. No es un chat que pueda ejecutar órdenes: una pregunta
produce una frase corta, uno o varios temas conocidos y, cuando ayuda, un botón a una pantalla real.

La primera capa vive entera en el móvil y funciona sin conexión. Reconoce preguntas sobre:

- presupuesto restante y exceso del mes;
- recibos todavía pendientes y su total;
- previsión de la cuenta marcada para recibos al final de mes;
- saldo mostrado de un banco concreto;
- efectivo, metas, deudas, bancos, histórico, categorías y recibos.

Las cifras salen de los mismos helpers que pintan Aely. Abrir un destino no apunta gastos, no
borra datos, no cambia preferencias y no sincroniza bancos. Si una pestaña está oculta o el modo
sencillo no ofrece esa pantalla, dirige a Ajustes en vez de cambiar el modo por sorpresa.

## Interpretación remota: preparada, no activada

Cuando la capa local no entiende una duda, puede ofrecer interpretación con OpenAI. Antes del
primer envío se muestra un consentimiento explícito: solo sale la pregunta escrita, nunca saldos,
cuentas, movimientos, comercios ni reglas financieras. Rechazar se recuerda; aceptar se puede
revocar desde Ajustes y una nueva activación vuelve a pedir confirmación.

El cliente y la Edge bloquean patrones de IBAN, tarjeta, PIN/CVV, contraseña, claves y tokens.
La Edge exige JWT, corta el cuerpo en 4096 bytes y limita a 15 consultas/10 minutos y 30/24 horas
por usuario, con 1000/24 horas globales. Si el limitador no puede comprobarse, no se llama al
proveedor. Los errores 404, 429, 503 o timeout dejan visible la ayuda local y nunca aparentan que
la IA haya respondido.

OpenAI solo clasifica la pregunta dentro de ids cerrados. No devuelve prosa ni cantidades y no
puede inventar una acción: la frase, la cifra y el botón se construyen en el móvil. Se usa Responses
con Structured Outputs, `store:false`, `reasoning:low` y máximo 180 tokens de salida. El modelo es
configurable mediante `OPENAI_HELP_MODEL`; por petición de priorizar inteligencia, el valor por
defecto es `gpt-5.6-sol`, el modelo flagship de esa familia.

La función sigue cerrada salvo que existan **las dos** variables `OPENAI_API_KEY` y
`AELY_HELP_AI_ENABLED=true`. Integrar o desplegar el código no activa llamadas ni coste.

## Coste que hay que aprobar antes de activar

La tarifa oficial consultada el 16/09/2026 para GPT-5.6 Sol es 4 USD por millón de tokens de
entrada y 20 USD por millón de tokens de salida. La página del modelo confirma también Responses
y Structured Outputs: [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol).
La [guía de modelos](https://developers.openai.com/api/docs/models) distingue Sol como flagship,
Terra como equilibrio inteligencia/coste y Luna como opción para alto volumen sensible al coste.

Estimación conservadora, no factura: suponiendo 2000 tokens de entrada —instrucciones, esquema y
pregunta— y agotando los 180 de salida, una consulta costaría unos **0,0116 USD**. Agotar 30 al día
serían unos **0,35 USD/día** o **10,44 USD/30 días por usuario**. Agotar además el límite global de
1000 todos los días rondaría **348 USD/30 días**. En uso normal la salida debería ser mucho menor;
no se incluyen impuestos, Supabase ni cambios de tarifa. Los límites técnicos no son un límite de
facturación de la cuenta OpenAI.

## Verificación

- 14 E2E del asistente: offline, presupuesto, recibos, saldo, efectivo sin escritura, segmentos
  de Plan, consentimiento, rechazo, revocación, secretos, 404/429/503/timeout y foco/Escape.
- La navegación a Metas se ejecuta con CPU ×6 y espera el montaje real de Plan, sin tocar sus
  gestos ni `11-app-main.js`.
- Unitarios de cliente y Edge cubren esquema cerrado, modelo configurable, aislamiento del body,
  límites, secretos y combinaciones tema→frase incompatibles.
- Build, sintaxis, i18n es/en/ca, mapa de pruebas, seguridad, privacidad y sintaxis de las Edge
  verdes en la integración con el rediseño.
- Revisión independiente final de Claude: GO tras corregir consentimiento, errores remotos y
  coherencia entre respuesta y acción.

## Qué falta para que la parte remota funcione

1. Aprobar expresamente el coste y el envío de la pregunta escrita a OpenAI.
2. Desplegar `help-assistant` en Supabase.
3. Configurar `OPENAI_API_KEY` y `AELY_HELP_AI_ENABLED=true`; opcionalmente cambiar
   `OPENAI_HELP_MODEL`.
4. Probar en beta con una cuenta de prueba que la Edge responde y que los límites no exponen
   errores crudos. La ayuda local puede probarse antes y no requiere estos pasos.
