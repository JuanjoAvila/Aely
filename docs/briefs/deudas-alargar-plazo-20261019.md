# Deudas: alargar el plazo al bajar la cuota

Candidata sin integrar sobre `656194916c61e8fd6d3ca50450d072d2980784e1` (beta 4.26.145). La reproducción inicial procede de `7090802099ac0c7956c0d3597a9936a82c52a95f`; el módulo de edición no cambió entre esas bases. Revisión, CI, publicación y aceptación móvil pendientes.

En Plan → Deudas → Editar, una bajada de cuota que FIN16 rechaza ofrece «Alargar el plazo a N meses». El cálculo usa los mismos céntimos, amortización y redondeo hacia arriba del recálculo existente. El botón solo cambia el plazo del borrador; Guardar sigue pasando por FIN16 y por la comprobación de estado fresco. No se alarga nada automáticamente. El número es el plazo total, incluidas las cuotas ya pagadas, como indica el campo.

El saldo pendiente, cuotas pagadas, `paidYm`, identidades, enlaces y pruebas de pago se conservan. El ancla `value` y la amortización ligada a la cuota se ajustan mediante el guardado ya existente para conservar el saldo; no se congelan esos campos a costa de cambiar el pendiente. Las amortizaciones distintas de la cuota conservan su comportamiento. La última amortización parcial y el pago final siguen el modelo lineal vigente.

## Límite acordado

La consulta `ef260103` constató que FIN16 no calcula cobertura de intereses: usa amortización lineal y no incluye la TAE en su fórmula. La aclaración `62d20aa2` autoriza la propuesta lineal y deja **fuera de alcance** detectar cuotas que no cubren intereses. Para deudas antiguas sin amortización conocida y con TAE positiva, el rechazo muestra una explicación es/en/ca y no ofrece un plazo. No se introduce una fórmula de intereses ni se cambia la validación al subir la cuota.

## Verificación

- RED en pantalla real: bajar 200 a 100 con pendiente 1.200 y plazo total 10 conserva datos y muestra el error, pero falta el botón para 16 meses.
- 22 contratos Node: meses/céntimos exactos, umbrales de 99,99/100/100,01, última fracción, pago final, amortización explícita, nula o distinta, TAE heredada, borradores y límites numéricos. Los 62 controles existentes de plazo/cuota siguen pasando.
- Siete E2E nuevos: elegir y guardar en es/en/ca, desconocimiento de amortización con TAE en los tres idiomas, y subida de cuota. Comprueban borrador sin escritura, saldo 120.000 céntimos, cuatro cuotas pagadas, doce restantes, enlaces históricos y otras colecciones intactas, recarga y fila de Plan.
- Seis mutantes rechazados por aserciones. El primer test numérico extremo no distinguía un mutante; se conserva su supervivencia y se añade el límite exacto de 2^53 meses, que sí demuestra la guardia.
- Capturas sintéticas antes de elegir, plazo elegido y tras guardar. Un worker, cero reintentos, servidor propio y red externa interceptada con respuestas sintéticas.

Los resultados dirigidos no acreditan la suite general, CPU6, APK, servido ni móvil. Los controles de privacidad, sintaxis, idiomas y registro E2E pasan. `docs-frescura` falla por código publicable sin nueva VERSION en la rama candidata; el presupuesto estático falla en HTML minificado (1.379 KB frente al tope de 1.378 KB), aunque gzip (382/383 KB) y ficheros bloqueantes (3/3) cumplen. Son bloqueos reales de integración; no se suben los topes. VERSION, catálogo fuente y topes no se modifican. Las notas y metadatos de una nueva versión corresponden a integración; los JSON y HTML generados se conservan coherentes con este build.

Texto familiar preparado para la futura nota de versión:

- es: «Al bajar la cuota de una deuda, puedes elegir alargar el plazo antes de guardar.»
- en: “When lowering a debt payment, you can choose to extend the term before saving.”
- ca: «Quan abaixes la quota d'un deute, pots triar allargar el termini abans de desar.»
