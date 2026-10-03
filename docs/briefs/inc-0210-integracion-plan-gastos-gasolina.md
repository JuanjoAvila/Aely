# Integración Plan + Gastos + Gasolina/Taxi · candidata85 · 3/10/2026

Unión aislada sobre Plan/Gastos8587e4b6b80f6d7010f8154b9f1877fb2f0563c1 y Featureb51b095d261e8f1e2dafdfd426e4fb40559a6881 (fuente final e3aed087); base común3467bbd4. Rama propia del coordinador codex/coord-int85-0310. Conserva las notas85+84+83,206 versiones del histórico,19 alcances y el registro de contratos/DOM. Categoría86, Meta87, Movilidad88 y Widget89 no forman parte de esta unión. No acredita publicación ni aceptación móvil.

## NO-GO reproducido y corrección

El primer SHA conjunto dac443226d8ba422f36fa72c792ef4c47e17c5a8 se subió y lanzó CI37111482453. Aun con104 DOM PASS y guardián completo CLI0, Claude y el revisor independiente encontraron un contrato no cubierto: una cuota60 vinculada a un apunte manual, manual:sabadell, macrodroid o sin source podía dejar de estar pendiente sin que el saldo800 incluyera el pago. La proyección pasaba de740 a800. Ese SHA y el contrato anterior8587 mantienen NO-GO; un verde de su CI no los convierte en entregables.

DebtPaymentState exige ahora origen ob o exactamente una fila de feed de la misma identidad. FixedPaymentFeedClear conserva el requisito BOOK y el veto PDNG/duplicados. Sin esa prueba, un vínculo manual conserva cuota pendiente y proyección740. BOOK único permite retirar la previsión sin segundo débito ni cambios de saldo, principal, cuentas o movimientos. Source ob se conserva porque nace del sync bancario del saldo y bankTx no contiene todo el histórico; exigir feed a ese origen reintroduciría el doble conteo. ob-hist sin BOOK conserva el pendiente anterior: no se amplía el contrato a importaciones históricas. El posible desfase entre expenses y app_state en otro dispositivo sigue siendo un límite general, sin afirmar que se haya observado en el caso familiar.

Revisión focal de Claude: sonda propia CLI0 y40 contratos PASS; favorable sobre fuente, sin GO de SHA mutable. Revisor independiente:40 contratos y46 casos propios PASS, misma dirección y límites. El dictamen exacto requiere SHA final y DOM final.

Gastos usa un solo periodo en cifra, categorías, límites y lista. El singular de una categoría se comprueba en es/en/ca; se retiran cuatro claves antiguas sin consumidores. El alcance propio inc-0210-03-gastos-periodo incorpora tres rangos de idioma con los textos de periodo/plural/singular: cambiar una traducción propia invalida la huella. No repina auditorías históricas ni amplía idiomas ajenos.

## Evidencia local y pendientes

- Contratos financieros actuales:40 cuotas,33 cuotas-deudas,6 periodo,40 Gasolina/Taxi,31 veredictos; sintaxis7 bloques, i18n, frescura documental, relevantes y privacidad PASS. Son datos sintéticos, no evidencia del cargo real ni de la Edge activa.
- Primer guardián corregido completo CLI0:1188 dependencias y384 datos mutados. El segundo guardián con los tres rangos i18n explícitos queda registrado en test-results/integration85-fixed-guard2.log y .exit; su cierre se acredita aparte.
- DOM anterior del SHA invalidado:104 PASS, fail/skip/retry/flaky0,185794 ms, HTMLc56c278b7073f682aad50cd783135445c69595eded7dae10924451ff91ff3d34. No acredita la corrección nueva. La ampliación final prevé39 Plan+5 Gastos+6 Gasolina+63 Panel=113 pruebas, incluida recarga manual/notificación y BOOK único; necesita concesión expresa de lease tras FEATURE47. Informe final independiente del anterior, sin sustituir evidencia roja.
- Suite Node completa de Claude en TZ=UTC sobre dac44322:116 etapas/1592,6 s, único fallo externo memoria-espejo. Es referencia del SHA invalidado, no PASS integral de la corrección. Deno local ausente no se presenta como PASS; CI completa exacta sigue siendo gate.

Los alcances actuales son unión explícita de ambos candidatos; el guardián verifica llamadas/datos sin dependencias omitidas. Diez lectores financieros actuales rechazan compatibilidad histórica, incluido TR cambiado por Gasolina. El positivo de compatibilidad usa fuente fija955765a9 y alcance preintegración real8587, con mutante Java real de esa fuente. No se presenta TR85 como intacto ni se aliasan aprobaciones.

A/B inicial mismo host/minificador con sellos82.99/84.99/85.99: base82 min1292833/gzip351893; Plan/Gastos84 min1296320/gzip352724; Feature85 min1294335/gzip352407; unión85 min1297889/gzip353265. Delta unión frente84:+1569/+541B. Topes mínimos1268/346KiB, tres bloqueantes, sin recortar idiomas/notas. Medición actual corregida con minificador oficial:1297918 min/353247 gzip9, márgenes514/1057B; no se compara ese sello local con el futuro como si fuera el mismo. Fichero min temporal retirado, métricas JSON locales conservadas.

APK80/code52, Android y apk.json conservados. Incluye dos fuentes Edge de Feature, ingest_logic y categorize, sin despliegue ni SQL; los IDs web y límites no requieren desplegarlas. No se atribuye mejora a Wallet ni a una notificación real. Solo se integra/publica beta tras revisión exacta y CI; no producción, APK nueva, instalación ni aceptación móvil inferidas.

La copia temporal autorizada original conserva el patch íntegro33 archivos. Se aplicó al worktree gestionado propio y se comprobaron contenidos normalizados de los33. Las rutas locales y logs ignorados no se incorporan como datos personales al repositorio público. No se borran ramas/worktrees. La unión final requiere commit limpio, DOM113 final, GO exacto y CI nueva; no reutilizar el SHA ni el run invalidado.

## Cierre de pruebas corregidas · 3/10/2026

Fullguard2 final CLI0 con1188 funciones/dependencias y384 datos mutados; tres mutantes en memoria del singular es/en/ca cambian su huella propia (PASS), sin escribir fuentes. DOM final113/113 PASS, fail/skip/retry/flaky/errors0, CLI0,252213ms; informe test-results/integration85-fixed-dom.json. HTML local y HTTP200 propios idénticos SHA2560cb976b3221882783f39b182a6a301b7c83e346e86c9f70a67c061ecb03b0a6a. ROOTlease48 cerrada expresamente:listener4491=0 yChrome=0, canonicalFREE. Los pendientes de DOM/guard indicados arriba quedan acreditados por este cierre; permanecen SHA final, revisión exacta y CI nueva antes de integrar. No reutilizar CI37111482453 de dac44322.
