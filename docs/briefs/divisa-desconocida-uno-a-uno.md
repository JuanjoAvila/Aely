# Una divisa sin tipo de cambio se cuenta como si fuera euros

> Encontrado el 2026-09-08 auditando los espejos cliente/servidor, después de que ese mismo
> barrido cazara la fecha corrupta de `reservaLog` y el «Douglas» de las categorías.
> **No es una hipótesis: son dos implementaciones de la misma conversión que no coinciden.**

## Los dos lados, uno al lado del otro

```js
// CLIENTE — src/modules/00-core.js:332
function toEurAmt(amount, cur, s){
  const r = fxTableOf(s)[c];
  if (r > 0) return n * r;
  if (c === "USD" && s && s.fx > 0) return n * s.fx;
  return n;                    // ← «divisa desconocida: no inventar tipo»
}
```

```ts
// SERVIDOR — supabase/functions/_shared/wallet.ts:127
export function aEuros(importe: number, divisa: string, data: any): number | null {
  const r = Number(data?.fxRates?.[cur]);
  if (!(r > 0)) return null;   // ← sin tipo, no hay cifra
  return +(Number(importe) * r).toFixed(2);
}
```

Tres diferencias, y la primera importa de verdad:

1. **Sin tipo de cambio, el servidor devuelve `null` y el cliente devuelve el importe crudo.**
   El comentario dice «no inventar tipo», pero devolver `n` **es** inventarse un tipo: 1:1. Una
   compra de 500 liras se pinta como 500 €. El servidor, en el mismo caso, no da cifra.
2. El cliente tiene un apaño extra para USD (`s.fx`) que el servidor no tiene.
3. El servidor redondea a céntimos; el cliente arrastra el float.

## Cuándo le pasa

`fxRates` vive en su estado y se rellena al traer los tipos. Basta con que pague en una divisa que
no esté en la tabla —o antes de la primera descarga de tipos— para que la app cuente 1 unidad = 1 €.
En el crucero pagó en liras, así que este camino no es teórico para él.

## Lo que NO se puede hacer sin decidir

Cambiar el cliente a `null` a secas rompe a los que llaman: `toEurAmt` alimenta sumas de patrimonio
y de coste, y un `null` ahí se convierte en `NaN` y contamina la pantalla entera. Por eso no lo he
tocado sobre la marcha: hay que elegir qué enseña la app cuando no sabe el cambio.

Tres caminos, con su coste:

- **A. Dejar la cifra cruda pero MARCARLA** («500 ₺ · sin tipo de cambio») y no sumarla al total en
  euros. Honesto y no rompe nada, pero hay que tocar cada sitio que suma.
- **B. Pedir el tipo al vuelo** cuando aparece una divisa nueva. Arregla la causa, pero mete una
  llamada de red en un camino que hoy es puro cálculo.
- **C. Igualar al servidor** (sin tipo, no hay cifra) y blindar a los que llaman para que un gasto
  sin convertir no rompa la suma. Es lo más coherente, y lo más caro.

## Lo que sí es barato y va aparte

Alinear el redondeo y el apaño de USD, que son las diferencias 2 y 3. Eso se puede hacer ya y
reduce el ruido cuando se compare de frente.

## Test que hay que escribir en cualquier caso

`toEurAmt` y `aEuros` sobre la misma tabla de tipos y las mismas divisas —EUR, USD, TRY conocida,
y una desconocida— tienen que dar el MISMO número, o el mismo «no lo sé». Hoy no hay ningún test
que las cruce; es la misma familia que el bug de los 965 € y que el «Douglas» de las categorías.
