# Auditoría de la ronda — 9 de septiembre de 2026

## Veredicto

**La ronda no está lista para promoverse entera.** El relevo decía que el histórico estaba
cerrado, pero la revisión encuentra casos sin cubrir. Esta auditoría no modifica datos reales,
no despliega Supabase y no aprueba ninguna tanda en nombre del dueño.

Base revisada: `953a4773`, con beta publicada **4.19.13.1** (`a2abcf61`) y producción
**4.18.7**, comprobadas con GitHub Actions, `salud` y `listo`. Al empezar había **2 tandas
aprobadas, 3 rechazadas y 10 sin veredicto**. Los rechazos son ventana del mes, avisos de
presupuesto y TR reactivo; pertenecen a compilaciones anteriores y requieren revalidación.

Alcance: contraste de relevo, commits desde 4.18.7, lógica de identidad/borrado, importación,
efectivo, presupuesto/widget, cambios visibles y ejecución de las suites. Un test verde no
demuestra la ausencia de casos financieros no contemplados; abajo quedan los reproducidos.

## Corregido en 4.19.14

1. **Deshacer restauraba un estado antiguo.** Se abre la confirmación con presupuesto 100;
   antes de confirmar entra un cambio a 777 y un gasto ajeno. El código publicado devolvía el
   presupuesto a 100 y perdía el nuevo gasto, porque usaba `histUndoBatch(state,last)` fuera
   del updater. Reproducido con el componente real en navegador. Ahora conserva ambos.
2. **Un DELETE sin sesión se anunciaba como realizado.** `deleteExpensesByIds` resolvía sin
   enviar ninguna consulta. Ahora rechaza; la UI conserva el lote para reintentar.
3. **Reintento expuesto a cierres y pulls.** `cloudPending` se guarda antes de la petición,
   no solo al recibir el error. Un pull durante el DELETE no resucita sus filas al terminar.
   Las respuestas no sobrescriben el estado ni el identificador de una importación posterior.
4. **Panel de revisión plegable.** Cabecera con título, progreso/veredicto y botón de desplegar.
   Aprobar encoge solo esa tanda. Se pueden consultar sus puntos y cambiar de opinión.
   Se rescatan aprobaciones de compilaciones anteriores por id y textos todavía marcados;
   al responder Pages también se recuperan las marcas de las versiones anteriores de la ronda.

## Hallazgos abiertos antes de aprobar

### P1 — El cierre mensual descuenta el efectivo de Trade Republic

`src/modules/01-i18n.js`, `reconcileTR`, todavía suma **todos** los gastos del mes para
descontarlos de la cuenta diaria. Las demás cuentas solo arrastran `monthNetForAccount`, que
no resta las compras del sobre. La nueva `saldoCuentaMostrada` sí las resta durante el mes.

Reproducción ejecutada con `loadPureLogicFromFile` y el mes anterior al reloj de la prueba:

- Cuenta diaria TR: base 1000, inyección 0. Sobre: base 100.
- Un único gasto de 20, categoría bares, `ent:"efectivo"`, en el mes anterior.
- Tras `reconcileTR`: **TR 980 / sobre 100**. Lo correcto es **TR 1000 / sobre 80**.

El total puede coincidir mientras los dos saldos individuales son falsos. Es una interacción
de la cuenta nueva con el cierre antiguo. También hay que cubrir la variante sin cuenta diaria
(el cierre retorna antes), creación/reanclaje del sobre y varios meses sin abrir la app.
**No aprobar efectivo con dinero real hasta cerrar esta integración.** No se ha aplicado una
corrección retrospectiva automática de saldos durante esta auditoría.

### P1 — El histórico confunde pagos mensuales con recibos duplicados

`src/modules/08-motor-bank.js`, `histClassifyCandidates`, sigue pasando TODOS los candidatos
por `dedupeHistRecibos`, que compara comercio/importe/banco sin fecha. Eso era protección al
crear Fijos; desde el híbrido C el destino por defecto es un gasto puntual.

Reproducción ejecutada: tres cargos sin tarjeta de 12, mismo comercio y Sabadell, con fechas
12/6, 12/7 y 12/8; estado sin gastos ni fijos/deudas modelados. Clasifica **uno como nuevo y
dos como `dup`, motivo `recibo-lote`**. La UI deja desmarcados esos dos meses reales.

Pendiente: separar deduplicación de pagos de la protección al crear un Fijo expresamente.
No basta con eliminar el guardo: hay que conservar que seleccionar varios «Recibo» equivalentes
no cree varios cargos recurrentes. **No dar por completa la importación histórica todavía.**

### Límites ya conocidos que siguen abiertos

- **Identidad cloud:** el índice UNIQUE por usuario/fecha/importe/comercio sigue sin banco.
  Dos gastos legítimos iguales pueden chocar. Los UUID y el ACK del histórico protegen el undo,
  pero no solucionan esa restricción de almacenamiento.
- **Divisa sin cambio:** el cliente puede tratar el importe original como euros. Ver
  `divisa-desconocida-uno-a-uno.md`; sigue sin resolver.
- **Pull máximo 2000:** ahora avisa, pero no hay paginación completa. Un aviso no equivale a
  descargar todo el histórico.
- **Servidor compartido:** el código de cajero/categorías/ventana mensual en el repo no prueba
  que todas las Edge Functions estén desplegadas. Esta sesión no las ha desplegado ni ha
  inspeccionado su código vivo. El sufijo `#dup` sí está diseñado para excluirse con el servidor
  anterior; no extender esa garantía al resto de cambios.
- Metas como gasto, dos sugerencias ambiguas y limpieza de ramas/worktrees siguen pendientes
  según el relevo. La última exige permiso antes de borrar; aquí no se ha borrado ninguno.

## Verificación y prueba móvil

- Suites de lógica y los cuatro ficheros Deno ejecutados y aprobados con los runtimes instalados.
- **164/164 e2e aprobados** con Chromium. Tras el último ajuste de retirada de aprobación,
  **26/26** pruebas del panel e histórico aprobadas; sintaxis, i18n, seguridad, privacidad,
  frescura de documentación y tamaño verificados. El runner local se ejecutó con todos sus
  pasos y Deno; el navegador se lanzó por su CLI local porque faltan los wrappers `.bin`.
- Los dos fallos del undo se reprodujeron antes del arreglo; sus regresiones pasan después.
- La primera pasada con Edge pasó 160/163 e2e; fallaron arco y dos medidas del tutorial.
  Los 9 tests de esos dos ficheros pasaron después con el Chromium de Playwright, sin tocar
  sus pantallas ni relajar aserciones. La validación final usa ese Chromium.
- Presupuesto minificado ajustado de 1180 a 1182 KB por el rescate de veredictos y undo;
  **el tope de descarga gzip sigue en 330 KB**, medido alrededor de 327 KB.

Para probar **4.19.14**: actualización **OTA, sin APK nueva**. Ajustes → Revisar esta beta →
tocar una cabecera para encoger/desplegar; deben conservarse marcas y comentarios. Una tanda
aprobada debe quedar encogida y poder desplegarse para consultar o cambiar de opinión. No es
necesario importar, borrar ni alterar movimientos reales para verificar este cambio.

Producción permanece bloqueada hasta resolver los hallazgos y recibir el veredicto del dueño.
