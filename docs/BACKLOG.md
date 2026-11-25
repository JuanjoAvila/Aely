# Backlog oficial — Aely

> Estado a 25/11/2026 sobre la **4.26.258** (beta). Lista corta y verdadera. Lo antiguo (OPS/SEC/FIN…, ya casi todo hecho) está en [BACKLOG-historico.md](BACKLOG-historico.md): no lo uses como lista de trabajo.
> Subir a producción solo con el OK directo de Juanjo y siguiendo `docs/RELEASE.md`.

## 1. En marcha

| Qué | Estado |
|---|---|
| 4.26.258 en beta: «Ya pagados» solo con prueba bancaria | Hecho, en beta |
| Icono «i» en Recibos, Deudas y Metas | Hecho, en rama (aún no en beta) |
| Cascada «A dónde va tu sueldo» (4 arreglos) y «ahorro al mes» dentro de la hoja del presupuesto en curso | En marcha |
| Capturas de errores de Juanjo | Pendientes de su envío |

## 2. Para lanzar a prod (en orden)

| # | Paso | Quién / de qué depende |
|---|---|---|
| 1 | Prueba única de todo junto en el móvil (beta) | Juanjo |
| 2 | Servidor DIN/SEG: rama `deploy/din-seg-0032` (migración 0032, `bank-sync` con DIN-04+08, `cp_iban` DIN-01). Pasos y vuelta atrás en `E:\coord-notas\deploy-din-seg-25-11.md` | Juanjo (o con su OK); nada ejecutado |
| 3 | Cliente DIN-07 y DIN-01 y SEG-22: aún NO están en beta (ramas `claude/din-07-lapidas`, `din-01-iban`, `seg-22-recovery-otp`); sin cliente, 0032 y `cp_iban` son inertes | Claude: cherry-pick a beta con bump |
| 4 | SEG-22: cambiar la plantilla de email «Reset Password» en Supabase (código `{{ .Token }}`) tras tener el cliente | Juanjo |
| 5 | Decisiones suyas: rotar el token viejo de ingesta (H5 de la revisión E2), migraciones 0029 y 0030 (sin aplicar), APK 65 (con remates de firma OTA M1-M4) | Juanjo |
| 6 | Subida a prod | Solo con su OK directo, `docs/RELEASE.md` |

## 3. Después

| Qué | Nota |
|---|---|
| Ahorro en bolsas (Fondo de emergencia, Inversión, Otros) | La suma = «Ahorro al mes»; enlazadas a meta o Cartera; versión aparte; se cruza con «Metas origen» |
| Mockup «Modo viaje» | Sin respuesta de Juanjo |
| Fase 2 de amortizar | |
| Instalar Deno | Para probar los `.ts` de las Edge antes de desplegar `bank-sync` |
| Limpieza de worktrees | Solo con su OK |
| Play Store | Siempre al final (DEC-01) |

## 4. Bichos conocidos (poco riesgo)

| Bicho | Detalle |
|---|---|
| H1 (P2, dinero) | Meta con el interruptor «Restar del presupuesto» apagado y encendido en el mismo mes acredita dos veces (motor de reservas) |
| H2-H4 (P3) | Meta ya cumplida: el interruptor parece encendido aunque no reserva nada |
| `quedaPagar` | Sin probar frente a la tarjeta de Recibos en ciclos que cruzan de mes |
| `possibleDup` | Se trata distinto en Plan y en Gastos al netear «otros ingresos» |
| «−260 €/mes» | Con letra enorme se parte la línea en la hoja de deuda (usar espacio duro en `cap` de `18-plan-deudas-metas.js`) |

## 5. Histórico

Todo lo anterior (OPS, SEC, FIN, PRO, tablas «Hecho», cierres) está en [BACKLOG-historico.md](BACKLOG-historico.md), sin tocar. Antes de reabrir un ID viejo, compruébalo contra `CHANGELOG.md` y el código.
