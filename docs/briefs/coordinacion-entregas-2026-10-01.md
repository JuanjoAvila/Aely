# Coordinación de entregas preparadas · 1/10/2026

Objetivo nuevo: terminar, revisar por SHA, publicar y cotejar en beta Panel, Cyberpunk/Preguntar/Perfil, nómina, retirada y widget/APK beta52. El cierre nocturno no continúa ni impone su plazo vencido. Un coordinador controla versiones, merges, publicación y Chromium; no se abren objetivos nuevos mientras queden estas candidatas.

El relevo completo está en `relevo-coordinacion-2026-10-01.md`, rama `codex/noche-3009-registro`, commit `d5c43596`. Este registro no prueba una publicación ni un OK móvil. No se consultan movimientos familiares, ni se promociona beta completa, APK estable, Edge o SQL.

## Control y trabajo concreto

- Panel: fuente `351053b9f0d83d5f40152c5f684803fb735f9eb1`, parent `ca7b97d4`, [PR97](https://github.com/JuanjoAvila/Aely/pull/97). GO de fuente del relevo revisado: delta solo panel/docs/i18n/tests; recibo solo cambia digest Panel. Verificación independiente nueva: filtro16/16 y veredictos26/26 PASS. [CI36829164352](https://github.com/JuanjoAvila/Aely/actions/runs/36829164352) en curso; publicación76 pendiente. Los55 DOM es/en/ca congelados no se repiten sin un delta relevante. No declarar resuelta la reclamación en móvil por CI.
- Claude: ACK `20261001T071238Z-claude-ui77-ack-empezado`, implementación exclusiva UI77; commit local `9f0fec78` observado. Se comunica parent76 exacto para rebase inmediato y lease25 tras liberación explícita de Panel24. Tres tandas independientes, SHA/PRdraft/CI y A/B tamaño exigidos. Codex UI conserva el papel de revisor y los archivos sincommit del fixture Cyber; no duplica implementación.
- Nómina: cuatro fixtures reparadas en `70ee1bbc`, acta `c2f31fe92fc1ba17699e0527be8177ff7b436a20`; 26 contratos de veredictos y14 de tandas verdes, runtime idéntico a `5c2146c3`. Rebase después77, renumeración final y cuatroDOM pendientes; PR96 antigua no se publica.
- Retirada: encargo concreto de carreras lateproof/ACK y preparación del rebase; cuatroDOM tardíos pendientes de turno posterior. Fuente local `aff910b9`; PR88 antigua no se publica.
- Widget: encargo concreto de plan beta-only, build52 y verificaciones de firma/sello/WEBDEBUG/asset; parent/tamaño/CI finales pendientes. Runtime `821733fc` revisado en relevo. El comando ordinario de release APK publica estable y no se utiliza para esta entrega.

## Evidencia y límites

Al tomar el control, `origin/beta=ca7b97d438e01f60091a3818fdca734740ec8a9e`, observado con `ls-remote`, no con VERSION del checkout inicial. Lease canónico25 exclusivo Claude; los demás pueden avanzar Node/integración sin Chromium. Solo el coordinador escribe ese lease y acepta liberación explícita.

Cada entrega exige fuente exacta, revisión delta, CI correcta y después manifiesto/ZIP/huella/HTML/SW/APK realmente servidos. Aprobación de una tanda no equivale a entrega ni autoriza otra superficie. Último rechazo/revocación manda. Pruebas físicas, pagos o servidor sin evidencia se conservan pendientes.
