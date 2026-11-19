# Traspasos propios con nombre: análisis y propuesta

Estado: propuesta documental, sin implementación ni validación de movimientos reales.
Fuente revisada: `9ef9f19b49938d207271289176f2314b858152a1`.
Origen: BACKLOG P2 «Traspasos propios con nombre, como ingreso», revisión R4 del 26/10/2026 [E1].

## Decisión propuesta

No ampliar `esTraspasoPropio` con nombres, palabras como «transferencia», similitud de importes ni la mera existencia de un flujo de Plan. Para reconocer un traspaso con nombre hace falta evidencia de las **dos cuentas y de su pertenencia al mismo perímetro económico del usuario en la fecha del movimiento**. Tener acceso a una cuenta conectada o conocer su IBAN no acredita por sí solo esa pertenencia.

Proponer un contrato adicional y versionado que conserve la cuenta de contraparte, su procedencia y la evidencia de pertenencia. Solo un resultado positivo inequívoco permitiría proponer la categoría neutra `traspaso`. Un resultado negativo solo rechaza esa propuesta: no convierte automáticamente la fila en ingreso, gasto o nómina. Ante ausencia, contradicción o ambigüedad, devolver `desconocido` y conservar el tratamiento anterior, sin presentar la propiedad como verificada.

Este documento no modifica el clasificador heredado, los saldos, el presupuesto ni los datos. La implementación futura requiere otro encargo y una decisión explícita sobre compatibilidad y dinero. La PR contiene únicamente este análisis; no constituye una corrección entregada al móvil.

## Evidencia de la fuente

