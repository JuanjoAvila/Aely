# UX2909-04 · Antigüedad bancaria y revisión de ingresos

Propuesta de diseño, 26/10/2026. Fuente inspeccionada: **`78c41edf87e2784ed31f8c9a083656c786d2632f`**. Este documento no implementa pantallas, conciliación ni cambios de dinero. No acredita despliegue, datos bancarios actuales, pruebas ejecutadas o aceptación móvil.

Encargo: `ux2909-04-bank-freshness-income-design-codex-20261026`, definición `828ca75ee7c28d1c34dc409f43508adf632bfa4b`. Abarca el diseño de ambos problemas: saber qué datos pueden faltar y revisar un ingreso manual que se parece a uno bancario. Una cifra negativa no demuestra por sí sola un error ni un duplicado; tampoco actualizar los bancos garantiza que deje de ser negativa.

## 1. Frontera y estado observado

`docs/BACKLOG.md:71` separa revisión de ingresos (UX-2909-04) de antigüedad y botones (UX-15); `:302` conserva la petición conjunta original. `:136-145` describe además el cambio de Gastos v5: «Actualizar gastos» fuera y explicación de lectura de nube al pie de Filtros. Esta propuesta reúne las necesidades de diseño por encargo expreso, sin reabrir UX-15 runtime, recuperar aquel botón ni atribuir cierres nuevos. El brief anterior `docs/briefs/ux-2909-04-ingreso-manual.md` contiene evidencia histórica de otra candidata: sirve de contexto, no prueba lo que corre hoy.

Inventario AS IS, referencias de líneas de la base indicada (rutas relativas):

