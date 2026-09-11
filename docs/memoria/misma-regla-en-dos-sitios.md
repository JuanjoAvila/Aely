<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (misma-regla-en-dos-sitios.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: misma-regla-en-dos-sitios
description: "Cuando una regla de dinero corre en cliente Y servidor, el test debe cargar LAS DOS y exigir el mismo número"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 272a31c7-fc62-419e-a958-cac67b02f7a5
  modified: 2026-09-11T16:18:42.891Z
---

**2026-08-06.** Le saltó «¡95% del presupuesto! 965 € de 1.000 €» en la noti y en el widget, y al
abrir la app no llegaba al 30%. Las dos cifras salían de la MISMA nube.

Causa: `monthBudgetStats()` (cliente) descarta bancos que no son de gasto diario, categorías neutras
(inversión/traspaso) y resta lo reservado; `ingest` sumaba **todas** las filas del mes. Nadie las
había mantenido alineadas porque **nada las obligaba a estarlo**.

**Why:** un test de constantes se queda verde cuando alguien cambia una implementación y se olvida
de la otra — que es exactamente cómo nació el bug. El widget y las notis se pintan con la app
cerrada, así que el servidor no puede reutilizar el JS del bundle: la regla vive dos veces a la
fuerza.

**How to apply:** el test carga LAS DOS implementaciones (el cliente con
`loadPureLogicFromFile()`, el `.ts` del servidor con `esbuild`) sobre el MISMO escenario y exige el
mismo resultado. Escribir el movimiento UNA vez y traducirlo a los dos formatos, si no el test puede
pasar con dos escenarios distintos y no probar nada. Comparar redondeando a céntimos: el servidor
redondea (sus cifras van a una noti) y el cliente arrastra el float crudo.

Ver `tests/presupuesto-servidor.test.mjs`. Mismo patrón aplicable a cualquier regla de dinero
duplicada. Y verificar siempre contra su nube real antes de darlo por bueno
([[feedback-de-uno-en-uno]]): aquí el número de la noti (964,58 €) se reprodujo clavado.

⚠ Trampa relacionada: `toEurAmt()` dice «no inventar tipo» pero **devuelve el número crudo** sin
tipo de cambio, o sea que aplica un 1:1. El freno real está en el botón de guardar. Cualquier
conversión nueva necesita su propio freno.

---

## 2026-09-11 — TRES veces el mismo día, y una le enseñaba a su padre un saldo falso

**No son dos sitios: eran SEIS.** El comentario de `saldoCuentaGasto` (`00-core.js`) ya avisaba
—*«vivían copiadas en cinco sitios; si se cambia dynBal y no las inversas, teclear el saldo guarda
un número torcido»*— y por eso existe `valueDesdeSaldo`, la inversa canónica.

1. **El saldo de su padre.** `applyBankBalances` era la **sexta copia sin migrar**: al re-anclar
   restaba `spentM` = **el gasto del mes de TODOS los bancos**, mientras que al pintar se resta
   solo `spentByBank[ent]`. Su padre gasta con Caixa y TR, así que a Revolut se le devolvían
   gastos ajenos: el banco decía **26,46 €** y la app le enseñaba **455,50 €**. Arreglado en
   4.19.57 llamando a `valueDesdeSaldo` + `gastoDelMesPorBanco`. **Y el mismo fallo ya se había
   arreglado en agosto… solo en la mitad que pinta** (un cargo de Revolut se comía 257,17 € de TR).
2. **`dailyEnt` se deriva de dos maneras**: al pintar `find(a => a.spendFrom)`, al re-anclar
   `find(accDaily)` — y `accDaily` NO mira `spendFrom`. Hoy coinciden en los tres usuarios (lo
   comprobé con sus datos), pero se separan en cuanto alguien ponga «Todo» sin esa marca vieja.
3. **Casi cometo la séptima** al duplicar `marcaDeInversion` en `scripts/logos-inversiones.mjs`.
   Se evita con `load-pure-logic.mjs`, que es el mecanismo que el repo ya tiene para esto: la
   regla vive en `00-core.js` y el script la CARGA.

**La regla de oro que sale de aquí:** antes de escribir una fórmula inversa a mano, buscar si ya
existe (`valueDesdeSaldo`, `gastoDelMesPorBanco`). Y el test tiene que sembrar **DOS bancos**: con
uno, todas estas versiones pasan igual de bien estando rotas.
