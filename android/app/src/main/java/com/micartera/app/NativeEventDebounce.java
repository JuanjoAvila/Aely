package com.micartera.app;

import java.util.LinkedHashMap;
import java.util.Map;

/** Admisión local por evento; la identidad duradera sigue siendo responsabilidad de ingest. */
final class NativeEventDebounce {
    private static final long WINDOW_MS = 180000L;

    interface Store {
        Map<String, Long> read();
        void write(Map<String, Long> accepted);
    }

    private NativeEventDebounce() {}

    // Un monitor compartido incluye el adaptador persistente, no solo una caché de cada servicio.
    static synchronized boolean admit(String event, long now, Store store) {
        // Un fallo al crear la huella nunca debe convertir todos los gastos en el mismo evento.
        if (event == null || event.isEmpty()) return true;

        Map<String, Long> active = new LinkedHashMap<>();
        for (Map.Entry<String, Long> entry : store.read().entrySet()) {
            String key = entry.getKey();
            Long acceptedAt = entry.getValue();
            if (key == null || key.isEmpty() || acceptedAt == null) continue;
            long age = now - acceptedAt;
            // Si retrocede el reloj se expira: perder una compra sería peor que reenviarla.
            // age >= 0 descarta también una resta desbordada entre instantes muy alejados.
            if (now >= acceptedAt && age >= 0 && age < WINDOW_MS) {
                active.put(key, acceptedAt);
            }
        }

        // Una reentrega suprimida no alarga la ventana del evento original.
        if (active.containsKey(event)) return false;
        active.put(event, now);
        store.write(active);
        return true;
    }
}