| Fuente | Contrato observado | Consecuencia para el diseño |
|---|---|---|
| `src/modules/11-app-main.js:917-974`, `:1017-1026` | Sync espera lectura de nube; aplica movimientos, conciliaciones y saldos. `lastBankSync=at` es la marca global de esa respuesta y de su guardado. `obBalAt[aspsp]` recoge `balanceAt` cuando viene. | La marca global no certifica éxito individual ni cobertura completa. No copiarla a cada banco. |
| `src/modules/10-app-components.js:958-1015` | Mis bancos tiene estado de conexión, acordeón y «Saldo actualizado» con `obBalAt[aspsp] || last_sync`. Su comentario distingue `last_sync` como cursor del extracto y fallback legado. | Ya existe puerta y lenguaje visual. El fallback no demuestra la hora real de un saldo; distinguir procedencia desconocida. |
| `src/modules/08-motor-bank.js:960-1046`, `:1047-1096` | Saldos fallidos conservan cuentas con señales stale; fases por cuenta distinguen saldo de lectura. Reancla la base para que el saldo mostrado corresponda al bancario utilizable. Puede haber una cuenta buena y otra fallida. | No convertir un éxito de saldo o un timestamp por banco en éxito de todas sus cuentas o movimientos. |
| `src/modules/08-motor-bank.js:1279-1334` | `flattenBankTx` conserva cuenta en `acc`, trata parcialidad/expiración y puede mezclar feed anterior con BOOK nuevos inequívocos. | Tener filas no prueba extracto completo. La fecha del movimiento más reciente no es hora de lectura. |
| `src/modules/08-motor-bank.js:3842-3855`, `:3244-3281` | `bankIssuesOf` cubre conexión pendiente/caducada/sin cuentas; `bankReadWarnings` distingue límites, interrupción, saldo fallido, parcialidad y enlaces esperados ausentes. | La ausencia de `bankIssues` no significa «todo al día». Preservar avisos de lectura por su alcance. |
| `src/modules/11-app-main.js:1222-1227`; `src/modules/10-app-components.js:811`, `:1006-1015` | Acción manual compartida llama bancos y brókers, recoge un informe; «Actualizar todos» no filtra al banco de la tarjeta. | Conservar alcance real y explicarlo antes de pulsar. No prometer un sync individual inexistente. |
| `src/modules/11-app-main.js:1408-1444`, `:1461-1471`; `docs/ARQUITECTURA.md:808-825` | No hay consulta bancaria por mera apertura/primer plano; lectura de nube sí. Notificación bancaria requiere ajuste explícito y límite persistente; autorización bancaria tiene su recorrido existente. | Ningún nuevo disparador automático, timer o reintento por abrir este diseño. No confundir lectura de nube con consulta al banco. |
| `src/modules/08-motor-bank.js:1691-1757`, `:1793-1820`, `:1920-1965` | Ingreso importado tiene importe negativo. Admite BOOK o legado sin estado, rechaza otros estados y fechas futuras/inválidas; respeta ventana y lápidas. Revisión manual específica exige BOOK y categoría ingreso, mismo banco, céntimo y ventana de tres días. Unicidad en ambos sentidos antes de poner `possibleDupOf`; ambiguos reciben `possibleDup` sin pareja. | Parecido abre revisión, no acredita identidad. La revisión específica no demuestra cobertura del legado sin estado o llegada en orden inverso. |
| `src/modules/08-motor-bank.js:1738-1766`, `:1923-1938` | Excluye manual pendiente, repetido, con recibo/deuda, borrado o reclamado; considera bancos ya existentes para no gastar dos veces el manual. La búsqueda manual se agrupa por entidad/importe, no por cuenta. | No reutilizar manual ni enlazar otra cuenta por suposición. La cuenta conocida exige atención, no una garantía que este matcher no da. |
| `src/modules/00-core.js:2664-2694`, `:3540-3576`; `src/modules/04-tab-gastos.js:482-499`, `:2614-2624` | `possibleDup` viaja como `#dup`; `possibleDupOf` no se reconstruye desde esa marca. «Es el mismo» elimina fila OB, conserva gemelo si existe, registra vínculo y la UI añade lápida/borrado remoto. «Son distintos» quita marca, libera vínculo y pide PATCH. La ficha ofrece hoy ambos botones con copy genérico de cargos sin nombre. | No llamar a ese borrado una relación reversible ni permitirlo sin pareja inequívoca revisada. No prometer deshacer universal o persistencia atómica. Copy específico para ingresos. |
| `src/modules/08-motor-bank.js:2743-2788`; `src/modules/00-core.js:3184-3199` | Presupuesto excluye posibles repetidos; ciclo y mes natural tienen reglas distintas, y la nómina que abre ciclo no añade otro presupuesto. El saldo mostrado es derivado por rol. | No presentar una suma de filas como saldo de cuenta ni crear un nuevo total. Cualquier importe de revisión debe decir qué magnitud y periodo afecta. |
| `src/modules/08-motor-bank.js:14-92`, `:4301-4315` | `flows` previstos usan otra ruta: BOOK único del banco/mes, anterior al previsto hasta siete días y no futuro. Nombre compatible admite tolerancia; sin nombre compatible usa un céntimo. Competidor de ingreso/traspaso o varias cuentas fijas del banco impiden atribución. `paidYm/paidDay` solo valen con `paidBank/paidAmount` compatibles; `keepShownAcrossFlows` compensa base para conservar saldo mostrado. Cambiar contrato invalida marcas. | No confundir un apunte manual de Gastos con una previsión, ni `paidYm` con una relación manual↔BOOK. La revisión no debe sumar otra vez una nómina ya incluida en saldo. |

## 2. Jerarquía de información propuesta

Reutilizar Mis bancos, ficha de movimiento, filas, chips, hints y hojas existentes. No rediseñar el panel general. En Cartera, junto a la puerta bancaria existente, un resumen corto abre Mis bancos: «Hay datos bancarios pendientes de revisar» solo si existe evidencia de parcialidad/desconexión/antigüedad conocida. Si solo falta procedencia: «Consulta la fecha de los datos bancarios». El detalle explica cada banco; nunca un verde global derivado del último que respondió.

En Inicio/Gastos, la ayuda de una cifra explica primero su **magnitud, periodo y filtros**; después advierte «Puede faltar información bancaria» cuando proceda, con «Ver bancos». Si hay revisiones de ingresos, una entrada separada «Revisar ingresos ({n})» abre las filas afectadas, sin duplicar otra cola. Una cifra negativa con datos incompletos no se atribuye causalmente a la nómina ni se corrige visualmente: «Esta cifra usa los datos disponibles. Revisa los bancos y los ingresos pendientes». No aparecer por el signo negativo como único disparador.

