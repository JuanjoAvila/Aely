# FIN31: moneda y valores desconocidos en Cartera

Candidato sobre beta **4.26.160**, `66c13084257fd576444a01cb529c5e6e815c6ec6`.
La base era la beta remota al arrancar. No se persigue otra beta ni se incorpora
el trabajo de PR289; Claude integra ambos candidatos. No es entrega servida ni aceptación móvil.

## Comportamiento

- Un bróker con algún valor sin conversión muestra `—`, con «Sin conversión».
  El total de inversiones y el total de Cartera que incluye esa parte también
  quedan desconocidos, como Inicio. Se conservan los originales visibles en la
  posición, las cuentas conocidas y el cero real. Si se excluye la parte
  desconocida mediante la selección de Cartera, el subtotal conocido sí se muestra.
- Tus inversiones inicia en la moneda global y permite EUR, USD y GBP con opción
  seleccionada. También representa una moneda inicial distinta con su símbolo o
  código. La selección local no cambia Ajustes. Sin cambio para la moneda local,
  muestra `—` y el aviso existente, sin etiquetar euros como libras.
- Proyección usa la moneda local para aporte, eje, principal, valor futuro,
  contribución y ganancia. Las series y el deslizador siguen calculándose en EUR.
  Sin principal completo o cambio de visualización no fabrica una proyección.
  Un aporte guardado de cero sigue siendo cero; mover el simulador no lo guarda.

No cambian importes, costes, identidades, FX, importación, sincronización ni widget
nativo. El cambio de formato del resumen coincide parcialmente con la zona de
FIN22: se ha implementado desde esta base y su integración con PR289 corresponde a Claude.

## Evidencia dirigida

Tres ROJOS reales sobre el artefacto de la base: `0 €` en vez de `—`,
`1485,90 €` en vez de `1188,72 £` y `150 €` en vez de `187,50 $`.
El HTML causal se conserva con SHA-256 idéntico al servido en los tres intentos.

Siete pruebas únicas de navegador pasan con un worker, cero reintentos y parada
al primer fallo; cuatro principales y tres casos límite. Una repetición adicional
solo corrige la captura tomada durante la transición, y no aumenta la cobertura.
Se conservan también las capturas anteriores deficientes. Datos sintéticos,
red limitada al servidor local propio y comprobación de devolución del puerto.

Oráculos independientes: USD→EUR=0,8, GBP→EUR=1,25; inversiones 148590 céntimos EUR,
118872 céntimos GBP; patrimonio 223590 céntimos EUR. Con aporte 150 EUR/mes,
dos años al 0% dan 508590 céntimos EUR; el aporte mostrado es 187,50 USD o 120 GBP.
Se comprueban las filas completas y los tipos guardados antes/después de cambios
y recarga, y controles de cero, bróker mixto y falta exclusiva del cambio de destino.

FX, seguridad, mapa, sintaxis, privacidad y presupuesto: EXIT0. Tamaño minificado
1427 KiB/1429, gzip 396 KiB/399; tres ficheros bloqueantes de tres permitidos.
Catálogo160 dirigido: EXIT1, dependencias adicionales de `limpieza-ajustes-perfil`:
`00-core.js:CUR_SYM`, `00-core.js:eur`, `00-core.js:fromEurAmt`.
El gate docs-frescura se registra sobre el commit final en el informe privado.

VERSION, notas, catálogo y límites quedan reservados a integración. No se ejecuta
la batería general de mutaciones del catálogo, suite completa, CPU6, CI general,
banco/nube reales, SQL/Edge/API, APK, despliegue o merge. No ProductREADY.
