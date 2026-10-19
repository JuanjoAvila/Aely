Beta 4.26.148 (19/10/2026), candidata de beta sobre la 4.26.147 con APK nueva (4.26.148/code59): un cargo con la marca de un recibo se confirma con «Sí, es este recibo» y un recibo que solo había vencido se puede enlazar a mano (INC-1810-04, PR 281 y siguiente), y la vibración nueva con ajustador en Ajustes solo en beta (UX-16, cambio nativo). Sin SQL. Dos tandas nuevas (`youtube-enlazar-recibo`, `vibracion-ajustador`); las de la 145 (`plan-por-confirmar-prestamo-youtube`, `vibracion-suave-ronda-3`, rechazadas) pasan a vacías. Integración rápida: `3bc25a8dc` (youtube-enlace) y `352cf25f9` (vibra-ajustador) sobre la beta 4.26.147 servida (`ccb798376`).

INC-2709-03/UX-08, candidata web sin integrar sobre78b54d61d: Gestionar y categoría conservan su scroller sin capas de reposo y la hija fixed permanece en el viewport. [Repro, capturas y límites](briefs/inc270903-ux08-ola-web.md); ola visual Android y aceptación móvil pendientes.

Beta 4.26.147 (19/10/2026), candidata de beta sobre la 4.26.146, solo web y sin APK nueva (sigue la 4.26.145/code58): al bajar la cuota de una deuda y no cuadrar con el plazo, la edición ofrece alargar el plazo con un toque (PR 282, INC-1910-01) y los bloques de brókers se reordenan manteniendo pulsado (PR 283, INC-2709-08). Sin SQL. Dos tandas nuevas (`deuda-bajar-cuota-alarga-plazo` y `cartera-ordenar-brokers`) además de las de la 145 y la 146. Integración rápida: PR 282 (`9f7daa51`) sobre la beta 4.26.146 (`48d5ef810`).

Beta 4.26.146 (19/10/2026), candidata de beta sobre la 4.26.145, solo web y sin APK nueva (sigue la 4.26.145/code58): la vuelta a primer plano y el arranque no se quedan parados con mucho historial (la app no rehace el historial entero si la nube no ha cambiado). Sin SQL. Una tanda nueva (`vuelta-sin-tiron`) además de las de la 145. Integración rápida: `claude/perf-vuelta` (`fff05adca`) sobre la beta 4.26.145 (`656194916`). Las tandas de la 145 quedan como están.

INC-2709-08, en la beta 4.26.147 (PR 283): orden de brókers mediante la misma pulsación larga que las cuentas, en la portada de Cartera y en Inversiones → Ver todas. Guarda únicamente la preferencia visual en `settings.secOrder.inv`, con persistencia y sincronización existentes. Revisión, integración y aceptación móvil pendientes.

Beta 4.26.145 (19/10/2026), candidata sobre la 4.26.144: la vibración del anillo de Mi ciclo sube suave y progresiva, el borde da un toque algo más intenso que se repite mientras se tira y el cursor de la gráfica de Inicio da un toque suave (UX-16 ronda 3, necesita la APK 4.26.145/code58); el saldo del banco se reparte por fases (H2, PR 279, toca la Edge `bank-sync`, sin desplegar); Plan solo da por pagado lo que ve y deja «Por confirmar» lo demás, y la ficha del gasto dice qué recibo o deuda paga (INC-1810-03/04, PR 281); incluye el hotfix de producción 4.26.142. Cuatro integraciones sobre la beta 4.26.144: PR 279 (`3940e1b2`), PR 280 (`5ee28328`), `origin/main` (hotfix 4.26.142) y PR 281 (`b09d0945`). Sin SQL; APK nueva 4.26.145/code58. Dos tandas nuevas en el panel (`vibracion-suave-ronda-3` y `plan-por-confirmar-prestamo-youtube`); la 144 conserva solo `deudas-guardar-motivo` (sin votar) y las demás salen del panel. Edge `bank-sync` (H2) pendiente de desplegar con OK del dueño.

Beta 4.26.144 (18/10/2026), candidata: la vibración al rellenarse el anillo de Mi ciclo y al llegar al final de una lista por impulso es más suave (necesita la APK 4.26.144/code57), el aviso de por qué no se guarda una deuda se ve entero, renombrar un recibo ya cobrado cambiando mayúsculas no lo deja pendiente y el histórico de CaixaBank deja sin marcar una lectura dudosa en vez de darla por nueva. Cuatro integraciones sobre la beta 4.26.143: PR 277, 278, 275 y 276. Sin SQL; APK nueva 4.26.144/code57. Tres tandas en el panel; la 143 queda con `tandas: []`.

Beta 4.26.143 (18/10/2026), candidata: las fichas de Deudas avisan cuando cambiar el saldo o el día de cobro mueve el plazo total y las cuotas que faltan, la ficha de una cuenta guarda el saldo escrito también al salir con atrás, el porcentaje de Mi ciclo dice «<1 %» cuando queda un margen mínimo, el banco de pruebas no enseña un aviso de reinicio sin motivo y las devoluciones del banco se separan de su compra por signo. Ocho integraciones sobre la beta 4.26.141: PR 265, 268, 273, 269, 271, 272, 270 y 267 (FIN-17, con FIN-11). Sin SQL ni APK nueva; la 4.26.142 queda reservada para un hotfix de producción. Tres tandas en el panel.

Beta 4.26.141 (17/10/2026), candidata: las fichas se cierran bajando suave también con el gesto de atrás, vibración suave al llegar al final de una pantalla y en el anillo de Mi ciclo (UX-16, requiere la APK nueva 4.26.141/code56), Metas no pierde lo que guardan dos móviles a la vez (INC-0410), los movimientos de dos cuentas del mismo banco ya no se confunden (FIN-10) y más protección al conectar bancos (SEC-03). Cinco integraciones sobre la beta 4.26.140: `claude/hoja-141` (`9e30757b`), PR 264 (`af387031`), PR 263 (`600d5021`), PR 261 (`fc2a7bf3`) y PR 260 (`8a34391a`). Sin SQL. Dos tandas en el panel; la 140 queda con `tandas: []`. Los cortes fechados de abajo son historia, no instrucciones vigentes.

Beta 4.26.140 (17/10/2026), candidata: la hoja de editar Deudas y Metas se cierra bajando suave al guardar, con el teclado abierto el primer atrás solo lo esconde y conserva lo escrito (UX-13), una nómina manual y la del banco no cuentan doble (UX-2909-04) y más protección en las conexiones con bancos y MyInvestor (SEC-01, sin cambio visible). Seis integraciones sobre la beta 4.26.139: `claude/hoja-cierre-140` (`c325b2a5`), PR 256 (`8f64624b`), PR 251 (`00bb2bbb`), PR 248 (`255eb082`) y PR 255 (`b8a71214`); la PR 250 (FIN-10) pasa a la 141. Sin SQL ni APK nuevos (sigue la 4.26.117/code55). Dos tandas en el panel; la 139 queda con `tandas: []`. Los cortes fechados de abajo son historia, no instrucciones vigentes.

Beta 4.26.139 (17/10/2026), candidata: Deudas queda más estricta y clara (plazo y cuota tienen que cuadrar y el aviso dice entre qué cuotas encaja; una cuota a 0 con saldo pendiente no se guarda), la hoja de editar Deudas y Metas se abre como la de Apuntar y la cierra el gesto de atrás, una financiación que empieza más adelante no cuenta como deuda antes de empezar (FIN-12) y Trade Republic deja rastro de sesión caída (SES-01, sin cambio visible). Tres PR sobre la beta 4.26.138: `claude/deudas-139` (`a7c044e5`, que añade a la 5eda435b el rango sin TAE heredada y el aviso en euros), PR 242 (`ab0abf68`) y PR 247 (`059218be`). Sin SQL ni APK nuevos (sigue la 4.26.117/code55). Dos tandas en el panel; la 138 queda con `tandas: []` (tres aprobadas, dos rechazadas y recogidas en la 139). Los cortes fechados de abajo son historia, no instrucciones vigentes.

Hotfix 4.26.142 (integrado en la beta 145) (18/10/2026): sobre la producción 4.26.137, lo apartado por una regla de «Reservar dinero» ya borrada vuelve al presupuesto del mes al abrir la app o leer la nube. Directo a producción por petición urgente del dueño; sin APK nueva (sigue la 4.26.117/code55) ni servidor. Ninguna tanda en el panel. La línea siguiente y los cortes fechados de abajo son historia, no instrucciones vigentes.

Promoción 4.26.137 (16/10/2026): sube a producción la beta 4.26.137.1 sobre la producción 4.26.136. MyInvestor ya no pierde las posiciones leídas si una sincronización choca con otra o su sello final falla, y solo propone reconectar tras un intento manual. Una nota familiar más el historial de producción; sin APK nueva (sigue la 4.26.117/code55). La migración 0026 y `myinvestor-connect` ya están en producción desde el 16/10; `myinvestor-sync` se despliega solo cuando este cliente esté servido. Ninguna tanda en el panel. Los cortes fechados de abajo son historia, no instrucciones vigentes.

Beta 4.26.135 (15/10/2026), candidata: dos compras idénticas el mismo día en el mismo sitio ya no se funden en una, y una compra que el banco manda primero como pendiente y luego como cargada ya no cuenta dos veces, ni en la app ni en el widget. Las referencias bancarias distintas ocupan ranuras distintas, y al absorber el cargo se deja una lápida `ob-absorbed|banco|referencia|ranura` (también en la nube) que leen el cliente, el mes y el widget. PR 235 de Codex (`1496559e`) sobre la 4.26.134. **Orden de despliegue: la Edge Function `ingest` (lector de `_shared/presupuesto.ts`) ANTES que el cliente.** Sin SQL ni APK nuevos (sigue la 4.26.117/code55). Tanda `compras-identicas-ids` en revisión, única del panel; `inicio-grafica-reservas` (4.26.134) aprobada, sale del panel. Los cortes fechados de abajo son historia, no instrucciones vigentes.

Promoción 4.26.134 (15/10/2026): sube a producción la beta 4.26.134 sobre la producción 4.26.133. La gráfica de patrimonio de Inicio deja de enseñar bajones falsos al mover dinero entre tus cuentas o sacar efectivo del cajero; un traspaso a una cuenta que no está en la app cuenta como salida y la hoja «Cómo se calcula» lo explica. Una nota familiar más el historial de producción; solo web, sin servidor ni APK nuevos (sigue la 4.26.117/code55). Ninguna tanda en el panel. Los cortes fechados de abajo son historia, no instrucciones vigentes.

Beta 4.26.134 (15/10/2026), candidata: la gráfica de patrimonio de Inicio deja de enseñar bajones falsos al mover dinero entre cuentas propias o sacar efectivo del cajero. Un traspaso con su contrapartida propia (mismo importe y signo opuesto, en bancos presentes, a ±3 días civiles de Madrid) se empareja una sola vez y queda neutro; un traspaso sin contrapartida cuenta como salida por decisión del dueño, salvo enlace a bróker o aportación periódica coincidente; la retirada de efectivo se reconoce por concepto o por la confirmación de Gastos y resta si no hay cuenta o bolsillo de efectivo. La hoja «Cómo se calcula» lo explica en es/en/ca. PR 233 de Codex (`a24cb716`) sobre la producción 4.26.133 (`cdea1015`); solo web, sin servidor ni APK nuevos (sigue la 4.26.117/code55). Tanda `inicio-grafica-reservas` en revisión, única del panel; `scroll-borde-barra` ya estaba en producción. Los cortes fechados de abajo son historia, no instrucciones vigentes.

Promoción 4.26.133 (15/10/2026): sube a producción la beta 4.26.133 sobre la producción 4.26.132. Al llegar al final o al principio de una pantalla deslizando rápido vuelve la ola de Android, y la barra de abajo ya no asoma a medias (regresión de la 4.26.97: el margen de pintado de la barra escondida hacía desplazable el documento 30 px). Una nota familiar más el historial de producción; solo web, sin servidor ni APK nuevos (sigue la 4.26.117/code55). Ninguna tanda en el panel. Los cortes fechados de abajo son historia, no instrucciones vigentes.

Beta 4.26.133 (14/10/2026), candidata: al llegar al fondo de una pantalla con la barra inferior escondida, el deslizamiento rápido vuelve a sacar la ola de Android y la barra ya no asoma a medias (regresión de la 4.26.97: el margen de pintado de la barra escondida hacía desplazable el documento 30 px). Solo web, sin servidor ni APK nuevos. Tanda `scroll-borde-barra` en revisión, única del panel; `inicio-recientes-sin-repetidos` (4.26.132) sale del panel. Encima de la candidata 4.26.132.

Promoción completa 4.26.132 (14/10/2026): sube a producción la ronda de beta 129 a 132 sobre la producción 4.26.128. Ajustes pierde las opciones que no hacían nada y la app es más ligera, el perfil guarda solo nombre y apodo y la proyección de inversiones pasa a Cartera; Trade Republic junta solo los movimientos repetidos, sin preguntar; en cada cuenta se puede decir qué parte es tuya (cuentas compartidas); y «Últimos movimientos» de Inicio no repite las compras de Trade Republic. Una nota familiar más el historial de producción; las notas intermedias de beta quedan en Git y su contrato, en los guardianes. La APK sigue en la 4.26.117/code55 y no hay funciones del servidor que desplegar. Los cortes fechados de abajo son historia, no instrucciones vigentes.

Beta 4.26.132 (14/10/2026), candidata: «Últimos movimientos» de Inicio, la ficha de cada cuenta y el resumen del hogar dejan de repetir las compras de Trade Republic (la fila oculta del banco de una pareja automática, `autoGemelo`, solo se escondía en Gastos; ahora también en esas listas, y la foto del hogar no cuenta dos veces el importe). Solo web, sin servidor ni APK nuevos. Tanda `inicio-recientes-sin-repetidos` en revisión; `cuenta-parte-mia`, `tr-empareja-sin-preguntar` y `limpieza-ajustes-perfil`, aprobadas por el dueño, salen del panel (Retiro132). Sobre la candidata 4.26.131: cada cuenta puede contar solo tu parte en el patrimonio (una conjunta al 50 %). Cartera → Tus cuentas → la cuenta → «Parte mía» → Cambiar; Inicio y su gráfica cuentan solo esa parte, y gastos y presupuesto no cambian. Si una cuenta compartida tiene movimientos antiguos sin cuenta de origen, su ficha pregunta («Decidir») si son de esa cuenta. Rama `claude/cuenta-parte-mia` (`450d544e`, nacida de `24d0d463`) sobre la beta 4.26.130; solo web, sin servidor nuevo. Tandas `cuenta-parte-mia`, `tr-empareja-sin-preguntar` y `limpieza-ajustes-perfil` en revisión.

Beta 4.26.130 (14/10/2026), candidata: Trade Republic empareja solo el aviso y el cargo del banco, sin preguntar, y el emparejado se puede deshacer desde la ficha del movimiento. PR 230 de Codex (`bd2b20f3`) sobre la beta 4.26.129; solo web, sin servidor nuevo. Tandas `tr-empareja-sin-preguntar` y `limpieza-ajustes-perfil` en revisión; `inicio-mes-pasado-mismo-dia` (4.26.128) y `bancos-reconexion-revoca` (4.26.127) aprobadas en el móvil y retiradas del panel.

