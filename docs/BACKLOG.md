# Backlog operativo — Aely

| ID | Estado vigente | Evidencia comprobada y límite | Siguiente paso |
|---|---|---|---|
| FIN-01 | abierto | `96b0fe4f`, `e1780957` y el cierre por cuenta siguen en beta y main; `tests/efectivo-cierre.test.mjs`. La corrección publicada no acredita toda importación/cuenta ni una reparación histórica. | Acreditar cierre por cuenta y aceptación de efectivo; no compensar saldos reales. |
| FIN-02 | abierto | `d4b87004` en beta/main y `histFijosFromSelection` vigente; `tests/hist-pagos-mensuales.test.mjs`. Tres pagos mensuales y un fijo son identidades distintas; cierre completo del histórico sin verificar. | Verificar importación, reimportación y deshacer con las filas de cada mes. |
| FIN-03 | abierto | [Arquitectura de identidad](briefs/arquitectura-identidad-gastos.md) y `src/modules/00-core.js` en B117; UUID, índice real, RLS y carreras de todo el circuito sin acreditar. | Ensayar origen/UUID/ACK en pruebas; no migrar ni buscar gemelos por parecido. |
| FIN-04 | abierto | [Triaje OPS-05](https://github.com/JuanjoAvila/Aely/blob/ffe95ce99fb4038741b57a27b07b51e0c8c96f31/docs/briefs/ops05-pr-abiertas-triaje-2026-10-12.md): PR43 conserva valor; transporte beta117 **2 PASS/16 FAIL, exit1**. Banco/duplicado pueden resolver sin ACK exacto. | Preparar contrato parcial por propietario/UUID y conflicto explícito, preservando deuda y origen TR/Wallet. |
| FIN-04-ACK | abierto | Propuesta concreta del triaje PR213, no encargo reclamado ni corrección entregada; el contrato parcial actual conserva 16 rojos de transporte. | Claude decide su encargo desde beta vigente con dos clientes, cero filas, ACK ajeno y pérdida de respuesta; FIN-04 mantiene el alcance general. |
| FIN-05 | abierto | PR201 integrada en beta por `94050870`; widget115 **rechazado en móvil**, corrección puente116 `8f2b437b` y PR212 borrador. APK, pago cerrado, reentrada y día45 son gates propios. | Validar contrato vigente y binario instalado; no cerrar por supersesión de PR105/170 ni por CI. |
| FIN-06 | abierto | Cliente4.26.51 `2ea992b2` en main/beta; [divisas](briefs/fin06-divisas-2026-09-26.md). Fuente Wallet existe; servidor actual y pago real en divisa no verificados en este corte. | Cotejar ingest desplegado y aceptación por pago real sin inventar euros faltantes. |
| FIN-07 | cerrado | Paginación cloud aprobada4.26.52, `8cd41f09` en main/beta; [contrato](briefs/fin07-historico-cloud-2026-09-26.md). Ausencia no borra; no garantiza que el proveedor envíe todo. | Conservar regresiones; cargos Caixa actuales se siguen en INC-2709-06. |
| FIN-08 | abierto | La investigación antigua y sus límites se conservan en [historia](BACKLOG-HISTORIA.md); no hay cierre verificable de reparación de filas reales en B117/P111. | Inventario privado por identidad y copia restaurable; reparación sólo con aprobación expresa. |
| FIN-3009-04 | abierto | Solicitud de reserva de cuotas conservada íntegra en [historia](BACKLOG-HISTORIA.md); B117 no aporta cierre verificable de su contrato completo. | Definir mes/ciclo, parciales y datos faltantes sin descontar de nuevo cuotas pagadas. |
| OPS-01 | abierto | [Control manual](briefs/ops01-control-2026-09-27.md), fuentes beta/main y sucesor categorize PR196 `bdd75636` en main. El 403 antiguo es historia; este corte no inspecciona servidor vivo. | Matriz por función repo/servidor/cliente con rollback y pruebas; no declarar igualdad global. |
| OPS-02 | abierto | Visor aprobado/publicado4.26.56 `42613195` en main/beta; [contrato](briefs/ops02-restauracion-probada.md). Recuperación compartida financiera, SQL/RLS/ACK siguen abiertos. | Separar visor ya entregado de restauración revisable, dependiente de FIN-03/08. |
| OPS-03 | abierto | Panel y `tests/novedades-idiomas.test.mjs` vigentes en B117; varias cuentas con veredictos independientes y permisos sin admin no acreditadas. | Probar alta y aislamiento de dos probadores; conservar rechazos e idiomas. |
| OPS-04 | abierto | `USO_OK`/`logPerf` e instrumentación existen en fuente B117; existencia y aceptación de una vista SQL agregada **sin verificar**. | Inventariar agregados actuales antes de proponer otra vista, sin campos libres financieros. |
| OPS-05 | abierto | PR213 **borrador**, `ffe95ce9`, CI38227525602 success: triaje listo. Conservar43/182/195; cierre48/87/105/170/180/181 sólo propuesto. PR210 filtro de memoria separado;202/204 excluidas. | El dueño decide cierres; Claude revisa e integra. No borrar ramas/worktrees ni rescatar árboles viejos. |
| OPS-06 | abierto | Guardianes actuales y diagnóstico PR182 conservados; **NO-GO de optimización de Plan**, sin banco discriminante del lag prolongado. Play Store sigue al final. | Ronda intensiva de rendimiento, botones, carreras, offline, seguridad y dispositivo tras correcciones. |
| OPS-0410 | en producción | Panel93 y retirada de entregadas presentes en main; `1d5dd782`, `8bb0398f`, recibo P111 `ops-0410-panel-cola`. El ahorro Node antiguo no mide móvil ni CI total. | Conservar sólo pendientes de aceptación/entrega; no convertir rechazo histórico en OK. |
| OPS-3009-03 | en producción | Recibo P111 `beta-panel-veredictos` y fuente actual del panel; [acta](briefs/ops-3009-03-panel-beta.md). Los cortes75/76 se conservan como preparación. | Revalidar identidad y veredicto por tanda al cambiar código; no restaurar la cola antigua. |
| SEC-01 | abierto | **14 funciones** inventariadas en fuente B117, incluida ayuda. PR211 borrador `db884002` propone lectura acotada/validación/JWT explícito; no integrado ni desplegado. Deno check ingest conserva tres errores de baseline según su documentación. | Conservar el alcance SEC y su fila al integrar; revisión/CI exactas y despliegue función a función, no por arrastre. |
| SEC-02 | abierto | PR127 integrada en beta `cdbb9acd`; [prices](briefs/sec02-prices-limites.md), body/auth y límite30/600 **propuesto y apagado**. No prueba límites/replay de todas las funciones. | Auditar coste y concurrencia reales; decisión de cuota/despliegue separada sin descartar pagos legítimos. |
| SEC-03 | abierto | Cliente4.26.57 `ece3a2d9` en main/beta; [privacidad](briefs/sec03-privacidad-logs.md). Logs Edge/gateway actuales y retirada de historia pública no acreditados. | Verificar por función; conservar el incidente histórico sin transcribir cifras, sin force-push. |
| BRAND-01 | decisión del dueño | [Marca Aely](design/aely/AELY_BRAND_BRIEF.md) y marca en fuente actual. Aceptación nativa completa sin verificar; nombre oficial Aely y sin mascota. | Aplicar el brief vigente cuando se encargue; no renombrar ni iniciar Play Store. |
| UX-01 | abierto | Correcciones de lifecycle/caché en P111 no cierran INC-2709-09; [diagnóstico de Plan](https://github.com/JuanjoAvila/Aely/pull/182) conserva NO-GO. | Reproducir degradación sostenida real antes de atribuir causa o mejora global. |
| UX-02 | abierto | Perfil UI77 en fuente/recibo P111, `inc-2709-10-perfil`; alcance amplio de rediseño/aceptación sin verificar. | Auditar puertas y casos restantes sin retirar funciones; seguir INC-2709-10. |
| UX-03 | en beta sin veredicto | Splash web117 `532a6066` en B117 y tanda `splash-animado`; el síntoma nativo es independiente y sigue abierto. | Probar arranque/movimiento reducido en móvil; no atribuir el splash web a una APK nueva. |
| UX-04 | cerrado | `9c7b6d13` en main/beta y puerta/textos actuales; mensaje de actualización/acceso superior de bancos ya reconciliados. | No reconstruir sin un caso actual; conservar regresiones. |
| UX-05 | cerrado | `0f55ae1e` en main/beta; `e2e/bancos-historico-filtro.spec.mjs` vigente protege filtro único y contador de importación. | Conservar cobertura de todos los bancos y la puerta de importación. |
| UX-06 | abierto | Pulido y Bienes presentes en P111; el alcance global incluye gestos nativos, anillo y uso prolongado aún sin cierre verificable. | Seguir incidencias concretas; no dar el objetivo entero por cerrado por una promoción. |
| UX-07 | en producción | Temas presentes en beta/main; recibo P111 `inc-2709-12-cyber-fab` acredita el sucesor de la línea sobre el FAB. | Mantener regresiones y movimiento reducido; un informe nuevo exige reproducción propia. |
| UX-2909-04 | abierto | Estado de bancos y sincronización a demanda existen en B117; experiencia del negativo/doble ingreso manual-bancario **sin aceptación verificada**. | Recorrido sintético con datos antiguos y revisión de duplicado, sin borrado automático ni sync al abrir. |
| PRO-01 | abierto | [Meta fuera de gasto corriente](briefs/plan-tanda-5-meta-gasto-mes.md), motor actual y metas mensuales no acreditan todo ese contrato. | Confirmar alcance por banco, agotamiento y retorno al presupuesto sin rehacer el motor entero. |
| PRO-02 | abierto | B117 `03-tab-dash.js:103` calcula proyección; correcciones Inicio/ciclo en P111. Aceptación de fin de mes y supuestos **sin verificar**. | Verificar calendario, bancos y datos faltantes; presentar previsión como previsión. |
| PRO-03 | abierto | Recordatorios B117 `11-app-main.js:2284/2294` sin frase de saldo; PR209 borrador `ab6ffa04` propone saldo del propio banco. Nativo sigue separado. | Revisar/CI del candidato, datos faltantes y dedupe; no duplicar el sistema de avisos. |
| PRO-04 | abierto | Informe PNG actual y [reconciliación histórica](BACKLOG-HISTORIA.md); importador PDF no acredita exportación PDF, cierre de salida **sin verificar**. | Confirmar necesidad y probar descarga/compartir/mes vacío reutilizando el informe. |
| PRO-05 | abierto | OTA y notificaciones locales en B117; push de nueva versión con app cerrada para otros usuarios **sin verificar**. | Auditar canal antes de diseñar proveedor/credenciales; permisos y aceptación propios. |
| PRO-06 | abierto | Fuentes MyInvestor actuales y resultados de brókers en P111 no prueban fiabilidad del proveedor/reCAPTCHA real. | Ensayo acotado y fallback acordado; no guardar credenciales ni rehacer CSV/Excel. |
| PRO-07 | abierto | Petición pensiones/ahorro preservada; alcance final y soporte de proveedor **sin verificar** en B117. | Distinguir proveedor de manual/import y datos desconocidos antes de implementar. |
| PRO-08 | abierto | `src/modules/13-hogar.js` y [Hogar](HOGAR.md) existen; aceptación completa con dos usuarios/revocación **sin verificar**. | Matriz sintética compartida y aislamiento antes de cierre; sin escribir en el estado del otro. |
| PRO-09 | abierto | Ayuda local en beta/main; recibo P111 `inc-2709-14-preguntar`. Fuente remota existe, activación/coste/consentimiento actuales **sin verificar**. | Mantener ayuda local; sólo activar remoto tras decisión expresa y verificación de privacidad. |
| TEC-01 | decisión del dueño | Refactor financiero/adaptadores sigue aplazado; fuente única `src/modules` y tests puros actuales. | Priorizar integridad; propuesta incremental sólo bajo encargo concreto. |
| TEC-02 | decisión del dueño | [i18n aparcado](briefs/i18n-orphans-aparcado.md); usos dinámicos impiden declarar huérfanas las claves por barrido simple. | No borrar en bloque; demostrar usos y mejora si se retoma. |
| DEC-01 | decisión del dueño | Marca/monetización/Play Store preservadas, sin cierre por versiones o CI; Play siempre al final. | Decisión expresa sobre marca, condiciones, costes y publicación tras aceptación completa. |
| DEC-02 | decisión del dueño | Ideas opcionales conservadas en historia; sin encargo de implementación ni compromiso de fecha. | Mantener opciones sin añadir pantallas, dependencias o CDNs por iniciativa propia. |
| INC-0210-01 | en producción | `d366215a` en main/beta y recibo P111 `inc-0210-01-plan-cuota`; [cuota vinculada](briefs/inc-0210-01-plan-cuota.md). | Conservar una sola atribución y saldo/anclas; otros defectos financieros siguen separados. |
| INC-0210-02 | en producción | `d366215a` y recibo P111 `inc-0210-02-categoria-elegida`; [categoría](briefs/inc-0210-02-categoria-elegida.md). | Mantener elección manual tras sync; no reabrir por un snapshot de preparación86. |
| INC-0210-03 | en producción | `d366215a`, recibo P111 `inc-0210-03-gastos-periodo`; [periodo de Gastos](briefs/inc-0210-03-gastos-periodo.md). | Conservar categorías del periodo activo y lectores financieros; no rehacer84. |
| INC-0310-01 | abierto | `8bb0398f` y recibo P111 `inc-0310-01-meta-regla`; [borrado de regla](briefs/inc-0310-01-meta-regla.md). Arreglo prospectivo entregado, reservas huérfanas antiguas sin reparar. | Separar aceptación de borrado actual del inventario/reparación histórica autorizada. |
| INC-0410 | abierto | Metas94 `fb137d1d`, producción `8bb0398f`; edición y tres metas en P111. Rechazo87 conservado; LWW simultáneo y lag no quedan cerrados. | Validar concurrencia y límites pendientes sin borrar/recrear reglas ni duplicar aportes. |
| INC-0810 | cerrado | **ID antiguo compartido por varios alcances:** historial Perfil→Ajustes cerrado en beta117; CHANGELOG registra180/180 sobre `f695a299`. Recientes, edición de Metas e indicador están en recibo P111. Gráfica109 rechazada permanece archivada; sucesor aprobado PR208. | Usar alcances completos para distinguirlos; conservar rechazo109 y no cerrar INC-2709-09 por memo/CI. |
| INC-2709-01 | abierto | Recibo P111 `inc-2709-01-arranque-red` acredita arreglo anterior; splash web117 posterior en beta. Reporte de red lenta/lag completo sin nueva aceptación verificada. | Probar frío/offline/frente en móvil y datos locales útiles; distinguir nativo. |
| INC-2709-02 | en producción | `df30b76f` en main/beta, web4.26.67 y [archivo de deuda](briefs/inc-2709-02-prod.md); aprobación selectiva preservada. | Conservar deuda/ID/cuotas antiguas; saldo proyectado cero no acredita pago. |
| INC-2709-03 | abierto | Ola de alta Recibos47 publicada; no acredita todas las puertas Plan/Gestionar/categorías en Android actual. | Matriz nativa por puerta, seguir dedo/cancelar/volver sin perder borrador. |
| INC-2709-04 | en producción | `b72e3264` y `9ce964ed` en historia de main/beta; cuotas-deuda-crash aprobado web4.26.59. | Conservar DOM de cuotas/plazo/importes; nuevo crash requiere versión y reproducción. |
| INC-2709-05 | abierto | Inicio/ciclo66 y natural73 en main, recibo P111 `inc-2909-02-inicio-natural`; no cierra automáticamente todos los conceptos/nómina/reportes de dos perfiles. | Verificar base/periodo/banco coherentes y nómina una vez sin tocar datos familiares. |
| INC-2709-06 | abierto | PR200/206 integradas en beta y tramo de bancos116 en B117. ACK perdido y margen de fechas tienen encargo separado; reconexión tampoco queda cerrada por paginación. | Acreditar recorrido proveedor→vista con cero perdidos/duplicados y compatibilidad de cliente/servidor. |
| INC-2709-07 | en producción | PR208 merge `b2dfd2c0`, P111 `bienes-completo`; alta vacía, guardar/cancelar y borrar confirmado ya suceden al acceso111. | No repetir alta/borrado por la cabecera antigua del backlog; conservar pruebas. |
| INC-2709-08 | abierto | Resultados de brókers y editor existen en P111, pero orden por pulsación y despliegue escalonado del pedido completo **sin cierre verificado**. | Auditar puertas/diseño y medir frames antes de proponer diferencias concretas. |
| INC-2709-09 | abierto | Caché95, lifecycle100–102 y memo106 entregados no demuestran solución acumulativa; PR182 diagnóstico **NO-GO**, PR204 candidata sin integración. | Banco discriminante de uso prolongado/rAF/heap/listeners y A/B; no extrapolar muestras cortas. |
| INC-2709-10 | en producción | Fuente UI77 `f3e89df7` y recibo P111 `inc-2709-10-perfil`; [perfil](briefs/inc-2709-10-perfil.md). | Conservar estado vacío compacto y puertas con letra grande/idiomas. |
| INC-2709-11 | abierto | Petición de anillo recortado preservada y V4Ring vigente; aceptación específica del contorno **sin verificar**. | Reproducir0/parcial/completo, temas y escala de texto; no cerrar por Bienes o gráfica. |
| INC-2709-12 | en producción | UI77 `f3e89df7` en main/beta y recibo P111 `inc-2709-12-cyber-fab`; sucesor de la línea sobre +. | Mantener safe area, tamaños y movimiento reducido. |
| INC-2709-13 | en producción | FAB98 `06737170` en main, indicador107 promovido PR197 `8e6d1234`; P111 `inc-2709-13-fab-contorno`. **Rechazo97 histórico conservado**. | Conservar contorno/ocultación en gesto real; nuevo fallo exige reproducción y aceptación propia. |
| INC-2709-14 | en producción | UI77 y recibo P111 `inc-2709-14-preguntar`, alcance separado de ayuda remota. | Conservar CTA con teclado/safe area y no enviar preguntas reales como test. |
| INC-2809-01 | en producción | `085a6f66` en main/beta, web66; [Inicio/ciclo](briefs/inc-2809-01-inicio-ciclo.md) conserva aprobación y entrega exactas. | Mantener neto/disponible del ciclo; el mes natural sigue en INC-2909-02. |
| INC-2809-02 | en producción | `17aeacc0` en main/beta y recibo P111 `inc-2809-02-ayuda-ciclo`; ayuda plegable y preferencia por perfil. | Conservar reapertura, persistencia y tres idiomas. |
| INC-2909-01 | abierto | Fuente80 `22396f9a`, widget115/116 en beta; recibo web antiguo no acredita Java actual, periodo/modo real ni día45. PR212 candidata. | Verificar app/widget mismo periodo y magnitud en APK real, cerrado/reentrada/rollover. |
| INC-2909-02 | en producción | `a03a2a06` y `8bb0398f` en main/beta; recibo P111 `inc-2909-02-inicio-natural`. | Conservar gasto bruto mensual al salir de Mi ciclo, sin atribuir arreglo al widget. |
| INC-2909-03 | abierto | `955765a9`/`8bb0398f` y recibo P111 `inc-2909-03-retirada`; corrección prospectiva publicada. FIN-04/RLS y timeout tras commit siguen limitados. | Verificar ACK exacto y dos dispositivos; no añadir efectivo por retirar un importado. |
| INC-3009-01 | abierto | Correcciones71/74 en producción, recibo P111 `inc-3009-01-cargos`; **rechazo humano conservado**, PR202 borrador de atribución única. | Revisar candidato y probar el cargo→recibo real; importe o nombre genérico no demuestran identidad. |
| INC-3009-02 | abierto | `955765a9`/`8bb0398f` y recibo P111 `inc-3009-nomina-anticipada`; BOOK/fecha Madrid en fuente. Nuevo reparto/fechas de bancos mantienen gates propios. | Confirmar cobro y origen una vez; ninguna previsión se toma como saldo cobrado. |
| FEATURE-0210-01 | en producción | `d366215a`, recibo P111 `feature-0210-01-gasolina-taxi`; [contrato](briefs/feature-0210-01-gasolina-taxi.md). | Clasificar altas nuevas; no recategorizar pasado ni heredar un despliegue Edge. |
| REC-GUARDADO-01 | en producción | `490d402d` en main/beta, web48; confirmación de tipo/nombre del alta y Atrás47 documentados en historia. | Mantener recorridos de recibo/cargo/ingreso; otras puertas nativas siguen en INC-2709-03. |

## Corte y lectura de la evidencia

Corte de fuente/GitHub del **12/10/2026**. **B117** = `origin/beta` 4.26.117,
`c5f62d6603d016150afd9d0e20547b608b323045`; **P111** = `origin/main` 4.26.111,
`b2dfd2c01d7ec6a9a30b74ae71d473054932c42f`.
Se comprobaron las PR actuales, la ascendencia de los commits citados, las fuentes y el recibo
`public/beta-delivery.json` de main. «En producción» en la tabla acredita incorporación a main
y el alcance indicado; **no es un cotejo HTTP nuevo de artefactos servidos**. APK/Edge/SQL,
aceptación real y cierre financiero amplio se verifican por separado. No se consultaron datos
familiares ni veredictos privados nuevos: «sin verificar» conserva el pendiente y no supone aprobación.

La dependencia OPS-05 está liberada: resultado `done/released:true` en el canal y PR213 con CI
exacta success. Sus seis cierres son propuestas. El ahorro de PR195 es **54,3372% de la etapa
Node local primaria**, no del total CI; el guardián original aún requiere port y dio exit1.
SEC-01/PR211 conserva su trabajo propio: esta reorganización no incorpora backend ni sustituye
su revisión. Al integrar cambios concurrentes, se actualiza únicamente su fila y se añade su
versión completa a la historia antes de resolver un conflicto; nunca se recorta alcance ajeno.

## Historia y criterios completos

[BACKLOG-HISTORIA.md](BACKLOG-HISTORIA.md) conserva íntegros los textos de la base del encargo,
beta117, OPS-05/PR213 y SEC-01/PR211, con SHA y huella por snapshot. Son fotografías históricas,
incluidas reglas de reparto antiguas y rechazos; no autorizan ejecución, promoción ni borrado hoy.
Los briefs mantienen criterios detallados. Este índice da **una fila por ID**; el antiguo INC-0810
se usó para varios alcances, descritos juntos para no inventar IDs ni perder sus límites.

<a id="cierre-del-día--27-de-septiembre-de-2026"></a>

El [cierre del 27/9](BACKLOG-HISTORIA.md#cierre-del-día--27-de-septiembre-de-2026) vive en el archivo;
se conserva esta puerta para enlaces históricos del ROADMAP.

Cada encargo entrega base, SHA/PR, comandos y exits, revisión, CI exacta y limitaciones.
Claude revisa e integra. Sólo el dueño cambia el veredicto móvil y decide producción.