| Punto | Comportamiento observado | Consecuencia y límite |
|---|---|---|
| Clasificador actual [E2] | `esTraspasoPropio` exige `amount <= -200`; admite comercio vacío, `Movimiento` o `Ingreso`; exige algún flujo `kind === "transfer"` cuyo `to` coincida con `tx.ent`. | Un nombre distinto devuelve `false`, aunque el dinero pudiera ser propio. El predicado no consulta IBAN, titular, cuenta concreta, contraparte, moneda ni estado. Su comentario histórico no es un contrato actualizado de nómina. |
| Alta diaria [E3] | Los créditos se importan como `source:"ob"`; el predicado decide `traspaso` o `ingreso`. Exige fecha válida, no futura y estado vacío o `BOOK`, además de ventana y dedup. Conserva `obAcc`, `obName`, `extId` y nota cuando existen. | La aceptación del crédito y su clasificación son decisiones distintas. No hay que eludir estos filtros para clasificar propiedad. El estado vacío mantiene compatibilidad, no confirma formalmente liquidación. |
| Histórico [E4] | `histClassifyCandidates` vuelve a llamar al mismo predicado para candidatos entrantes. Los candidatos conservan identidad de cuenta, referencia/ordinal y marca pendiente por sus rutas específicas. | Transportar un campo solo por el diario dejaría el histórico con otra decisión. La propuesta futura no debe saltarse la previsualización ni selección del importador. |
| Mapeo de proveedor [E5] | `mapTransaction` obtiene magnitud absoluta y aplica signo negativo solo a `CRDT`. Toma el nombre del deudor para un crédito, el del acreedor para un débito; después usa concepto o `Movimiento` como título alternativo. Retorna referencia, fecha, importe, comercio, nota, concepto, MCC opcional, tarjeta y estado. | El objeto retornado no contiene identificador de cuenta de contraparte ni moneda de transacción. El nombre puede venir del banco o del concepto; ninguno acredita propiedad. Esto describe el código, no garantiza qué datos ofrece un proveedor concreto. |
| Respuesta por cuenta [E6] | `bank-sync` aplica `mapTransaction` y devuelve cuentas con `uid`, `iban`, `name`, `currency`, balances y movimientos. El nivel superior conserva una primera cuenta compatible para lectores antiguos. | `accounts[].iban` identifica la cuenta consultada, no la contraparte. La moneda de la cuenta no demuestra la moneda o conversión de cada movimiento. Evitar mezclar primera cuenta y multicuenta. |
| Reducción en cliente [E7] | `bankTxFromLinks` recorre `accounts[].transactions` y asigna `acc` desde `iban || uid`; admite el formato antiguo de movimientos en el nivel superior. Construye una lista explícita de campos por movimiento. | Añadir solo un campo al Edge no basta: esta proyección lo perdería. `tx.acc`/`expense.obAcc` es la cuenta del apunte, nunca debe reutilizarse como contraparte. |
| Catálogo de cuentas [E8] | Las principales guardan `bankIban` o `bankUid`; las extra OB guardan `iban`, clave y nombre. Existe un ajuste de participación `accountShare`, y una heurística visual `accountLooksJoint`. | Hay identidad de cuenta y participación configurable, pero estas rutas no aportan una prueba bancaria estructurada de titulares y vigencia. El nombre de una conjunta y el porcentaje por defecto no acreditan titularidad legal ni neutralidad de una transferencia familiar. |
| Persistencia [E9] | `addExpense` proyecta campos explícitos; `expenseSourceForCloud` codifica referencia, cuenta propia, ordinal y otras marcas. `expenseFromRow` reconstruye `obAcc` y `obName`; la mezcla conserva cuenta conocida frente a un lector legado sin ella. | Un metadato nuevo necesita diseñar ida, vuelta y mezcla. No basta con mantenerlo en la respuesta o en `bankTx`. No se inspeccionó esquema SQL ni se afirma que exista una columna para contraparte. |
| Presupuesto [E10] | `traspaso` es neutra; `expenseCountsBudget` excluye neutras. `monthBudgetStats` separa nóminas; el gastado contra el límite mensual usa `max(0, spent - (income - nomina))` y el margen es presupuesto menos ese gastado. El ciclo usa neto con su ancla propia. | Un crédito que permanezca como ingreso elegible y no sea nómina puede devolver margen aunque proceda de otra cuenta propia. Depende de fecha, bancos seleccionados, duplicados y demás filtros; no todo abono altera el límite. |
| Nómina [E11] | `esNomina` rechaza neutras/Bizum y busca palabras de nómina o un ingreso periódico de Plan compatible. Sus llamadores aplican el umbral de 200 y controles adicionales. | «Nombre propio» no es una nómina ni acredita traspaso. No cambiar este reconocimiento para tapar la falta de contraparte. |
| Identidad y duplicados [E12] | Existen referencia con signo, cuenta, nombre bancario original, ordinales y marcas de ambigüedad. La conciliación PDNG→BOOK de débitos y las rutas históricas tienen reglas propias. | Enriquecer propiedad no debe cambiar claves, fusionar los dos lados de un traspaso, absorber filas por parecido ni reutilizar referencias entre cuentas. |
| Diferentes vías TR [E13] | El decodificador conserva una vía `tr`/`macrodroid` distinta de `ob`/`ob-hist`; el motor también admite movimientos OB de las entidades reconocidas. | Un banco es una entidad, no una única fuente. Un futuro enriquecimiento de OB no cubre por sí mismo notificaciones TR, manuales o CSV. No se verificó disponibilidad actual de conexiones de TR ni el contenido de datos reales. |

## Qué queda como hipótesis

La cadena de código explica cómo un crédito con nombre puede quedar como ingreso. **No demuestra que haya ocurrido en una cuenta concreta**, su frecuencia ni el dinero afectado. El backlog pide verificarlo posteriormente con datos reales; esa comprobación corresponde al coordinador/dueño bajo autorización separada y permanece pendiente.

Tampoco se ha verificado que todos los bancos, tipos de pago o versiones del proveedor entreguen un identificador utilizable de contraparte. No se deduce su ruta externa a partir de `debtor.name` o `creditor.name`. Antes de implementar un adaptador habrá que consultar documentación primaria vigente para cada forma admitida y declarar cobertura, dirección, semántica, ausencias y limitaciones. Aquí no se inventa ningún campo de API externa ni se hace una consulta bancaria.

## Contrato mínimo conservador para una implementación futura

Los nombres siguientes describen **conceptos del contrato propuesto**, no campos ya disponibles ni una API aprobada. Separar evidencia recibida, catálogo de pertenencia y decisión derivada permite revisar un cambio sin destruir la información original.

