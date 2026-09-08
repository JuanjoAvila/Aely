# i18n huérfanas — aparcado (2026-09-08)

Investigación Cursor + Claude. **No borrar claves.** El ahorro no compensa el riesgo.

## Qué se midió

Sobre `a2abcf61` (4.19.13): ~1484 claves string en `LANG.es`. Dos barridos dieron listas distintas; ninguna es segura para borrar a ciegas.

| Intento | Criterio | Resultado | Agujero |
|---------|----------|-----------|---------|
| v1 | Solo `t("x")` / `tf("x")` literales; excluye prefijos `t("pref"+…)` | ~245 “huérfanas” | No ve tablas tipo `{k:"tour_1"}` en `02-ui-shared.js`. El tour vive así. |
| v2 | La clave como string en `src/modules` (salvo `01-i18n`) + `shell.html` | Sin excluir dinámicos → ~336; con exclusión de prefijos → ~212 | Sin prefijos, marca vivas `cat_*`, `bn_50`… (`catName` → `t("cat_"+id)`, avisos `tf("bn_"+th)`). |

Ahorro estimado si se borraran las de v2 “limpia”: ~**38 KB** raw / ~**11–13 KB** gzip. El `01-i18n` / bundle rondan **1,6+ MB**. Es **&lt;1%**. No le arregla nada al dueño.

## Por qué no se toca

1. Un método fiable tiene que cubrir **las dos trampas a la vez** (tablas + prefijos dinámicos) y aun así revisar **familia a familia** (`ob2_`, `ob3_`, `d_`, `lt_`, `wl_`, …) antes de borrar.
2. El fallo típico de borrar mal es un texto que solo sale en un estado raro: los tests no lo ven y lo ve la familia.
3. El premio (unos KB gzip) no vale ese riesgo hoy.

## Si alguien vuelve a tentarse

1. LANG vía sandbox completo (varios `Object.assign(LANG.es, …)`), no un solo bloque regex.
2. Contar como usada si la clave aparece como `"…"`, `'…'` o `` `…` `` en módulos/UI **o** cae bajo un prefijo de `t("pref"+` / `tf("pref"+`.
3. No borrar sin mirar cada familia y sin e2e/camino manual del texto.
4. Medir KB gzip del delta **antes** de abrir la tanda.

## Estado

**Aparcado.** Sin tanda de limpieza. Decisión Claude 2026-09-09 (canal `I18N-ORPHANS`).
