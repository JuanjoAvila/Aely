> Estado actualizado: el usuario eligió ayuda híbrida. Este texto conserva el diseño inicial;
> implementación y pruebas actuales en [ayuda](asistente-hibrido-2026-09-15.md) y
> [categorías personales](categorias-personales-2026-09-15.md).

# Ayuda dentro de Aely y categorías que aprenden

Propuesta de arquitectura, 15/9/2026. Sin chatbot desplegado ni API nueva. Preparada a partir de
dudas reales sobre efectivo, ahorro para una compra y movimientos bancarios que no aparecen.
Los ejemplos de comercios son sintéticos; este documento es público.

## 1. Ayuda que conduce a una acción concreta

Una entrada estable «Ayúdame» y ayuda contextual en Apuntar, Gastos, Plan e Importaciones.
El usuario puede escribir libremente; la respuesta da un paso corto y un botón que abre la
pantalla real. Catálogo versionado junto al código: no inventar nombres de botones ni rutas.

| Pregunta | Respuesta y acción propuesta |
|---|---|
| «He pagado en efectivo» | Explicar la diferencia entre sacar dinero y gastarlo; abrir Apuntar con efectivo seleccionado. Si falta el sobre, guiar primero su creación. |
| «Quiero ahorrar para un coche» | Aclarar si es ahorro futuro o un préstamo existente; abrir Meta o Deuda según la respuesta. No deducirlo por la palabra coche. |
| «No aparecen los recibos» | Mostrar el estado comprobado del enlace, resultado de lectura y filtros. Distinguir movimiento bancario de un Fijo previsto. No aconsejar reconectar si solo falta una página. |
| «Este comercio es la comida del trabajo» | Ofrecer cambiar ese movimiento a Bares y restaurantes y preguntar si debe recordarse para futuras compras. |

### Contexto mínimo y acciones

- Resolver localmente pantalla, versión, disponibilidad de efectivo y estado resumido de banco.
  Las cifras se calculan con funciones actuales de Aely; el modelo no hace contabilidad.
- Catálogo de acciones permitido: abrir Apuntar/Metas/Deudas, mostrar un filtro o preparar un
  formulario. Confirmación en los formularios existentes antes de guardar dinero o categorías.
- La primera versión guía y prepara. No consulta bancos, borra gastos ni crea Fijos por una
  respuesta del modelo. Una consulta bancaria sigue siendo a demanda del usuario.
- Texto de movimientos y respuestas de proveedores son datos, nunca instrucciones ejecutables.
- Una capa de comprensión de lenguaje puede elegir una intención y pedir la aclaración que
  falte; sus salidas se validan contra el catálogo de acciones y documentación de la versión.
- Sin conexión: guías locales y acceso a pantallas. Si la comprensión remota no está disponible,
  decirlo y ofrecer las acciones frecuentes; no fingir que el chat está conectado.
- Antes de contratar/desplegar el servicio: concretar proveedor, coste por usuario, datos enviados,
  retención y consentimiento. No copiar el histórico de movimientos a cada consulta.

### Aceptación antes de beta

Las preguntas de la tabla deben terminar en la pantalla correcta en es/en/ca, también con
datos incompletos, sin conexión y después de volver atrás. Nunca «guardado» sin confirmación
de la app. Una ruta desaparecida debe fallar de forma explícita en las pruebas de navegación.

## 2. Qué está fallando en las categorías hoy

Contrastado en base 4.23.1:

- `00-core.js`: reglas personales en `catOverrides` / `USER_OVERRIDES`, anteriores a las palabras
  clave. `setCat` en `04-tab-gastos.js` aprende al corregir una categoría no neutra.
- El botón de IA llama primero a `autoCategory`; si devuelve categoría, termina **sin preguntar
  al modelo**. En `categorize` sucede lo mismo con `categorizar` antes del LLM.
- `ingest/index.ts` categoriza las notificaciones con `categorizar(comercio)` y **no consulta
  catOverrides**. Una corrección personal del cliente no gobierna esa entrada del servidor.
  Reproducción sintética ejecutada: con una regla personal de restauración para una marca de
  seguros, `autoCategory` devuelve `bares` mientras `categorizar` devuelve `recibos`.
- `categorize` devuelve `otros` tanto si no hay clave de IA, como por límite, error HTTP,
  excepción o falta de una respuesta útil. `suggestAi` muestra el mismo mensaje para esos casos.
- Un nombre de aseguradora puede ser un seguro o un comedor de empresa. Un modelo que solo
  recibe el nombre no puede distinguirlo de forma fiable. No convertir una excepción personal
  en palabra clave global para todas las carteras.

## 3. Tanda propuesta de categorías (separada del arreglo bancario)

Orden de decisión compartido: categoría elegida en el movimiento → regla personal confirmada
para ese comercio → sugerencia contextual → regla general/modelo → pendiente de revisar.

1. Unificar resolución de reglas personales entre Apuntar, sync, histórico, CSV e ingest;
   auditar cada entrada antes de cambiarla. Ingest carga solo los datos de reglas del usuario
   autenticado por su token, con proyección mínima. Si no están disponibles, no fingir que se usaron.
2. Distinguir `source` y `reason` de la sugerencia: personal, regla, modelo, sin contexto,
   sin servicio, límite o error. «Otros» puede ser una elección válida; no debe ocultar una avería.
3. Corrección: «Solo este movimiento» / «Recordar para futuras compras de este comercio».
   Una empresa con varios usos necesita contexto adicional o confirmación, no una regla absoluta.
4. Bandeja «Por revisar» para lo que no se pudo decidir: explicar por qué y ofrecer categorías.
   Mantener los movimientos visibles. No recategorizar el pasado por defecto.
5. Pruebas: mismo comercio con distinta regla en dos usuarios; gasto nuevo por notificación y
   por sync respetan la misma regla; categoría manual permanece; fallo/límite se distinguen;
   variante de nombre no crea una regla excesivamente amplia; cliente viejo sigue funcionando.

No cambia `ingest` en esta tanda: Claude tiene trabajo activo en esa función. La implementación
de categorías se coordina por separado y el despliegue del servidor requiere aprobación.
