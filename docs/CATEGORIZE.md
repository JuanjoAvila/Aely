# Categoría de un gasto (palabras clave + lo que aprende de ti)

## Cómo funciona (desde el 19/11/2026)

1. **Palabras clave**: la misma lista en el móvil (`00-core.js` → `KW`) y en el servidor
   (`ingest_logic.ts` → `CATEGORIAS`). El guardián `categorias-dual` exige que digan lo mismo.
2. **Lo que aprende de tus correcciones** (`setCat` en Gastos):
   - `catOverrides`: comercio → categoría. Lo usan las altas nuevas (banco, Apuntar) en
     `categoryOfNewMerchant`.
   - `catRules`: comercio + banco + con/sin tarjeta, con el instante en que lo enseñaste. Lo usa el
     pull (`keepCategoryChoices`) para el cargo siguiente que categorizó el servidor.
   - Las dos se aplican también al **mismo comercio escrito distinto** (`comercioBase`: sin números
     de tienda/tarjeta, signos ni forma jurídica). No si la base es genérica («Compra 123»,
     «Transferencia») ni si dos correcciones de la misma base se contradicen.
   - Nunca tocan el histórico ni un gasto al que ya pusiste categoría a mano.

## La IA de pago, retirada

La app ya no llama a la Edge `categorize` ni enseña el ajuste «Sugerir categoría con IA» ni el ✨
de la ficha. El secreto `OPENAI_API_KEY` nunca se configuró en Supabase, así que la función solo
repetía las palabras clave con una llamada de red de por medio.

⚠ La Edge `categorize` **sigue desplegada** y su código sigue en `supabase/functions/categorize/`
(con sus tests). No se borró ni se redesplegó nada del servidor en esta tanda: retirarla es una
decisión aparte.

## Alinear keywords

Cliente: `src/modules/00-core.js` → `KW`.  
Servidor: `supabase/functions/_shared/ingest_logic.ts` → `CATEGORIAS`.  
Mantenerlos alineados al cambiar uno. Una palabra nueva en el servidor solo llega a las
notificaciones cuando se despliega `ingest`.
