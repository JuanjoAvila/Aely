# INC-2709-10 · Casillas vacías gigantes en el perfil

**Versión provisional:** 4.26.81 · rama `tanda/inc-2709-10-perfil` desde `main` 12884f48 · sin publicar.

## Qué notó el dueño (27/9)

«Casillas vacías gigantes en Ajustes del perfil».

## Ruta y medida (30/9, lease 11, sin datos reales)

Avatar de Inicio → panel de perfil (`ProfilePanel`, `14-v4-screens.js`). Viewport 393×800, perfil
vacío (`{}`) frente a relleno con 15 campos ficticios, es/en/ca × letra normal/grande/enorme: 18/18
pasadas, idénticas en los tres idiomas.

| Caso | Alto del panel | Fila vacía |
|------|---------------:|-----------:|
| Vacío, normal | 1.787 px | 127 px (10 filas) |
| Relleno, normal | 1.107 px | — |
| Vacío, grande | 1.798–1.817 px | 143 px |
| Vacío, enorme | 1.801–1.803 px | 160 px |

## Causa

El valor de una fila vacía llevaba `className="pr-val empty"`. `empty` es también la clase GLOBAL de
estado vacío: `.empty{text-align:center;padding:34px 20px;color:var(--muted)}` en `shell.html`.
Cada «Añadir» recibía 68 px de padding vertical y quedaba centrado. No era una decisión de diseño.

## Arreglo

El modificador pasa a `pr-val-empty` (componente y CSS). Mismas filas, etiquetas y diálogo al
tocar; «Añadir» sigue en gris. No se oculta ni se agrupa ningún campo.

## Prueba

`e2e/perfil-filas-vacias.spec.mjs` (E2E_MAP de `14-v4-screens.js`), 9 casos es/en/ca × normal/big/huge:

- cada fila ✎ vacía mide ≤ la rellena + 4 px y ≥ 44 px;
- «Añadir» está alineado a la izquierda;
- el toque abre su diálogo, sin guardar nada.

Las filas se distinguen por contenido (el único campo relleno), no por clase, para que el rojo
falle por la altura. Se mide `offsetHeight`, porque el panel se abre escalando y a mitad de
animación el rect mide la miniatura.

- **Rojo** (lease 13, 1/10 00:26–00:27 UTC), spec sobre main 12884f48: 9/9 fallan por la altura —
  fila vacía 127–128 px contra rellena 59–61 (+4 de margen).
- **Verde** sobre la rama: 9/9, más `profile-anim` y `listas-render` como vecinos → 23/23.
