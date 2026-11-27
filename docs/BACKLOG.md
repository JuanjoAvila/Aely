# Backlog oficial — Aely

> Estado a 26/11/2026 (beta servida: 4.26.259; 4.26.260 integrada en local, sin subir). Lista corta y verdadera. Lo antiguo (OPS/SEC/FIN…, ya casi todo hecho) está en [BACKLOG-historico.md](BACKLOG-historico.md): no lo uses como lista de trabajo.
> Subir a producción solo con el OK directo de Juanjo y siguiendo `docs/RELEASE.md`.

## 0. Alcance: beta pública el miércoles 16/12 (decidido por Juanjo, 26/11)

**Entra**

| Qué | Hecho cuando |
|---|---|
| Tests rápidos: menos de 10 min por subida (esta semana) | Una subida a beta se verifica en menos de 10 min sin perder guardianes |
| Los 6 pasos de «Para lanzar» (§2) | Prod subida con su OK directo |
| Los 5 bichos conocidos (§4) | Corregidos o comprobados con test |
| Abrir altas con antiabuso | Cuenta nueva creada de punta a punta, topes desplegados, `0029` aplicada |
| Privacidad mínima: responsable, base jurídica, contacto | Borrador revisado por Juanjo y publicado en es/en/ca |
| Términos de beta gratis | Borrador revisado por Juanjo y publicado |
| Salir de «Restricted Production» de Enable Banking | Solicitud enviada por Juanjo; **el plazo depende de ellos** |

**Condicional:** ahorro en apartados («bolsas») solo si está terminado el **sábado 5/12** (revisado y en beta). Si no, tras la beta.

**Fuera hasta después de la beta:** Play Store, Modo viaje, fase 2 de amortizar.

**Plan por días**

| Fecha | Claude | Juanjo |
|---|---|---|
| J 26 – V 27/11 | Tests rápidos; 4.26.260 a beta; revisión de dinero y privacidad del cliente DIN/SEG | |
| S 28/11 | | Sesión de 15 min: 5 decisiones. Enviar la solicitud a Enable Banking cuando tenga las URL legales |
| D 29/11 | Recoger sus fallos | Seguir probando |
| L 30/11 – M 2/12 | Cliente DIN/SEG a beta; fuentes del servidor a la rama común y revisar el marcador de `bank-sync`; borrador de privacidad y términos (1/12) | Revisar el borrador legal |
| X 2 – V 4/12 | Bichos que quedan; antiabuso de altas (topes, decidir captcha); remates de la APK 65 (ronda B, M1, M2, M4) | OK para desplegar funciones; publicar textos legales |
| S 5/12 | Corte de bolsas: dentro o fuera | |
| 7 – 8/12 | Candidata congelada con todo junto | Prueba única en el móvil (paso 1) |
| X 9 – J 10/12 | Arreglos de esa prueba; subida a prod (paso 6) | OK directo para prod |
| V 11 – D 13/12 | APK 65 (después de prod: exige `checksum` en estable y puente) | Instalarla encima y probar |
| L 14 – M 15/12 | Alta de prueba con cuenta nueva; aislamiento entre dos cuentas; borrar cuenta; vuelta atrás anotada | Abrir altas (15/12) |
| X 16/12 | Beta pública; vigilar errores | Invitar |

**Riesgo principal:** sin contrato de Enable Banking a tiempo, la beta abre **sin conexión de banco** para usuarios nuevos (a mano e importación).

## 1. En marcha

| Qué | Estado |
|---|---|
| 4.26.260 (apartados de ahorro y 5 arreglos de Plan, rama `claude/integra-260`) | Integrada en local; suite en curso; sin subir |
| Tests rápidos (`claude/tests-rapidos`) | En curso |
| Cliente DIN-07/01/04 y SEG-22 (`claude/cliente-din-seg`) | Escrito; falta revisión independiente de dinero y privacidad |

## 2. Para lanzar a prod (en orden)

| # | Paso | Quién / de qué depende |
|---|---|---|
| 1 | Prueba única de todo junto en el móvil (beta) | Juanjo |
| 2 | Servidor DIN/SEG: rama `deploy/din-seg-0032` (migración 0032, `bank-sync` con DIN-04+08, `cp_iban` DIN-01). Pasos y vuelta atrás en `E:\coord-notas\deploy-din-seg-25-11.md` | **Ejecutado el 25/11** según Actions (runs 45671550501 y 45671668077: 0032 aplicada y `bank-sync` desplegada). Falta verificar en móvil. Sus fuentes siguen SOLO en esa rama: desplegar `bank-sync` desde otra lo revertiría |
| 3 | Cliente DIN-07, DIN-01 y SEG-22: aún NO está en beta (rama `claude/cliente-din-seg`); sin cliente, 0032 y `cp_iban` son inertes. Su nota señala un posible fallo del marcador de `bank-sync` ya desplegado (sin verificar contra la BD) | Claude: revisión, y a beta con bump |
| 4 | SEG-22: cambiar la plantilla de email «Reset Password» en Supabase (código `{{ .Token }}`) tras tener el cliente | Juanjo |
| 5 | Decisiones suyas: rotar el token viejo de ingesta (H5 de la revisión E2), migraciones 0029 y 0030 (sin aplicar), APK 65 (necesita `claude/ronda-b`, que no está en la integración; remates M1-M4 de firma OTA, con M3 en `claude/apk65-prep-x`; secreto `OTA_SIGNING_KEY`, que no existe; y estable sirviendo `checksum`, o sea después del paso 6) | Juanjo |
| 6 | Subida a prod | Solo con su OK directo, `docs/RELEASE.md` |

## 3. Después

| Qué | Nota |
|---|---|
| Ahorro en bolsas (Fondo de emergencia, Inversión, Otros) | Entra en la beta solo si está terminado el 5/12 (§0). La suma = «Ahorro al mes»; se cruza con «Metas origen» |
| Mockup «Modo viaje» | Fuera hasta después de la beta |
| Fase 2 de amortizar | Fuera hasta después de la beta |
| Instalar Deno | Para probar los `.ts` de las Edge antes de desplegar `bank-sync` |
| Limpieza de worktrees | Solo con su OK |
| Play Store | Siempre al final (DEC-01); fuera de la beta del 16/12 |

## 4. Bichos conocidos (poco riesgo)

| Bicho | Detalle |
|---|---|
| H1 (P2, dinero) | **Arreglado en la 4.26.259**, en beta: apagar y encender «Restar del presupuesto» el mismo mes ya no acredita dos veces. Falta su prueba en el móvil |
| H2-H4 (P3) | **Arreglado en la 4.26.259**, en beta: la meta cumplida ya no enseña el interruptor. Falta su prueba |
| `quedaPagar` | Sin probar frente a la tarjeta de Recibos en ciclos que cruzan de mes |
| `possibleDup` | Se trata distinto en Plan y en Gastos al netear «otros ingresos» |
| «−260 €/mes» | **Arreglado en la 4.26.261 (H7, PR #365)**: el importe va en un trozo que no se parte. Falta su prueba (paso 11 de `beta-260`) |

## 5. Histórico

Todo lo anterior (OPS, SEC, FIN, PRO, tablas «Hecho», cierres) está en [BACKLOG-historico.md](BACKLOG-historico.md), sin tocar. Antes de reabrir un ID viejo, compruébalo contra `CHANGELOG.md` y el código.