| Componente conceptual | Mínimo necesario | Ausencia o conflicto |
|---|---|---|
| Ámbito | Usuario autenticado y perímetro económico concreto; las dos cuentas deben pertenecer a ese mismo ámbito. | No buscar coincidencias entre usuarios, familiares o todas las cuentas visibles. Acceso/consentimiento no equivale a propiedad. |
| Cuenta del movimiento | Identidad estable local + proveedor/conexión y cuenta de origen de la respuesta; dirección explícita. | Sin asignación inequívoca, no decisión positiva. `ent` sola es insuficiente con varias cuentas del mismo banco. |
| Cuenta de contraparte | Tipo de identificador, valor normalizado o referencia privada, lado de la operación y disponibilidad explícita. | Ausente, truncado, enmascarado o identificador opaco sin equivalencia documentada: `desconocido`. No comparar un UID de proveedor con un IBAN. |
| Procedencia | Proveedor/adaptador, versión del mapeo, instante de observación y fecha efectiva del apunte. | No elevar un texto libre o una edición de comercio a evidencia bancaria. No inferir fecha de pertenencia desde la fecha de sync. |
| Catálogo de pertenencia | Por usuario y cuenta: relación explícita, origen de la afirmación, vigencia desde/hasta y revocación. Distinguir cuenta propia, ajena y relación no resuelta. | No tratar `bankIban` como certificado de titularidad. Autorizado, apoderado, cuenta compartida y cuenta familiar necesitan semántica propia. |
| Participación/perímetro | Relación económica de ambas cuentas y decisión expresa para cotitularidades o porcentajes distintos. | El ajuste `accountShare` y su valor por defecto no resuelven por sí solos si el movimiento es neutro para ese usuario. Dejarlo pendiente. |
| Estado monetario | Estado de contabilización, moneda e importe originales, signo/dirección y comisión separada cuando exista. | Un estado, importe o moneda desconocidos no autorizan una nueva clasificación automática ni una conversión supuesta. |
| Resultado derivado | `propio`, `ajeno` o `desconocido`, motivos, versión de regla y referencias a la evidencia usada. | No convertir `null` en `false` ni confundir «no hay coincidencia» con «cuenta ajena acreditada». |
| Identidad de fila | Conservar ID local, referencia bancaria y cuenta, fecha, signo, ordinal, nombre original, marcas de duplicado y decisiones manuales. | La nueva evidencia no cambia identidad, no crea otro ingreso y no borra el movimiento anterior. |

Una normalización futura de IBAN deberá validar el tipo completo y normalizar únicamente su representación admitida; nunca casar por últimos dígitos, nombre o distancia de texto. Si el proveedor usa una cuenta virtual, una cuenta colectora, un intermediario o un identificador distinto por conexión, no asumir que equivale al IBAN de la cuenta económica. Hace falta una equivalencia documentada y vigente; sin ella, `desconocido`.

### Regla de decisión propuesta

1. Mantener los controles existentes de validez, fecha, estado, ámbito y deduplicación. Para **nuevas inferencias de propiedad con efecto monetario**, exigir evidencia de contabilización inequívoca; el crédito legado sin estado puede conservar su comportamiento, pero no ganar una certeza nueva.
2. Resolver la cuenta del apunte y la contraparte dentro del ámbito del usuario, con identificadores comparables y sin colisiones. Un par de importes opuestos no identifica por sí solo un traspaso.
3. Verificar que ambas relaciones de pertenencia cubren la fecha efectiva y que el movimiento es interno al mismo perímetro económico. Un permiso de consulta o una igualdad de nombres no satisface este punto.
4. Emitir `propio` solo con evidencia positiva suficiente y coherente. Si falta moneda, hay comisión inseparable, titularidad/participación dudosa, intermediario o cambio de cuenta no resuelto, no automatizar el efecto monetario. Se puede conservar la evidencia parcial para revisión.
5. Emitir `ajeno` solo con evidencia explícita incompatible con pertenencia al perímetro. No encontrar el IBAN entre las cuentas conectadas deja `desconocido`: puede ser una cuenta propia no conectada.
6. `propio` permite una propuesta de categoría neutra para la fila y dirección autorizadas; `ajeno` y `desconocido` no imponen otra categoría ni anulan una elección manual. La decisión y los datos que la justifican deben poder revisarse por separado.

