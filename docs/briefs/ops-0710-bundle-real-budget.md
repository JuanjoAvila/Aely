# Presupuesto del paquete realmente publicado · 7/10/2026

La candidata100 dejaba6bytes de margen crudo con sello100.99999, pero la configuración de monitorización del publicador añadía95bytes. La CI sobre configuración vacía no acreditaba el presupuesto del paquete servido. Se conserva el límite1287KiB crudos/351KiB gzip y los tres recursos bloqueantes.

La fuente `src/shell.html` compacta únicamente la sintaxis del HEAD: separación entre etiquetas, whitespace de CSP y viewport, y sintaxis equivalente de atributos y etiquetas vacías HTML. No cambia ninguna directiva/origen de CSP, elemento, atributo interpretado, texto visible ni bloque JavaScript/CSS. El build regenera `public/index.html`; no se edita el generado a mano. Ahorra101bytes minificados frente a la fuente1002d96.

El guard por defecto reserva95bytes sintéticos de configuración y el sufijo beta99999, sin leer secretos ni mostrar valores. Conserva íntegra cualquier configuración mayor. Exige una única marca DSN y una única versión. `--artifact` mide el fichero final tal cual y gzip9, sin minificar de nuevo, añadir fixture ni sustituir el sello. El publicador debe ejecutar esa modalidad después de build, configuración, sellado y minificación: la fixture no garantiza el gzip de cualquier configuración futura.

Validación local: fuente100 anterior rechazada por el nuevo guard; candidata con configuración sintética95bytes y sello100.99999 mide1317876bytes crudos/358971gzip9, bajo1317888/359424. Artefactos excesivos y marcas ausentes fallan cerrado. Sintaxis, security, privacidad y diffcheck verdes. HTMLParser acredita equivalencia de elementos/atributos/textos con normalización de whitespace CSP/viewport; todos los bloques script/style son byteidénticos. Catálogo de220notas,29scopes y códigos, pruebas, APK y SW conservados. No se atribuye aprobación móvil, publicación, rendimiento percibido ni solución global de INC-2709-09.

Pendientes: revisión independiente del árbol final, CI exacta y gate del artefacto real antes de publicación. La candidata de limpieza96/98 debe reconstruirse sobre esta fuente; no aplicar un public generado antiguo. Los inputs privados siguen bloqueados por falta de credencial autorizada.
# Gate del publicador

El workflow beta ejecuta `node tests/presupuesto-rendimiento.test.mjs --artifact` después de ensamblar con su configuración, sellar y minificar, antes de empaquetar o sustituir assets. Esta modalidad mide los bytes y gzip del HTML real, sin reemplazar configuración ni versión. El fixture local no acredita una configuración diferente: el gate real debe pasar en el SHA final antes de declarar entrega. La CI del árbol anterior no se hereda.
