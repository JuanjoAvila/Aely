# Bienes: alta, edición y borrado

Encargo de Claude `bienes-completo-codex-20261010`, base `74c5f075bf08e38e289992195ad97e3a71a8b031`. Candidata sin versión nueva ni publicación: Claude integra y prepara catálogos y notas.

La lista vacía ocultaba todo el bloque en Cartera. Tocar una fila abría el editor antiguo, que escribía el nombre antes de Guardar y no tenía cancelación ni borrado. Una prueba DOM sobre el bundle de la base reproduce la falta de Añadir bien.

La candidata conserva el bloque vacío y ofrece Añadir bien. Cada fila abre una ficha con los componentes existentes; nombre, valor en EUR y tipo quedan en un borrador local hasta Guardar. Cancelar y cerrar no escriben. El valor admite cero y hasta dos decimales; rechaza importes negativos, vacíos, no finitos y texto parcial. La edición conserva el identificador y la nota, y el borrado usa askConfirm. Las cuentas y movimientos se conservan.

La única ampliación de alcance es retirar la condición de lista no vacía en `14-v4-screens.js`, aprobada por Claude en `bienes-alcance-14-ok-20261010`. No hay dependencias, APK ni cambios de backend. La aprobación móvil queda pendiente.

Cobertura: `cartera-bienes-toque` conserva los seis casos es/en/ca y tamaño normal/grande, ahora contra la ficha y su cancelación. `cartera-bienes-completo` comprueba alta vacía válida/inválida/cancelada, edición, borrado cancelado/confirmado, recarga y patrimonio, además de cero y conservación de otros bienes. Ambos están registrados para sus módulos en relevant-tests. Comandos, resultados y limitaciones finales se entregan por el canal; un resultado sintético no acredita aceptación móvil.

Validación local: build exit0 y once casos DOM aprobados, incluida geometría a360px con letra grande y revisión visual de la captura sintética. La base falla por falta de Añadir bien con lista vacía. `npm test` termina exit1: beta-sources espera que Bienes111 y la identidad de Nómina que incluye Wealth sigan sin cambios, memoria-espejo aborta por privacidad de memoria local ajena y el presupuesto gzip se excede236bytes. Deno no está instalado y el runner no llega a la suite DOM general al fallar Node. No se presenta suite completa verde.

Presupuesto oficial con reserva de sello:1.323.954bytes minificados y361.708gzip frente a topes1.326.080/361.472, con tres cargas bloqueantes. No se aumentan topes ni se editan catálogos/pins/notas/VERSION: esos gates se han comunicado a Claude, junto a los resultados ejecutados. La entrega es un borrador pendiente de integración, no beta publicada.
