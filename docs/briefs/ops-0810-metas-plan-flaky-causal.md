# Metas mensual: aislar avisos y escritura del doble · 8/10/2026

Estado: parche de test preparado; requiere CI del SHA exacto. Sin cambio de producto,
publicación, versión ni permisos. Base `a4d0128199e496bba181edd4cfc661ed5b8407c3`.

La [CI 37719554158](https://github.com/JuanjoAvila/Aely/actions/runs/37719554158),
job `113123820848`, terminó correctamente tras recuperar tres casos al reintento.
Los logs oficiales muestran dos errores de Metas: el remoto inválido en es esperaba
«formato inesperado» pero observó logros y después conflicto de nube; el pull fallido
en ca esperaba «fallo sintetico» pero observó logros. Ninguna de esas pasadas llegó
a las aserciones financieras posteriores: el verde recuperado no demuestra su causa.

## Causa comprobada de Metas

- `gamifOf` desbloquea `save_100` tras el alta y `first_underbudget`/`first_reto`
  al cerrar el mes. El efecto de gamificación de App envía esos avisos a `showToast`,
  el mismo estado único que usan los errores de nube. El fixture no los marcaba vistos.
- La respuesta inválida lleva `updated_at`. App conserva lo local y llama al
  `pushState` real con ese sello. En `00-core.js`, un UPDATE que devuelve cero filas
  significa conflicto. El doble de `fixtures.mjs` no guarda las escrituras y devuelve
  siempre el `app_state` sembrado, aquí vacío. Esto fabrica un conflicto ajeno al caso;
  el debounce puede repetirlo y abrir otro pull.
- Una comprobación Node ejecutó el `pushState` real contra el cliente creado por
  `seedLoggedInDashboard`: obtuvo `{conflict:true}`. También ejecutó el `gamifOf`
  real para ahorro de 100 y cambio de mes, y comprobó que los IDs vistos eliminan
  esos avisos. Es evidencia de las interferencias del doble; no una reproducción DOM.

El parche marca los logros como vistos y, junto al pull ya diferido, registra las
escrituras sintéticas de estado y devuelve su sello de éxito. No altera el transporte
mensual de App ni el motor. Mantiene los avisos exactos de error, cifras visibles,
100/200 €, presupuesto 900/800 €, asientos, recarga, segundo cliente, fallo/reintento
y cero consultas bancarias. Añade para nube inválida el cotejo de identidad y payload
rescatado: usuario sintético, ahorro 100 y solo octubre por 100. No se oculta un
asiento de noviembre dentro de la escritura simulada.

## Plan sigue sin causa acreditada

El tercer caso, búsqueda inexistente/nombre largo en `plan-gestionar`, consumió 60 s
esperando el grupo tras `fill("")`. Pasó en 2,8 s al reintento. La respuesta oficial
de artefactos del run no contiene capturas, trace ni `error-context` descargable.
El código programa foco inicial al título mediante rAF, pero sin observar el foco
y el valor del buscador en la pasada fallida no se acredita que ese sea el origen.
Se conserva el spec intacto; siguiente diagnóstico: registrar foco/valor/eventos
al vaciar, sin cambiar timeout, retries, selectores ni aserciones de ancho.

## Validación y límite

Sintaxis del spec, `metas-pull-transport` (10 casos) y `relevant-tests` (12 casos)
verificados en Node. La comprobación causal también verifica que el nuevo doble
registra el payload completo y no devuelve conflicto. Chromium no está disponible
en este runtime: no se declara e2e verde ni desaparición de los flakes hasta la CI
exacta. La semántica del conflicto entre dispositivos y los avisos simultáneos de
producto quedan fuera de esta corrección del banco de pruebas.
