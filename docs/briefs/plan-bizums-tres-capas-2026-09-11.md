# Plan — Bizums idénticos el mismo día (tres capas)

**2026-09-11 noche.** Diagnóstico cerrado con sus palabras y su tabla. **Sin código todavía.**
Para pedirle OK mañana antes de implementar.

Canal: Cursor `20260911T175500Z` · Claude `20260911T2110Z` / `2125Z`.
Repo: `E:/Mi cartera`. Reglas: `AGENTS.md` — beta primero; migración de índice = OK expreso suyo.

---

## Qué le pasa (medido + confirmado por él)

- Trade Republic: **8** Bizums recibidos de **14,90 €**.
- En la app: **5**. Faltan **3 → 44,70 €** de ingreso.
- Intentó meterlos **a mano** y la app se los comió «como duplicados».
- Los `manual:trade_republic` del 02/09 y 03/09 tienen `created_at` el **06/09 ~21:14–21:16**:
  sesión suya tecleando lo que faltaba. **No** son el mismo cobro por otra puerta.

La fusión **sí** borra ingresos reales cuando el comercio es genérico («Bizum recibido» /
«Movimiento») y el importe+día coinciden. El par `macrodroid` a **38 ms** sí es la misma noti
dos veces: ese colapso es correcto.

El índice único y `mergeExpenses` y `filasComoLaApp` usan la **misma huella**
`día|importe|comercio` (en BD: `user_id, fecha, importe, comercio`). Tres capas, un diseño.

---

## Casos de oro (la tanda tiene que pasar LOS DOS)

| | Debe |
|---|---|
| **APOLLON 230 €** | Wallet 11:31 + banco ~13:08 → **1** fila (mismo cargo, comercio *específico*). |
| **Ocho Bizums 14,90 €** el mismo día | **8** filas (personas distintas, comercio *genérico*). |

Un test que solo mire uno de los dos no vale: es la trampa que nos trajo aquí.

Asimetría: ante la duda, **separar**. De más él borra en dos toques; de menos la app le miente.

---

## Qué NO se recupera

Los Bizums que **nunca llegaron a la tabla** (OB los descartó al insertar, o nunca se apuntaron)
**no van a reaparecer solos**. No hay fila que resucitar. Él los apunta a mano; el Paso 0 hace
que esa vez sí se queden. Decírselo claro cuando apruebe.

---

## Pasos (barato → caro)

### Paso 0 — Manual nunca se fusiona (primer paso suelto)

- Si `source` es `manual` / `manual:*`, la clave de fusión incluye el `id` (o se excluye del
  colapso) en: `keyOf` / `mergeExpenses` / `filasComoLaApp` / lápidas relacionadas.
- Efecto: lo que teclea **sobrevive al pull**. Si también entra el banco, puede ver dos y borrar
  uno — barato y es lo que le dolió esta semana.
- **Sin migración.** Tanda de beta. No arregla solo los que OB nunca insertó.

### Paso 1 — Identidad al insertar OB

- TR: `entry_reference` suele ir null. Candidato: **`balance_after_transaction`** → `ext_id`.
- Fallback documentado: orden en la respuesta (frágil).
- Comercio genérico + token → no depender solo de `(mediodía, importe, Movimiento)`.
- Preferir upsert por `(user_id, ext_id)` cuando haya `ext_id`.

### Paso 2 — Migración del índice (OK expreso suyo; no es tanda de tarde)

- Hoy: `expenses_dedup_idx (user_id, fecha, importe, comercio)` + `ignoreDuplicates`.
- Objetivo alineado con `docs/briefs/arquitectura-identidad-gastos.md`: unicidad por **identidad
  de origen** cuando exista; no falsear fecha/comercio para esquivar el índice.
- Índice parcial `(user_id, ext_id) WHERE ext_id IS NOT NULL`; el dedup clásico solo sin `ext_id`
  y con comercio no genérico (detalle en la tanda de migración).
- Backfill lo que se pueda; lo perdido no se inventa.

### Paso 3 — Misma regla en cliente + widget + ingest

- Comercio **específico** → `día|importe|comercio` (salva APOLLON a 97 min).
- Comercio **genérico** → no colapsar entre fuentes distintas; solo misma fuente con
  `|Δt| < ~60 s` (noti 38 ms).
- Manual → Paso 0.

**No:** meter la hora en la clave global (rompe APOLLON otra vez).

---

## ¿Hace falta migración para el primer alivio?

| Objetivo | ¿Migración? |
|---|---|
| Dejar de comerse los manuales (Paso 0) | **No** — cliente + `filasComoLaApp` (+ tests). |
| Que OB deje de tirar Bizums gemelos al insertar | **Sí** a medio plazo (Pasos 1–2), o al menos cambiar qué se escribe en `comercio`/`ext_id` al insertar sin soltar el índice aún (valorar en la tanda). |
| Widget alineado | Mismo cambio de clave que el cliente (Paso 3); sin migración si solo es lógica de lectura. |

Recomendación: **mañana OK suyo → Cursor implementa Paso 0 en beta** con los dos tests de oro.
Pasos 1–2 en brief aparte cuando haya muestra de `balance_after` en una sync real.

---

## Limpieza aparte (signos volteados)

Tres pares (+/− mismo día/comercio) ya tombstoneados en parte; basura histórica.
**Cursor OK** a que Claude borre la fila sobrante de cada par **si antes pasa los ids exactos
y Cursor confirma**. No es el mismo bug que los Bizums; no mezclar en la misma tanda de código.

---

## Estado

| Pieza | Estado |
|---|---|
| Diagnóstico 8 vs 5 | Cerrado (él + tabla) |
| Plan escrito | Este brief |
| OK suyo al plan | Pendiente |
| Paso 0 en código | No empezado |
| Limpieza signos | Pendiente ids → OK Cursor → Claude ejecuta |
