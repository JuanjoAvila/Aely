# OPS-0110 · actor autorizado en listo

Candidata de tooling en `codex/cli-beta-actor`, sobre beta80.1 / `955765a9ec0ad96d20140a8f12da00c9fa04985c`. Sin publicación ni promoción. El arreglo de continuidad del Panel81 mantiene su implementación independiente.

## Problema y fuente de autorización

El CLI usa service role y consultaba partes de todos los actores. Reproducción sin red sobre el script de 80.1: rechazo del propietario a las 09:00 y aprobación de otro actor a las 10:00, misma huella, producía `approved`. Es un defecto del tooling; no demuestra por qué reaparecían tandas en el móvil.

La fuente verificable es `profiles.user_id` con `is_admin=true`: el rol que abre Dev, declarado por la migración existente `0016_profiles_and_privacy.sql`. Se exige exactamente un administrador y un total exacto que descarte respuestas recortadas. Si falta la configuración, es ambigua, inválida o no puede consultarse, no se evalúa ningún veredicto: JSON indeterminado y salida 2. No hay selector por correo, UID fijado en código, fallback a otro actor ni escritura de configuración.

La consulta de eventos selecciona y filtra `user_id` antes del límite; el parser vuelve a comprobarlo. El rechazo y la retirada propios conservan su precedencia, incluido `null` explícito: el filtro previo lo saltaba y podía recuperar un OK anterior. Un campo ausente o valor inválido no se interpreta como retirada. Un parte ajeno tampoco se incluye como rechazo histórico. Autorizar al emisor no acredita entrega.

## Verificación y límites

`tests/listo-actor.test.mjs` ejecuta el CLI real con transporte simulado que bloquea toda red no prevista. Está registrado en `scripts/run-tests.mjs`. Protege las dos direcciones de contaminación, retirada propia, partes sin autor y configuración vacía/ambigua/recortada/inválida/denegada/offline. La fixture previa de `beta-veredictos` declara ahora su perfil y actor sintéticos.

- Contraste inicial: los 14 casos del guardián de actor fallan contra el script de `955765a9`; 14/14 pasan con el cambio. Tras la revisión temprana, los tres contratos añadidos sobre `null` propio/ajeno y decisiones ausentes/inválidas también pasan: 17/17 en el corte final. Las dos direcciones de contaminación y la retirada se ejecutan contra el CLI real, con filas ajenas devueltas pese al filtro remoto para comprobar también la defensa local.
- `npm run build` PASS y ningún artefacto `public/` cambia. Runner con plan de Node afectado PASS: `listo-actor` (17 contratos), `beta-veredictos` (26 contratos), `relevant-tests`, `docs-frescura` y `guard-privacy`, 11,6 s. Sintaxis de los dos scripts y `git diff --check` PASS. No se ha ejecutado la suite completa, Deno ni Chromium.
- No se han consultado perfiles ni partes reales. No se modifican `src/`, `public/`, Android, Edge, SQL, versiones ni el comparador del panel. PR y CI pendientes en este corte; el SHA final se identifica en la PR. La integración contra beta se hará después del freeze del Panel si el delta sigue siendo separable.