Esquema propuesto dentro del acordeón actual:

```text
Banco A                         Conexión activa
Saldo: leído {fecha y hora} · hace {tiempo}
Movimientos: lectura incompleta / fecha no disponible
Último intento: {fecha y hora}, si está acreditado
[Ver detalle]
  Cuenta A: saldo disponible; movimientos pendientes
  Cuenta B: no se pudo leer el saldo
[Actualizar todos] [Reconectar, solo si corresponde]
```

Antes de la acción: «Actualizar todos consulta los bancos y los brókers configurados. Puede tardar». Conservar el informe manual conjunto existente, con resultados por fuente y por cuenta si hay parcialidad. No introducir una acción «Actualizar este banco» hasta que un contrato futuro pueda cumplirla.

## 3. Antigüedad: evidencia y estados

Tres ejes independientes: conexión, resultado de lectura de saldo/movimientos y edad de cada dato acreditado. «Conectado» no equivale a reciente; «Desconectado» no borra la última cifra; sin conexión a internet se siguen leyendo datos guardados. Una actualización parcial conserva el éxito anterior de la fase que falló.

Propuesta de presentación de edad: fecha/hora absoluta más edad legible, en zona horaria visible en detalle. «Reciente» solo con éxito acreditado y edad válida. Un umbral de 24 horas podría servir como aviso de antigüedad, **pendiente de decisión de producto**; no es una regla existente ni una garantía bancaria. Hasta fijarlo, usar «Leído hace {tiempo}», sin badge que certifique actualidad. Timestamp futuro, inválido o sin procedencia: «Fecha no disponible», nunca cero ni «ahora». Solo afirmar «Nunca sincronizado» si existe evidencia de ausencia de primer éxito; ausencia del timestamp legado no la demuestra.

| Estado de diseño | Qué se muestra | Acción y persistencia segura |
|---|---|---|
| Éxito acreditado reciente | Fecha de cada fase válida; «No se han recibido movimientos nuevos» solo si la lectura lo acredita. | Actualizar todos a demanda. Cero filas nuevas no implica cero actividad ni cobertura histórica completa. |
| Datos antiguos | «Datos leídos hace {tiempo}»; conservar cifra y fuente. | Actualizar todos; no poner a cero ni sincronizar al abrir. |
| Sin primer éxito conocido | «Aún sin datos bancarios», si la ausencia está acreditada. | Completar conexión/actualizar según estado. Si solo falta fecha: «Fecha no disponible». |
| Desconectado / pendiente | Estado de conexión y último dato válido por separado. | Reconectar/completar enlace. No atribuir expiración a cualquier fallo temporal. |
| En curso | «Consultando bancos y brókers…»; anteriores fechas visibles. | Evitar doble pulsación; cancelar/cerrar la hoja no debe inventar éxito. No dar un progreso individual que no se conoce. |
| Éxito parcial | «Saldo leído {fecha}; movimientos incompletos» o el inverso, solo si consta. Por cuenta cuando divergen. | Mostrar qué falta y conservar datos anteriores. Sin resultado de una fase: «Resultado no disponible». |
| Fallo temporal / límite de consultas | «No se pudo completar la lectura. Se conservan los datos anteriores». | Acción manual disponible conforme a los límites existentes; informar espera si se conoce, sin bucle de reintento. |
| Sin conexión | «Sin conexión. Estás viendo datos guardados». | Sin consulta automática al recuperar red; actualizar por acción explícita. |
| Legado / procedencia incompleta | «Fecha de lectura no disponible»; detalle «La fecha guardada corresponde al avance del extracto» si solo hay cursor. | No transformar `last_sync`, `lastBankSync` o fecha del último movimiento en éxito individual. |

