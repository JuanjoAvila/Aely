package com.micartera.app;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

/** El filtro del lector no debe tirar una noti con el importe fuera de `android.text` (27/11). */
public class TrExpenseListenerTextoTest {

    @Test
    public void textoConImporteSigueMandandoElTexto() {
        assertEquals("12,50 € en Mercadona",
                TrExpenseListener.textoConImporte("12,50 € en Mercadona", "otro 3,00 €", "Pago"));
    }

    @Test
    public void importeEnBigTextNoSeDescarta() {
        assertEquals("Gastaste 4,20 € en 1801086",
                TrExpenseListener.textoConImporte("", "Gastaste 4,20 € en 1801086", "1801086"));
    }

    @Test
    public void importeSoloEnElTituloNoSeDescarta() {
        assertEquals("4,20 € en 1801086",
                TrExpenseListener.textoConImporte("Toca para ver", "", "4,20 € en 1801086"));
    }

    @Test
    public void sinImporteEnNingunCampoSeDescarta() {
        assertEquals("", TrExpenseListener.textoConImporte("Toca para ver", null, "Trade Republic"));
    }
}
