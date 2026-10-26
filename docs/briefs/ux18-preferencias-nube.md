# UX18: idioma recibido de nube y preferencias visibles

Candidato de fuente sobre `78c41edf87e2784ed31f8c9a083656c786d2632f`, sin publicación,
integración, beta servida ni aceptación móvil acreditadas por este documento.

La reproducción causal cambia el idioma desde otro cliente después del arranque. El SDK real
lee una fila sintética con `settings.lang=en` y un orden nuevo de tres cuentas. El orden sí
llega al DOM, pero Cartera sigue mostrando «Tu cartera»: no se ha solicitado el JSON inglés.
Recargar solicita el paquete real y muestra «Your portfolio». Se comprobaron el título visible,
su presencia en el viewport y la foto de estado antes y después. Los primeros fallos del banco
de pruebas se conservan aparte; no se consideran fallos de producto.

El botón de Ajustes y el arranque ya cargaban el paquete; adoptar un idioma desde nube no lo
hacía. App ahora carga el idioma guardado, conserva el castellano como alternativa mientras no
esté disponible y repinta las páginas memoizadas al terminar. Conserva la preferencia solicitada
si falla la descarga y vuelve a intentarla al recuperar conexión. La respuesta de un idioma
abandonado y el desmontaje invalidan el repintado pendiente. Este estado de UI no se persiste
ni escribe en la nube.

La guardia de respuesta tardía reprodujo además otra causa en Ajustes: elegir inglés, elegir
catalán mientras la descarga inglesa sigue pendiente y recibir después inglés volvía a guardar
la primera elección. Un contador local invalida esa respuesta cuando hay otra elección, cambia
el idioma guardado o se desmonta el panel. No se cambia el contrato persistido de preferencias.

No se ha reproducido un fallo de orden en el caso remoto. El guardián también comprueba un GET
antiguo retenido mientras se reordena mediante pulsación larga y se cambia el idioma mediante
Ajustes. El transporte captura la foto al iniciar ese GET, aplica UPDATE solo si coinciden
titular y revisión, y conserva las escrituras aceptadas al recargar. Liberar una lectura no
rebobina la fila simulada. No se modifica la política de conflictos ni la lógica financiera.

`e2e/ux18-preferencias-nube.spec.mjs` usa App, SDK, controles y paquetes de idioma reales,
con identidad y transporte sintéticos y red externa bloqueada. Está registrado para i18n,
Ajustes, App y Cartera en `scripts/relevant-tests.mjs`. Cubre ES/EN/CA, orden de varias cuentas,
campos de preferencia desconocidos, replay, error HTTP, desconexión de la descarga, recuperación,
respuesta tardía y desmontaje. Las pruebas son dirigidas y seriales; no equivalen a suite global,
CI, servicio remoto real ni aceptación física.