Necesidades futuras de contrato, **no campos presentes garantizados**: identidad estable de banco/enlace/cuenta; por fase, hora del último intento y su resultado; hora del último dato aplicado correctamente; cobertura del extracto y parcialidad; procedencia/versionado de la evidencia. Persistirlos ligados al dato que describen, separados de la hora de lectura de nube. `obBalAt` por entidad no basta para certificar todas las cuentas. Un cliente sin esta evidencia muestra el estado desconocido, sin fabricar timestamps ni reconstruirlos mirando gastos.

## 4. Revisión de ingresos: recorrido propuesto

1. **Manual antes de banco.** Tras una consulta solicitada, preservar ambas evidencias. Si el motor propone posible coincidencia, señalarla en Gastos y en la entrada de revisión; no borrar, cambiar importe ni confirmar relación por nombre/importe. El apunte bancario marcado no vuelve a sumar en el presupuesto existente. Explicar «Este apunte del banco está pendiente de revisión y no se suma por segunda vez». No prometer que todas las cifras de la app ya estén corregidas.
2. **Abrir comparación.** Mostrar dos tarjetas con origen «Apuntado a mano» / «Traído del banco», importe firmado legible, fecha, concepto, banco y cuenta cuando se conocen; referencia solo abreviada en detalle y sin exponer números de cuenta completos. Explicar qué coincide y qué falta, sin porcentaje de confianza inventado. Una referencia distinta entre dos BOOK prueba dos identidades, no cuál corresponde al manual.
3. **Decidir.** Sin selección previa. «Revisar después» mantiene estado y deja salir. «Es el mismo ingreso» solo se habilita con pareja concreta existente, no borrada, no reclamada y contrato fresco compatible. Antes de confirmar, describir el efecto exacto: se conserva el apunte manual y se retira la fila bancaria duplicada conforme al contrato actual. «Son ingresos distintos» hace contar ambas entradas cuando son elegibles en ese periodo; no afirma otro aumento del saldo bancario ya leído.
4. **Varios candidatos / pareja perdida.** «No sabemos qué apunte corresponde». Mostrar opciones sin preselección; no conectar el botón actual `resolvePossibleDup(...,true)` a un caso sin gemelo localizable. «Es el mismo» queda deshabilitado hasta que un futuro contrato permita elegir y validar una relación. «Revisar después» permanece disponible. No escoger el primero, más reciente o de nombre parecido.
5. **Resultado y recuperación.** Confirmar localmente «Decisión guardada en este dispositivo» si ese es el único hecho. Si falla compartirla: «No se ha podido compartir la decisión» con revisión/reintento explícito conforme al contrato futuro. No mostrar éxito de nube por un toast local. Recargar o recibir estado de otro dispositivo no debe volver a consumir el manual ni deshacer la decisión. Garantizarlo y resolver carreras requiere un contrato de implementación posterior; el borrado remoto actual y el estado no forman una operación atómica demostrada.

No ofrecer «Deshacer» como promesa general del borrado actual. Es preferible proponer para implementación una relación durable revisable que preserve ambas evidencias; eso cambia el contrato financiero y de sincronización y exige decisión separada. Este brief no elige ni implementa esa migración.