No depender de que el importe sea al menos 200: ese es el límite del predicado heredado, no una prueba de propiedad. Un contrato futuro puede describir importes menores, pero cualquier ampliación de cobertura o cambio de umbral necesitará autorización y validación específicas. Tampoco reutilizar el flujo modelado por banco como prueba para todas sus cuentas.

### Compatibilidad y despliegue futuro, aún por diseñar

- **Servidor y lector antiguos:** añadir metadatos opcionales sin cambiar signo, fecha, referencia, comercio, concepto ni forma de `accounts[]`/nivel superior. Lector nuevo con respuesta antigua: evidencia ausente significa `desconocido`. Lector antiguo: debe conservar su comportamiento. No atribuirle soporte de propiedad por ignorar un campo.
- **Transporte completo:** revisar mapeo compartido, ambas respuestas de `bank-sync`, `bankTxFromLinks`, candidatos históricos, altas de gastos, almacenamiento/pull y mezcla. Las proyecciones explícitas actuales perderían un campo nuevo [E3–E9]. No decidir ahora una migración, un encoding en `source` ni un almacén lateral.
- **Persistencia y dinero:** resolver antes de implementar cómo viajan evidencia, versión y decisión entre móvil, nube y widget. El presupuesto actual transporta decisiones de nómina con un alcance específico [E10]; añadir propiedad solo en memoria puede dar cifras distintas tras reinicio o en otro lector. Una categoría común puede ser parte de la solución, pero no demuestra compatibilidad completa.
- **Histórico:** nada de barridos de recategorización ni corrección retrospectiva automática. La nueva evidencia no demuestra quién poseía una cuenta antes de su vigencia. Una revisión futura sería una propuesta identificable por fila, con impacto previsto, decisión expresa y reversión, sin alterar los importes ni el saldo bancario.
- **Decisiones existentes:** conservar categorías manuales, renombrados, lápidas, posibles duplicados, ordinales, vínculos y fuentes. La evidencia nueva es enriquecimiento, no una orden de reinsertar o absorber filas. Una respuesta antigua sin metadatos no debe borrar evidencia válida posterior ni confirmar una pertenencia caducada.
- **TR y otras vías:** mantener la procedencia OB frente a `tr`/`macrodroid`, CSV y manual. No adjudicar contraparte a una notificación por parecido con un movimiento bancario. Cada vía requiere su propio contrato; el análisis no garantiza cobertura uniforme.

## Efectos económicos que debe preservar la propuesta

Un traspaso mueve saldo entre cuentas aunque no sea ingreso nuevo. Sus dos apuntes bancarios son **dos filas válidas**, no duplicados que deban fundirse. No borrar ninguno ni compensar saldos a mano. Las comisiones son un gasto independiente; el principal no debe ocultarlas. En moneda distinta, no sumar importes nominales ni crear una igualdad usando una cotización supuesta. No decidir neutralidad dentro de un patrimonio parcial o con distinta participación sin un criterio aprobado.

Ejemplo aritmético **sintético, descrito y no ejecutado**: mes sin reservas, límite de 500, compras elegibles de 300, nómina identificada de 1.000 y abono de 200 desde una cuenta propia. Si el abono queda como ingreso no nómina, la regla mensual calcula gastado contra límite de 100 y margen de 400. Si ese mismo abono se reconoce válidamente como neutro, calcula 300 y margen de 200. La nómina no devuelve margen. Son consecuencias de la fórmula de [E10], no resultados de una prueba de esta PR.

El margen mensual nunca supera el límite por esa fórmula; Mi ciclo conserva otro contrato. Un ajuste de categoría puede cambiar ingresos, balance, mes cerrado y el margen sin modificar saldo bancario, y debe revisarse como decisión de dinero. No aplicar el ejemplo a las cuentas de nadie ni extrapolarlo a todos los bancos o modos.

## Privacidad

