# FIN-11 · absorciones pendientes sobre FIN-10 y FIN-15

## Port privado sobre FIN-10 beta503 y dos remates

Fuente actual exacta `af387031feab76caf4ace026fa5f22d21ca90f90` (PR264), admitida
por `288885aeeabd382f54ebb8fc9f8297d75ccef89a`. Task nuevo
`fin11-beta503-port-remates-codex-20261017`, claim `558e4000`, ACK `bacf3f78`.
Se porta el delta completo revisado f872→d68 en sus 22 rutas, bajo `d1c35333`
y corrección `3b601b99`; los dos remates nuevos son exclusivamente `323df048`.
La PR262/d68 anterior permanece congelada. No se heredan sus pruebas como verdes
de esta fuente. Sin push, nueva PR, result ni cierre de PR262 en esta fase privada.

El pull de gastos termina al completar lectura y mezcla; inicia el reintento de
absorciones en segundo plano. La barrera `nubeLista` sigue exigiendo ese pull completo
antes de llamar al banco cuando falló el arranque, pero ya no espera al DELETE.
Un fallo de limpieza no acredita ACK ni retira la intención protegida. El ROJO causal
observa cero llamadas al banco antes de resolver el DELETE en el código anterior;
también se comprueba que un pull fallido sigue impidiendo la llamada.

La guardia201 se prueba con un único alias válido (UUID original ausente, identidad
completa con cuenta conocida) y 200 identidades ajenas. No hay ambigüedad que oculte
la falta de cobertura. El control de 200 filas permite DELETE y ACK del único alias;
201 conserva ambos. Quitar solo la guardia201 produce el DELETE inseguro y falla.
Restaurar solo la espera de limpieza vuelve a fallar el oráculo de la barrera.

FIN17 queda fuera: segundo móvil que recrea filas después de ACK/poda/backfill y
política de caducidad o liquidación manual requieren otro titular y nueva FINAL.
Los límites y pruebas de la adaptación anterior que siguen son históricos; los
EXITs y hashes de esta candidata se registran por separado en su checkpoint privado.

Evidencia propia af387: FIN11 21 casos pasan en Madrid (comando EXIT0) y en UTC
(21 PASS dentro de una matriz inicial EXIT1 por tres casos de Compras que aún
leían el HTML de base). Tras reconstruir, regresión FIN10/FIN15/Compras 87/87
EXIT0 en UTC y 87/87 EXIT0 en Madrid; no se repiten los casos propios cuya fuente
no cambió. Quince mutantes propios detectados: doce originales, orden FIN15,
guardia201 y barrera DELETE. Deno 18/18 EXIT0. DOM dirigido 9/9 EXIT0 en puerto
48543, un worker/cero retries/stop al primer fallo, con hash del HTML servido.
El primer lanzador DOM falló antes de arrancar Chromium por resolver mal el loader;
se conserva su EXIT1 y se corrigió solo la ruta del lanzador privado.

Build, siete bloques de sintaxis, seguridad, registro, i18n y presupuesto servidor
EXIT0. Tamaño oficial EXIT1: 1324/1314 KB minificado, 368/366 KB gzip, 3/3 recursos
bloqueantes. Los topes, VERSION y catálogo permanecen iguales a af387. El ROJO del
remate (EXIT1) y un fallo de anclaje CRLF del mutante (EXIT1) también se conservan;
tras normalizar el texto de la fixture, los tres casos afectados pasan EXIT0.
Sin suite general/CPU6, beta-sources, CI general, publicación ni móvil físico.

## Adaptación anterior congelada sobre f872 (histórico)

Candidata **privada**, sin push, PR ni result. Fuente exacta
`f872a24cf180ee0817ccf1139ab3e01721e091eb` (PR259), admitida por Claude en
`6c8bb5538c12c4629e470ff2a62e85d9719de20d`. Mismo GO A con contención B
`fa83f1c681750095c017f8448e2353040cb91456`; el ACK de fuente separado es
`da6dff8aa32b8a6d2eeea779e2af47cb18970768`. Task, claim y base históricos
permanecen inmutables. La candidata previa sobre otra fuente se conserva privada;
sus verdes no acreditan esta adaptación. No hay SQL, migración ni cambio de SDK.

## Causa y adaptación

ROJO ejecutado sobre f872 sin arreglos: tres casos, un control pasa y dos fallan,
EXIT1. DELETE fallido o UUID remoto distinto dejan viva la fila BOOK. Tras 500
lápidas posteriores, nuevo dispositivo y servidor pasan de 320 a 640 céntimos;
el dispositivo original conserva 320. Recuperar conexión y repetir la reconciliación
sin nueva transición no reintenta la retirada.

El cambio conserva las funciones de transporte/identidad FIN-10, incluida cuenta
`#acc`, día literal y comodín simétrico cuando falta cuenta. La unión FIN-15 por
banco/ref entre días conserva su Map de claves y Set de referencias. Las intenciones
se añaden al conjunto de protección **antes** de consumir esas referencias: una fila
oculta por el comodín sin cuenta no puede consumir la superviviente de otro día.
No se elige otra preferencia PDNG/BOOK ni se reparan históricos.

