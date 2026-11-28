package com.micartera.app;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

/**
 * El filtro del lector no debe tirar una noti con el importe fuera de `android.text` (27/11), pero
 * tampoco debe tapar el ruido de `android.text` con el título (NO-GO de Grok, 28/11). Datos inventados.
 */
public class TrExpenseListenerTextoTest {

    // ---- Positivos ----

    @Test
    public void textoConImporteSigueMandandoElTexto() {
        assertEquals("12,50 € en COMERCIO SINTETICO",
                TrExpenseListener.textoConImporte("12,50 € en COMERCIO SINTETICO", "otro 3,00 €", "Pago"));
    }

    @Test
    public void importeEnBigTextNoSeDescarta() {
        assertEquals("Gastaste 4,20 € en 4402917",
                TrExpenseListener.textoConImporte("", "Gastaste 4,20 € en 4402917", "4402917"));
    }

    @Test
    public void bigTextQueNoContieneAlTextoSeSumaSinPerderlo() {
        assertEquals("Aviso Gastaste 4,20 € en 4402917",
                TrExpenseListener.textoConImporte("Aviso", "Gastaste 4,20 € en 4402917", "Trade Republic"));
    }

    @Test
    public void importeSoloEnTituloConVerboDeCompraNoSeDescartaNiPierdeElTexto() {
        assertEquals("Toca para ver Gastaste 4,20 € en 4402917",
                TrExpenseListener.textoConImporte("Toca para ver", "", "Gastaste 4,20 € en 4402917"));
    }

    @Test
    public void sinImporteEnNingunCampoSeDescarta() {
        assertEquals("", TrExpenseListener.textoConImporte("Toca para ver", null, "Trade Republic"));
    }

    // ---- Negativos: importe solo en el título, sin verbo de compra → no se manda ----

    @Test
    public void alertaDePrecioConImporteEnTituloSeDescarta() {
        assertEquals("", TrExpenseListener.textoConImporte("alerta de precio", "", "Acme Corp 182,40 EUR"));
    }

    @Test
    public void ordenEjecutadaConImporteEnTituloSeDescarta() {
        assertEquals("", TrExpenseListener.textoConImporte("orden de compra ejecutada", "", "Acme Corp 182,40 EUR"));
    }

    @Test
    public void devolucionConImporteSoloEnTituloSeDescarta() {
        assertEquals("", TrExpenseListener.textoConImporte("te hemos devuelto el dinero", "", "Devolución 12,00 EUR"));
    }

    @Test
    public void saldoBajoConImporteEnTituloSeDescarta() {
        assertEquals("", TrExpenseListener.textoConImporte("", "", "Saldo bajo 4,20 EUR"));
    }

    @Test
    public void ruidoDelTextoSigueViajandoSiElImporteVaEnBigText() {
        assertEquals("alerta de precio Gastaste 3,00 € en COMERCIO SINTETICO",
                TrExpenseListener.textoConImporte("alerta de precio", "Gastaste 3,00 € en COMERCIO SINTETICO", "Trade Republic"));
    }

    // ---- Negativos: importe solo en bigText, sin verbo de compra → no se manda (NO-GO de Grok, 28/11) ----

    @Test
    public void devolucionConImporteSoloEnBigTextSeDescarta() {
        assertEquals("", TrExpenseListener.textoConImporte("Toca para ver",
                "Te hemos devuelto 12,00 EUR de tu compra en Tienda Inventada", "Trade Republic"));
    }

    @Test
    public void cotizacionConImporteSoloEnBigTextSeDescarta() {
        assertEquals("", TrExpenseListener.textoConImporte("", "Acme Corp cotiza a 182,40 EUR", "Trade Republic"));
    }

    @Test
    public void saldoConImporteSoloEnBigTextSeDescarta() {
        assertEquals("", TrExpenseListener.textoConImporte("", "Tu saldo es de 4,20 EUR", "Trade Republic"));
    }

    // ---- Verbos de compra ampliados (alineados con COMPRA_TARJETA de ingest) ----

    private static void seManda(String big) {
        assertEquals(big, TrExpenseListener.textoConImporte("", big, "Trade Republic"));
    }

    @Test
    public void verbosNuevosEnBigTextSeMandan() {
        seManda("Pago con tarjeta de 7,10 € en COMERCIO SINTETICO");
        seManda("COMPRA CON TARJETA 7,10 € COMERCIO SINTETICO");
        seManda("Vas pagar 7,10 € a COMERCIO SINTETIC");
        seManda("Vas gastar 7,10 € a COMERCIO SINTETIC");
        seManda("Spent 7,10 € at SYNTHETIC SHOP");
        seManda("Has  gastado 7,10 € en COMERCIO SINTETICO");
    }

    @Test
    public void ordenDeCompraDeAccionesConImporteSoloEnBigTextSeDescarta() {
        assertEquals("", TrExpenseListener.textoConImporte("", "Has comprado 0,5 acciones de Acme por 50,00 EUR", "Trade Republic"));
    }

    @Test
    public void espacioDuroEntreLasPalabrasDelVerboNoLoRompe() {
        seManda("Has\u00a0pagado 7,10\u00a0€ en COMERCIO SINTETICO");
        assertEquals("Toca para ver Pago\u00a0con\u00a0tarjeta 7,10 €",
                TrExpenseListener.textoConImporte("Toca para ver", "", "Pago\u00a0con\u00a0tarjeta 7,10 €"));
    }

    // ---- Wallet: sin cambios ----

    @Test
    public void walletSinImporteEnTextoNoUsaTituloNiBigText() {
        assertEquals("", TrExpenseListener.textoConImporte("wallet", "Toca para ver", "9,95 €", "COMERCIO SINTETICO"));
    }

    @Test
    public void walletConImporteEnTextoSigueIgual() {
        assertEquals("9,95 € con Tarjeta ••0000",
                TrExpenseListener.textoConImporte("wallet", "9,95 € con Tarjeta ••0000", "", "COMERCIO SINTETICO"));
    }
}