La contraparte y la pertenencia son datos privados. Mantenerlos dentro del ámbito del usuario autorizado, con mínima retención y acceso; no publicar IBAN, nombres, identificadores de conexión, payloads bancarios ni datos familiares en PR, logs o telemetría. No crear un directorio de titulares global. Una huella estable de IBAN también puede ser un identificador vinculable y necesita protección; truncarlo o aplicar un hash simple no acredita anonimización.

El informe público solo contiene código y ejemplos sintéticos. Una comprobación real posterior debe aportar como salida pública únicamente conclusiones agregadas y saneadas. No se han consultado SQL, nube, secretos, extractos ni cuentas reales para este análisis.

## Matriz de validación FUTURA — no ejecutada

Esta es una especificación de casos para un encargo posterior. **No se han creado ni ejecutado tests, harness, runtime de producto, instalación, build o CI.** «Esperado» expresa el contrato propuesto, no un resultado medido. Usar identidades simbólicas A/B/X y datos inventados.

| Caso sintético | Evidencia disponible | Decisión/efecto esperado en una implementación futura |
|---|---|---|
| Abono con nombre cualquiera; A y B propias vigentes, mismo perímetro y moneda, `BOOK` | Cuentas de ambos lados resueltas y pertenencia explícita | `propio`; proponer neutra sin depender del nombre. Conservar fila, importe y saldo. |
| Mismo nombre y concepto «transferencia», sin contraparte | Solo texto | `desconocido`; no ampliar el clasificador ni confirmar propiedad. |
| Cuenta X explícitamente ajena | Relación vigente acreditada fuera del perímetro | `ajeno`; no forzar ingreso, nómina ni otra categoría. |
| Contraparte no está conectada | No hay coincidencia en catálogo | `desconocido`, porque no conexión no prueba ajenidad. |
| IBAN enmascarado, ausente o cuenta colectora | Identificador insuficiente o intermediario | `desconocido`; nunca casar por sufijo o nombre. |
| UID opaco en otro proveedor | Mismo texto, sin equivalencia documentada | `desconocido`; no igualarlo a un IBAN ni a otro UID. |
| Dos cuentas en un banco y solo una propia | `ent` común, cuentas distintas | Resolver por cuenta concreta; el banco/flujo común no autoriza ambas. |
| Cuenta familiar visible o usuario autorizado | Acceso confirmado, pertenencia económica sin resolver | `desconocido`; sin cruce de datos entre usuarios. |
| Conjunta frente a personal; participación 50/100 o no declarada | Titularidad/participación no resuelven el perímetro | No neutralizar automáticamente; requiere criterio y decisión expresa. |
| Misma cuenta aparente en ambos lados | Identidad contradictoria, devolución interna o corrección posible | Sin automatismo; revisar naturaleza del apunte, no inventar un traslado entre cuentas. |
| Cambio de titularidad o evidencia revocada | Movimiento fuera de la vigencia acreditada | `desconocido`; no reutilizar la pertenencia actual para el histórico. |
| Principal y comisión separados | Dos apuntes identificados | Neutralizar solo el principal acreditado; conservar el gasto de comisión. |
| Comisión incluida o importe neto no desglosado | No se sabe qué parte es traslado | No neutralizar toda la fila; revisión pendiente. |
| Monedas distintas o moneda omitida | Sin conversión documental trazable | No emparejar por igualdad nominal ni automatizar efecto monetario. |
| Abono menor de 200 y pertenencia acreditada | Evidencia positiva independiente del importe | El contrato puede describir propiedad; cobertura/cambio del umbral queda pendiente de grant, no se presume en legado. |
| `PDNG`, fecha futura, dirección ausente o estado desconocido | Propiedad parcial pero cobro no acreditado | No saltar controles ni dar disponibilidad; sin nueva clasificación automática que afecte dinero. |
| Estado vacío en formato antiguo | Lectura antigua válida sin certeza de contabilización | Mantener comportamiento legado; no convertirlo en evidencia positiva nueva. |
| PDNG→BOOK con nueva referencia | Evidencia nueva sobre misma operación según reglas vigentes | Mantener identidad/conciliación propia, sin segundo ingreso ni apropiarse de un débito igual. |
| Dos BOOK idénticos, distinta cuenta o referencia | Dos apuntes reales | Conservar ambos y sus ordinales; propiedad no es dedup. |
| Repetición de paginación, pull y reinicio | Misma identidad de fila | Enriquecimiento idempotente, sin duplicar ni perder evidencia en la ida/vuelta. |
| Diario e histórico de una misma fila | Mismo contrato, diferente ruta | Misma evidencia/decisión; respetar selección y preview históricos. |
| Notificación TR, OB y manual parecidos | Fuentes diferentes | No copiar pertenencia por parecido ni fusionar automáticamente. |
| Cliente nuevo/servidor viejo y cliente viejo/servidor nuevo | Campo opcional ausente o ignorado | Comportamiento anterior y ausencia explícita; no afirmar soporte inexistente. |
| Renombrado o categoría manual, posible duplicado o lápida | Decisión previa conservada | No pisar decisión ni reinsertar; no contar dos veces ni borrar el original. |
| Presupuesto mensual/ciclo/widget/mes cerrado | Casos elegibles e inelegibles, nómina/Bizum y reservas | Validar cada contrato monetario y sus límites, sin reutilizar un verde como prueba de otra superficie. |