Beta 4.26.129 (14/10/2026), candidata: Ajustes sin opciones muertas (Pestañas, Ocultar bloques, Actualizar precios al abrir y, salvo en modo sencillo, Cambiar mis recibos), perfil con solo nombre y apodo y la Proyección de inversiones en Cartera → Inversiones → «Ver todas». Rama `claude/limpieza-1410` (`a0bf906a`) sobre la beta 4.26.128; solo web, sin servidor nuevo. Tandas `limpieza-ajustes-perfil`, `inicio-mes-pasado-mismo-dia` y `bancos-reconexion-revoca` en revisión.

Beta 4.26.128 (14/10/2026), candidata: en Inicio, «más/menos que el mes pasado» compara hoy con el mismo día del mes pasado (o de hace 3 meses) y cuadra con la gráfica; el dinero en tránsito a un bróker no hunde la gráfica y los intereses de la deuda no cuentan como capital. Sobre la beta 4.26.127; solo web, sin servidor nuevo. Tandas `inicio-mes-pasado-mismo-dia` y `bancos-reconexion-revoca` en revisión.

Beta 4.26.127 (14/10/2026), candidata: bancos que no se dan por caducados ante un fallo pasajero, desconexión que revoca de verdad y descargas incompletas que conservan lo guardado. Sobre la producción 4.26.126; cuatro funciones Edge cambian y no están desplegadas, sin migración. Tanda `bancos-reconexion-revoca` en revisión.

Promoción completa 4.26.126 (13/10/2026): sube a producción la ronda entera de beta 118 a 126. Inicio estrena la gráfica del patrimonio desde el primer día con datos, la comparación con el mes pasado y una tarjeta del mes que enseña solo lo que queda y cuánto se puede gastar al día; cada cargo del banco paga un solo recibo y se ve en Gastos sin contar dos veces; los bancos no pierden movimientos si falla la conexión o al reconectar; los apuntes iguales de Trade Republic entran todos; y Plan no salta al bajar despacio. Una nota familiar más el historial de producción; las notas intermedias de beta quedan en Git y sus contratos, en los guardianes. La APK sigue en la 4.26.117/code55. Los cortes fechados de abajo son historia, no instrucciones vigentes.

Candidata de beta4.26.126 (13/10/2026): la tarjeta del mes de Inicio («Este ciclo» / «Este mes») deja de enseñar la línea de estado («Vas justito», «Vas bien»…) y el rótulo «Te quedan»; a la derecha del anillo quedan solo el importe (de 28 a 24 px) con su «de X €» y la línea «N € al día durante M días», centrados respecto al anillo. El estado lo siguen diciendo el color del anillo y de la línea «al día» y un `aria-label` del botón con la frase completa; no cambia ningún cálculo. Solo web, encima de la beta 4.26.125; la APK sigue en la 55 y ninguna función del servidor cambia. `inicio-patrimonio-flujos`, aprobada en el móvil sobre la 4.26.125.1, sale del panel; la única tanda en revisión es la nueva, `inicio-tarjeta-ciclo-limpia`.

Beta4.26.125 (13/10/2026), publicada: la gráfica del patrimonio de Inicio, corregida tras verla el dueño en su móvil sobre la 123. La serie arranca en el primer día con movimientos de las cuentas (antes la recortaban la primera foto de inversiones, el banco más corto, un bien con escalones, una deuda con fecha o un traspaso de una sola pata); la línea llega hasta el punto de hoy (se revela con un recorte en vez de con `stroke-dasharray`); la frase bajo la cifra compara el punto más bajo de los últimos 45 días con el de 45 días anteriores (la víspera del cobro, caiga el día que caiga la nómina) en vez de el último punto con el primero, siempre con el importe, y el rojo queda solo para ir peor de verdad; aparece el periodo 3M; desaparece el texto bajo los periodos y la «i» abre una hoja inferior, «Cómo se calcula». Solo web, encima de la beta 4.26.124; la APK sigue en la 55 y ninguna función del servidor cambia. `plan-scroll-lento`, aprobada en el móvil sobre la 4.26.124.1, sale del panel; `inicio-patrimonio-flujos`, sin veredicto en la 123, se vuelve a presentar con el guion nuevo y es la única tanda en revisión.

Beta4.26.124 (13/10/2026), publicada: en Plan, bajar despacio desde arriba del todo ya no hace saltar el contenido. El gesto que cambia de sección empujaba el scroll a mano encima del scroll del navegador; se quita ese empujón y el scroll es solo del navegador. Solo web, encima de la beta 4.26.123; la APK sigue en la 55 y ninguna función del servidor cambia. Salen del panel las tres tandas aprobadas en el móvil sobre la 4.26.122.1 (`recibo-cargo-en-gastos`, `tr-iguales-ordinal` y `bancos-acuse-reconexion`); quedan en revisión `plan-scroll-lento`, nueva, e `inicio-patrimonio-flujos`, aún sin veredicto.

Beta4.26.123 (13/10/2026), publicada: la gráfica de Inicio aparece desde el primer día, también con hipoteca o préstamos dados de alta de antes. Una deuda sin fecha explícita ya no recorta la serie: su saldo se reconstruye hacia atrás con su cuadro de cuotas (o se mantiene si no hay cuota); una cuenta manual mantiene su primer cierre hacia atrás; bajo la gráfica queda una sola línea («Gráfica desde…») y el detalle por cuenta, bien y deuda va en la «i». Solo web, encima de la 4.26.122; la APK sigue en la 55. Incidente: la 121 se publicó sin probar con deudas heredadas y el dueño vio «Faltan saldos fiables» en vez de la gráfica.

Integración4.26.122 (13/10/2026), preparada y no publicada por separado (va dentro de la 123): todo cargo del banco sale en Gastos. El adeudo que paga un recibo o un puntual del Plan ya no se descarta al sincronizar: entra en Gastos atenuado y rotulado «Recibo: nombre» (o «¿Recibo: nombre?» si solo se parece), sin contar otra vez en lo gastado ni en los saldos. Desde su ficha, «No es este recibo» lo devuelve a gasto normal, y confirmar el pago con ese mismo cargo lo deshace. El filtro por defecto de Gastos no cambia: sigue enseñando los bancos de gasto diario. Web más `_shared/presupuesto.ts`, que usa la función `ingest`: `ingest` se despliega ANTES que la web, nunca después. Encima de las integraciones 4.26.120 y 4.26.121, que no se promocionan a producción sin esta entrega; la APK sigue en la 55. Cuatro tandas en revisión: `recibo-cargo-en-gastos`, nueva, la de la 121 y las dos de la 120 sin tocar. Despliegue de `ingest`, publicación en beta y aceptación móvil pendientes.

Integración4.26.121 (13/10/2026), preparada y no publicada por separado (va dentro de la 122): Inicio v4.2. El patrimonio (cuentas, inversiones, bienes y deudas) se reconstruye hacia atrás por flujos en vez de con fotos del total, se dibuja en una gráfica que se consulta con el dedo, una frase dice cuánto ha subido o bajado en el periodo elegido y la tarjeta del mes dice cuánto queda y cuánto se puede gastar al día. Donde falta un dato la gráfica se recorta y dice desde cuándo hay datos; la racha se retira. Solo web, encima de la integración 4.26.120; la APK sigue en la 55. Su tanda `inicio-patrimonio-flujos` sigue en el panel de la 122.

Integración4.26.120 (13/10/2026), preparada y no publicada por separado (va dentro de la 122): los apuntes iguales de un banco que no da identificador (mismo día, importe y comercio; Trade Republic por Open Banking) entran todos en vez de fundirse en uno, contestar «es el mismo» empareja el aviso una sola vez e «Importar histórico» reconoce lo ya contestado. Web más `_shared/presupuesto.ts`, que usa la función `ingest`: `ingest` se despliega ANTES que la web, nunca después. La APK sigue en la 55. Dos tandas en revisión: `tr-iguales-ordinal`, nueva, y `bancos-acuse-reconexion`, que vuelve con el guion corregido tras su rechazo en la 119 (el paso 2 prometía «ningún repetido» y las preguntas pendientes de Trade Republic no venían de esa tanda). Despliegue de `ingest` pendiente.

Beta4.26.119 (12/10/2026), publicada y rechazada en el panel por la redacción de un paso: los bancos no pierden movimientos si la respuesta de una sincronización no llega al móvil, y reconectar un banco con las mismas cuentas no deja días sin leer. El cursor del servidor solo avanza cuando el móvil acusa haber guardado lo recibido (acuse local al dispositivo), el suelo de lectura baja tres días para cubrir la fecha valor y `bank-callback` conserva el cursor al reconectar. Web más dos funciones Edge (`bank-sync` y `bank-callback`); la APK sigue en la 55. Su tanda `bancos-acuse-reconexion` pasa a la nota 120 con el guion corregido; `recibos-cargo-unico` (118) fue aprobada el 12/10 y salió del panel.

Beta4.26.118 (12/10/2026), publicada y APROBADA en el móvil el 12/10 (5 ok / 0 fallos): cada cargo del banco se atribuye a un único recibo. Un mismo cargo ya no marca pagados dos recibos, un homónimo de otro banco no paga el que no es, un recibo se reconoce pagado también cuando el pago salió de otro banco (nombre completo e importe exacto) y mover el día de un recibo ya cobrado por el banco no lo vuelve a descontar. Solo web, sobre la producción117; la APK sigue en la 55. Su tanda `recibos-cargo-unico` está aprobada y retirada del panel; promoción a producción pendiente.

Promoción completa4.26.117: entrada renovada, recuperación de movimientos bancarios, widget que se actualiza al pagar con la app cerrada tras actualizar la app e Inicio sin el desglose de Gastos superpuesto. La reconciliación conserva los30 commits propios de main y el código aprobado de beta117. Una nota familiar más el historial de producción; las notas intermedias de beta quedan en Git y sus contratos, en los guardianes. Los cortes fechados de abajo son historia, no instrucciones vigentes. [Acta](briefs/prod-completa-117.md).

Candidata selectiva web4.26.111: Cartera → Bienes permite alta vacía, edición y borrado con confirmación. Inicio conserva la gráfica aprobada de beta113, sin Inicio V42. Dos PR separados, sin fusionar ni publicar; pruebas completas, CI y revisión pendientes.

Selección web4.26.110: indicador de barra, Plan → Metas → Reservar dinero y vuelta desde Perfil/Ajustes y Recibos/Gestionar, con las identidades aprobadas107/108/110. Gráfica109 excluida e historial conservado. [Alcance y cualificación local](briefs/promocion-107-108-110-local26.md).

Snapshot8/10 previo a la entrega106: candidata selectiva4.26.106 desde main56c7e328 para las aprobadas99/100/101/102/106. Producción comprobada4.26.98, beta4.26.106.1/source8dcc5ed3. Revisión independiente, CI exacta y entrega pendientes. Panel beta solo se retira después de entrega real; lag global abierto. [Acta](briefs/promocion-aprobadas-local26.md).

Promoción selectiva98 preparada7/10: el dueño aprobó ocultar juntos barra y botón en beta4.26.98.1/sourceb7ab. Base main85b8, sólo CSS aprobada, scope y guardianes correspondientes. Producción96 ya servida; candidata98 local pendiente de revisión independiente, CI exacta y entrega. No99/100/APK/Edge/SQL; INC-2709-09 continúa abierto. [Acta](briefs/promocion-fab98-2026-10-07.md).

# Roadmap — Aely

MAIN4.26.110 incorpora PR196 (bdd75636), sólo pruebas, herramientas y documentación. Tests38005461796 y DeployPages38005461732 terminaron SUCCESS y sus artefactos se comprobaron; ese cierre no publica Inicio112 ni acredita APK nuevo o aceptación móvil. Las aprobadas99/100/101/102/106 ya entregadas conservan su cierre;109 sigue rechazada.

Promoción4/10: las once tandas de beta4.26.94.1 tienen aprobación vigente. Producción4.26.94/source8bb0398f servida y cotejada; APK52 estable y las tres funciones Edge entregadas. La limpieza conserva notas y decisiones; solo retira las once entregadas, sin producto nuevo. Prioridad permanente: producción de lo aprobado antes de otra implementación. [Acta](briefs/promocion-aprobadas-2026-10-04.md).

