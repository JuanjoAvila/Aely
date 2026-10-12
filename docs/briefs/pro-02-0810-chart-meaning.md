# INC-0810 · significado de la gráfica de Inicio

Unidad `inc-0810-inicio-grafica-significado`, candidata `4.26.109`. Base beta `8dcc5ed39b6e212ba1e34a90b550685794ce0bd5`; entrega Grok PR187 `edc84ecd9743e4888f4ae4a8b802ed31164289da`. Producto guardado en `47ec665141669acfce14096f951a86c29a797055`: Node, presupuesto autorizado y auditoría histórica postcommit verificados; DOM25/25 y control causal6 rojos esperados terminales. Borrador propio y CI exacta pendientes en este corte; sin publicación. Nav107 y Meta108 son unidades separadas del coordinador.

## Auditoría de la fuente

Se revisaron los cinco ficheros de PR187 y los escritores de `state.history`. `Sparkline` concatena los números guardados y el patrimonio actual en EUR; con menos de dos puntos no pinta. Escala entre mínimo/máximo con rango1 si coinciden, sin base cero, eje temporal ni porcentaje. `buildEmpty` y estado vacío guardan `[]`; `buildInitial` copia la semilla sintética `[42000,42150,42300,42450,42600,42750,42800]`; alta guarda `[0]`; `seedFlows` repone una lista vacía si falta. No se acreditan snapshots diarios ni fechas. El cero de alta y la semilla no acreditan una ganancia.

Se conserva el dibujo y todos sus números. No hay cambios en `Sparkline`, saldos, curva, cálculos, escritores, onboarding ni semillas. La nota debajo de la cifra principal es texto visible accesible. La moneda de visualización convierte la cifra grande; la línea conserva EUR.

La revisión local corrige los dos hallazgos de PR187: elimina «Tu histórico empieza hoy» y adapta su guard de DOM sin retirar la ausencia de SVG/pastilla de cero; restaura íntegro `pt_trb_hint` español desde beta8dcc5ed3. El recorte de ese texto financiero no pertenece a esta tarea.

## Texto propuesto

Sin cifras guardadas:

- es: Solo se muestra el total actual; aún no hay cifras anteriores. No es un histórico con fechas ni una ganancia.
- en: Only the current total is shown; there are no earlier figures yet. This is not a dated history or a gain.
- ca: Només es mostra el total actual; encara no hi ha xifres anteriors. No és un històric amb dates ni un guany.

Con cifras guardadas:

- es: La línea termina en el total actual. Cifras sin fecha en EUR; escala relativa del mínimo al máximo, no desde cero. No indica una ganancia.
- en: The line ends at the current total. Undated figures in EUR; relative scale from minimum to maximum, not from zero. It does not show a gain.
- ca: La línia acaba en el total actual. Xifres sense data en EUR; escala relativa del mínim al màxim, no des de zero. No indica un guany.

## Alcance aprobado y plan pendiente de ventana del coordinador

El coordinador raíz aprobó el alcance es/en/ca, EUR/mínimo-máximo/sin base cero/sin fechas y restauración de `pt_trb_hint`. La ampliación autorizada de los dos guards de autenticación usa un lector cacheado de106 para sus notas, registro y auditoría histórica de revisiones; conserva todas las aserciones de106 y la comprobación aparte de los33 descriptores contra la candidata actual. Partes funcionales, `authWorld`, mutantes causales y7funciones/9datos siguen leyendo la fuente actual normalizada aLF. La nueva unidad109 tiene su propio alcance y mutantes actuales, sin repins. Todavía no se han ejecutado los guards.

- Fuente: dos claves es/en/ca y nota de Inicio; ninguna operación financiera nueva. Nueva identidad con el bloque real de la gráfica, `Sparkline` y los tres bloques de texto. Los33 descriptores anteriores, repins históricos y anclas conservan su contenido.
- Guards: `inicio-grafica-significado` ya mapeado a Inicio; vacío, un número, cero de alta, semilla, negativos, iguales, USD y matriz es/en/ca vacío/serie a360px. Verifica texto accesible, ausencia de recorte, curva y saldo, y estado financiero al ir a Plan y volver. `pulido-vacios` conserva cobertura previa. `beta-sources` cubre alcance y mutaciones de nota/textos/dibujo.
- Versión109/package/lock, nota familiar es/en/ca y guion propio; README/ROADMAP/CHANGELOG/TESTING veraces. No se cambian topes, notas anteriores ni dependencias.
- Solo tras concesión expresa y lectura del lease canónico: `npm run build`, sellado/minificación y coste contra1287/351KiB de la base y1291/352KiB autorizados para la integración Meta108. Se reportará el coste antes de resolver presupuesto con el coordinador, sin recortar explicaciones ajenas.
- Node tras concesión: sintaxis, i18n, docs-frescura, relevant-tests, privacidad, beta-source-parse y beta-sources; coste oficial. DOM en puerto exclusivo por asignar: `inicio-grafica-significado` + `pulido-vacios` una vez. Solo repetir si hay cambios/fallo no resuelto. Rojo causal acotado al texto vacío anterior y falta de EUR/escala, sin usarlo como prueba móvil.
- Si gates locales y revisión final permiten cierre: commit propio, draftPR contra beta, workflow `test.yml` sobre SHA exacto una vez. Este chat no integra ni publica.

