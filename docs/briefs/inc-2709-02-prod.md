# INC-2709-02 · promoción selectiva de Deudas · 30/9/2026

## Autorización y alcance

El dueño comunicó el 29/9 en chat que aprobó `inc-2709-02-deudas-archivo` tras publicarse beta 4.26.70.1. La aprobación es específica de esa tanda. `npm run listo` no puede consultar el registro remoto porque falta `SUPABASE_SERVICE_ROLE_KEY` en este worktree; el mensaje directo del dueño es la fuente de autorización. La beta de origen quedó en [PR #69](https://github.com/JuanjoAvila/Aely/pull/69), merge `9b0cc9351f486e1a4210b911db74576f53c2cac9`, [Action 36624037785](https://github.com/JuanjoAvila/Aely/actions/runs/36624037785) SUCCESS y ZIP de huella `4495e50005bdc9eb`.

La candidata nace de producción `c2b02ed8c3caa584ed9ab5b7a19c50df8c4defdb` (web 4.26.66). Traslada exclusivamente el diff de deuda de beta `50e77f83..fc46aa9d`: `09-tab-debts-goals.js`, claves nuevas de `01-i18n.js`, `e2e/deudas-archivo.spec.mjs` y su mapa. Versión web candidata 4.26.67 con notas es/en/ca, `tandas:[]` y documentación; no altera el cálculo `debtBalance`, gastos, banco, Android, Edge, SQL, migraciones ni APK. En el panel beta debe desaparecer solo esta tanda después de verificar producción; el resto permanece en versiones superiores a 4.26.67.

## Contrato y verificación

Un saldo proyectado cero requiere confirmación para marcar la deuda liquidada; una amortización total introducida por la persona es explícita. El archivo conserva el objeto y su `id` para que Gastos encuentre cuotas antiguas. Un saldo positivo corregido vuelve a mostrarse, el borrado con cuotas vinculadas se bloquea y un diálogo obsoleto no descuenta dos veces. [Acta de beta](https://github.com/JuanjoAvila/Aely/blob/beta/docs/briefs/inc-2709-02-deudas-archivo.md).

Pendiente registrar SHA candidato, revisión independiente de Claude, pruebas del candidato, CI, diff integrado y cotejo HTTP/ZIP/HTML/SW/APK de producción. No se mezclan la incidencia de la nómina anticipada, el gas vencido o el widget del 30/9 con esta publicación.