> Estado a 2026-10-19 · **v4.26.148** — candidata de beta sobre la 4.26.147 con APK nueva (4.26.148/code59): un cargo con la marca de un recibo se confirma con «Sí, es este recibo» y un recibo que solo había vencido se puede enlazar a mano (INC-1810-04, PR 281 y siguiente), y la vibración nueva con ajustador en Ajustes solo en beta (UX-16, cambio nativo). Sin SQL. Dos tandas nuevas (`youtube-enlazar-recibo`, `vibracion-ajustador`); las de la 145 (`plan-por-confirmar-prestamo-youtube`, `vibracion-suave-ronda-3`, rechazadas) pasan a vacías. Antes, **v4.26.147** — candidata de beta sobre la 4.26.146, solo web y sin APK nueva (sigue la 4.26.145/code58): al bajar la cuota de una deuda y no cuadrar con el plazo, la edición ofrece alargar el plazo con un toque (PR 282, INC-1910-01) y los bloques de brókers se reordenan manteniendo pulsado (PR 283, INC-2709-08). Sin SQL. Dos tandas nuevas (`deuda-bajar-cuota-alarga-plazo` y `cartera-ordenar-brokers`) además de las de la 145 y la 146. Antes, **v4.26.146** — candidata de beta sobre la 4.26.145, solo web y sin APK nueva (sigue la 4.26.145/code58): la vuelta a primer plano y el arranque no se quedan parados con mucho historial (la app no rehace el historial entero si la nube no ha cambiado). Sin SQL. Una tanda nueva (`vuelta-sin-tiron`) además de las de la 145. Antes, **v4.26.145** — candidata de beta sobre la 4.26.144: la vibración del anillo de Mi ciclo sube suave y progresiva, el borde da un toque algo más intenso que se repite mientras se tira y el cursor de la gráfica de Inicio da un toque suave (UX-16 ronda 3, necesita la APK 4.26.145/code58); el saldo del banco se reparte por fases (H2, PR 279, toca la Edge `bank-sync`, sin desplegar); Plan solo da por pagado lo que ve y deja «Por confirmar» lo demás, y la ficha del gasto dice qué recibo o deuda paga (INC-1810-03/04, PR 281); incluye el hotfix de producción 4.26.142; dos tandas nuevas en el panel y la de Guardar en Deudas sin votar; sin SQL. Antes, **v4.26.144** — candidata de beta sobre la 4.26.143: la vibración al rellenarse el anillo de Mi ciclo y al llegar al final de una lista por impulso es más suave (necesita la APK 4.26.144/code57), el aviso de por qué no se guarda una deuda se ve entero, renombrar un recibo ya cobrado cambiando mayúsculas no lo deja pendiente y el histórico de CaixaBank deja sin marcar una lectura dudosa en vez de darla por nueva; tres tandas en el panel, sin SQL. Antes, **v4.26.143** — candidata de beta sobre la 4.26.141: las fichas de Deudas avisan cuando cambiar el saldo o el día de cobro mueve el plazo total y las cuotas que faltan, la ficha de una cuenta guarda el saldo escrito también al salir con atrás, el porcentaje de Mi ciclo dice «<1 %» cuando queda un margen mínimo, el banco de pruebas no enseña un aviso de reinicio sin motivo y las devoluciones del banco se separan de su compra por signo; tres tandas en el panel, sin SQL ni APK. Antes, **v4.26.142** — hotfix de producción sobre la 4.26.137: lo reservado por una regla de reserva ya borrada vuelve al presupuesto (`liberarReservasHuerfanas`, al cargar y al leer la nube); sin APK nueva ni servidor. Antes, **v4.26.141** — candidata de beta sobre la 4.26.140: cierre suave de fichas con atrás (`useBackClose`/`useSheetSwipe`), plugin de vibración `AelyHaptics` (APK 56), Metas a tres vías (PR 263), FIN-10 (PR 264) y SEC-03 (PR 261); dos tandas en el panel, sin SQL. Antes, **v4.26.140** — candidata de beta sobre la 4.26.139: hoja de Deudas y Metas que cierra suave (`PlanEditSheet`/`useSheetSwipe`), atrás con teclado abierto (PR 248), nómina manual frente a la del banco (PR 251) y protección de conexiones (PR 256); dos tandas en el panel, sin SQL ni APK. Antes, **v4.26.139** — candidata de beta sobre la beta 4.26.138 con la rama `claude/deudas-139` (plazo y cuota que encajan, aviso con el rango de cuotas, cuota a 0 rechazada con saldo pendiente, hoja de editar con el velo de Apuntar y cierre con atrás), la PR 242 (FIN-12: inicio de financiación) y la PR 247 (SES-01: telemetría de sesión de Trade Republic). Dos tandas en el panel; sin SQL ni APK. Antes, **v4.26.138** — candidata de beta sobre la producción 4.26.137 con cuatro PR aprobadas: PR 240 (Deudas y Metas editables desde una hoja por tarjeta, con PR 239; `debtEditResult` valida plazo y cuota en céntimos y la deuda terminada solo deja cambiar el nombre), PR 243 (FIN-15: `filasComoLaApp` de `_shared/presupuesto.ts` reconoce banco + `#ref`, así que una compra PDNG/BOOK en días distintos no cuenta doble en el mes ni en el widget), PR 244 (UX-15: «Actualizar gastos» con su explicación) y PR 245 (INC-2709-15: botones de suscripciones completos en móvil). Cinco tandas en el panel. **Orden: desplegar `ingest` antes que el cliente**; sin SQL ni APK nueva. Antes, **v4.26.137** — producción con la beta 137 aprobada (MyInvestor, tanda `myinvestor-contador-a-cero` ya entregada) sobre la 4.26.136: la sincronización conserva las posiciones cuando dos peticiones chocan o falla el sello final, y el contador de fallos va por versión y solo caduca el enlace en un intento manual (`cloud.myinvestorSync(userInitiated)`). Servidor: `myinvestor-connect` y la migración 0026 ya desplegadas el 16/10; `myinvestor-sync` solo cuando este cliente esté servido; el keepalive no cambia. Una nota familiar más el historial de producción; sin APK nueva. Ninguna tanda en el panel. Antes, **v4.26.136** — producción con la beta 135 aprobada (más `ob-absorbed` en `GASTO_ORIGENES`): las ranuras ordinales por referencia bancaria (`obOrd`, `#ref` en `source`) y la lápida `ob-absorbed` (`obPendingAbsorbedState`, leída por cliente, mes y widget con `filasComoLaApp`). Una nota familiar más el historial de producción. Solo web: `ingest` ya está desplegado en producción desde `963f43c7` con la misma fuente, sin SQL; la APK sigue en la 4.26.117/code55. Ninguna tanda en el panel.

> Anterior: 2026-10-15 · **v4.26.135** — candidata de beta: compras idénticas con referencias bancarias distintas ocupan ranuras distintas (`obOrd`, `#ref` en `source`) y el cargo que absorbe a un pendiente deja la lápida `ob-absorbed` (`obPendingAbsorbedState`), leída por cliente, mes y widget (`filasComoLaApp`). Encima de la 4.26.134. Orden: desplegar `ingest` antes que el cliente; sin SQL; la APK sigue en la 4.26.117/code55. Tanda `compras-identicas-ids` en revisión.

> Anterior: Estado a 2026-10-15 · **v4.26.134** — candidata de beta: `netWorthSeries` empareja las dos patas de un traspaso propio una sola vez en ±3 días civiles de Madrid, trata el traspaso sin contrapartida como salida y reconoce la retirada de efectivo por concepto o por la confirmación de Gastos; `NetWorthInfoSheet` lo explica. Encima de la producción 4.26.133 (borde de scroll). Solo web: la APK sigue en la 4.26.117/code55 y no hay servidor que desplegar. Tanda `inicio-grafica-reservas` en revisión.


> Anterior: Estado a 2026-10-15 · **v4.26.134** — promoción a producción de la beta 134: la gráfica de patrimonio de Inicio (`netWorthSeries`) empareja las dos patas de un traspaso propio una sola vez, trata el traspaso sin contrapartida como salida y reconoce la retirada de efectivo. Una nota familiar más el historial de producción. Solo web: la APK sigue en la 4.26.117/code55 y no hay servidor que desplegar. Ninguna tanda en el panel.

> Anterior: 2026-10-15 · **v4.26.134** — candidata de beta: `netWorthSeries` empareja las dos patas de un traspaso propio una sola vez en ±3 días civiles de Madrid, trata el traspaso sin contrapartida como salida y reconoce la retirada de efectivo por concepto o por la confirmación de Gastos; `NetWorthInfoSheet` lo explica. Encima de la producción 4.26.133 (borde de scroll). Solo web: la APK sigue en la 4.26.117/code55 y no hay servidor que desplegar. Tanda `inicio-grafica-reservas` en revisión.

> Anterior: Estado a 2026-10-15 · **v4.26.133** — promoción a producción de la beta 133: `.app` lleva `overflow:clip`, así que el margen de pintado de 30 px de la barra escondida (`overflow-clip-margin`, 4.26.97) ya no hace desplazable el documento; el fling al fondo vuelve a dar la ola de Android y no deja asomar media barra. Una nota familiar más el historial de producción. Solo web: la APK sigue en la 4.26.117/code55 y no hay servidor que desplegar. Ninguna tanda en el panel.

> Anterior: Estado a 2026-10-14 · **v4.26.132** — promoción completa de la ronda de beta 129 a 132: Ajustes más limpios y app más ligera, Trade Republic que junta solo los repetidos, parte mía por cuenta y Últimos movimientos sin repetir las compras de Trade Republic. La APK sigue en la 4.26.117/code55; no hay servidor que desplegar. Ninguna tanda en el panel.

> Anterior: 2026-10-14 · **v4.26.132** — candidata de beta: los últimos movimientos de Inicio, la ficha de cuenta y el resumen del hogar excluyen `autoGemelo` (como Gastos) y la foto del hogar excluye los posibles repetidos; encima de la 4.26.131, «Parte mía» por cuenta. Cada cuenta (manual, re-anclada o extra de Open Banking) puede contar en el patrimonio solo la parte que es tuya (`settings.accountShare`); Inicio y su gráfica la respetan, y gastos, presupuesto y recibos siguen con el saldo entero del banco. Los movimientos viejos del banco sin cuenta de origen los atribuye el usuario desde la ficha («Decidir»), y los nuevos llevan su cuenta (`obAcc`). Rama `claude/cuenta-parte-mia` (`450d544e`) sobre la beta 4.26.130. Solo web: la APK sigue en la 4.26.117/code55 y no cambia ninguna función del servidor. Tandas `cuenta-parte-mia`, `tr-empareja-sin-preguntar` y `limpieza-ajustes-perfil` en revisión.

> Anterior: 2026-10-14 · **v4.26.130** — candidata de beta: Trade Republic empareja solo el aviso y el cargo del banco de una compra, sin preguntar, y el emparejado es reversible desde la ficha («No es el mismo: separar» / «Volver a unir»); borrar la compra retira también el apunte oculto y Deshacer los devuelve. PR 230 de Codex (`bd2b20f3`) sobre la beta 4.26.129. Solo web: la APK sigue en la 4.26.117/code55 y no cambia ninguna función del servidor. Tandas `tr-empareja-sin-preguntar`, `limpieza-ajustes-perfil`, `inicio-mes-pasado-mismo-dia` y `bancos-reconexion-revoca` en revisión.

> Anterior: 2026-10-14 · **v4.26.129** — candidata de beta: limpieza de Ajustes y del perfil. Fuera las opciones que no hacían nada (Pestañas, Ocultar bloques, Actualizar precios al abrir y, salvo en modo sencillo, Cambiar mis recibos); el perfil guarda solo nombre y apodo y borra el resto, también en la nube y en la copia diaria; la Proyección de inversiones vive en Cartera → Inversiones → «Ver todas». Rama `claude/limpieza-1410` (`a0bf906a`) sobre la beta 4.26.128. Solo web: la APK sigue en la 4.26.117/code55 y no cambia ninguna función del servidor. Tandas `limpieza-ajustes-perfil`, `inicio-mes-pasado-mismo-dia` y `bancos-reconexion-revoca` en revisión.

> Anterior: 2026-10-14 · **v4.26.128** — candidata de beta: Inicio compara hoy con el mismo día del mes pasado (o de hace 3 meses), como los extremos de la gráfica; el dinero que va a un bróker no desaparece de la gráfica mientras llega y los intereses de la hipoteca no cuentan como capital. Rama `claude/inicio-compara-vispera` (`99014642`) sobre la beta 4.26.127. Solo web: la APK sigue en la 4.26.117/code55 y no cambia ninguna función del servidor. Tandas `inicio-mes-pasado-mismo-dia` y `bancos-reconexion-revoca` en revisión.

> Anterior: 2026-10-14 · **v4.26.127** — candidata de beta: bancos con reconexión sin falsas caducidades (MyInvestor y Open Banking), desconexión que revoca el permiso en el banco y descargas incompletas que conservan lo guardado y lo explican. Tres ramas (`2d53ab24`, PR 226, PR 223) sobre la producción 4.26.126. Cambian `bank-sync`, `bank-disconnect`, `myinvestor-sync` y `myinvestor-keepalive`, sin migración y SIN desplegar; la APK sigue en la 4.26.117/code55. Tanda `bancos-reconexion-revoca` en revisión.

> Anterior: 2026-10-13 · **v4.26.126** — promoción completa preparada para producción: la ronda de beta 118 a 126 entera, sin ninguna tanda en el panel. La APK sigue en la 4.26.117/code55; el despliegue de funciones se acredita aparte.

> Anterior: 2026-10-13 · v4.26.126 — candidata de beta: la tarjeta del mes de Inicio se queda en el importe y en «N € al día durante M días», sin línea de estado ni «Te quedan» (el estado va en el color y en un `aria-label`). Solo web, encima de la beta 4.26.125; la APK sigue en la 4.26.117/code55. Tanda `inicio-tarjeta-ciclo-limpia` en revisión; `inicio-patrimonio-flujos`, aprobada sobre la 4.26.125.1, sale del panel. Ninguna función del servidor cambia en esta entrega.

> Anterior: 2026-10-13 · v4.26.125 — beta publicada: la gráfica del patrimonio de Inicio arranca en el primer día con movimientos de las cuentas, la línea llega hasta hoy, la frase compara con el mes pasado por mínimos de 45 días (rojo solo si va peor de verdad), hay periodo 3M y la «i» abre la hoja «Cómo se calcula». Solo web, encima de la beta 4.26.124; la APK sigue en la 4.26.117/code55. Tanda `inicio-patrimonio-flujos` (vuelta a presentar con el guion nuevo) en revisión; `plan-scroll-lento`, aprobada sobre la 4.26.124.1, sale del panel. Ninguna función del servidor cambia en esta entrega.

> Anterior: 2026-10-13 · v4.26.124 — beta publicada: en Plan, bajar despacio desde arriba del todo ya no hace saltar el contenido (el scroll es solo del navegador; el cambio de sección tirando hacia abajo sigue igual). Solo web, encima de la beta 4.26.123; la APK sigue en la 4.26.117/code55. Tandas `plan-scroll-lento` (nueva) e `inicio-patrimonio-flujos` en revisión; `recibo-cargo-en-gastos`, `tr-iguales-ordinal` y `bancos-acuse-reconexion`, aprobadas sobre la 4.26.122.1, salen del panel. `ingest`, que la 122 pedía desplegar antes que la web, no cambia en esta entrega.

> Anterior: 2026-10-13 · v4.26.123 — beta publicada: la gráfica de Inicio aparece desde el primer día, también con hipoteca o préstamos dados de alta de antes (una deuda sin fecha explícita se reconstruye hacia atrás con su cuadro de cuotas; una cuenta manual mantiene su primer cierre), una sola línea bajo la gráfica y el detalle en la «i». Solo web, encima de la 4.26.122; la APK sigue en la 4.26.117/code55. Tandas `inicio-patrimonio-flujos` (vuelta a presentar con el paso 2 corregido), `recibo-cargo-en-gastos`, `tr-iguales-ordinal` y `bancos-acuse-reconexion` en revisión.

> Anterior: 2026-10-13 · v4.26.122 — integración preparada y no publicada por separado: el cargo del banco que paga un recibo o un puntual del Plan sale en Gastos, atenuado y con el nombre del recibo, sin contar dos veces; «No es este recibo» desde su ficha lo devuelve a gasto normal y se puede deshacer. Web más `_shared/presupuesto.ts` (`ingest`, que se despliega antes que la web), encima de las integraciones 4.26.120 y 4.26.121; la APK sigue en la 4.26.117/code55. Tandas `recibo-cargo-en-gastos`, `inicio-patrimonio-flujos`, `tr-iguales-ordinal` y `bancos-acuse-reconexion` en revisión. La 120 y la 121 no se promocionan a producción sin esta entrega: con el ordinal y sin los recibos, el cargo marcado cuenta dos veces. Despliegue de `ingest`, publicación en beta y aceptación móvil pendientes. Quedan documentados: dos cargos iguales que casan con un recibo entran los dos marcados; un móvil con el estado viejo puede pisar `reciboBorrado`; tras «No es este recibo» sobre uno de dos iguales de un recibo fijo no hay vuelta atrás desde la ficha; dos filas idénticas, una con identificador del banco y otra sin él; y un segundo pull puede dejar la categoría del aviso sobre la de la fila.

> Anterior: 2026-10-13 · v4.26.121 — integración preparada y no publicada por separado: Inicio v4.2, con el patrimonio reconstruido por flujos (bancos por movimientos, cuenta manual y bienes por escalones, deudas por cuadro de amortización, inversiones entre fotos más aportaciones), gráfica consultable con el dedo, variación del periodo elegido y la tarjeta del mes con lo que queda y el importe al día. Solo web, encima de la integración 4.26.120. Su tanda `inicio-patrimonio-flujos` sigue en el panel de la 122. Quedan documentados: un bien que ya existía mantiene su valor actual hacia atrás hasta que se revalora, una deuda sin día de cargo sitúa la amortización al empezar el mes, y a la nube solo viaja una ventana de 14 cierres por cuenta (el histórico largo es local a cada móvil).