| Caso | Comportamiento de diseño esperado | Límite de la base / decisión pendiente |
|---|---|---|
| Banco antes de manual | Antes de guardar el manual, ofrecer revisar un ingreso bancario ya conocido; siempre poder salir. | El análisis de `importObExpenses` no acredita un matcher simétrico al alta manual. Requiere flujo futuro; no prometer detección retroactiva. |
| Dos ingresos reales de igual importe y referencias distintas | Ambas identidades permanecen visibles; no colapsarlas por parecido. Si un manual podría corresponder a uno, revisión explícita. | La exclusión provisional por `possibleDup` no demuestra que el total sea definitivo. Mostrar pendiente, no «duplicado confirmado». |
| Sin referencia, varios manuales o varios bancos/cuentas | Ninguna pareja elegida automáticamente. Mostrar procedencia/cuenta desconocida y el motivo. | Matcher manual actual usa entidad y céntimo, no cuenta. No usarlo como prueba de relación multicuenta. |
| Importe/fecha corregidos | Reabrir comparación con datos actuales; no confirmar con la copia antigua. Un céntimo distinto no se fuerza a coincidir. | Cambios de identidad, categoría, fecha o contrato deben invalidar propuesta de forma explícita; definir persistencia futura. |
| Anulación/devolución posterior | Mostrar abono y reversión como hechos separados; no volver a contar el manual ni declarar cobro vigente por una relación anterior. | Signos y referencias requieren vínculo acreditado; no deducir reversión solo de importe opuesto. |
| Pendiente, fecha futura o legado sin estado | «Pendiente de confirmación bancaria» solo con esa evidencia; no tratar como BOOK. | La base admite ingreso sin estado para compatibilidad, pero no lo convierte en prueba de confirmación de una relación. |
| Offline, replay, recarga y sync posterior | Cerrar/abrir no altera cifras; mismo hecho recibido otra vez no duplica. Conservar decisión y advertir si no está compartida. | Identidad estable y resolución durable entre dispositivos son criterios futuros, no garantía añadida por diseño. |
| Previsión `flows` y nómina ya incluida en saldo | Mostrar «Previsto» separado de «Apuntado a mano» y «Traído del banco». No sumar flujo + manual + BOOK como tres cobros. | Respetar `paidYm/paidDay/paidBank/paidAmount`, unicidad y compensación de `keepShownAcrossFlows`; revisión manual no escribe esos campos. |

## 5. Copy propuesto ES / EN / CA

Son propuestas de texto, no claves añadidas al catálogo. Conservar placeholders idénticos en los tres idiomas; no usar el texto genérico actual sobre «cargos sin nombre» para una nómina con nombre.

| Uso | ES | EN | CA |
|---|---|---|---|
| Detalle | Datos de {bank} | Data from {bank} | Dades de {bank} |
| Saldo | Saldo leído: {date} | Balance read: {date} | Saldo llegit: {date} |
| Edad | Leído hace {time} | Read {time} ago | Llegit fa {time} |
| Movimiento | Movimientos: lectura incompleta | Transactions: incomplete read | Moviments: lectura incompleta |
| Desconocido | Fecha de lectura no disponible | Read date unavailable | Data de lectura no disponible |
| Intento | Último intento: {date} | Last attempt: {date} | Últim intent: {date} |
| Sin datos | Aún sin datos bancarios | No bank data yet | Encara sense dades bancàries |
| Conexión | Reconecta este banco | Reconnect this bank | Reconnecta aquest banc |
| En curso | Consultando bancos y brókers… | Checking banks and brokers… | Consultant bancs i brókers… |
| Acción existente | Actualizar todos | Refresh all | Actualitza tots |
| Alcance | Consulta los bancos y los brókers configurados. Puede tardar. | Checks your configured banks and brokers. This may take a while. | Consulta els bancs i els brókers configurats. Pot trigar. |
| Fallo | No se pudo completar la lectura. Se conservan los datos anteriores. | The read could not be completed. Previous data is kept. | No s'ha pogut completar la lectura. Es conserven les dades anteriors. |
| Offline | Sin conexión. Estás viendo datos guardados. | Offline. You are viewing saved data. | Sense connexió. Estàs veient dades desades. |
| Ayuda contextual | Esta cifra usa los datos disponibles. Revisa los bancos y los ingresos pendientes. | This figure uses the available data. Review your banks and pending income checks. | Aquesta xifra fa servir les dades disponibles. Revisa els bancs i els ingressos pendents. |
| Puerta | Ver bancos | View banks | Veure bancs |
| Cola | Revisar ingresos ({n}) | Review income ({n}) | Revisar ingressos ({n}) |
| Posible relación | Este ingreso podría ser el que apuntaste a mano. | This income may be the one you recorded manually. | Aquest ingrés podria ser el que vas apuntar a mà. |
| Origen manual | Apuntado a mano | Recorded manually | Apuntat a mà |
| Origen banco | Traído del banco | Received from the bank | Rebut del banc |
| No resuelto | Este apunte del banco está pendiente de revisión y no se suma por segunda vez. | This bank entry is awaiting review and is not added a second time. | Aquest apunt del banc està pendent de revisió i no se suma una segona vegada. |
| Ambigüedad | No sabemos qué apunte corresponde. | We do not know which entry matches. | No sabem quin apunt correspon. |
| Mismo | Es el mismo ingreso | It is the same income | És el mateix ingrés |
| Efecto mismo | Se conserva el apunte manual y se retira la fila bancaria duplicada. | The manual entry is kept and the duplicate bank row is removed. | Es conserva l'apunt manual i es retira la fila bancària duplicada. |
| Distintos | Son ingresos distintos | They are different income payments | Són ingressos diferents |
| Aplazar | Revisar después | Review later | Revisar més tard |
| Solo local | Decisión guardada en este dispositivo | Decision saved on this device | Decisió desada en aquest dispositiu |
| Compartir fallido | No se ha podido compartir la decisión | The decision could not be shared | No s'ha pogut compartir la decisió |
| Sin confirmación | Pendiente de confirmación bancaria | Awaiting bank confirmation | Pendent de confirmació bancària |
| Previsión | Previsto | Planned | Previst |

