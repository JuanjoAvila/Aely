# Pruebas beta: reclamación reabierta el 1/10/2026

El usuario vuelve a indicar que beta muestra tandas que, en teoría, ya llegaron a producción. No volver a pedirle sus nombres: están en el chat `01a0f3d7-119f-7073-a027-4a796f1192ff`, mensaje `01a0f3f1-1323-77c3-bef7-36179a0719df`. Este registro conserva títulos y evidencia pública, sin datos ni capturas familiares.

| Título reportado | Comprobación de entrega vigente |
|---|---|
| Arranque con poca conexión | Producción67 no contiene `__mcSplashTimedOut`; beta75 sí. El ámbito web calculado desde main12884f48 es a36616fb… y el de beta4e9d7540…; hay diferencias funcionales en shell e Inicio. No ocultar por su antigüedad. |
| Ayuda de Mi ciclo | El HTML realmente servido en producción no contiene `gastosCycleHelpOff` ni `gastos-cycle-explanation`. La opción de plegar la explicación está en beta, no entregada en la web estable. |
| Widget después de reabrir | La promoción selectiva28/9 retuvo esta tanda con APK51; estable sigue48. Falta cotejo nativo específico antes de cualquier afirmación de entrega completa. |
| Gasto del widget tras una compra | Igual límite de entrega nativa; una aprobación del pago no publica el binario. |
| Clasificación de gastos bancarios | Agrupa cliente, fuente bancaria y receptor nativo; la promoción web retuvo esa tanda. Separar las superficies antes de declarar entrega completa. |
| Banco del widget | Selector nativo APK51 retenido; no dar por entregado por versión web. |
| Widget con la app cerrada | APK51 retenida; requiere además pruebas de su superficie servidor y del pago real que correspondan. |

Fuentes públicas de la entrega: [acta de promoción28/9](promocion-aprobadas-2026-09-28.md), [acta Deudas67](inc-2709-02-prod.md) y [cotejo HTTP de esta mañana](coordinacion-nocturna-2026-09-30.md). El coordinador descargó los ZIP declarados por ambos manifiestos y cotejó HTML/SW/apk.json. Producción67 no ofrece el registro nuevo de entregas (404); beta75 sí lo incluye. Un recibo ausente no se sustituye por una aprobación ni por un número de versión.

La primera explicación del coordinador atribuyó el síntoma al404 antes de identificar filas; esa atribución fue prematura. La evidencia actual apunta a entregas incompletas y a una presentación que no las explica. La auditoría del panel sigue abierta; no se declara corregido por tener CI verde.

Responsable: chat `01a0f419-3825-7550-be70-37e4e0cb320e`, misma tarea/worktree. Recuperar los últimos veredictos aplicables: rechazo/retirada más reciente manda; código distinto requiere revisión nueva. No inventar aprobación remota si falta acceso. Distinguir aprobación pendiente de entrega y revisión nueva, y probar el DOM con producción67 sin recibo, conservando lo genuinamente pendiente. Si ninguna de estas siete está completamente entregada, decirlo y corregir la explicación; no borrarlas para aparentar una limpieza.

El usuario autorizó conservar este reporte en memoria. Su contenido operativo queda también aquí, accesible desde cualquier sesión. La ventana nocturna terminó; este nuevo encargo se limita a la reclamación del panel, sin promoción de beta completa, APK, Edge, SQL ni cambios de dinero real.