`obAbsorbedPending` guarda titular, UUID retirado, clave FIN-10, UUID/clave de la
superviviente, importe y comercio observados. No guarda expenses, bankTx ni perfil.
Antes de aceptar la absorción se escribe una partición local por titular y se
comprueba su readback; un fallback en memoria no acredita persistencia. La reapertura
recupera esa partición antes del debounce. El CAS existente de app_state transporta
la lista; no es una transacción distribuida entre almacenamiento local y servidor.

Tope independiente 200 sin expulsar pendientes no confirmadas. Si no cabe o falla
la escritura, conserva la fila BOOK y revierte la referencia adoptada de la
superviviente, evitando fusión silenciosa al recargar. Si la unión local/remota
supera el tope, bloquea el push y no avanza CAS; conserva ambas copias. No cambia
DELETED_MAX=500 ni DELETED_AT_MAX=200.

BankSync registra la intención sin ejecutar DELETE. Refresco cloud y recuperación
online procesan hasta cuatro objetivos por pasada, serializados por titular y
cancelables por sesión/sandbox. Cada consulta PostgREST tiene abort a ocho segundos;
ese plazo no garantiza un límite absoluto para el refresco de sesión del SDK.

La confirmación relee UUID exacto y valida identidad/contenido, excluyendo la
superviviente. Si falta, acota la lectura al día y 201 filas; 201 no prueba cobertura.
Solo una coincidencia única con banco/ref/ordinal/cuenta/día conocidos permite
borrar otro UUID. Cuenta ausente, fila editada/legacy, solapamiento con superviviente,
ambigüedad o error mantienen protección. DELETE filtra titular, UUID y atributos
observados, jamás solo referencia. Cero filas requiere relectura; error:null o
respuesta ausente no acreditan éxito. La intención solo sale tras prueba remota y
guardar durablemente su ACK. Fallos de telemetría no consumen la intención.

Cliente, importador, ingest y widget combinan pendientes propias con deleted,
fuera de su poda. Cache y memos incluyen lista/titular. Los lectores servidor
reciben el titular autenticado; no confían en un _historyOwner remoto viejo.

## Evidencia propia de esta fuente

- Node propio: primera pasada 18 PASS / 1 FAIL por comparar un array de la VM con
  otro de Node, con los mismos UUID. Se normalizó solo el contenedor de comparación;
  el caso afectado pasa en una repetición focal. Los 19 casos quedan cubiertos en
  pasadas separadas, conservando el EXIT1 inicial. No se anuncia una pasada 19/19.
- Doce mutantes propios originales detectados en esta fuente. El caso nuevo detecta
  además el mutante que consume la referencia al ocultar por comodín: deja 0 frente
  a 320 céntimos. Incluye ambos órdenes cliente/servidor y UUID superviviente exacto.
- Regresión FIN-10 + FIN-15 + Compras: 87/87, EXIT0; matriz12, transporte, importador,
  676 comparaciones legacy, mutaciones financieras y handler/widget sintéticos.
- Deno: 6 propios + 12 de widget, 18/18 EXIT0 en una pasada sobre la adaptación.
- DOM: 9/9 EXIT0; 4 propios con protección después de poda/pull/reapertura y 5
  FIN-10/FIN-15 de la nueva fuente. Un worker, cero retries, stop al primer fallo,
  puerto exclusivo 48534. El spec FIN-15 verifica el hash del HTML servido.
- Build, sintaxis de siete scripts, seguridad y mapa de registro pasan. Presupuesto
  servidor pasa tras añadir al comando el loader privado de esbuild ya declarado;
  se conserva su fallo inicial de infraestructura antes de ejecutar el oráculo.

No se instaló dependencia ni se mutó node_modules compartido. Se usó el runtime
privado ya copiado y Chromium/Deno instalados. Node local24; no se ejecutó Node20.
El preflight del diff completo detectó cabeceras/docs y contexto del runner distintos:
no aplicó nada. Se adaptaron esos cinco archivos manualmente y el diff propio de
lógica revisado encajó sin cambiar la convivencia FIN-10/FIN-15. HTML reconstruido;
metadatos generados de catálogo/release notes restaurados a bytes f872, fuera de scope.

## Gates y límites

Tamaño oficial EXIT1: 1321/1311 KiB minificado, 367/365 KiB gzip; 3/3 recursos
bloqueantes. Caps intactos. Docs-frescura se registra sobre el commit privado final,
sin cambiar VERSION ni catálogo. No se ejecuta beta-sources en esta adaptación;
la auditoría interrumpida de la candidata anterior no acredita f872 ni esta fuente.

SDK en memoria y navegador sintético no prueban RLS/red/bancos/SQL reales, despliegue
de ingest ni widget nativo. El servidor no puede conocer una intención offline antes
de recibirla. Clientes antiguos pueden sobrescribir estado o recrear filas tras ACK:
no se promete cierre distribuido frente a ellos. Servidor con lectores nuevos antes
que cliente, mediante Claude tras revisión e integración. Sin suite general, CPU6,
Gradle/APK, deploy, CI general, versión servida ni aceptación móvil real en esta fase.

Semántica PostgREST revisada previamente en documentación oficial de Supabase
[delete](https://supabase.com/docs/reference/javascript/delete) y
[select](https://supabase.com/docs/reference/javascript/select); se mantiene SDK fijado.