## Límites y evidencia

Tras concesión expresa de Node, build salida0. A/B con fuentes baseLF y producto candidato normalizadoLF, minificador oficial sin renombrado, reserva sintética95bytes y sello común `4.26.109.99999`: base1.317.888/359.021bytes crudos/gzip9; candidata1.318.229/359.168bytes, delta+341/+147. Ayuda española ajena restaurada íntegra. Supera1287KiB crudos por341bytes y queda256bytes bajo351KiB gzip. Dentro del presupuesto autorizado para la integración Meta108 de1291/352KiB quedan3.755/1.280bytes; en ese primer corte aún no se había cambiado el tope. Artefacto build local SHA256 `5c2be0318e85a23008703fb5705dc6c0df7439208f6ff153d6d15f66ffd30a77`. Los33 digests web anteriores coinciden exactamente con beta8dcc; unidad109 nueva `d05bb0d4d86dce14c5ba4794a0be2a265e52f3a167cf8eadce87aa198e5cd38d`.

Gates Node terminales: sintaxis, i18n, mapa de pruebas, privacidad, parser de alcances, ambos guards de autenticación y `beta-sources` completo salieron0. El registro completo confirma mutantes109, dependencias funcionales/datos y el guard PERSIST91 sobre34 alcances sin retirar cobertura. `docs-frescura` salió1: confirma todas las versiones/textos y su único fallo es la auditoría histórica de código posterior al ancla106 mientras el bump109 sigue sin commit. No se altera ni elude ese guard; se comprobará después del commit. El primer presupuesto oficial salió1 exclusivamente por los341bytes crudos sobre1287KiB; gzip y3 recursos bloqueantes pasaron. Runner inicial salida1 por esas dos condiciones, conservado en su informe.

Tras autorización expresa del coordinador, esta unidad adopta el mismo presupuesto1291/352KiB de Metas108/navegación107, con3 bloqueantes. Se repite únicamente el guard de presupuesto tras cambiar sus constantes/comentario: salida0, tres límites dentro. Los ocho guards previos y mutantes completos se conservan sin repetición, con runtime y hash de build idénticos. Este resultado es de109 aislada; ninguna suma teórica acredita que la integración conjunta pase, y el coordinador deberá medirla oficialmente.

DOM con lease98, loopback4430 y un worker: gráfica14 + vacíos11 =25/25, salida0 en37,4s, sin omisiones, retries ni flaky. Control causal sobre `git archive 8dcc… public` exacto (HTML SHA256 `b6b6a52c9eae4677163574c85f49668b3deaf2c11e95097614ec8addc40cec65`): seis casos idénticos de vacío, un punto, USD y serie es/en/ca fallan por falta de la nota; el contexto DOM vacío conserva la promesa antigua. No se fuerza fuente ni CSS. Candidato conserva hash/curva y saldo/estado tras vista, con accesibilidad y ausencia de recorte a360px. El primer intento restringido no llegó a DOM por bloqueo del socket; se cerró y verificó0 procesos/listener antes del único pase efectivo con acceso local elevado.

Runner y servidores terminales, con verificación posterior de0 procesos propios/Chromium y listener4430; liberación expresa98. `docs-frescura` postcommit47ec terminó0, incluida la auditoría histórica deVERSION; resuelve el fallo inicial sin cambiar ese guard. No se recupera un lease por reloj ni se modifica el JSON del coordinador. Revisión final, CI y aceptación móvil pendientes; cifras sintéticas no acreditan uso real. Sin APK, servidor externo, SQL, cambios de saldos ni entrega beta/producción. El presupuesto de39bytes informado por Grok pertenece a su candidato recortado y no acredita esta revisión. Archivos, checkouts archivados temporales y servidor auxiliar retirados en esta misma tanda.
