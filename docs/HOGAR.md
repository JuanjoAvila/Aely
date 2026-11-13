# Hogar compartido (Fase 1 + 2)

> **Dónde está (desde v4.10.0):** toca tu **avatar en Inicio** → Perfil → sección **«Tu gente»**.
> (Antes: al final de Cartera en 4.6.1 —donde no lo veía nadie— y en Ajustes → Conexiones en 4.1.0.)
> Con la nav v4 (4 tabs + FAB) la pestaña «Compartido» desapareció y esta pantalla quedó
> huérfana hasta la 4.1.0. Ahí viven el Hogar (esta doc) Y los grupos de gastos compartidos
> (crucero, cenas…). Toda mención antigua a «Compartido → …» = esa pantalla de Ajustes.

## Qué hace

Como la cuenta conjunta de CaixaBank, pero **sin mezclar datos**:

1. Persona A crea un **Hogar** → recibe código de 6 letras
2. Persona B entra en **Hogar y compartido → Unirme con código**
3. Cada uno pulsa **Actualizar mi vista** → publica un snapshot (patrimonio, cuentas)
4. Todos ven la **suma fusionada** + detalle por miembro (solo lectura)

Des-compartir = salir del hogar (borra tu snapshot, no toca el `app_state` del otro).

## Migraciones Supabase

1. `0013_households.sql` — tablas del hogar (una vez).
2. `0014_household_rls_no_recursion.sql` — **si ves**  
   `infinite recursion detected in policy for relation "household_members"`  
   pégalo en **SQL Editor → Run** (arregla las políticas RLS).
3. `0015_household_policies_rebuild.sql` — **si ves**  
   `new row violates row-level security policy for table "households"`  
   (error real del 2026-07-18 al crear un hogar): reconstruye TODAS las políticas de
   las 3 tablas (a la BD le faltaba la de INSERT) y además deja visible el hogar recién
   creado para su creador. Idempotente.

> **Desde 2026-07-18 el CI aplica las migraciones solo** (workflow «Deploy Supabase»,
> `db push --include-all`; antes abortaba en silencio por las dos «0012» aplicadas a mano).
> Plan B si el CI no puede: pegar el fichero en **SQL Editor → Run**.

## Probar con dos cuentas

1. Cuenta A: Ajustes → Conexiones → Hogar y compartido → Crear hogar → copia el código
2. Cuenta B (otro email): misma pantalla → Unirme → código
3. Ambas: **Actualizar mi vista**
4. Deberíais ver patrimonio sumado

## Fase 2 (v3.110+)

Al pulsar **Actualizar mi vista**, el snapshot incluye también:

- gastos del mes por categoría (sin comercios)
- total de fijos + top 5 fijos por miembro

La UI del hogar muestra gasto fusionado y barras por categoría. **No hace falta otra migración SQL.**

## No confundir con las personas de Recibos (tanda 5, 31/10/2026)

Plan › Recibos › Todos › **Personas** (con quién compartes un recibo, «Te deben», «Lo descuento»)
no es el Hogar: no usa sus tablas ni su sincronización. Las personas viven dentro de los recibos
(`reparto` en `state.fixed`, viaja en `app_state`). El resumen que publica «Actualizar mi vista»
no cambia: el total de fijos sigue siendo tu parte de cada recibo, como antes.
