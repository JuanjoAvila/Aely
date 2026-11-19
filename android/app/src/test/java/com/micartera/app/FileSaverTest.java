package com.micartera.app;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

// Lo que llega de la web no puede sacar el fichero de Descargas ni romper MediaStore.
public class FileSaverTest {
    @Test
    public void nombreSinRutasNiCaracteresRaros() {
        assertEquals("aely-informe-2026-10.png", FileSaver.safeName("aely-informe-2026-10.png", "x"));
        assertEquals("evil.png", FileSaver.safeName("../../evil.png", "x"));
        assertEquals("evil.png", FileSaver.safeName("..\\evil.png", "x"));
        assertEquals("a_b_.png", FileSaver.safeName("a:b?.png", "x"));
        assertEquals("oculto", FileSaver.safeName(".oculto", "x"));
        assertEquals("x", FileSaver.safeName("   ", "x"));
        assertEquals("x", FileSaver.safeName(null, "x"));
    }

    @Test
    public void dataUrlOBase64Pelado() {
        assertEquals("QUJD", FileSaver.stripDataUrl("data:image/png;base64,QUJD"));
        assertEquals("QUJD", FileSaver.stripDataUrl("QUJD"));
        assertEquals("", FileSaver.stripDataUrl(null));
    }
}