## 6. Criterios de aceptación futuros y oráculos independientes

Los siguientes ejemplos son **especificación**, no pruebas realizadas. Importes en céntimos enteros; ingresos internos negativos, presentación como abono positivo. Perfil sintético de una cuenta, mes natural y mismos filtros; no extrapolar al ciclo ni a saldos derivados sin su propio cálculo.

| Escenario sintético | Resultado que debe comprobar una futura implementación |
|---|---|
| M1 manual −180000; B1 BOOK −180000 mismo banco/día y pareja única | Antes de decidir, B1 visible pendiente y contribución presupuestaria adicional 0; M1 sigue contado. «Mismo» deja una contribución de ingreso 180000, conserva trazabilidad, y replay/recarga no la elevan a 360000. |
| M1 −180000; B1/B2 BOOK −180000 con referencias diferentes | Dos identidades bancarias conservadas, manual sin atribución automática. Si la persona confirma M1=B1 y B2 distinto, ingreso resultante 360000, no 180000 ni 540000. Antes de decidir, cifra marcada como pendiente; no afirmar total definitivo. |
| M1/M2 −180000 y un B1 compatible | No asignar B1 a M1 por orden. Revisar después no borra ni libera marcas. Confirmación sin pareja seleccionada no disponible. |
| M1 −180000; B1 −179999 o banco/cuenta conocida incompatible | No autorrelación por tolerancia. Mantener identidades y explicar diferencia; no modificar importe ni saldo para casar. |
| B1 llega antes de M1; o cambia fecha/categoría antes de confirmar | Propuesta revisable y validación del estado vigente; no aplicar una relación calculada sobre la copia antigua. Detección en orden inverso requiere implementación separada. |
| B1 −180000 y reversión R1 +180000 acreditadamente vinculada | Contribución neta de esos hechos 0; M1 ya resuelto no resucita. Sin vínculo probado, revisión explícita y ninguna anulación automática. |
| Cuenta con saldo bancario utilizable 250000; nómina ya incluida | Abrir/cerrar revisión no cambia 250000. Una confirmación prevista que solo cambia metadatos conserva 250000 mediante la compensación existente; no sumar otros 180000 al saldo por confirmar manual/BOOK. Separar esta conservación de la futura regla de resolver ingresos distintos. |
| Banco A éxito de saldo 09:00; movimientos parciales; B falla a las 10:00 | A saldo 09:00 y movimientos incompletos; B conserva su último éxito o desconocido. El intento global 10:00 no rejuvenece B ni el extracto de A. Una cuenta fallida de A impide «todo A actualizado». |
| Sin timestamp, timestamp inválido/futuro, offline y posterior éxito | Nunca «hace 0» inventado ni «nunca» por un null. Al recuperar red no consulta por sí sola. Éxito posterior actualiza solo las fases/cuentas acreditadas y conserva decisiones de revisión. |

