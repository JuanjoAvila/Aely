# Relevo Aely: bancos, categorías, ayuda y tests

## Estado al cerrar la tanda

**Publicaciones y despliegues pausados.** El usuario rechazó la prueba offline de la beta
4.24.2/4.24.3 porque Ajustes se abre repetidamente al recuperar conexión. Claude y Cursor
investigan ese arranque; no mezclar nuevos cambios hasta cerrar el rechazo.

Antes de la pausa el usuario había aprobado, en la sesión de Claude, desplegar **solo
bank-sync por Actions junto a 4.25 en beta**, con reversión si falla. La autorización existe,
pero su ejecución está pausada. No se ha movido beta/main ni desplegado ninguna función desde
esta tanda de Codex. La IA remota de ayuda sigue apagada y sin autorización de activación.

## Entregas conservadas

| Bloque | Rama / commit | Estado |
|---|---|---|
| Bancos 4.25 + tooling | `codex/bancos-historico-caixa`, `6a3aea6470bd0214bea4459e79ff515fb72c9c3e` | Subida a origin; no a beta. Cursor: revisión ejecutada verde |
| Categorías 4.26 | `codex/categorias-personales`, `b9f8f974` | Local; revisión de código verde, ejecución independiente aplazada |
| Ayuda 4.27, integración de los cuatro bloques | `codex/asistente-hibrido`, `80fd2be3` antes de este relevo | Local; revisión de código verde, ejecución independiente aplazada |

Los tres bloques conservan `fd31aa20` (4.24.3) como ancestro. Cuando se cierre el fallo actual,
integrar su corrección en esta pila, revisar el diff y validar lo afectado antes de publicar.
No promocionar rondas parciales a main ni desplegar el ingest de categorías junto al arreglo
previo de 4.24.1: ese despliegue anterior debe observarse primero.

## Verificación y rendimiento

- Autor: `npm test` completo en **Europe/Madrid y UTC**, mismo código `1336fcb8`, Chromium
  oficial 1228: **EXIT 0**, Node + Deno verdes, **298 E2E correctos / 1 captura ya omitida /
  0 fallos / 0 flaky** por pasada. **225,263 s y 225,276 s** de runner completo.
- Rebases posteriores: solo documentación. `git diff 1336fcb8 80fd2be3` excluyendo `docs/`
  está vacío. Versiones, documentación y privacidad comprobadas después; worktrees limpios.
- Cursor sobre bancos `bb55475a` (antecesor con código idéntico): **27/27 E2E en Madrid y
  27/27 en UTC**, guardianes, paginado y TR verdes. Último commit bancario solo registra review.
- Ayuda: diez casos UI verdes, incluidos offline, navegación real, ausencia de función (404),
  servicio apagado (503) y foco. Categorías: siete casos UI verdes y handlers reales simulados.
- Fixture Novedades, A/B de nueve casos con el mismo bundle/navegador: **46,094 → 12,373 s**
  (73,2 % menos en ese grupo, sin extrapolar a toda la suite).
- Medición de rendimiento al final y con un trabajador: mismos siete casos y umbrales; los
  funcionales siguen en paralelo. Informes por fase y agregado conservan los 299 casos.
- El refresco bancario tiene mutación comprobada: sin listener falla; restaurado pasa. El doble
  cambia al simular la conexión y no depende de cuántas consultas haga Ajustes.

## Alcance y siguiente paso

Paginado diario/histórico, avisos de lectura parcial y retirada del cupo global de 150 movimientos
corregidos. Falta probar los cargos conocidos de CaixaBank/Sabadell tras el despliegue autorizado;
no se afirma que los movimientos de la familia estén recuperados sin esa comprobación real.

Las reglas personales gobiernan nuevas compras en servidor; no hay recategorización masiva ni
migración de identidad. La ayuda local abre formularios existentes y no guarda dinero por sí sola.
La consulta remota opcional está preparada, apagada y sin llamadas reales. Coste y límites en
[el brief del asistente](asistente-hibrido-2026-09-15.md).

Cliente por OTA, sin APK nueva. Primero cerrar Ajustes; después bancos 4.25 con bank-sync y
prueba móvil. Categorías y ayuda quedan para sus propias revisiones y entregas.