> Anterior: 2026-10-13 · v4.26.120 — integración preparada y no publicada por separado: los apuntes iguales de un banco sin identificador entran todos (ordinal), un aviso empareja una sola vez y el histórico reconoce lo ya contestado. Web más `_shared/presupuesto.ts` (`ingest`, que se despliega antes que la web); la APK sigue en la 4.26.117/code55. Sus tandas `tr-iguales-ordinal` y `bancos-acuse-reconexion` (guion corregido) siguen en el panel de la 122. Quedan documentados: `deleted` sigue por último-que-escribe, el histórico funde k iguales en un candidato, una repetición al paginar sin señal de estado entra dos veces y con versiones mezcladas el móvil anterior funde las filas iguales.

> Anterior: 2026-10-12 · v4.26.119 — beta publicada y rechazada en el panel por la redacción del paso 2 de su tanda: el cursor de bancos solo avanza con acuse del móvil, el suelo de lectura cubre la fecha valor y reconectar con las mismas cuentas conserva el cursor. Web más `bank-sync` y `bank-callback`; la APK sigue en la 4.26.117/code55. Su tanda `bancos-acuse-reconexion` vuelve en la 120. Quedan documentados: un dispositivo sin actualizar del mismo usuario sigue moviendo el cursor al leer, y el banco de pruebas no acusa.

> Anterior: 2026-10-12 · v4.26.118 — beta publicada y aprobada en el móvil (12/10), solo web: cada cargo del banco se atribuye a un único recibo. Tanda `recibos-cargo-unico` aprobada y retirada del panel; la APK sigue en la 4.26.117/code55. Quedan documentados y sin arreglo: aviso y cargo del mismo pago a más de tres días en otro banco, cargo más devolución del mismo comercio, y mostrar o deshacer la acreditación automática desde la ficha del cargo (decisión del dueño).

> Anterior: 2026-10-12 · v4.26.117 — producción: promoción completa de la beta aprobada (entrada, recuperación bancaria, widget y corrección del solape de Gastos). Android4.26.117/code55, con compatibilidad web para la APK52.

> Anterior: 2026-10-11 · v4.26.116 — bancos sin huecos y widget arreglado (APK 54).

> Anterior: 2026-10-11 · v4.26.115 — el widget se actualiza al pagar con la app cerrada (PR201), con APK 53; rechazada por el dueño en su móvil.

> Promoción96 fusionada en main `85b8b540`; fuente separada de beta98/99. El merge acredita integración, no artefactos servidos: CI/publicador/HTTP exactos deben confirmarse antes de retirar Inicio96 del catálogo beta. [Acta de origen](briefs/promocion-inicio96-2026-10-06.md).

> Snapshot verificado a 2026-10-07 · **v4.26.98** integrada en beta por PR153/b7abebb6: Apuntar acompaña la barra al retirarse y volver. Revisión independiente GO y CI37564577536 SUCCESS (12 FAB, control CSS97, 844 E2E y9 rendimiento). Publicador y artefactos servidos pendientes al escribir este corte; aprobación móvil propia pendiente. APK52/Edge/SQL intactos; INC-2709-09 abierto. [Acta](briefs/inc-0610-fab-sync-hide-2026-10-06.md).

> Snapshot anterior a 2026-10-06 · **v4.26.97** candidata para beta: contorno y ocultación completa del botón Apuntar. Conserva Inicio96.1. Revisión, CI y entrega exactas pendientes; móvil desconocido. Producción95 confirmada por HTTP. APK52 intacta; INC-2709-09 acumulativo abierto. [Acta](briefs/inc-2709-13-fab-motion-audit-2026-10-06.md).

Promoción selectiva6/10: candidata4.26.96 local para mostrar hasta tres metas activas en Inicio, aprobada directamente por el dueño para la fuente ca6f5e85. Base main537edc1; únicamente el límite visual aprobado, conservando todas las metas en Plan y el resto de main. Revisión independiente, CI y entrega servida pendientes; INC-2709-09 sigue abierto. [Acta](briefs/promocion-inicio96-2026-10-06.md).

> Snapshot de selección a 2026-10-10 · **v4.26.111** candidata selectiva de Bienes completo y gráfica de Inicio. Fuente beta `684a839d`, pruebas completas, CI e integración pendientes; historial y APK conservados.

> Snapshot previo a la entrega106, 2026-10-08 · **v4.26.106** candidata selectiva local; revisión, CI y entrega pendientes.

Promoción selectiva5/10: candidata4.26.95 para volver con mucho historial, autorizada directamente por el dueño. Base main8bb0398; solo caché de fechas aprobada en PR133, sin beta completa. Revisión independiente, CI y entrega servida pendientes. INC-2709-09 global sigue abierto. [Acta](briefs/promocion-cache95-2026-10-05.md).

> Snapshot anterior a 2026-10-05 · **v4.26.95** candidata de promoción selectiva autorizada de PR133. Caché de fechas con techo estable; el lag global de INC-2709-09 continúa abierto. Revisión independiente, CI y entrega servida pendientes. APK/backend/SQL sin cambios.

> Snapshot anterior a 2026-10-04 · **v4.26.94** candidata web terminada y verificada localmente; CI y publicación beta pendientes. Cierre de 162 casos DOM es/en/ca, con dos clientes en secuencia; suite Node sobre `094a7d23` con único fallo local de `memoria-espejo`, Deno pendiente de CI. El último cierre solo cambia el reloj del fixture antiguo y documentación, con producto idéntico. El presupuesto oficial sellado cumple1287/351KiB/3bloqueantes (1317221raw/358763gzip). Corte16:02UTC: beta servida93.2/source`4e65fa11`; producción86 y APK48/52. Aceptación móvil y escrituras simultáneas LWW siguen pendientes. Actas: [contrato mensual](briefs/inc-0410-metas-mensual.md) · [alta de reglas](briefs/inc-0410-metas-alta.md).

> Snapshot anterior a 2026-10-04 (12:30 UTC, panel de revisión) · **v4.26.93** publicada en beta. Primera entrega4.26.93.1 (1d5dd782), CI37200314653SUCCESS y artefactos cotejados a12:30UTC; cola11 tandas/24 puntos, historial/veredictos conservados. Producción86/d366 y APK beta80/code52/estable32/code48 intactos. Prueba y aprobación móvil pendientes. [Acta](briefs/ops-0410-panel-cola.md).