**Oráculo financiero independiente:** un libro sintético en céntimos con identidades, cuenta, fuente y decisiones explícitas, calculado sin invocar los helpers del producto. Contrastar contribuciones firmadas por periodo/filtros y, por separado, saldo bancario leído frente al saldo mostrado derivado por rol. Para los ejemplos M1/B1/B2, enumerar cada identidad y su inclusión; no deducir expectativas copiando `possibleDup` del resultado. Cubrir replay, permutación de llegada, cantidades corregidas y reversión con referencia propia.

**Oráculo de interacción y procedencia independiente:** un guion de aceptación que observe pantalla, foco, informe y llamadas de consulta con respuestas sintéticas por banco/cuenta/fase y tiempos controlados. Verificar que lo que lee una persona coincide con esa respuesta, incluyendo fallo parcial, ausencia de pareja, offline, recarga y decisión local frente a compartida. Consultar el libro anterior como expectativa, sin reutilizar el matcher ni la función de formato del producto. Cambiar solo B de fallo a éxito no debe modificar el texto de A. Abrir o volver al primer plano produce cero nuevas consultas bancarias atribuibles a estas pantallas.

La aceptación con una persona que no conozca la app debe comprobar que identifica qué dato es antiguo, qué hará Actualizar todos y por qué un ingreso espera revisión; puede aplazar sin borrar. Esa sesión sintética y la prueba móvil física quedan pendientes de una implementación futura; ninguna se ejecutó para este brief.

## 7. Accesibilidad, móvil y decisiones abiertas

Reutilizar componentes y tokens existentes. Cada estado tiene texto además de color/icono; contraste y foco visibles; fechas legibles sin truncar el motivo. Acciones táctiles de al menos 44 × 44 píxeles CSS y espacio entre decisiones; dos tarjetas se apilan en ancho pequeño, con scroll vertical y sin una tabla horizontal obligatoria. La hoja conserva título accesible, cierre, retorno del foco al origen y navegación por teclado/lector. Anunciar fin/fallo una vez con región de estado, sin interrumpir ni mover foco por un sync. Admitir aumento de texto al 200 %, movimiento reducido y teclado físico; no depender de pulsación mantenida para descubrir acciones. Solo mostrar referencias abreviadas necesarias y datos sintéticos en cualquier aceptación pública.

Decisiones que deben resolverse antes de implementar:

1. **Procedencia y cobertura:** definir evidencia durable por banco/cuenta/fase y si hay datos suficientes sin ampliar backend. Hora de intento, de dato aplicado y cursor no son intercambiables. Falta política para legado, clocks futuros, timezone y éxito parcial.
2. **Edad:** aprobar umbral/contexto de «antiguo» y decidir si aporta valor frente a edad factual. No disparar consultas ni prometer ausencia de movimientos por su edad.
3. **Identidad de relación:** resolver cuenta conocida, falta de referencia, dos BOOK distintos, orden banco→manual y conservación de ambas evidencias. Unicidad heurística no es confirmación humana ni identidad bancaria.
4. **Resolución segura:** decidir guardas ante pareja desaparecida, borrado/cambio concurrente, estado compartido, reintento, idempotencia y corrección de decisión. La base puede retirar OB incluso sin gemelo local; la propuesta debe impedir esa acción sin relación validada. No añadir un botón reversible sobre un borrado irreversible sin contrato.
5. **Magnitudes:** especificar qué cambia al resolver una relación y qué conserva saldo/ancla; respetar mes/ciclo, bancos elegidos y previsiones. No reconstruir histórico ni extender cambios a todos los ingresos por parecido.
6. **Frontera UX-15:** acordar integración del texto y puertas con Mis bancos/Gastos v5; no recuperar controles retirados ni declarar terminada esa tarea por este diseño. Puentes de brókers, backend, despliegue y aceptación física conservan encargos propios.

Entrega de esta PR: un único documento de diseño. Revisión estática de fuente, alcance y copy; **sin tests, build, npm, runner, servidor, cambios de runtime, versión ni catálogo**. La aprobación de este documento permite discutir una implementación futura; no cambia el dinero ni certifica la experiencia actual del móvil.
