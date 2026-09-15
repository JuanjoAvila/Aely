# Categorías personales coherentes entre app y notificaciones

Preparada en `codex/categorias-personales`, integrada sobre 4.24.3 (`fd31aa20`) y bancos 4.25.
Sin despliegue ni cambios en datos reales. Conserva `clasificarConMotivo` e `ingest_skip` de
Claude; esta tanda se desplegará después de observar aquella versión, no en el mismo paso.

## Problema reproducido

Una regla personal de restauración para una marca de seguros se respetaba en el cliente y
se ignoraba en `ingest`: este solo consultaba palabras clave. El nuevo caso de `categorias-dual`
falló antes del cambio (`recibos` frente a `bares`) y pasa después, alternando usuarios.

## Implementación

- `categorizar(comercio, reglas?)` mantiene su API anterior. La coincidencia personal usa la
  misma clave exacta normalizada que `catKey`; no hay coincidencias por parecido. Categorías
  neutras e IDs desconocidos se rechazan; los cajeros conservan su tratamiento contable.
- `readCategoryOverrides` proyecta solo `data->catOverrides`, filtrado por el titular del token
  o de la sesión. Una consulta por entrada clasificable, sin caché global. Tope de 2000 reglas
  y 128 KiB de JSON; un dato dañado no impide registrar un movimiento.
  [Proyección JSON y alias en Supabase](https://supabase.com/docs/reference/javascript/select).
- Ante un fallo de preferencias, ingest conserva la clasificación general y deja un aviso
  genérico, sin volcar reglas ni nombres de comercios en ese aviso. El gasto no se rechaza.
- `categorize` antepone la regla personal a las palabras clave. Añade `reason` y
  `rulesUnavailable`, conservando `category`, `source` y las señales `ai` del cliente anterior.
- Gastos distingue servicio no disponible, límite, preferencias inaccesibles, duda de categoría
  y «Otros» guardado por el usuario. Ante fallos conserva la categoría actual. Textos es/en/ca.
- No cambia modelos, precios, credenciales, reglas de importes, identidad ni histórico.

## Verificación

- `categorias-dual`: rojo antes del arreglo; verde después, incluidas reglas neutras y ATM.
- `category-preferences`: 7 grupos verdes ejecutando los handlers reales con BD y proveedor
  simulados. Dos usuarios, TR/Wallet, lectura fallida, ingreso, límites/errores/respuesta inválida,
  reglas dañadas, proyección mínima y presupuesto cliente/servidor idéntico. `widget-coherente`
  y `presupuesto-servidor` también pasan.
- `deno check --no-lock` de ingest y categorize: verde. El guard de `eur===null` se coloca
  después de ambas ramas de moneda para estrechar el tipo sin inventar un importe.
- Build y `i18n-keys`: verdes tras los últimos textos.
- `categorias-ia-respuesta`: siete casos de UI verdes en Chromium oficial, también en las completas.
- UTC: 10 suites dirigidas verdes, incluidas preferencias, categorías, presupuesto/widget, ingest, entrada Edge, limitador, i18n, mapa y seguridad.
- Versión preparada 4.26.0, integrada sobre 4.24.3 y bancos. Claude y Cursor: verde leyendo.
- Integración de los cuatro bloques `1336fcb8`: `npm test` EXIT 0 en Europe/Madrid y UTC,
  Node + Deno verdes, 298 E2E correctos / 1 captura omitida / 0 fallos / 0 flaky en cada pasada.
  Tiempos completos: 225,263 s y 225,276 s. Revisión ejecutada de afectados pendiente.

La antigua semilla `catOverrides.mapfre=bares` está dentro de `if(isDemo)`, condicionada a
cuentas legacy/demo del creador. No se aplica a todas las personas; se conserva ese alcance.

## Límites y despliegue

Una marca sin contexto puede seguir siendo ambigua hasta que el usuario corrija su categoría.
La corrección debe haber llegado a la nube para que el servidor la conozca. No se promete
interpretar automáticamente variantes del nombre ni se cambia el pasado por defecto.

Cliente por OTA; servidor requiere publicar `ingest` y `categorize` con aprobación del dueño,
en una tanda posterior al despliegue previo de ingest 4.24.1. No requiere SQL ni APK.

Hallazgo separado al preparar los casos: `extraerImporte` no acepta «12 €» sin decimales en
notificaciones TR (el clasificador sí reconoce la frase). Se deja fuera de esta tanda; verificar
formatos reales antes de ampliar el parser. Los casos de categorías usan «12,00 €».
