# INC-2709-13: la rayita de la pestaña activa se queda con la barra oculta

Base `8dcc5ed3`. Diagnóstico previo: `inc-0710-nav-hidden-marker-motion-diagnosis` (rama `codex/nav-hidden-diagnosis-relay21`).

## Causa y cambio

`.botnav-ind` (top:-9px, 3px) solo se ocultaba con `.hide` (drawer/perfil), nunca con la barra escondida. En el host nativo la barra oculta colapsa a 0 pero conserva `overflow-clip-margin:30px`, así que la rayita seguía pintada. Cambio mínimo, solo CSS en `src/shell.html`: `.botnav.botnav-hidden .botnav-ind{opacity:0;transition:none}`. Se engancha a la clase que `applyNavHide`/`revealNav` ponen primero (sin esperar a `navHidden` de React). `.botnav::after` (corriente Cyberpunk), FAB, pestañas y callbacks no cambian.

`transition:none` es deliberado: con la opacidad animada, `botnav-fab-recorte` (cyber, normal) bajó de ≥0,98 a 0,77/0,69 porque pausa todas las animaciones de la barra a 1 ms. Con `none` vuelve a pasar.

## Pruebas

`e2e/botnav-indicador.spec.mjs` (registrado en `CROSSCUTTING`): estilo calculado de la rayita y de `::after` real (sin apagar pseudos), temas green/cyber × reducir animaciones app on/off, corriente intacta con la barra oculta, y un arrastre real con dedo (CDP) que esconde y revela. Rojo contra la base (6/6), verde en la candidata.

## Limitaciones

No cubre safe-bottom 34 con esta spec (sí lo cubre `botnav-fab-recorte`, 12/12 verde), reducido por preferencia del sistema, ni el host nativo real/móvil. No se midieron frames ni pintura de píxeles de la rayita. Sin bump de VERSION ni notas, según el encargo.
