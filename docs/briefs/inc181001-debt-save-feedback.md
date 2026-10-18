# Guardar una deuda: mostrar el motivo del rechazo

Si el plazo y la cuota no encajan, la edición conserva el borrador y explica qué revisar. El aviso existente podía quedar recortado al pulsar Guardar en una hoja larga. Ahora recibe el foco y se desplaza lo necesario para verse completo, también al repetir el mismo intento. Se reutilizan los textos en español, inglés y catalán.

La reproducción sintética confirma el aviso recortado; no acredita que sea la causa del bloqueo total descrito en el móvil. Con una ventana más baja, la fuente base ya mostraba el motivo y guardaba una corrección válida. La aceptación del incidente real queda pendiente.

No cambia el cálculo ni las guardas de plazo/cuota, saldo, TAE o deuda terminada. La prueba `deudas-guardar-feedback` abre la hoja real, comprueba el rechazo sin escritura, repite el intento y corrige con céntimos y TAE decimal; exige cierre y persistencia tras recargar. También cubre el rechazo repetido sin rango en una deuda terminada y conserva sus campos financieros.
