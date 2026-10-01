# OPS-0110 · Pruebas: revisión y entrega

Candidata76 preparada desde beta `ca7b97d438e01f60091a3818fdca734740ec8a9e`, mismo chat y worktree del panel75. Solo panel; no promoción a main, APK, Edge, SQL ni cambio financiero. El coordinador revisa SHA/CI exactos antes de publicar beta.

## Las siete tandas reportadas

La reclamación original conserva los nombres: mensaje `01a0f3f1-1323-77c3-bef7-36179a0719df` del chat `01a0f3d7-119f-7073-a027-4a796f1192ff`. No confundir una tanda aprobada con una entregada.

| Tanda | Cotejo real de entrega | Compatibilidad del resultado anterior |
|---|---|---|
| Arranque con poca conexión | HTML estable67 sin `__mcSplashTimedOut`; ámbito main a36616fb… distinto de beta4e9d7540… | Código idéntico a su referencia aprobable; admite conservar OK si el último veredicto aplica. |
| Ayuda de Mi ciclo | Estable sin `gastosCycleHelpOff` ni `gastos-cycle-explanation`; plegado actual solo en beta. | Igual límite de veredicto real. |
| Widget después de reabrir | Retenido en promoción28/9 para APK51; estable48. | Cambio web respecto al código anterior; exige revisión nueva. |
| Gasto del widget tras una compra | Entrega nativa retenida; Edge actual sin acreditar en esta auditoría. | Cambio web; historial conservado, sin reutilizar OK. |
| Clasificación de gastos bancarios | La promoción retuvo cliente/receptor/servidor; APK estable48 no entrega revisión51. | Fuente idéntica a referencia, sujeto al último veredicto aplicable. |
| Banco del widget | Selector nativo51 retenido, estable48. | Cambio web, revisión nueva. |
| Widget con la app cerrada | Nativo51 retenido; Edge actual no acreditado aquí. | Cambio web, revisión nueva. |

Ninguna tiene entrega completa acreditada. El [acta selectiva28/9](promocion-aprobadas-2026-09-28.md) promovió cuatro tandas web y retuvo cinco nativas; no se repromocionan por esta reclamación. La ausencia de recibo no demuestra por sí sola un bug ni autoriza ocultar filas.

## Artefactos servidos y DOM

- Producción: manifiesto web4.26.67, APK4.26.32/code48, `beta-delivery.json`404. ZIP declarado SHA256 `4cc6e0ba97a2c9e7c23ece6affbfa23677fae920bc9413532631121f0e547b6d` (HTML también cotejado por el coordinador contra Pages).
- Beta: manifiesto4.26.75.1/source20d068e03569117b, APK4.26.55/code51. ZIP SHA256 `768c36bb71a9dcc890f3386f5d628aa94b8c998a6a454c88024fb980530a7502`, recibo dentro del ZIP/sourceca7b97d4. No existe como asset separado.
- DOM del ZIP beta75 con respuesta de producción67/48 y404 reales: diez filas, siete reportadas más Panel75, Recibos74 e Inicio73. Con aprobaciones SINTÉTICAS de la referencia auditada, tres quedan aprobadas/plegadas y cuatro abiertas con cambio web. Esto prueba reglas, no el estado remoto del usuario.
- Sin `.env.local` ni clave de servicio en este worktree/proceso. No se leyeron últimos `app_events` remotos ni se presume un OK vigente. No se consultaron datos financieros. Tampoco se acredita despliegue Edge por Git.

## Defecto reproducido y solución

El filtro moderno solo retiraba entregas si la nota tenía versión menor o igual a producción. RED Node y DOM contra ZIP75: aun con web/nativo/Edge exactos acreditados, las siete permanecían porque notas68/69 eran posteriores a67. GREEN del candidato: el recibo exacto retira por código con independencia del número; permanecen Panel, Recibos e Inicio sin acreditar. Deduplicar antes de filtrar evita que reaparezca una revisión antigua del mismo ID. Legacy sin código conserva la regla previa por versión.

Un único `betaEstadoEntrega` alimenta filtro y explicación. La fila visible, incluso plegada, separa aprobación conservada, código cambiado, publicación pendiente y entrega sin confirmar por superficie. APK estable48 frente a requisito51 se explica como publicación Android pendiente; sin recibo web/Edge se expresa falta de confirmación. No se falsifican veredictos, recibos ni referencias históricas.

## Verificación

- Lease24 del coordinador; Chromium un worker y dinero sintético. RED de presentación contra ZIP75; RED del filtro Node y DOM es/en/ca. GREEN focal6/6 sobre el candidato.
- Node filtrado16/16 y veredictos26/26. Primera DOM55:50/55, cinco fallos de fixtures; se corrige idioma persistido y recibos solo para los siete IDs humanos (historial no equivale a entrega). No se acomodan expectativas a2 ni español.
- DOM final sobre fuente76:55/55 PASS,31,8s,0skip/0flaky/0retry, es/en/ca y dinero sintético. RED del ZIP75:3/3 fallan porque quedan diez filas pese a acreditar exactamente los siete IDs; GREEN conserva las otras tres por identidad.
- Node completo128,1s: dos fallos, `memoria-espejo` por espejo externo desfasado y duplicado del guion75/76. Se traslada el único guion a76 dejando `tandas:[]` y Novedades75; test de duplicados, filtrado16, veredictos26 y docs repetidos: PASS. No se modifica ni omite la guardia de memoria en CI. Deno no instalado localmente: pendiente CI, igual que la suite completa de navegador.
- La metadata pública de los siete IDs es byte a byte equivalente como JSON a la del ZIP beta75. No se alteran referencias/alias/historial para maquillar la reclamación. Fuente final solo cambia panel/i18n, notas, documentos y tests de este objetivo.
- CI exacta y publicación76 pendientes; prueba móvil pendiente incluso tras CI/publicación.
- A/B75:1.278.280 B min /347.946 B gzip9. Candidato antes de sello:1.279.382 /348.250; +1.102 /304 B, supera topes por406/90 B. Coordinador autoriza ampliación mínima a1250/341 KiB. Medida sellada76.1:1.279.388 /348.256 B; márgenes612 /928 B respecto a1250 /341 KiB. El sello usa el SHA de base para medir antes del commit, sin atribuirlo a una publicación. Sin dependencias/CDN ni recortar contratos.

No se inicia otro objetivo en este chat. Publicación de las cinco tandas nativas y cotejo Edge/pago real continúan pendientes fuera de este cambio.
