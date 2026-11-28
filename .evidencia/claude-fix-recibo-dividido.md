# fix-recibo-dividido (28/11/2026)

**Síntoma**: recibo compartido (20,99 € de banco, tu parte 5,27) salía a 20,99 en la fila de
«Tus recibos» y en la cabecera de «Editar el recibo».

**Prod vs beta**: `proximo`/`fila` y la cabecera `sum-amt` son idénticos en origin/main y beta
(fad97db56). La diferencia entre los dos recibos del dueño son los DATOS, no el código.

**Causa**
1. Fila: el mes en curso ya estaba pagado ENTERO antes de compartir; «Desde ahora» lo congeló en
   `soloMes[ym]={amt:20.99}` sin `reparto`, y `occAmountIn` devuelve ese 20,99 para la fila.
2. Cabecera del editor: pintaba `amtTxt` = lo que cobra el banco (el importe que se teclea).

**Arreglo** (src/modules/14-v4-screens.js): la fila de un compartido vigente ignora el `soloMes`
congelado sin reparto; la cabecera enseña `rr.mia` (tu parte). La fila «Importe» sigue a 20,99.

**e2e** `e2e/recibo-dividido.spec.mjs` (es+ca × recién compartido / mes pagado congelado):
antes 4 failed (Received «20,99 €»); después 4 passed. En E2E_MAP (14, 07, 08).
Recibos de E2E_MAP (36 specs): 226 passed. `npm run test:syntax`: EXIT 0.

**Puntito verde**: no se reproduce con el despliegue (mostrar deja el botón 8 px bajo el borde).
Es el descendente de la «p» de «Més opcions» asomando bajo el borde del cuerpo al hacer scroll a
mano: recorte normal de scroll; arreglarlo pide una máscara en `.rp4-body` (no barato). Sin tocar.

**Nota sin arreglar**: Esbart 45 € «cada dos meses» suma 7,50/mes = 45·2/12: `fixedMonthlyOf`
cuenta los `months` marcados (2) en vez de los 6 del bimestral. Revisar sus `months` guardados.
