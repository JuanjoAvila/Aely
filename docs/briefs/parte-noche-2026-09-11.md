# Parte de la noche del 10 al 11 de septiembre

Para Juanjo al levantarse, y para que Cursor o cualquier sesión nueva retome sin preguntar nada.

---

## Lo primero, porque cambia el plan del día

**Producción le estaba borrando gastos a la familia.** No es una hipótesis: `pullExpenses` en
`main` (4.18.8) bajaba los gastos con un `.limit(2000)` sin paginar **y sin `id` en el orden**, y
`syncCloudExpenses` reemplaza los gastos de origen `supabase` por lo que acaba de llegar. Con más
de 2.000 gastos en la nube —lo normal en cuanto importas el histórico de un banco— **cada
sincronización borraba de la app los más viejos**. A su padre y a su pareja también.

Su queja del 10/9 («solo baja el histórico de Revolut un poquito y de Trade Republic») era esto,
y no el importador. Está arreglado y esperando su OK.

---

## Lo que hay listo y espera SOLO su sí

### `integra/prod-11sep` @ `06b65184` · **4.18.14** · suite entera exit 0, 148 e2e

Seis tandas que él ya había aprobado, portadas **una a una desde `main`** como pidió desde el
principio, integradas y verdes. Es el rescate de las aprobadas que llevaban desde el 9/9 sin poder
llegar a la familia porque yo las commiteé mezcladas en beta.

| versión | tanda | qué le arregla |
|---|---|---|
| 4.18.9 | FIN-07 | el histórico entero al sincronizar; y una descarga a medias ya no borra |
| 4.18.10 | multicuenta | entran los movimientos de las DOS cuentas de un banco, no solo de la primera |
| 4.18.11 | posible-repetido | los posibles repetidos de Open Banking se revisan, no se pierden |
| 4.18.12 | notas fuera del bundle | la app pesa un 11 % menos y abre antes |
| 4.18.13 | categoría IA | las suscripciones de IA dejan de contar como Ocio |
| 4.18.14 | orden del día | arrastrar el asa ⠿ para ordenar los gastos del mismo día |

**Falta su OK para tocar `main`.** `main` es suyo; yo no lo toco.

### `tanda/fin07-historico` @ `3b7f7804` · 4.18.9
La misma corrección de FIN-07, sola y desde `main`, por si quiere subir **solo eso** y dejar el
resto para después. Es la opción prudente si quiere que la familia tenga ya el arreglo de los
gastos sin nada más encima.

---

## Lo que ya está arreglado en la beta que tiene en el móvil (4.19.35) y él no ha probado

Rechazó cinco cosas el 10/9 por la mañana, en la **4.19.22.1**. Cuatro de los arreglos entraron
**ese mismo día por la tarde**, en la 4.19.26 y la 4.19.27. Nunca ha probado la versión arreglada.

- **Modo inicial** («entra sin más al banco de pruebas», «no resetea nada»). Verificado ejecutándolo
  esta noche contra su escenario real: entrar vacío deja 0 gastos, presupuesto 0, onboarding de la
  primera vez; vaciar desde dentro también; volver a copiar la real también. **Y su cartera real
  queda intacta en los tres casos** (40 gastos y 500 € de presupuesto, antes y después).
- **El histórico «todo negro» y «ver 35 más» que no hacía nada.** Arreglado y con dos e2e que lo
  vigilan; ejecutados: 2/2.
- **Mantener pulsado un gasto y que la app se vuelva loca.** 2 e2e, verdes.
- **Quitar un banco y que no cambie nada.** 6 e2e verdes, e incluye lo que pidió de distinguir si
  Trade Republic falla por Open Banking o por su propia API.

**Qué puede probar por la mañana:** todo eso. Es el grueso de lo que rechazó.

---

## Lo único que sigue bloqueado, y por qué

**El despliegue de `ingest`.** Verificado esta noche con el token de solo lectura:

```
ingest    desplegada 2026-08-17 21:08    24 días de atraso
          propio, sin desplegar: f0698252 fix(presupuesto): misma ventana de mes en app e ingest
```

El servidor calcula el mes con una regla distinta a la de la app. **Eso es el 475 € del widget**, y
mientras siga así hay dos tandas que él no puede aprobar aunque estén bien: `4.19.2/ventana-mes` y
`widget-coherente`. Desplegar toca producción y **necesita su OK expreso**; el plan está en
`docs/briefs/plan-despliegue-edge-2026-09-10.md`.

**`4.19.4/arranque-suelto` NO se porta**, y esto lo cazó Cursor: depende de `inicioDeMesMs`, que
viene de la ventana de mes que él **rechazó**. Portarla habría colado a la familia justo lo que él
tumbó. Está aprobada pero no es portable hasta que la ventana de mes se apruebe.

---

## Cosas que se rompieron por el camino y conviene no repetir

- **Un merge puede comerse una llave de cierre sin decir nada.** `moveExpenseWithinDay` se quedó sin
  `}` y el bundle no compilaba. Lo cazó `check-syntax`.
- **Dos `var RELEASE_NOTES=` en el mismo módulo:** en JS gana el segundo, así que el histórico
  pegado no lo leía nadie y solo pesaba. De rebote, **dos notas de versión de tandas aprobadas se
  quedaban fuera de Novedades**: habrían subido a producción sin que la familia viera qué cambió.
- **Dos guardianes se habrían quedado ciegos** al mover las notas a JSON: `docs-frescura` seguía
  mirando el módulo (con el array vacío a propósito, habría pasado siempre) y `release-notes-max`
  clavaba a mano versiones de beta que en producción no existen. Los dos arreglados.
- **Cinco comentarios se perdieron** al pasar las notas a JSON, que no admite comentarios. Llevaban
  la práctica de la casa (una tanda aprobada se BORRA del array, los puntos no se reescriben entre
  compilaciones, lo ya promocionado no se vuelve a contar). Rescatados al módulo.
- **El puerto 4173 fijo** sigue siendo una trampa en cualquier rama nacida de `main`: con varios
  worktreesa la vez, los e2e pueden pasar enteros contra el bundle de otro checkout. Portado el
  puerto por checkout a todas las ramas de esta noche.

---

## Estado de las ramas

| rama | qué es | estado |
|---|---|---|
| `integra/prod-11sep` | la ronda de prod, 6 tandas | **lista, espera su OK** |
| `tanda/fin07-historico` | FIN-07 solo, desde main | lista |
| `prod/multicuenta` `prod/posible-repetido` `prod/categoria-ia` `prod/orden-gastos` | portes de Cursor | revisados ejecutando, ya integrados |
| `prod/notas-json` | recorte de Novedades | ya integrado |
| `tanda/fin07-paginado` | mi primer intento de FIN-07, sobre beta | **muerta**, no mirar |
| `beta` (4.19.35) | lo que tiene en el móvil | publicada, pendiente de que la pruebe |

Cursor sigue portando `panel-ronda` y `notas-20`.
