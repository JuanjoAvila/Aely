<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (ob-signo-volteado-duplica.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: ob-signo-volteado-duplica
description: El bug del widget (475/491) es un movimiento de Open Banking que vuelve con el signo cambiado y entra OTRA VEZ; el indice unico lleva el signo dentro.
metadata: 
  node_type: memory
  type: project
  originSessionId: 7de23512-86c3-4aeb-94be-8333e759471e
  modified: 2026-09-11T12:29:21.047Z
---

⚠ 11/9/2026. Su queja más vieja viva («pago algo y el widget suma mal; al abrir la app se
corrige solo») tiene causa medida, y **no es el widget**.

**El mecanismo.** El índice único de `expenses` es `(user_id, fecha, importe, comercio)` y
**`importe` lleva el signo**. La clave de fusión del cliente (`keyOf`, `día|importe|comercio`)
también. Así que cuando una sincronización de Open Banking devuelve **el mismo movimiento con el
signo cambiado**, ni la base de datos ni la app lo reconocen como repetido: entra como fila nueva
y el mes se descuadra por el DOBLE del importe.

Caso literal en sus datos — misma `fecha`, mismo `comercio`, misma `nota`, mismo `ob_name`,
mismo `source`, solo cambia el signo y la categoría:
- `53fe8a61` · **+247,26** · cat `traspaso` · creado 06/09
- `7fa6b8c3` · **−247,26** · cat `ingreso` · creado 10/09

Barrido desde el 1/6: **3 pares, ≈1.097,72 € de ruido, y SOLO en su usuario** — los otros dos
tienen 0 y 0, porque son los que no tienen Open Banking. **Sus 248 lápidas de `state.deleted`
son él borrando esta basura a mano desde julio.**

**Nada lo tapa.** `reconcileObDupes`, pese al nombre, devuelve **siempre `borrar:[]`**: solo
recategoriza gemelos de cashback a «inversión». Lleva meses prometiendo algo que no hace.

**Estamos ciegos en el banco que falla.** `logObAmbiguous` guarda el payload crudo, pero su
filtro solo registra movimientos **sin concepto y sin nombre** (más un `siempreTR` para Trade
Republic). Resultado: **55 eventos OB desde el 3/8, los 55 de TR, cero de Revolut y cero de
CaixaBank** — y el duplicado de 247,26 € es de **Revolut**. De TR sí se sabe: `entry_reference`,
`transaction_id`, `reference_number` y `bank_transaction_code` salen **null en 8 de 8**; lo único
poblado es `credit_debit_indicator`, `status`, `booking_date`, importe y
**`balance_after_transaction`**, que nadie había mirado y puede servir de desempate.

**Y el script de diagnóstico mentía.** `scripts/diag-widget.mjs` etiquetaba «SERVIDOR (lo que va
al widget)» un cálculo con las filas CRUDAS, cuando `ingest` usa `filasComoLaApp` desde 4.18.2.
Con sus datos de hoy eso son **332,10 €** de diferencia, y de esa etiqueta falsa salió el
diagnóstico equivocado de «faltan 81,06 € en la nube» que quedó escrito en el traspaso.
Arreglado en `tanda/diag-widget-honesto` (pinta las dos cifras y caza solo los signos volteados).
Ver [[feedback-no-dar-por-hecho]].

**Lo que la app enseña ACIERTA:** 1000 − 505,44 = 494,56, que es el 491 de su captura.

Pendiente: decidir la clave de dedup (voto con Cursor, ver [[feedback-consenso-de-las-tres-ias]])
y **su OK para limpiar esas filas** — una limpieza de datos no lleva marcha atrás
([[tr-duplicados-saga]]).