> Snapshot anterior a 2026-10-04 · v4.26.90 servida en beta como 4.26.90.2 desde la fuente `7f3da23b` ([PR117](https://github.com/JuanjoAvila/Aely/pull/117), solo guardia de tests; publicación [37168006229](https://github.com/JuanjoAvila/Aely/actions/runs/37168006229) cerrada y cotejada a las 02:35 UTC). Lo que se usa es lo de 4.26.90.1 (merge `4a2e3c54`, [PR116](https://github.com/JuanjoAvila/Aely/pull/116)): Gastos sin columna de presupuesto fuera de mes/ciclo; cifras y periodos intactos. Brókers89 se entregó antes como 4.26.89.1 (merge `0f825c45`, [PR115](https://github.com/JuanjoAvila/Aely/pull/115)). Producción sigue en 4.26.86 (`d366215a`). Sin aceptación móvil de 89 ni 90; APK80/code52 sin binario nuevo; Edge/SQL sin entregas. [Gastos](briefs/inc-0310-gastos-sin-limite.md) · [Brókers](briefs/inc-0310-broker-resultados.md).

> Snapshot anterior a 2026-10-03 (superado por la entrega) · v4.26.90 candidata local sobre fuente Brókers89 todavía pendiente de CI/publicación; beta88.1 y producción86 eran las últimas acreditadas.

> Snapshot anterior a 2026-10-03 · **v4.26.86** candidata: la categoría elegida a mano sobrevive al pull y al reinicio, y los pagos siguientes del mismo comercio la heredan. Solo cliente; integrada sobre la beta 85 (`cdfb2f2c`). DOM conjunto, CI exacta y móvil pendientes. [Acta](briefs/inc-0210-02-categoria-elegida.md).

> Snapshot anterior · **v4.26.85** conjunta: Plan reconoce cuotas vinculadas contabilizadas, Gastos comparte fechas entre lista/resumen/categorías y Gasolina/Taxi se pueden elegir por separado. Base3467bbd4; integración local sin publicar, CI/revisión/móvil pendientes. [Plan](briefs/inc-0210-01-plan-cuota.md) · [Gastos](briefs/inc-0210-03-gastos-periodo.md).

> Snapshot anterior · **v4.26.82** candidata: decisiones y progreso por huella, alcance por unidades y equivalencias históricas auditadas. Base beta80/source955765a9; APK80/code52 conservada. Revisión, CI exacta y entrega pendientes. [Acta](briefs/ops-0110-validaciones-persistentes.md).

> Snapshot anterior de preparación · **v4.26.80** candidata sobre79/d45fb8b1 con guiones intactos. Prebuild52 verificado, asset beta real descargado/cotejado y manifiesto52 local. CI exacta, build final con52 y entrega80 pendientes. [Acta](briefs/inc-2909-01-widget.md).

> Estado a 2026-10-01 · **v4.26.79** candidata de Retirada sobre Nómina78 eaf55e4a, conserva Panel76/UI77. Entrega prevista junto a Nómina y Widget en beta80; CI exacta, publicación y prueba móvil pendientes. [Acta](briefs/inc-2909-03-retirada-caixa.md).

> Estado a 2026-10-01 · **v4.26.78** candidata: guardia de nómina sobre UI77 finalca7734fd, conserva Panel76 y las tres tandas UI77. Cuatro fixtures DOM4/4 y guardianes afectados verdes; CI exacta, publicación y prueba móvil pendientes. [Acta](briefs/inc-3009-nomina-anticipada.md).
> Estado a 2026-10-01 · **v4.26.77** candidata: tres tandas de pantalla (Cyberpunk, Preguntar, Perfil) con guiones independientes es/en/ca y alcances separados, sobre la fuente del panel76. Sin publicación hasta CI exacta y gate del coordinador. [Acta](briefs/ui-77-integracion.md).
> Anterior · **v4.26.76** corrección local del panel: entrega exacta independiente del número de versión, deduplicación antes de retirar y motivos visibles por tanda. Beta publicada **4.26.75.1**/ca7b97d4; producción **4.26.67**, APK48 estable/APK51 beta. CI exacta, publicación76 y prueba móvil pendientes. [Auditoría](briefs/ops-0110-panel-entrega.md).
> Inicio73 publicado y cotejado a20:55UTC, CI completa SUCCESS y prueba móvil pendiente. [Acta conservada](briefs/inc-2909-02-inicio-natural.md).
> Anterior: **v4.26.68** — ayuda plegable de Mi ciclo en beta, pendiente de prueba móvil.
> Corte anterior verificado (27/9,19:41 UTC): **v4.26.56** OPS-02 aprobado y publicado exclusivamente en producción; merge `426131959a75e5af8923009646caf20fd5b8e430`, idéntico a la candidata revisada `e91debd8`. Promote [36343752892](https://github.com/JuanjoAvila/Aely/actions/runs/36343752892), Pages [36344438830](https://github.com/JuanjoAvila/Aely/actions/runs/36344438830); HTTP/ZIP/HTML/SW cotejados el 27/9 a las 19:41 UTC. Beta 4.26.56.1 conservaba FIN-05, selector y TR pendientes; APK estable 4.26.32/code 48 intacta. [Evidencia](briefs/ops02-restauracion-probada.md).
> Cierre del día: [backlog completo y14 incidencias](BACKLOG.md#cierre-del-día--27-de-septiembre-de-2026), con crash de cuotas, coherencia Inicio/Gastos/nómina y cargos CaixaBank como primeras prioridades. Ninguna se implementa en este cierre.
> OPS-01 C: control manual de una función, sin despliegue global y SQL opt-in; entrega de tooling aislada desde main. Estado exacto, pruebas y revisión en [brief C](briefs/ops01-control-2026-09-27.md). A ingest49 quedó activado y cotejado; FIN-06/Wallet aún requiere pago real. B categorize está autorizado pero bloqueado403 por permiso del token; FIN-05, selector y compra TR siguen pendientes.
> Publicación: el promote sigue el deploy de su commit y coteja el sello de Pages antes de cerrar; la suite lenta de 4.26.47 ya no se confunde con un fallo.
> Anterior: **v4.26.46** — cambiar el día de un recibo conserva una sola ocurrencia y la fecha bancaria real.
> Anterior: **v4.26.44** — la ficha de un recibo confirma el guardado antes de cerrarse y un doble toque solo puede persistir una vez.
> Anterior: **v4.26.43** — el doble aviso Wallet/TR conserva una sola fila y una sola confirmación, sin convertirlo en una revisión manual.
> Anterior: **v4.26.41** — las capas interiores de Recibos acompañan el Atrás nativo y el arrastre desde el centro, dejando visible su pantalla padre.
> Anterior: **v4.26.40** — Pregúntame respeta la zona segura con teclado, se recoloca sin rebote y oculta el indicador lateral.
> Anterior: **v4.26.42** — Bizum es una forma de pago separada de la finalidad real del gasto; el histórico no se recategoriza a ciegas.
> Anterior: **v4.26.38** — el fondo recupera su posición al empezar la salida de una hoja, sin conservar el bloqueo visual hasta el desmontaje.
> Anterior: **v4.26.37** — Plan enseña el saldo más bajo del mes y el día crítico, sin permitir que una nómina posterior maquille un descubierto anterior.
> Anterior: **v4.26.35** — el filtro de Gastos usa las mismas fichas de icono y nombre que Apuntar y Modificar, conservando plegado, búsqueda y multiselección.
> Anterior: **v4.26.34** — Pregúntame, Apuntar y las fichas de Gastos comparten una entrada y salida más pausada y continua, sin ralentizar el modo de movimiento reducido.
> Anterior: **v4.26.33** — Pregúntame abre sin enfocar la pregunta, de modo que la guía se puede leer antes de que aparezca el teclado.
> Anterior: **v4.26.32** — Inversiones y Plan → Gestionar comparten el gesto Atrás que acompaña al dedo; Recibos usa iconos por tipo, cierra al guardar y evita el doble alta.
> Anterior: **v4.26.31** — Plan → Gestionar repite la cifra y su reparto al entrar, mantiene los importes reales y deja sitio a cantidades largas.
> Anterior: **v4.26.30** — Gastos pliega el filtro largo de categorías, anima el desglose sin desmontarlo y cierra la ficha con confirmación.
> Anterior: **v4.26.29** — el gesto horizontal desde el fondo se reclama antes y la APK 47 desactiva la barra gris nativa sin perder scroll ni rebote.
> Anterior: **v4.26.28** — Inicio retira la supuesta ganancia mensual sin foto fiable del día uno y calcula la racha con presupuestos guardados de meses cerrados, sin llama.
> Anterior: **v4.26.27** — el paso a paso del Asistente queda en tres instrucciones cortas y numeradas, sin mostrar `/n` ni volver al texto largo.
> Anterior: **v4.26.26** — el editor del presupuesto mensual entra y sale con un ritmo propio, usa una cifra compacta y respeta el movimiento reducido.
> Anterior: **v4.26.25** — Ahorro mensual vuelve a Plan → Metas como planificación editable que no crea movimientos; los formatos 1.000 y 1.200,50 conservan su valor real.
> Anterior: **v4.26.24** — el gesto horizontal vuelve a cambiar de pestaña desde el fondo, los gestos verticales conservan el rebote nativo y las barras laterales no se dibujan, también en Ajustes.
> Anterior: **v4.26.23** — «Pregúntame» responde primero en una frase, deja el paso a paso bajo petición y diferencia entre añadir efectivo y apuntar una compra.
> Anterior: **v4.26.17** — el histórico que solo devuelve movimientos ya guardados permite abrirlos en Gastos con el periodo completo y ese banco filtrado.
> Anterior: **v4.26.16** — la pantalla completa de Inversiones entra desde la derecha y vuelve con un gesto desde cualquier zona no interactiva.
> Anterior: **v4.26.15** — «Actualizar inversiones» consulta brókers y precios y conserva los fallos parciales en un único aviso.
> Anterior: **v4.26.14** — el resumen de Inversiones enseña beneficio en euros y porcentaje sin inventarlo cuando falta el coste.
> Anterior: **v4.26.13** — los candados desaparecen de la interfaz sin retirar ninguna protección.
> Anterior: **v4.26.12** — Novedades enumera las funciones que el móvil ya ejecutaba en beta, sin atribuirlas a producción.
> Anterior: **v4.26.11** — Ajustes abre sin salto; Action `35784943994` publicó el bundle beta 4.26.11.1.
> Anterior: **v4.26.10** — tema Cyberpunk y temáticas Otoño y Primavera.
> Anterior: **v4.26.9** — Plan recupera su vista compacta y las fichas de Gastos y Apuntar comparten gestos más suaves.
> Anterior: **v4.26.8** — Plan v4.1 usa importes reales, saldos honestos y recibos accesibles.
> Anterior: **v4.26.7** — cierre funcional, financiero y accesible de Inversiones v4.1.
> Anterior: **v4.26.6** — histórico aislado por banco y deduplicación estable TR/Wallet.
> Anterior: **v4.26.5** — barrido de estados y movimiento reducido del rediseño v4.1.
> Anterior: **v4.26.4** — Inversiones renovadas como pantalla propia, con refresco manual y cifras honestas.
> Anterior: **v4.26.3** — «Pregúntame» aporta ayuda local/offline y prepara un puente remoto privado aún apagado.
> Anterior: **v4.26.2** — «Tus recibos» deja de montar la pantalla antigua y abre listas y fichas ligeras.
> Anterior: **v4.26.1** — ficha completa de cuenta con saldo, histórico real y últimos movimientos, sin publicar por separado.
> Anterior: **v4.26.0** — ficha unificada de gasto y borrado con Deshacer, sin publicar por separado.
> Anterior: **v4.25.6** — la ronda 4.25 está en producción y el panel beta queda vacío al alcanzarla: sin entrada en Ajustes, tandas antiguas ni pruebas repetidas.
> Anterior: **v4.25.5** — la barra oculta ya no sale físicamente por debajo del viewport ni puede robar el segundo tirón en el fondo; el histórico bancario conserva la espera explícita tras 429.
> Anterior: **v4.25.3** — el intento de concurrencia limitada seguía provocando 429 y el host de la ola perdía clases al repintarse.
> Anterior: **v4.25.2** — el primer refuerzo del histórico seguía sin traer importes de Caixa y la ola continuaba revelando la barra al repetir el gesto.
> Anterior: **v4.25.1** — ficha y orden de cuentas nuevas, arranque offline/Dev y filtro de bancos diarios aprobados; rechazados histórico Caixa y ola/barra.
> Anterior: **v4.25.0** — lectura bancaria paginada publicada en beta y `bank-sync` desplegada; rechazada en el móvil al comprobar que una CaixaBank nueva seguía sin ficha ni orden.
> Anterior: **v4.24.5** — la ronda 4.24 a producción, con una sola nota.
> Anterior: **v4.24.4** — Ajustes ya no se abre solo tras probar la beta.
> Anterior: **v4.24.3** — el banco espera a la nube: un móvil con datos viejos ya no repite movimientos.
> Anterior: **v4.24.2** — Inicio y panel beta sin red (skel corto).
> Anterior: **v4.24.1** — la lista de Gastos marca los ingresos que no cuentan (otro banco o traspaso), igual que el balance; ingest deja rastro de cada descarte.
> Anterior: **v4.24.0** — sin internet, Inicio pinta los datos locales (no se queda en esqueletos).
> Anterior: **v4.23.1** — la 4.23.0 a producción (avisos claros y seguros al conectar un banco), con una sola nota; las tres Edge de SEC-01 se despliegan después de la web.
> Anterior: **v4.23.0** — mensajes claros y seguros al conectar un banco (cliente + Edge SEC-01; Edge se despliega aparte tras la web).
> Anterior: **v4.22.3** — la ronda 4.22 a producción (cuotas de meses pasados + «Es la cuota de…»), con UNA nota; el alias se mira antes del corte por categorías neutras.
> Anterior: **v4.22.2** — «Es la cuota de…» a mano desde la ficha, y lo aprende (su rechazo de 4.22.1).
> Anterior: **v4.22.1** — la ventana de cuotas se calcula igual en cualquier zona horaria (lo cazó la CI de beta).
> Anterior: **v4.22.0** — las cuotas de meses pasados también en «Deudas» (histórico, 2ª tanda). Beta renumerada tras el promote.
> Anterior: **v4.21.2** — la ronda 4.21 a producción (cuotas de deudas en Gastos + APK 46), con UNA nota.
> Anterior: **v4.21.1** — la APK 46 (sin copia de Android ni token de ingest) ya en la calle; beta sigue con las cuotas de deudas.
> Anterior: **v4.21.0** — las cuotas de las deudas, en Gastos: categoría «Deudas» y un filtro por deuda (beta; renumerada tras el promote).
> Anterior: **v4.20.4** — la ronda 4.20 a producción, con UNA nota para la familia.
> Anterior: **v4.20.3** — al apuntar, la categoría se sugiere sola (palabras clave + chip IA).
> Anterior: **v4.20.2** — seguridad: el código del Hogar y los topes de app_events (OPS-06).
> Anterior: **v4.20.1** — Gastos ya no se ralentiza de tanto subir y bajar.
> Anterior: **v4.20.0** — nueva ronda de beta (renumerada a petición suya); prod sigue en 4.19.106.
> Anterior: **v4.19.108** — el cartel de «reconecta» se va al volver del banco.
> Anterior: **v4.19.107** — «Actualizar» dice qué ha pasado, en un solo aviso.
> Anterior: **v4.19.106** — la ronda 4.19 sube a producción, con UNA nota para la familia.
> Anterior: **v4.19.105** — panel de pruebas limpio: 5 tandas, sin repetidas.
> Anterior: **v4.19.104** — el filtro de Gastos vuelve a scrollear.
> Anterior: **v4.19.103** — idiomas en/ca fuera del bundle (margen de gzip).
> Anterior: **v4.19.102** — el Saveback de TR ya no sale como ingreso en el histórico.
> Anterior: **v4.19.101** — el saldo al cambiar de rol, el redondeo de TR (tercera y última copia).
> Anterior: **v4.19.99** — un banco ya no se come a otro en el historico.
> Anterior: **v4.19.97** — el saldo al cambiar de rol, la otra mitad.
> Anterior: **v4.19.93** — Guardar sin corte ni brillo (superescrito por 100).
> Anterior: **v4.19.92** — histórico madrugada + notas sin duplicados.
> Anterior: **v4.19.90** — dismissNews + intento de e2e (hack retirado).
> Anterior: **v4.19.89** — e2e tandas vacías con prod.
> Anterior: **v4.19.88** — guardián CSS de la ola.
> Anterior: **v4.19.87** — ola nativa restaurada (CI rojo por season-detalle).
> Anterior: **v4.19.86** — guardianes OTA + panel sin vaciarse.
> Anterior: **v4.19.85** — el OTA baja el bundle desde su propia base.
> Anterior: **v4.19.83** — al quitar un banco, el aviso pendiente también se va.
> Anterior: **v4.19.82** — el aviso de la última cuota se puede quitar.
> Anterior: **v4.19.79** — sincronizar actualiza sin perder orden ni duplicados pendientes.
> Anterior: **v4.19.78** — el pull volvía a refrescar (ámbar: gemelo/id; corregido aquí).
> Anterior: **v4.19.77** — mantén pulsada una cuenta para ordenarla; Editar solo cuando hace falta.
> Anterior: **v4.19.76** — el saldo del efectivo se guarda al cerrar, y subir la lista ya no tira.
> Anterior: **v4.19.75** — las palabras escondidas dentro de otras ya no deciden la categoría.
> Anterior: **v4.19.74** — un gasto de madrugada ya se puede reordenar.
> Anterior: **v4.19.73** — «Dia» y las farmacias abreviadas ya se reconocen.
> Anterior: **v4.19.72** — el mismo día ya no sale dos veces en Gastos.
> Anterior: **v4.19.71** — el estado de la barra se vuelca aunque el gesto se cancele.
> Anterior: **v4.19.70** — «Sabadell» ya no es un parking.
> Anterior: **v4.19.69** — la barra de abajo, sin repintar la app con el dedo puesto.
> Anterior: **v4.19.68** — la factura del agua ya no es un viaje.
> Anterior: **v4.19.67** — cada cuenta tiene su ficha en Cartera.
> Anterior: **v4.19.66** — al quitar un banco su cuenta sale de Cartera.
> Anterior: **v4.19.65** — Gastos enseña TODAS las cuentas, y la cabecera de Cartera en una línea.
> Anterior: **v4.19.64** — el efectivo estrena billete.
> Anterior: **v4.19.63** — el banco a medio conectar avisa, y al quitarlo se va de Cartera.
> Anterior: **v4.19.62** — la barra de abajo vuelve a esconderse al bajar.
> Anterior: **v4.19.61** — TSMC y Micron con logo, y los brókers también.
> Anterior: **v4.19.60** — los logos de inversiones también por ticker.
> Anterior: **v4.19.57** — re-anclar saldo por banco (padre Revolut).
> Anterior: **v4.19.56** — la R de Revolut entera y TR a su tamaño.
> Anterior: **v4.19.54** — monograma de inversiones (regresión de logos).
> Anterior: **v4.19.45** — logos medidos (lockup Enable Banking; rehuidos).
> Anterior: **v4.19.44** — Aa en Inicio y Conectar cuentas.
> Anterior: **v4.19.43** — ronda de la tarde (bugs + copy + banco fantasma).
> Anterior: v4.19.33
> Anterior: v4.19.15 — cada cuenta arrastra sus propios gastos al cerrar el mes.
> Auditoría: [hallazgos y límites](briefs/AUDITORIA-CODEX-2026-09-09.md). Efectivo sigue bloqueado por el cierre mensual; no promover la ronda completa.
> **Cola operativa y encargos del equipo:** [BACKLOG.md](BACKLOG.md). Las tablas históricas de abajo no sustituyen ese inventario ni el canal vivo.
> En Ajustes → Revisar esta beta se pliegan las tandas desde su cabecera, automáticamente tras aprobar.
> Anterior: **4.19.13** — un límite por categoría en Gastos.
> Anterior: **4.19.12** — el resumen del mes cerrado, en Inicio.
> Anterior: **4.19.11** — puertas y avisos del import histórico; quedan los casos de la auditoría posterior.
> Anterior: **4.19.10** — efectivo como una cuenta mas (tanda 6).
> Anterior: **v4.19.9** — import historico: agujero A cerrado, se puede deshacer.
> Anterior: **4.19.8** — import historico: motor y UI seguras (tandas 1 y 2).
> Anterior: **4.19.7** — lo que el dueno ya aprobo no vuelve al panel de beta.
> Anterior: **4.19.6** — el gasto del mes cuadra: el posible repetido tampoco
> cuenta en el servidor, el widget se pone al día al volver y las categorías neutras
> sobreviven al pull (B09-D). OTA; sin APK y sin desplegar Supabase.
> [Evidencia del resume/categorías](briefs/b09d-codex-resume-categorias.md).
> Anterior: **4.19.5** (Novedades guarda 20 versiones). **4.19.4** (arranque suelto). **4.19.3**
> (panel beta). **4.19.2** (ventana mes). **4.19.1**.
> Canal vivo: `npm run salud` (no afirmar beta/prod solo por el working tree). OTA, sin APK.
> Anterior: **4.18.7** (cabecera de Gastos al cambiar bancos de gasto diario).
> Producción: **4.18.7**, promocionada el 2026-09-07 (antes llevaba desde el 18/8 en 4.18.3).
> Este número envejece: confírmalo con `npm run salud` antes de decírselo a nadie.
>
> Anterior: 2026-09-06 · **v4.18.6** — contención de integridad en el árbol (sin DELETE/lápida por
> similitud). Canal vivo: `npm run salud` (no afirmar beta/prod solo por el working tree). OTA, sin
> APK. Anterior: **4.18.5** (destello tabs). Producción conocida vía Pages: comprobar con `salud`.
>
> Anterior: 2026-08-18 · **v4.18.5** — El fondo ya no parpadea al cambiar de pestaña:
> el «refuerzo opaco» del gesto tapaba el degradado del `body` (−16 niveles medidos a 120 fps en su
> OnePlus 13, 12 gestos de 12, y también sin temporada). Y los gestos funcionan al estrenar la app.
> OTA, sin APK. Anterior: **4.18.4** (cada banco descuenta lo suyo, 257 € medidos). Producción sigue
> en **4.18.3** · APK **42**.
>
> Anterior: 2026-08-18 · **v4.18.3** — **EN PRODUCCIÓN**. El saldo OB ya no pinta un negativo inventado
> (Revolut −204 del padre). El widget manda `afford` y `budgetLeft` (APK 41 y 42). APK **42**.
>
> Anterior: 2026-08-17 · **v4.18.2** — ingest del widget a producción. El canal beta no prueba el widget con la app cerrada (un solo Supabase). APK seguía **41 / 4.17.1**.
>
> Anterior: 2026-08-17 · **v4.18.1** — **EN PRODUCCIÓN**. Tandas 3 y 4: Gastos enseña todos los bancos de gasto diario, calendario al apuntar, Recibos, sugerir categoría en cualquier gasto, banco del `+` en pastilla. El widget de 4.17.2 **no entra** (sigue solo en `beta`).
>
> Anterior: 2026-08-17 · **v4.18.0** — **EN `beta`**. Tandas 3 y 4: Gastos enseña todos los bancos
> marcados como gasto diario (no solo el principal), fecha al apuntar/editar con calendario de la
> casa, y categorías nuevas (heladería, joyería, videojuegos). Producción sigue en **4.17.1**.
> El widget de 4.17.2 **no entra** en esta tanda (sigue parado hasta que él compre y re-pruebe).
>
> Anterior: 2026-08-17 · **v4.17.2** — **EN `beta`**. El widget de la 4.16.2 ya no se contradecía
> por dentro, pero seguía sumando de más (907 vs 709): ingest no respetaba lápidas ni juntaba las
> dos notis del mismo cargo (Wallet + TR). Arreglo en el servidor, **sin APK nueva**.
>
> ⚠ El fallo del **bloqueo de pantalla al guardar** que encontró NO era de la tanda: venía de la
> v3.108.0 y saltaba con cualquier edición de importe o nombre. El sheet de detalle tenía dos
> nociones de «abierto» que discrepaban y dejaba el candado de `touchmove` puesto.
>
> Anterior: 2026-08-17 · **v4.17.1** — **EN PRODUCCIÓN**. Tanda `gastos-orden` (qué cuenta / qué no,
> «Movimiento» sin duplicar al sync). APK **41**. El widget no entra.
>
> Anterior: 2026-08-06 · **v4.16.1** — APK limpia **39 / 4.16.1**: sin franja nativa bajo la cámara.
> La 4.16.0 trae presupuesto que cuadra, divisa en la nube (migración 0020) y notis de Google Wallet.
>
> Anterior: 2026-08-05 · **v4.15.0** — **EN PRODUCCIÓN**. Ambientación suave, conversor FX,
> presupuesto alineado en Resumen/Gastos/widget y extracto de todos los bancos. Aprobada en el
> móvil (4.15.0.19, APK 35) con 12 tandas a cero fallos.
>
> Anterior: 2026-08-05 · **v4.14.1** — **EN PRODUCCIÓN**. OTA del pulido de Gastos (importes largos
> ¥/₺ + letra pequeña) que había entrado tras el sello 4.14.0. Multidivisa de la 4.14.0 sigue.
> APK **35 / 4.12.0** (sin nativo; llega por OTA).
>
> Anterior: 2026-08-05 · **v4.14.0** — **EN PRODUCCIÓN**. Multidivisa real (lira + moneda de
> visualización que convierte + Apuntar en divisa aparte + comparar monedas) y Ajustes → Dinero
> limpio. APK **35 / 4.12.0**.
>
> Anterior: 2026-08-05 · **v4.13.0** — **EN PRODUCCIÓN**. Ronda beta cerrada: gestos (ola nativa
> arriba/abajo, barra quieta, rayita) y plan-swipe aprobados 5/8 en `4.13.0.49`. Arranque ya había
> subido como 4.12.3; import de hojas como 4.12.4; bancos/temporada/reservar/docx en la misma
> 4.13.0. APK sigue en **35 / 4.12.0** (sin cambios nativos; llega por OTA).
>
> Anterior: 2026-08-01 · **v4.13.0** — en **beta**: **el arranque YA está en producción como 4.12.3**
> (2026-08-01, primera vez que se sube por feature y no por tanda entera: el nombre ya no cambia
> de forma a media carga —`font-display:swap`, la causa real de «algo raro antes del icono»—, el
> patrimonio vuelve a contar hasta la cifra visible, el logo se va antes que el fondo, y las
> temporadas caen UNA vez y paran). Sigue en `beta`, pendiente de su turno cada una por separado:
> **importar una hoja de gastos** (Excel o CSV, duplicados descartados solos), **gestos** —rebote
> rechazado dos veces, «no es el efecto ola»— y **bancos** —TR por Open Banking rechazado, «da
> error»; el sync del banco de gasto diario, arreglado, pendiente de su prueba.
>
> Anterior: 2026-07-28 · **v4.13.0 (primera versión)** — la ronda completa tal como se commiteó
> (mezclada, sin ramas `tanda/<id>`; por eso el arranque se tuvo que separar A MANO en vez de con
> `cherry-pick`). Producción iba por **4.12.1** (APK 35).
>
> Anterior: 2026-07-27 · **v4.12.1** — **APROBADA y en producción** (promocionada el 28/7). Ajustes solo desde Resumen, sin stopper al abrir Ajustes/perfil, y Gastos baja sin parones. Los dos puntos que quedaban del expediente del tirón los cerró él desde el móvil: «lo del tirón al deslizar arregladísimo» y «lo del perfil también va ultra fluido, sin stoppers».
>
> Anterior: 2026-07-27 · **v4.12.0** — **APROBADA en el móvil y en producción** («funciona» + «todas las pestañas van increíblemente fluidísimas»). Causa del tirón: la `transition` CSS del carrusel juddeaba a 120 Hz al soltar; asentamiento por `requestAnimationFrame` → 0 saltos. APK **35** (icono/splash nativos; OTA no los lleva — si aún no está instalada, ofrecerla). Ver `docs/LAG-DESLIZAR.md`.
>
> Anterior: 2026-07-26 · **v4.11.0** — **APROBADA en el móvil y promocionada a producción** («aprobado, todo funciona a las mil maravillas» — cuarta beta, 4.11.0.10, con la APK 34 puesta). Primera versión que recorre el circuito entero como estaba pensado: se publica en `beta`, la prueba él en su móvil, la rechaza dos veces con el panel de revisión, y sube cuando la aprueba. **el splash existía en el HTML y no lo veía nadie**: estaba dentro de `#root` y `ReactDOM.createRoot()` vacía su contenedor al montar, así que React se lo llevaba por delante (medido: fuera del DOM a los 150 ms); y React/ReactDOM/supabase iban en el `<head>`, bloqueando el parser, así que el navegador no tenía nada que pintar hasta ejecutar ~600 KB — el negro del vídeo. Ahora es hermano de `#root`, los scripts van después, con mínimo de 520 ms en pantalla y dos rAF antes de montar. **Corrección a la 4.10.0:** el patrimonio no venía mal, es una animación que cuenta hasta la cifra final. **Bienes separado de «Tus cuentas»** como bloque ordenable propio. **Perfil: cerrar = abrir al revés** — una sola curva y un solo umbral para los dos sentidos (iban con números distintos y el de abrir pedía casi el triple de arrastre), y candado durante la animación para que un dedo puesto a medias no la corte en seco. E2E 62 → 72. **Tercera vuelta (2026-07-26): el fallo del perfil era OTRO y por fin se ha reproducido** — con el panel scrolleado (`scrollTop=220`, lo normal) el arrastre solo scrollea y no cierra; ninguna prueba lo veía porque todas empezaban con el perfil arriba del todo. Además `e.preventDefault()` **nunca funcionó**: React ata `onTouchMove` en modo pasivo, así que el navegador se quedaba el gesto (los listeners van ya a mano con `{passive:false}`, y `touchcancel` cuenta como final). Ahora la franja de arriba es asa y, tirando desde el medio, el cierre toma el relevo cuando el scroll llega al tope. **⚠ Pendiente APK 34**: el arreglo de las notis duplicadas es Java (`Notif.idFor`, ids estables — el id salía del reloj y cada aviso se apilaba en vez de sustituir). **Lleva mezclada la 4.10.2**: sin ella este bundle no se puede ni descargar. **Segunda vuelta (2026-07-26): la rechazó desde el móvil, 3 ok / 2 fallos, los dos del perfil** — unificar los umbrales dobló el de cerrar (52 → 94 px) y el candado de la animación se activaba también en el rebote y en un toque suelto, dejando la app sorda medio segundo al segundo intento. Curva compartida sí, umbral no (`PROF_TH_OPEN`/`PROF_TH_CLOSE`). Y dos del canal, que estrenaba móvil: el bundle se sellaba con un número distinto del que anunciaba el manifiesto (**la misma beta ofrecida en bucle**, ahora `MC_STAMP_VERSION` + el workflow no publica si no cuadran) y **apagar la beta no devolvía a producción** (`_mcApplyChannelBundle`: cambiar de canal instala en la dirección que sea).
>
> Anterior: 2026-07-25 · **v4.10.2** — publicación MÍNIMA, capítulo 2: **la CSP era solo la mitad**. Los assets de las releases de GitHub **no mandan cabeceras CORS** en ninguno de los dos saltos del redirect (verificado con `curl -H Origin`), así que el `fetch` de la WebView (origen `https://localhost`) los tira igual con la CSP arreglada — mismo síntoma, causa distinta. Ahora el manifiesto lo pide **Android** (`CapacitorHttp`), como el login de MyInvestor. Y `mcFetchManifest` solo cae a estable con un **404**: cualquier otro fallo sale en el toast y en `app_events`, porque disfrazarlo de «no hay nada nuevo» es lo que escondió esto durante semanas. El `bundle.zip` de la beta **nunca se había descargado** (`downloadCount: 0`). Guardián: `tests/updates.test.mjs` ejecuta el trozo real del monolito con `fetch`/`CapacitorHttp` de mentira.
>
> Anterior: 2026-07-25 · **v4.10.1** — publicación MÍNIMA: **el canal beta llevaba roto en silencio**. Los assets de las releases de GitHub redirigen a `release-assets.githubusercontent.com` (antes `objects.githubusercontent.com`) y ese dominio no estaba en `connect-src`, así que el `fetch` moría; la caída a estable de `mcFetchManifest` convertía el fallo en un «✓ estás a la última» con el canal activado y la beta publicada. No podía arreglarse POR beta, porque es lo que impide bajarla. **El resto del trabajo del día (splash que no se veía, bienes separados de cuentas, perfil con una sola curva para abrir y cerrar) está en la rama `beta` = release `beta`, esperando la prueba del dueño.**
>
> Anterior: 2026-07-25 · **v4.10.0** — **el gesto del perfil, ahora con el caso real**: el panel SCROLLEA (su contenido mide ~1.680 px y no cabe en un móvil), y el arrastre medía desde el `touchstart`, así que al llegar arriba saltaba de golpe a la miniatura (medido: 1,000 → 0,122 en un frame) y con el rebote del scroll volvía a pantalla completa — ese ida y vuelta era el parpadeo del vídeo. Además **abrir** se había quedado sin los dos arreglos que sí recibió el cierre (opacidad y radio por frame), porque los dos gestos estaban duplicados; ahora comparten `profileGrab()`. **El CSV de Revolut ya no rechaza el extracto de la cuenta en €** —justo el que hace falta para el coste del oro—: lo confirma, guarda los euros y dice qué falta; los ficheros se pueden soltar de uno en uno. **Splash de entrada** con la marca de la app que espera al primer dato bueno (se acabó ver el patrimonio viejo un segundo). **Cartera ordenable** y **Hogar mudado al perfil**. **Seguridad del servidor**: CORS con lista blanca en las diez funciones, límite de peticiones en `ingest` y `myinvestor-connect`, y el `state` del OAuth caduca a los 30 min y solo vale una vez. **Presupuesto de rendimiento** en `npm test` (987 KB / 278 KB gzip / 3 bloqueantes). E2E 53 → 62.
>
> Anterior: 2026-07-25 · **v4.9.2** — **incidente del APK 32, corregido**: se empaquetó copiando `public/`→`www/` a mano en vez de con `build-www.mjs`, así que salió con `APP_VERSION: "dev"` — y como `_mcNewerVer` hace `parseInt("dev")`→`NaN`, la comparación de versiones daba `false` siempre y **ese móvil no volvía a actualizarse nunca**, sin error visible. Además, reescribir un módulo con `Get-Content|Set-Content` de PowerShell lo leyó como Windows-1252 y corrompió 95 líneas (el «✓» de TR salía como tres símbolos sin sentido). **APK 33 / 4.9.2 la sustituye.** Guardianes: `build-www.mjs` aborta si no sella, `npm run apk:prep` encadena el proceso entero, y `docs-frescura` caza el mojibake.
>
> Anterior: 2026-07-25 · **v4.9.1** — **los brókers los elige el usuario** (chips «¿Qué brókers usas?»; antes se pintaba el login de TR/MyInvestor/Revolut aunque no tuvieras cuenta) y **sus tarjetas se pliegan** con el mismo acordeón que los bancos (`bkBrand()` compartido). **Cierre del perfil sin superponer dos pantallas**: se quitó el fundido de opacidad del arrastre —el panel ocupa la pantalla entera, así que fundirlo dejaba ver perfil y resumen a la vez— y ahora escala hacia el avatar, opaco, como la apertura en reversa. **`docs-frescura` vigila que no quede código publicable sin subir `VERSION`**, que fue el fallo del día: todo desplegado en Pages con la versión intacta y el móvil sin enterarse. **APK 32 / 4.9.0 publicada** (fix de sesión de TR + token de ingest en cabecera). E2E 49 → 53.
>
> Anterior: 2026-07-25 · **v4.9.0** — **Trade Republic en frío CERRADO de verdad** (capítulo 3, verificado por el usuario matando la app): la causa era `snapshotCookies` quedándose con la copia CADUCADA de `tr_refresh` —sale dos veces en la cabecera, con dos paths— y re-guardándola en cada vuelta, así que una vez estropeada no se recuperaba nunca (`put` → `putIfAbsent`); además la WebView se aparca en `about:blank` al pasar a segundo plano para que la SPA de TR no rote la sesión a nuestras espaldas, y los errores llevan pegado el estado del jar para diagnosticar sin cable. **Coste del oro de Revolut automático** cruzando el extracto de metales con el de la cuenta en € por marca de tiempo (verificado: 0,258218 oz / 1.000 € / 3.872,70 €/oz). **«Mis bancos» en acordeón**. **Gesto de cerrar el perfil** sin repintar la pantalla entera por frame. **Seguridad**: token de ingest en cabecera; `app_events` recupera los grants de `service_role` (la telemetría del ingest llevaba dos semanas muerta en silencio). **`scripts/errores.mjs`** para leer los errores del móvil desde la consola. **MyInvestor**: diagnóstico cerrado, el reCAPTCHA rechaza el token por dominio → hace falta WebView nativa. E2E 46 → 49.
>
> Anterior: 2026-07-24 · **v4.8.0** — **rendimiento**: el estado se guarda PARTIDO (los gastos en su propia clave, solo se reescriben cuando cambian) → volver a primer plano pasa de escribir 477 KB (2.000 gastos) / 1.912 KB (8.000) a **1 KB constante**, que es la causa real del «cuanto más la uso, más lenta va»; `totals` con dependencias reales, `parseDate` cacheado, filtrado de Gastos en una pasada y filas en `React.memo`. **Concepto de los movimientos** (mensaje del bizum / descripción del banco, editable y con relleno retroactivo al sincronizar). **Bancos caídos**: noti + deep-link al panel con el banco resaltado. **Entorno de pruebas** del dueño: banco de pruebas aislado + canal beta por release `beta`. **Seguridad**: CSP, token de ingest de 256 bits, comparación en tiempo constante. E2E de 10 → 34.
>
> Anterior: 2026-07-22 · **v4.7.0** — notis sin duplicados (gasto tocho y recibo de la víspera, éste además con importe exacto), roles de cuenta excluyentes y en el subtítulo del banco, brókers con animación + orden configurable, deudas con «Quedan n/tot cuotas» y «acabas en» uniformes, badge de reCAPTCHA oculto con errores diagnosticables. El fix del gasto tocho es Java → **APK 31 publicado**. **v4.6.4:** MyInvestor: intento OTA de resolver el reCAPTCHA en la WebView (pegando el site key). **v4.6.3:** «Gasto diario» multi-banco en el chip de siempre (quitado el duplicado). **v4.6.2:** barra inferior pegada abajo con letra pequeña/enorme, widget re-empuja al volver a la app. (4.6.1:) letra pequeña, Hogar movido a Cartera, animaciones de temporada con profundidad/parallax estilo Revolut. (Base:) **v4.6.0** — temáticas de temporada, accesibilidad (letra grande a nivel body sin descuadres, reducir animaciones, contraste), metas con teclado propio + banco, más monedas + comparativa, varios bancos de gasto diario, selección de Cartera persistida, Ajustes reordenados y encogidos al abrir, widget con «lo que te puedes permitir» (APK 30).

## Listo para uso diario

Multi-cuenta, ingest TR, OTA/APK, gamificación, onboarding, inversiones, deudas, Open Banking, MyInvestor, RGPD mínimo, tests unit + E2E, código modular, **Hogar Fase 1+2** (+ fix RLS `0014`), informe mensual, fin de mes en paz, presupuesto por categoría, recibos gordos, widget Android, export JSON + informe imagen, **multi-banco en Gastos** + filtro por banco, tutorial/roles claros, **FX multi-divisa (USD/GBP/CHF + costEur)**, **sugerencia de categoría (KW + IA opcional)**, **diccionario ampliado de comercios** (impuestos/multas, **Pádel**), **Sentry en prod**, perfil pull-down, sheets sin velo negro, brókers en tarjetas planas, **APK nueva se ofrece sola** (noti + instalador al abrir), **OB a demanda** (botón en Cartera), **gráfico de Cartera multiseleccionable**, **editor de cuentas v4** (nombre+rol, saldo bloqueado si viene del banco), **bienes editables**, **monedas £/CHF**, **huella + logout en Ajustes**, **Hogar accesible desde el perfil** (4.10.0; antes en Cartera), **bloques de Cartera ordenables**, **«¿Me lo puedo permitir?» a plazos** (cuota + crear deuda), **banco elegible en gastos manuales**, **Sincronizar de Cartera con TR/MI**, **temáticas de temporada** (Mundial/Halloween/Navidad/Verano/Invierno/Pascua/Otoño/Primavera con animación ambiental), **tema Cyberpunk** (4.26.10), **accesibilidad** (letra grande a nivel body sin descuadres, reducir animaciones, contraste), **aportar a metas con teclado propio + banco**, **15 monedas + comparativa**, **varios bancos de gasto diario**, **selección de Cartera persistida**, **Ajustes reordenados/encogidos**, **widget con «lo que te puedes permitir»**.

## Versión actual (alineación)

| Qué | Valor |
|-----|--------|
| Web / OTA (`VERSION`) | **4.26.148**, candidata de beta sobre la 4.26.147 con APK nueva (4.26.148/code59): un cargo con la marca de un recibo se confirma con «Sí, es este recibo» y un recibo que solo había vencido se puede enlazar a mano (INC-1810-04, PR 281 y siguiente), y la vibración nueva con ajustador en Ajustes solo en beta (UX-16, cambio nativo). Sin SQL. Dos tandas nuevas (`youtube-enlazar-recibo`, `vibracion-ajustador`); las de la 145 (`plan-por-confirmar-prestamo-youtube`, `vibracion-suave-ronda-3`, rechazadas) pasan a vacías. Anterior: **4.26.147**, candidata de beta sobre la 4.26.146, solo web y sin APK nueva (sigue la 4.26.145/code58): al bajar la cuota de una deuda y no cuadrar con el plazo, la edición ofrece alargar el plazo con un toque (PR 282, INC-1910-01) y los bloques de brókers se reordenan manteniendo pulsado (PR 283, INC-2709-08). Sin SQL. Dos tandas nuevas (`deuda-bajar-cuota-alarga-plazo` y `cartera-ordenar-brokers`) además de las de la 145 y la 146. Anterior: **4.26.146**, candidata de beta sobre la 4.26.145, solo web y sin APK nueva (sigue la 4.26.145/code58): la vuelta a primer plano y el arranque no se quedan parados con mucho historial (la app no rehace el historial entero si la nube no ha cambiado). Sin SQL. Una tanda nueva (`vuelta-sin-tiron`) además de las de la 145. Anterior: **4.26.145**, candidata de beta de la vibración suave ronda 3 (APK 58), el saldo del banco por fases (H2) y el hotfix 4.26.142 de la reserva borrada encima de la beta 4.26.144. Anterior: **4.26.144**, candidata de beta de la vibración suave (APK 57), el aviso entero al guardar una deuda, el recibo renombrado y CaixaBank con identidad histórica encima de la beta 4.26.143. Anterior: **4.26.143**, candidata de beta del aviso de plazo en Deudas, el saldo de cuenta con atrás, Mi ciclo «<1 %», el banco de pruebas sin aviso falso y las devoluciones con signo encima de la beta 4.26.141. Anterior: **4.26.141**, candidata de beta de las fichas que cierran suave con atrás, la vibración (APK 56), Metas a tres vías, FIN-10 y SEC-03 encima de la beta 4.26.140. Anterior: **4.26.140**, candidata de beta de la hoja de Deudas y Metas que cierra suave, el atrás con teclado, la nómina manual y la protección de conexiones encima de la beta 4.26.139. Anterior: **4.26.139**, candidata de beta de Deudas más claras (cuota que encaja, hoja de editar suave y atrás que la cierra), FIN-12 y SES-01 encima de la beta 4.26.138. Anterior: **4.26.138**, candidata de beta de Deudas y Metas editables, «Actualizar gastos», botones de suscripciones en móvil y FIN-15 (compra pendiente que reaparece otro día) encima de la producción 4.26.137; requiere `ingest` antes que el cliente. Anterior: **4.26.137**, producción con la beta 137 aprobada (MyInvestor: posiciones conservadas en carreras y fallos del sello; reconectar solo tras intento manual) encima de la producción 4.26.136; `myinvestor-sync` se despliega solo cuando el cliente esté servido. Anterior: **4.26.136**, producción con la beta 135 aprobada más `ob-absorbed` en `GASTO_ORIGENES` (compras idénticas sin duplicar ni perderse; `ingest` ya desplegado). Corte de beta que la precede: candidata de beta de las compras idénticas sin duplicar ni perderse (requiere `ingest` antes que el cliente). Anterior: **4.26.134**, promoción a producción de la beta 134 (gráfica de Inicio con traspasos y efectivo). Corte de beta que la precede: candidata de beta de la gráfica de Inicio con traspasos y efectivo encima de la producción 4.26.133. Anterior: **4.26.133**, promoción a producción de la beta 133 (borde de scroll con la barra escondida). Anterior: **4.26.132**, promoción completa a producción de la ronda de beta 129 a 132. Corte de beta que la precede: candidata de beta de los últimos movimientos sin repetidos de Trade Republic encima de la 4.26.131, candidata de beta de la parte mía de cada cuenta encima de la 4.26.130, candidata de beta del emparejado automático de Trade Republic encima de la 4.26.129, candidata de beta de limpieza de Ajustes y perfil encima de la 4.26.128, candidata de beta de Inicio (comparación con el mismo día del mes pasado) encima de la 4.26.127, candidata de beta de bancos sobre la producción 4.26.126, que fue la promoción completa a producción de la ronda de beta 118 a 126. Corte de beta que la precede: la tarjeta del mes de Inicio más limpia (importe y ritmo diario, sin línea de estado ni «Te quedan») encima de la beta 4.26.125, que lleva la gráfica del patrimonio de Inicio corregida (serie desde el primer movimiento, comparación con el mes pasado por mínimos de 45 días, periodo 3M y hoja «Cómo se calcula») encima de la beta 4.26.124 (el scroll lento de Plan sin saltos), que va encima de la beta 4.26.123, con la gráfica de Inicio para carteras heredadas (deudas sin fecha explícita y cuentas manuales ya no recortan) encima de la 4.26.122 (cargo de recibo en Gastos) y de las integraciones 4.26.121 (Inicio v4.2, patrimonio por flujos) y 4.26.120 (apuntes iguales por ordinal de Trade Republic), sobre la beta 4.26.119. Ni la 124 ni la 125 tocan `ingest` ni ninguna otra función; la 125 está publicada en beta y su tanda aprobada en el móvil (4.26.125.1); la publicación en beta de la 126 y su aceptación móvil están pendientes. |
| APK (`versionName` / `versionCode`) | **4.26.117 / 55** publicada (widget con la app cerrada y lectura correcta del ciclo). `build.gradle` y `apk.json` están en **4.26.145 / 58** (vibración suave, ronda 3): APK de beta en el release `beta` (por subir), la estable sigue en la 55. |
| Anterior | **4.16.1 / 39** (sin franja bajo la cámara), **4.16.0 / 36–38** (Wallet). Antes: **4.12.0 / 35**. |
| `public/apk.json` | Asset de beta de **4.26.144 / 57** (`Aely-4.26.144-beta-57.apk`), con hash binario y las revisiones nativas de la 56 y de la tanda nueva. |

## Pendiente / limitaciones conocidas

| Tema | Notas |
|------|--------|
| **MyInvestor reCAPTCHA** | **4.6.4:** intento OTA — la app carga el reCAPTCHA de Google bajo demanda con el **site key de MyInvestor** (que el usuario pega en la tarjeta MI; su web va tras Incapsula y no se puede extraer desde el CI), ejecuta la acción, y reintenta el login con `X-Recaptcha-Token`. **Riesgo:** reCAPTCHA v3 suele atar el token al dominio registrado (`myinvestor.es`); si MI valida el origen, rechazará el token de nuestra WebView → entonces el único camino es una **WebView nativa** que cargue la web de MI (APK). El intento OTA se prueba en 1 min: si el token cuela, resuelto sin tocar nativo. Palancas previas: `x-myinvestor-app`=3.150.0, mensaje humano, `captchaToken` en cabeceras (plumbing listo). |
| **Open Banking: sync solo a demanda** | Desde 4.1.0 NO hay auto-sync al abrir/volver. En 4.25.4 también se retira el bootstrap sin toque y la sincronización por notificación queda apagada por defecto; si se activa expresamente, se limita a una cada 12 h. Un 429 abre una espera local de 6 h sin reconexión. Solo un 401 firme pide renovar el permiso. |
| **Widget «Puedes gastar»** | 4.18.2: ingest cuenta como la app (`filasComoLaApp`). Prueba: pago con la app cerrada. Si el widget no se re-pinta en MIUI, quitar y re-añadir. |
| **Limpieza del repo (tanda 16)** | Basura, docs rancio, código muerto. **No visual, no es rendimiento, no es Clean Code de libro.** El monolito es a propósito (`docs/adr/0002-monolito.md`). Alcance en `docs/briefs/plan-vuelta-crucero.md` §16. |
| **Play Store** | **Lo último.** Data safety + NotificationListener. No adelantar: si se implementa, se tienta de publicar antes de que esté pulida a su criterio. Cualquier tanda nueva va **antes**. |
| **Rediseño v4.1 (tanda 17)** | En curso en `codex/diseno-v41-fichas`, siguiendo `handoff/SPEC-v4.1-fichas.md` por secciones y commits. §1 ficha unificada y §1.5 deshacer al borrar implementados y cubiertos; §3 ficha de cuenta es el siguiente bloque. No se publica hasta cerrar la tanda y aprobarla en beta. |
| **OPENAI_API_KEY** | Opcional en Supabase Secrets → Edge `categorize`. Ver [CATEGORIZE.md](CATEGORIZE.md) |
| **IA en gastos antiguos** | 4.19.1 ya escribe categoría (y banco/nota/borrado) por uuid cuando el gasto lo tiene; ids cortos del móvil siguen por atributos. Recategorizar histórico a IA sigue siendo manual y seguro fila a fila. |
| **Salto a TR/Open Banking al sincronizar automáticamente** | Reportado el 2026-09-07, pero no reproducido ni respaldado por el flujo inspeccionado. No se cambia la navegación a ciegas; recoger pantalla y punto de entrada exacto si vuelve a ocurrir. |

## Lo que apuntó él el 2026-07-26 — HECHO en la 4.12.0

| Tema | Cómo quedó |
|------|------------|
| **`RELEASE_NOTES` en cristiano** | ✅ Hecho. Regla y tabla de ejemplos en `AGENTS.md` §4; las de la 4.11.0, que eran el contraejemplo, están reescritas; y de paso las notas van ya en **es/en/ca**. |
| **Tirón al deslizar / Deudas** | ✅ Hecho en tres capas: premount + `heavyOk` adelantado + **scroll→swipe** (`freezeShell` en tab + `onPageScroll` ignora durante el gesto). Guardián con el caso real a CPU ×6. |
| **Banco caído: ni redirige ni se ve rojo** | ✅ Noti → solo Cartera con banner; Mis bancos usa `bankIssues` para pintar coral; `bankConnectOnce` evita doble OAuth / `invalid_request`. |
| **Trade Republic mudo al desconectarse** | ✅ Banner + noti + resumen en Ajustes; CTA abre Mis bancos con TR, no OAuth. |
| **Stopper del perfil (560 ms)** | ✅ Candado afinado: síncrono al cerrar, cierre permitido tras abrir, generación en `transitionend`. |
| **Versión APK invisible en Ajustes** | ✅ Pie y fila de actualizaciones: `web vX · app Y` (puente ya en APK 35). |
| **Herencia de veredictos en el panel de beta** | ✅ Se conservan marcas compatibles entre compilaciones; aprobar pliega la tanda y se puede cambiar de opinión. Los rechazos anteriores requieren revalidación: consultar `npm run listo`. |

## Lo siguiente

Primero FIN-01 (efectivo al cerrar mes) y FIN-02 (pagos mensuales del histórico), después
identidad cloud, widget y validaciones pendientes. Reparto, pruebas y dependencias en
[BACKLOG.md](BACKLOG.md). `npm run salud` y `npm run listo` dan la versión y los veredictos
actuales. No promover la ronda entera con esos bloqueos abiertos.

### Pendiente de respuesta suya

| Qué | Por qué hace falta preguntarlo |
|-----|-------------------------------|
| **Lo raro del arranque** | Pidió quitar «algo raro que aparece antes del icono». Se ha arreglado lo que **sí** se puede arreglar por OTA y estaba mal: el nombre del splash cambiaba de forma a media carga (fallback de Georgia → Fraunces). Si lo que él ve es ANTES de eso —con la app cerrada del todo— entonces es el **splash NATIVO**, que no viaja por OTA: `styles.xml` usa `Theme.SplashScreen` con solo `android:background`, sin `windowSplashScreenBackground` ni `windowSplashScreenAnimatedIcon`, así que Android 12+ mete su propia pantalla antes. Arreglarlo es nativo → **APK nueva**. No se ha tocado sin confirmarlo. |

### Abierto, con lo medido

| Tema | Qué se sabe |
|------|-------------|
| **«Gastos se queda a medio pintar / desvaído»** | **No reproducido.** Se montó su camino del vídeo (arrancar, esperar, deslizar a Gastos con el dedo, CPU x12, 1.200 gastos) y se midieron filas y opacidad a los 120 ms, 500 ms y 2 s de soltar: 12 filas, opacidad 1, ninguna a medias ni desvaída. No se toca a ciegas. Sospechas sin descartar: el `content-visibility:auto` de `.page` cuando entra una pestaña que aún no es `page-live`, y la paginación de la lista (12 filas + centinela) leída como «lista a medias». Lo que desbloquea el diagnóstico ya está puesto: el veredicto dice la compilación y la APK. |
| **Abrir el perfil: los ~175 ms que quedan** | Suyo, 27/7: «ha mejorado una barbaridad, le queda nada para ir a la velocidad que quiero». Ya no es JS (el perfil de CPU deja la app por debajo del 1 %): es pintado del navegador al hacer visible una pantalla de ~1.680 px. **No hay palanca CSS**: velo, sombra, animación del avatar, radio y `content-visibility:auto` en sus tarjetas están medidos y descartados uno por uno (números en el `CHANGELOG`; el último parecía ganar con 5 pasadas y salió peor con 9 intercaladas). El siguiente tramo pide **rediseñar qué se enseña al abrir** — enseñar menos panel, no pintarlo más rápido. |

## Review externa (ChatGPT, 2026-07-25) — qué falta de verdad

El usuario pidió una review del repo a ChatGPT y trajo el veredicto (arquitectura 9, organización
8,5, seguridad 8,5, rendimiento 8, CI/CD 9,5, tests 9). **La mitad de lo que propone ya está hecho**
y darlo por pendiente sería trabajar dos veces, así que la tabla separa las dos cosas. Lo que ya
existe se deja anotado con su prueba: si mañana alguien vuelve a proponerlo, aquí está la respuesta.

| Propuesta | Estado real | Qué falta (tarea) |
|-----------|-------------|-------------------|
| Beta cerrada con 10-20 amigos | **A medias.** Hay canal beta + panel de revisión (`docs/TESTING.md`), pero es de **un solo móvil**: el suyo. | Que la beta la puedan recibir otros: APK firmado repartible, alta de probador sin ser `is_admin`, y que los veredictos de varios convivan en el panel. |
| Feedback dentro de la app | **Ya está.** Ajustes → App → «Enviar sugerencia» (4.1.0) + `betaReport` del panel de beta. | — |
| Crash reporting | **Ya está.** Sentry en producción ([SENTRY.md](SENTRY.md)) + `app_events` propio, con `window.onerror` y `unhandledrejection` enganchados. | — |
| Analytics de uso | **HECHO (4.13.0).** `cloud.logUso(etiqueta)` con **vocabulario cerrado** (`USO_OK` en 00-core): pestañas y acciones, agregado y sin un solo dato personal. Instrumentadas las cuatro pestañas y el importador. | Una vista SQL que agregue `kind='use'` por etiqueta y semana. El dato ya se está guardando, que era lo que no se recuperaba hacia atrás. |
| Rate limiting | **A medias.** Migración `0019` + `_shared/ratelimit.ts`, aplicado en `ingest` y `myinvestor-connect` (4.10.0). Documentado como hueco #7 en [AMENAZAS.md](AMENAZAS.md). | Extenderlo al resto de funciones (`prices`, `categorize`, `bank-*`) o dejar por escrito por qué no hace falta. |
| Validar TODO lo que entra | **Sin auditoría sistemática completada.** Hueco #8 de [AMENAZAS.md](AMENAZAS.md). | SEC-01: inventariar todas las Edge Functions actuales; tipos, tamaños y rangos, con pruebas de errores 4xx sin efectos. El antiguo recuento de diez ya no sirve. |
| Logs sin información sensible | **A medias.** `guard-privacy` vigila el cliente; las métricas nuevas nacen cerradas (`USO_OK`). Hueco #9 de [AMENAZAS.md](AMENAZAS.md). | Auditar qué acaba en `app_events` y en Sentry (mensajes de error con importes, correos o IBAN) y limpiarlo en origen. |
| Virtualización de listas | **Ya está.** La lista pagina — `e2e/rendimiento.spec.mjs`: 3.000 movimientos no son 3.000 nodos. | — |
| Memoización / no repetir trabajo | **Ya está** (4.8.0): estado partido, `totals` con dependencias reales, `parseDate` cacheado, filas en `React.memo`, presupuesto de rendimiento en `npm test`. | — |
| Lógica financiera independiente de React | **A medias.** La lógica pura se extrae y se testea sin React (`scripts/load-pure-logic.mjs`, 15 suites), pero convive en el mismo fichero que la UI. | Separar de verdad los servicios (cartera, movimientos, dividendos, precios) a módulos sin un solo `React.createElement`, y que la UI solo los llame. Sin prisa: es refactor, no arreglo. |
| Módulos por dominio, no por número | **No.** `src/modules/` va numerado por orden de ensamblado (`00-core`, `06-sync-brokers`, `10-app-components`…). | Reagrupar por dominio cuando duela — hoy 15 ficheros se siguen; el riesgo real es `10`/`11`, que son los que crecen sin parar. |
| Importadores PDF/CSV | **CSV, XLSX, DOCX y PDF de texto soportado ya existen.** Pruebas `import-docx-pdf` unitarias y E2E. Los PDF escaneados no tienen OCR. | No reconstruir el lector. La integridad del histórico sigue en FIN-02/03/07 de [BACKLOG.md](BACKLOG.md). |
| Sistema de backups | **Copia diaria y visor aislado de solo lectura, OPS-02 aprobado y publicado en producción 4.26.56.** Ajustes → Copia de seguridad → Copias automáticas. | Recuperación compartida e identidad/SQL/RLS siguen abiertas. [Contrato](briefs/ops02-restauracion-probada.md). |
| Sincronización bancaria con adapters | **A medias.** Cada banco/bróker tiene su módulo, pero sin interfaz común. | Interfaz única (conectar / sincronizar / desconectar / estado) para que añadir un banco no toque la UI. Enlaza con Enable Banking. |
| Play Store, cobrar, gestor fiscal | Ya estaba en el plan (ver «Solo si lo pides» y la nota de freemium). | Antes de cobrar un euro: **hablar con un gestor**. La consulta es barata comparada con regularizar tarde. |
| Más tests de lógica financiera | Lógica y Deno aprobados, 164 E2E Chromium en la auditoría 4.19.14. Recuento vivo en runner/mapa. | Seguir sumando al tocar dinero; los casos pendientes concretos están en [BACKLOG.md](BACKLOG.md). |

### Segunda tanda de la misma review (2026-07-26)

El usuario trajo una segunda ronda, centrada en **operación** más que en producto. Dos de las
propuestas son la tabla de arriba dicha con otras palabras, y dos las descartamos a propósito —
queda escrito para no volver a discutirlas.

| Propuesta | Veredicto | Qué falta (tarea) |
|-----------|-----------|-------------------|
| **Métricas funcionales** (usuarios activos, syncs OK/KO, imports, tiempo medio de sync, bancos más usados, errores por banco, funciones más usadas) | **Repetido** — es la fila «Analytics de uso». Lo nuevo es la lista de qué medir. **Más barato de lo que parece**: `Core.logEvent(kind,message,detail)` (`00-core.js`) ya existe con RLS solo-admin, tope de 20/sesión y dedupe. | Un `kind` nuevo (`use`) + una vista SQL agregada. **Agregado y anónimo**: son datos financieros, `guard-privacy` vigila el cliente. Instrumentar **ahora** aunque haya 3 usuarios: el histórico de uso no se recupera hacia atrás. |
| **Health check** (versiones, migraciones pendientes, última release, errores 24h/7d, último backup) | **HECHO (4.13.0).** `npm run salud` — script, no pantalla, por lo que ya estaba escrito aquí. | Nada. Da alineación de versiones + APK viva, qué sirve Pages **de verdad**, si la beta va por delante o por detrás, commits sin promocionar, migraciones y errores a 24 h / 7 días. |
| **ADR** (`docs/adr/`, una página por decisión) | **HECHO (4.13.0).** [`docs/adr/`](adr/) con las cinco: Supabase, monolito, cero CDNs, OTA propio y Capacitor. | Nada. Cada una dice qué se descartó y qué haría cambiar de opinión; la del OTA lleva pegada la lección de las dos causas con el mismo síntoma. |
| **Threat model** (XSS, inyección, token robado, noti falsa, replay, función pública, acceso indebido) con ✅ mitigado / ⚠ pendiente | **HECHO (4.13.0).** [`docs/AMENAZAS.md`](AMENAZAS.md): 13 amenazas cruzadas con lo que ya hay. | Lo que sale de ahí, por orden: **validar la entrada de las diez Edge Functions** (la única en rojo), **auditar `app_events`/Sentry**, y **extender el rate limit**. |
| **Observabilidad** (duración de Edge Functions, consultas SQL más caras, tiempo de carga) | **A medias, y la mayor parte NO se construye.** Las duraciones de Edge Functions y el SQL caro ya los da el panel de Supabase (Logs + Query Performance); rehacerlo es trabajo tirado. | **HECHO (4.13.0):** `cloud.logPerf` mide justo eso —lo que pasa en el móvil— redondeado a medio segundo. Las duraciones de Edge Functions y el SQL caro se siguen mirando en el panel de Supabase, que ya los da. |
| **Feature flags** por usuario | **No ahora.** Ya hay dos ejes de gating: el canal beta y `profiles.is_admin`. Meter flags en el monolito = ramas de código muertas conviviendo en los ficheros que ya crecen sin parar (`10`/`11`). | Se recupera **el día que la beta tenga varios móviles** (fila «Beta cerrada» de arriba). Entonces sí es una maravilla; antes, no. |
| **Tercer canal «Experimental»** (Experimental/Beta/Stable) | **No.** Repite la fila «Beta cerrada» y multiplica por tres la matriz de release (OTA + manifiesto + APK), que es exactamente la que reventó dos veces seguidas en 4.10.1 y 4.10.2. | Lo que falta no es un canal más: son **más móviles en el que ya existe**. |
| **«Operations Dashboard» como tarea única** | **Dividido a propósito.** Son tres cosas distintas (salud + métricas + observabilidad) con costes muy diferentes. | Con 3 usuarios, el 90 % del valor está en el script de salud + la vista SQL de métricas. La pantalla, si algún día compensa. |

## Bloqueante antes de publicar en Play Store: el NOMBRE

Decidido el 2026-07-26. **«Aely» se queda como descripción, no como marca.** Los hechos:

- Ya hay una app **«Aely»** de finanzas personales en Google Play (`com.support_tech.micartera`),
  misma categoría: gastos, informes, export a Excel. No es ilegal llamarse igual —el nombre es
  genérico y nadie puede apropiárselo— pero en Play seríamos invisibles entre los homónimos.
- El Gobierno tiene **«Cartera Digital Beta»** (identidad digital y verificación de edad). Nombre
  distinto, pero la palabra «cartera» arrastra esa asociación en España.
- Un nombre descriptivo **no se puede registrar** como marca: no habría nada que defender.

Cambiarlo ahora cuesta un rato; con la app instalada en 300 móviles, cuesta muchísimo más. La
lista de candidatos se comprueba en Play, App Store, dominio y OEPM/EUIPO antes de proponerla, y
la elección es suya. El registro real lo confirma un agente de la propiedad industrial, no nosotros.

## Solo si lo pides

| Tema | Notas |
|------|--------|
| **Play Store** | **Lo último**, cuando él diga que está hiper pulida. No adelantar. |
| **Pulido visual gordo** | SPEC-v4 / handoff en `docs/design/` |
| **Logos de banco reales** | Idea 2026-07-18: sustituir el monograma (Sb/Cx…) por el logo del banco. Regla de la casa: cero CDNs → habría que auto-hospedar los ~8 logos habituales en `public/vendor/banks/` (los de Enable Banking vienen de fuera y solo se usan en el picker). |
| **Freemium / suscripciones** | Idea 2026-07-18 (medio en broma, medio en serio): gratis = cuentas manuales (importe editable a mano); plan de pago = sync bancaria automática. El nombre editable en ambos. La 4.1.0 ya deja la semántica lista (manual = saldo editable; conectada = solo nombre/rol). Para monetizar de verdad faltan pasarela de pago + entitlements en Supabase — se diseña cuando lo pidas, no se mete de tapadillo. |

## Widget Android (ya existe)

En el móvil: **mantener pulsado en el escritorio → Widgets → Aely**.  
Muestra gasto del mes vs presupuesto + saldo de la cuenta diaria.

## Export / informe

| Qué | Dónde | Estado |
|-----|--------|--------|
| Backup JSON | Ajustes → Copia de seguridad → Exportar | ✅ |
| Informe del mes (imagen WhatsApp) | Inicio → tarjeta del mes cerrado (4.19.12); compartir imagen, con descarga PNG si no hay share | ✅ |
| Cargo de un recibo, a la vista | Gastos → fila atenuada «Recibo: nombre» / «¿Recibo: nombre?» (candidata 4.26.122); con el banco de los recibos fuera del gasto diario, filtro 🎛️ → «Todos los bancos». Ficha del movimiento → «No es este recibo»; se deshace en «Paga un recibo» → el mismo recibo → «Confirmar pago completo». También en los últimos movimientos de Inicio y en «Importar histórico» | 🧪 beta |
| Evolución del patrimonio | Inicio → gráfica bajo la cifra grande (candidata 4.26.126): mantener o arrastrar el dedo enseña cada día, botones 1M/3M/6M/1A/Todo, frase que compara con el mes pasado y la «i», que abre la hoja «Cómo se calcula». Debajo, la tarjeta «Este mes» / «Este ciclo» con lo que queda y «N € al día durante M días», sin línea de estado (el color dice cómo vas) | 🧪 beta |
| Hogar y gastos compartidos | **Perfil → «Tu gente»** (toca tu avatar en Inicio). Movido aquí en 4.10.0 porque al final de Cartera no lo veía nadie; antes en Cartera (4.6.1) y antes aún en Ajustes → Conexiones | ✅ |
| Sugerencias / errores del usuario | Ajustes → App → «Enviar sugerencia» (desde 4.1.0; antes dentro de Novedades) | ✅ |

## Mantenimiento habitual

1. Bugs en uso (feedback real)  
2. Features pedidas  
3. **Cada release:** alinear `VERSION` + `package.json` + `CHANGELOG` + `RELEASE_NOTES` + APK (`build.gradle` + `apk.json` + release GitHub) + `docs/ROADMAP.md`  
4. Play Store: **siempre lo último**. Si se añade algo, va antes. Sideload/APK GitHub no esperan.

Ver [CHANGELOG.md](../CHANGELOG.md) · [ARQUITECTURA.md](ARQUITECTURA.md) · [AMENAZAS.md](AMENAZAS.md) · [ADR](adr/) · [TESTING.md](TESTING.md) · [SENTRY.md](SENTRY.md) · [HOGAR.md](HOGAR.md) · [CATEGORIZE.md](CATEGORIZE.md) · [AGENTS.md](../AGENTS.md)