## Alcance de esta entrega y siguiente decisión

Se propone desarrollar primero la evidencia de contraparte y pertenencia con contrato versionado y cobertura documentada; después, bajo otro encargo, validar el recorrido completo y cualquier cambio de categoría. Antes de ello quedan abiertos la disponibilidad real del proveedor, las reglas de cuentas compartidas y perímetro, el almacenamiento privado, la compatibilidad entre lectores y la confirmación del síntoma con el dueño. No se necesita ni se autoriza una corrección de datos para aceptar este análisis.

Revisión realizada en esta entrega: lectura estática de la fuente citada y del diff documental. La revisión independiente y el permiso de publicación se registran fuera del documento para no atribuir una aprobación futura al texto. Ningún test previo se reejecuta ni se reclama como evidencia nueva.

## Referencias exactas

Todas las referencias de código siguientes están fijadas a la misma fuente `9ef9f19b49938d207271289176f2314b858152a1`; los comentarios históricos se interpretan junto al código ejecutable, sin trasladar sus afirmaciones sobre bancos o datos reales al presente.

- **E1:** [docs/BACKLOG.md, línea 54](https://github.com/JuanjoAvila/Aely/blob/9ef9f19b49938d207271289176f2314b858152a1/docs/BACKLOG.md#L54).
- **E2:** [src/modules/08-motor-bank.js, líneas 3167–3183](https://github.com/JuanjoAvila/Aely/blob/9ef9f19b49938d207271289176f2314b858152a1/src/modules/08-motor-bank.js#L3167-L3183).
- **E3:** [src/modules/08-motor-bank.js, líneas 2011–2038](https://github.com/JuanjoAvila/Aely/blob/9ef9f19b49938d207271289176f2314b858152a1/src/modules/08-motor-bank.js#L2011-L2038).
- **E4:** [src/modules/08-motor-bank.js, líneas 3688–3700](https://github.com/JuanjoAvila/Aely/blob/9ef9f19b49938d207271289176f2314b858152a1/src/modules/08-motor-bank.js#L3688-L3700) y [3930–3944](https://github.com/JuanjoAvila/Aely/blob/9ef9f19b49938d207271289176f2314b858152a1/src/modules/08-motor-bank.js#L3930-L3944).
- **E5:** [supabase/functions/_shared/enablebanking.ts, líneas 219–265](https://github.com/JuanjoAvila/Aely/blob/9ef9f19b49938d207271289176f2314b858152a1/supabase/functions/_shared/enablebanking.ts#L219-L265).
- **E6:** [supabase/functions/bank-sync/index.ts, líneas 327–328](https://github.com/JuanjoAvila/Aely/blob/9ef9f19b49938d207271289176f2314b858152a1/supabase/functions/bank-sync/index.ts#L327-L328), [359–365](https://github.com/JuanjoAvila/Aely/blob/9ef9f19b49938d207271289176f2314b858152a1/supabase/functions/bank-sync/index.ts#L359-L365) y [454–460](https://github.com/JuanjoAvila/Aely/blob/9ef9f19b49938d207271289176f2314b858152a1/supabase/functions/bank-sync/index.ts#L454-L460).
- **E7:** [src/modules/08-motor-bank.js, líneas 1516–1530](https://github.com/JuanjoAvila/Aely/blob/9ef9f19b49938d207271289176f2314b858152a1/src/modules/08-motor-bank.js#L1516-L1530).
- **E8:** [src/modules/08-motor-bank.js, líneas 1005–1043](https://github.com/JuanjoAvila/Aely/blob/9ef9f19b49938d207271289176f2314b858152a1/src/modules/08-motor-bank.js#L1005-L1043), [1205–1215](https://github.com/JuanjoAvila/Aely/blob/9ef9f19b49938d207271289176f2314b858152a1/src/modules/08-motor-bank.js#L1205-L1215) y [src/modules/00-core.js, líneas 3488–3527](https://github.com/JuanjoAvila/Aely/blob/9ef9f19b49938d207271289176f2314b858152a1/src/modules/00-core.js#L3488-L3527).
- **E9:** [src/modules/00-core.js, líneas 1290–1318](https://github.com/JuanjoAvila/Aely/blob/9ef9f19b49938d207271289176f2314b858152a1/src/modules/00-core.js#L1290-L1318), [2721–2729](https://github.com/JuanjoAvila/Aely/blob/9ef9f19b49938d207271289176f2314b858152a1/src/modules/00-core.js#L2721-L2729), [3618–3667](https://github.com/JuanjoAvila/Aely/blob/9ef9f19b49938d207271289176f2314b858152a1/src/modules/00-core.js#L3618-L3667) y [3780–3793](https://github.com/JuanjoAvila/Aely/blob/9ef9f19b49938d207271289176f2314b858152a1/src/modules/00-core.js#L3780-L3793).
- **E10:** [src/modules/00-core.js, línea 376](https://github.com/JuanjoAvila/Aely/blob/9ef9f19b49938d207271289176f2314b858152a1/src/modules/00-core.js#L376), [src/modules/01-i18n.js, líneas 2934–2945](https://github.com/JuanjoAvila/Aely/blob/9ef9f19b49938d207271289176f2314b858152a1/src/modules/01-i18n.js#L2934-L2945) y [src/modules/08-motor-bank.js, líneas 2940–3064](https://github.com/JuanjoAvila/Aely/blob/9ef9f19b49938d207271289176f2314b858152a1/src/modules/08-motor-bank.js#L2940-L3064).
- **E11:** [src/modules/04-tab-gastos.js, líneas 15–21](https://github.com/JuanjoAvila/Aely/blob/9ef9f19b49938d207271289176f2314b858152a1/src/modules/04-tab-gastos.js#L15-L21) y [30–52](https://github.com/JuanjoAvila/Aely/blob/9ef9f19b49938d207271289176f2314b858152a1/src/modules/04-tab-gastos.js#L30-L52).
- **E12:** [src/modules/08-motor-bank.js, líneas 1782–1844](https://github.com/JuanjoAvila/Aely/blob/9ef9f19b49938d207271289176f2314b858152a1/src/modules/08-motor-bank.js#L1782-L1844), [2160–2183](https://github.com/JuanjoAvila/Aely/blob/9ef9f19b49938d207271289176f2314b858152a1/src/modules/08-motor-bank.js#L2160-L2183) y [3606–3662](https://github.com/JuanjoAvila/Aely/blob/9ef9f19b49938d207271289176f2314b858152a1/src/modules/08-motor-bank.js#L3606-L3662).
- **E13:** [src/modules/00-core.js, líneas 3620–3633](https://github.com/JuanjoAvila/Aely/blob/9ef9f19b49938d207271289176f2314b858152a1/src/modules/00-core.js#L3620-L3633) y [src/modules/08-motor-bank.js, líneas 4–12](https://github.com/JuanjoAvila/Aely/blob/9ef9f19b49938d207271289176f2314b858152a1/src/modules/08-motor-bank.js#L4-L12).
