# B09-D — widget e Inicio muestran distinto gasto del mes

**2026-09-08. Prioridad alta de diagnóstico.** Evidencia visual aportada por el dueño en el chat:
widget con gasto mensual mayor que Inicio, mismo presupuesto. Las capturas son de momentos
distintos; no permiten atribuir toda la diferencia a una fórmula ni afirmar cuál cifra es correcta.
No se copian imágenes, saldos ni importes personales al repositorio público.

## Ubicación en el trabajo pendiente

Es parte del frente histórico de coherencia widget/app (`plan-vuelta-crucero.md`), pero tiene
aceptación propia. **No cerrarlo solo con B09-C/safeLiq**: ese cálculo limita «Puedes gastar»,
no explica por sí solo que `spent` difiera. B09-B solo alinea el inicio del mes. Vinculado al
bloqueo de [identidad y decisiones de duplicado](arquitectura-identidad-gastos.md).

Claude dirige diagnóstico servidor/contrato; Cursor reproduce la secuencia app→widget→notificación
y comprueba el puente. Mantener separados los dos rechazos del panel beta ya registrados.

## Hechos comprobados en c37be5ee

- Inicio (`03-tab-dash.js`) y envío al widget (`11-app-main.js:budW`) usan `monthBudgetStats`.
  Con el mismo estado y momento, deben enviar el mismo `shown`; no son dos presupuestos distintos.
- Hay dos escritores: app → `MiCarteraPlugin.updateWidget`; notificación → respuesta de ingest →
  `TrExpenseListener` → `MiCarteraWidget.saveMonth`. Ambos reemplazan `spent` y actualizan la hora.
  La hora del widget por sí sola no identifica cuál escribió ni acredita frescura de sus datos.
- `expenseCountsCash` excluye `possibleDup`; `expenseCountsBudget` utiliza esa regla. La app
  no cuenta un posible repetido pendiente de decisión.
- `cloud.addExpense` no persiste esa marca, `expenseFromRow` no la recupera, `slimForCloud`
  elimina `expenses`, y la consulta de ingest no selecciona ninguna decisión de duplicado.
  `cuentaParaPresupuesto` del servidor no puede aplicar esa exclusión.
- **Fallo reproducido con datos sintéticos:** una compra confirmada de 30, otra de 10 y un
  posible repetido de 30 producen **app 40 / ingest 70** con las implementaciones actuales.
  Comercios distintos evitan que el dedup por atributos esconda el defecto del test.
  Demuestra una divergencia real; no demuestra que sea toda la diferencia de las capturas.
- Los tests `presupuesto-servidor`, `widget-coherente` y `month-window` pasan en esta base.
  No cubren la pérdida de la decisión al subir/bajar gastos ni una notificación posterior.
- B09-B está en `origin/beta` y no en `origin/main` en la comparación de esta revisión.
  `supabase.yml` despliega automáticamente solo desde main. Último run de ese workflow consultado:
  [32069491520](https://github.com/JuanjoAvila/Aely/actions/runs/32069491520), 17/8, verde.
  **No prueba la versión activa de la función**: puede haber despliegues manuales y el workflow
  tiene un gate que permite omitir despliegue. No anunciar B09-B activo en servidor por estar en beta.

## Siguiente diagnóstico, acotado

1. Sin editar/borrar gastos reales: abrir Inicio, volver al launcher y observar el widget.
   Si converge, el envío de la app funciona y hay que investigar qué lo sobrescribe después;
   no atribuir esa sobrescritura a ingest hasta registrar el evento. Si no converge, revisar
   ejecución/error de `nat.updateWidget`, versión OTA/APK y refresco del launcher.
2. En entorno de pruebas, sembrar estado, enviar al widget y simular una notificación por el
   circuito completo. Registrar escritor, versión de cálculo y secuencia del snapshot; evitar
   logs con movimientos o datos personales. Cubrir respuesta tardía de ingest que llega después
   de un push más nuevo de la app: hoy no hay arbitraje de revisiones en esos escritores.
3. Comparar los conjuntos que cuentan: posibles repetidos, decisiones confirmadas, categorías,
   bancos de presupuesto, modo neto/bruto, lápidas y límite del mes. Buscar el delta por IDs con
   diagnóstico privado; no inferirlo por parecido de importes ni publicarlo en el brief.
4. Verificar versión realmente desplegada de ingest y estado de migraciones sin disparar una
   ingestión real. Su servidor es compartido por producción y beta.

## Qué debe proteger la corrección

- Persistir y recuperar la decisión de posible repetido con identidad inequívoca. No enviar solo
  un total desde el móvil ni hacer que la app cuente pendientes para imitar al servidor.
- Cliente y servidor excluyen pendientes/confirmados como mismo movimiento y cuentan los
  confirmados como distintos. La decisión sobrevive a pull, reinicio y segundo dispositivo.
- Probar alta→nube→pull→cálculo servidor con el escenario de abajo, no únicamente invocar dos
  helpers con objetos que ya tienen todos los campos. Una columna sin escritura/lectura no arregla nada.
- App→widget y siguiente notificación conservan igualdad de gasto, presupuesto y restante para
  el mismo snapshot; una respuesta antigua no sustituye una más reciente.
- Ampliar tests existentes y añadir la prueba de puente/Android que proceda, registrada en runner/mapa.
  Una aserción sobre texto Java no ejecuta `SharedPreferences` ni simula el orden de callbacks.

Entrega requerida según causa: cambio web → OTA; campos/cálculo servidor → migración/despliegue
Supabase con autorización de producción; cambio en preferencias/orden de escritores Java → APK.
**No decir que todo este frente requiere APK ni que se arregla entero por OTA antes del diagnóstico.**

## Reproducción sintética (Node en modo módulo, tras npm run build)

```js
import fs from 'node:fs';
import { transformSync } from 'esbuild';
import { loadPureLogicFromFile } from './scripts/load-pure-logic.mjs';
const c = loadPureLogicFromFile();
const js = transformSync(fs.readFileSync('supabase/functions/_shared/presupuesto.ts','utf8'),
  {loader:'ts',format:'esm'}).code;
const p = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const date = new Date().toISOString();
const base = {date, category:'otros', ent:'trade_republic'};
const s = {accounts:[{id:'a',ent:'trade_republic',role:'diario',spendFrom:true}],
  expenses:[
    {...base,id:'a',amount:30,merchant:'Compra A',source:'macrodroid'},
    {...base,id:'b',amount:10,merchant:'Compra B',source:'manual'},
    {...base,id:'c',amount:30,merchant:'Movimiento',source:'ob',possibleDup:true,possibleDupOf:'a'}
  ], fixed:[],debts:[],oneoffs:[],reservaLog:[],budget:100,
  settings:{expenseBanks:['trade_republic']}};
const rows = s.expenses.map(e => ({fecha:e.date,importe:e.amount,comercio:e.merchant,
  cat:e.category,source:e.source === 'ob' ? 'ob:trade_republic' : e.source}));
console.log({app:c.monthBudgetStats(s).shown,
  ingest:p.statsDelMes(p.filasComoLaApp(rows,[]),s,p.inicioDeMesMs()).shown});
// Actual: app 40 / ingest 70. Objetivo: ambos 40 mientras c esté pendiente;
// ambos 70 si se confirma «son distintos», incluso tras nube y nueva notificación.
```

Estado de entrega: diagnóstico y reproducción; **ninguna corrección publicada todavía**.
