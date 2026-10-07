# Widget105 · fuente aislada del journal desconocido · 7/10/2026

**Candidata de fuente, NO-GO entrega.** No se publica APK, web, Edge ni SQL.
No se modifica versión, manifiesto ni catálogo; no acredita causa del placeholder humano.

Base beta102 equivalente: `48410e5b9c47f48dd0462d8bb84192a1f73efbce`,
tree `839c975d8ba3ca7a9c3a7a53c1b474c01b160971`.
Fuente examinada mediante lector oficial GitHub: PR105/head
`9711219766449e4e7c50081b00f7f4da7d7abd1e`.
Sólo se traslada WidgetSnapshotArbiter.java, blob
`9ddb3941760e23375c147d267d3677953a6c8c03`, idéntico al original remoto.
Árbitro base: `8e4d634f238464720a87cec5a9a1d141362d0902`.

## Causa demostrada, alcance y límite

Un unknownJournal antiguo con salto final e indentación, `ev\tkey\n    `,
se rechaza en la fuente base incluso con cobertura explícita `|ev|`.
La fila de formato vacía se interpreta como registro con un solo campo; activa journalFull
y conserva unknownPending. La contraprueba Java usa los mismos esperados sobre ambos árbitros:
base sale 1 por la aserción de recuperación; candidata pasa.

La fuente105 distingue líneas de espacio sin tabulador de registros dañados, normaliza sólo
el identificador del evento y escribe unknownJournal sin salto final. Conserva identidad,
ACK y lápidas como gates. La deduplicación afecta altas y traslado de selección; duplicados
legados no se borran por silencio y siguen pendientes hasta cobertura explícita.

No se modifican el journal de siete campos, contribuciones monetarias, selección de banco,
fences, tickets, orden servidor, expiración, claves financieras ni el algoritmo de ingest.
El resto de producto/base y las aprobaciones web anteriores permanecen fuera de este delta.

## Contrato financiero de la matriz

| Caso sintético | Esperado |
|---|---|
| Canónico, LF, newline final y espacios de indentación | ACK exacto recupera; sin ACK conserva desconocido. |
| Evento con espacios laterales | Identificador normalizado, clave monetaria preservada. |
| Clave con espacios laterales | Lápida sólo si la clave coincide byte por byte; no recortar identidad. |
| CRLF | ACK exacto recupera; un CR conservado en clave impide asumir una lápida distinta. |
| Registro con clave vacía | Sin ACK conserva desconocido; ACK explícito cubre el evento. |
| Línea sólo de tabulador, evento vacío o campos extra | Fallo cerrado, sin vaciar el journal ni inventar un importe. |
| Registro válido seguido de corrupción parcial | Rechaza incluso con ACK del primero; conserva evidencia completa. |
| ACK parcial o ajeno | No cubre otros eventos pendientes. |
| Reinicio sintético | Copia los campos persistidos a otro State real; conserva pendientes y permite ACK posterior. |
| Duplicados, reentrega e invalidateScope | Altas no crecen por duplicado; selección conserva sólo identidad pendiente. |

CRLF **no** se promete como normalización universal de claves: retirar `\r` o espacios puede
alterar un identificador legítimo. La matriz confirma conservación segura, y recuperabilidad
con ACK, sin ampliar el cambio de105. El reinicio es transferencia sintética de State, no
Android SharedPreferences ni un dispositivo instalado.

Todas las fotos base sintéticas mantienen spent 40, budgetLeft 60, cash 200 y safeLiq 150;
no se asigna un delta desconocido a esos importes. Los tests existentes de arbitraje siguen
cubriendo cruces de respuestas, appFence, periodo, reentrada, banco, dedup y lápidas.
Esa cobertura existente no se presume ejecutada por esta matriz nueva.

## Guardian registrado

`tests/widget-unknown-journal.test.mjs` está en run-tests. Compila la Java real con javac
o con el módulo jdk.compiler ya disponible, sin instalar dependencias.
La fixture `tests/fixtures/WidgetUnknownJournalTest.java` contiene sólo datos sintéticos.
El patch congelado reconstruye el baseline; su hash verifica los bytes reales8e4 antes
de compilar, en vez de recrear un algoritmo alternativo. Resultado local: candidata 205
aserciones, baseline rojo con exit 1 en el mismo caso corregido; contraprueba adicional del
rechazo original con 2 aserciones. Java17 modular ya disponible, sin instalación.

Los guardianes existentes widget-arbitraje/coherente requieren esbuild declarado por el repo;
su primer intento local falló por dependencia ausente, no por una aserción financiera.
Hasta ejecutar con esa dependencia o CI, no se anuncian verdes.

La compilación y procesos Java son síncronos y los temporales propios se retiran al final.
No se prueba ni se modifica el APK público52; instalado y entrega efectiva siguen unknown.

## Gates siguientes

Revisión independiente fuerte del árbol exacto, matriz y guardianes financieros; CI exacta
completa antes de cualquier integración. Después, definir la versión/identidad y circuito
nativo beta con aprobación propia, firma y APK real, si el dueño autoriza esa entrega.
No fusionar en main producto Java por una CI de documentación ni cerrar PR105 como absorbida:
la fuente de esta candidata aún no es una entrega. Estado financiero real e ingest vivo no
se han leído ni reparado. El síntoma del widget y INC-2709-09 conservan sus investigaciones.
