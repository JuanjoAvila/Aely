package com.micartera.app;

/* UX16 ronda 5: en su OnePlus 13 la fuerza «en 1 no vibra nada, o en cualquier potencia vibra
   igual». Pasar solo la amplitud no basta: en toques cortos el motor llega a su tope o se queda
   corto antes de que la amplitud se note, y el HAL puede tratarla casi como encendido/apagado.
   Por eso la fuerza se traduce también en TIEMPO encendido: cada tramo se trocea en ranuras de
   SLOT_MS y la fuerza decide qué parte de cada ranura vibra. Con control de amplitud además
   sube la amplitud; sin él, el mismo troceo hace de fuerza. La duración total no cambia. */
final class HapticPlan {
    static final int EDGE_AMPLITUDE = 30;
    static final int EDGE_MS = 8, MAX_EDGE_MS = 100;
    // Topes de la onda que manda la web: ni un zumbido de segundos ni un array sin fin.
    static final int MAX_STEPS = 120, MAX_STEP_MS = 200, MAX_CUSTOM_MS = 3000;
    static final int SLOT_MS = 6, MIN_FELT = 60, ON_AMPLITUDE = 255;
    // Fuerza 1 sigue encendiendo un tercio de cada ranura: «en 1 no vibra nada» era el otro fallo.
    static final float DUTY_MIN = .3f;
    enum Path { NONE, WAVEFORM }

    static int clamp(int value, int lo, int hi) { return Math.max(lo, Math.min(hi, value)); }
    static Path select(int api, boolean allowed, boolean hasVibrator) {
        return allowed && api >= 33 && hasVibrator ? Path.WAVEFORM : Path.NONE;
    }
    // Por debajo de MIN_FELT un toque corto no mueve el motor: la fuerza 1 empieza ahí.
    static int felt(int strength) {
        if (strength <= 0) return 0;
        return MIN_FELT + Math.round((255 - MIN_FELT) * (clamp(strength, 1, 255) - 1) / 254f);
    }
    static float duty(int strength) {
        return DUTY_MIN + (1 - DUTY_MIN) * (clamp(strength, 1, 255) - 1) / 254f;
    }

    static final class Wave {
        final long[] timings;
        final int[] amplitudes;
        Wave(int count) { timings = new long[count]; amplitudes = new int[count]; }
    }
    static long total(Wave wave) { long sum = 0; for (long t : wave.timings) sum += t; return sum; }
    static long onTime(Wave wave) {
        long sum = 0;
        for (int i = 0; i < wave.timings.length; i++) if (wave.amplitudes[i] > 0) sum += wave.timings[i];
        return sum;
    }
    // Un toque de borde o de gráfica: un tramo con su fuerza, que luego trocea shape().
    static Wave single(int durationMs, int strength) {
        Wave wave = new Wave(1);
        wave.timings[0] = durationMs;
        wave.amplitudes[0] = clamp(strength, 0, 255);
        return wave;
    }
    // Lo que manda la web (fuerza por tramo, 0–255). Se valida antes de trocear.
    static Wave custom(long[] timings, int[] amplitudes) {
        if (timings == null || amplitudes == null || timings.length == 0 || timings.length != amplitudes.length || timings.length > MAX_STEPS) return null;
        Wave wave = new Wave(timings.length);
        long sum = 0;
        boolean audible = false;
        for (int i = 0; i < timings.length; i++) {
            if (timings[i] <= 0 || timings[i] > MAX_STEP_MS) return null;
            sum += timings[i];
            wave.timings[i] = timings[i];
            wave.amplitudes[i] = clamp(amplitudes[i], 0, 255);
            audible |= wave.amplitudes[i] > 0;
        }
        return audible && sum <= MAX_CUSTOM_MS ? wave : null;
    }
    // La rampa de la APK 58 para una web que solo mande durationMs (fuerza 3 → 30).
    static Wave waveform(int requestedMs) {
        int duration = Math.min(1200, requestedMs);
        if (duration <= 0) return null;
        int count = Math.min(60, duration);
        Wave wave = new Wave(count);
        for (int i = 0; i < count; i++) {
            wave.timings[i] = duration / count + (i < duration % count ? 1 : 0);
            wave.amplitudes[i] = count == 1 ? 3 : 3 + Math.round((EDGE_AMPLITUDE - 3f) * i / (count - 1));
        }
        return wave;
    }
    // Fuerza por tramo → onda real: ranuras encendido/apagado y amplitud sentida si el motor la acepta.
    static Wave shape(Wave raw, boolean amplitudeControl) {
        if (raw == null) return null;
        int cap = 0;
        for (long ms : raw.timings) cap += 2 * (int) ((ms + SLOT_MS - 1) / SLOT_MS) + 1;
        long[] t = new long[cap];
        int[] a = new int[cap];
        int n = 0;
        for (int i = 0; i < raw.timings.length; i++) {
            int strength = raw.amplitudes[i];
            long left = raw.timings[i];
            if (strength <= 0) { n = push(t, a, n, left, 0); continue; }
            int amp = amplitudeControl ? felt(strength) : ON_AMPLITUDE;
            float d = duty(strength);
            while (left > 0) {
                long slot = Math.min(SLOT_MS, left);
                long on = Math.min(slot, Math.max(1, Math.round(slot * d)));
                n = push(t, a, n, on, amp);
                if (slot > on) n = push(t, a, n, slot - on, 0);
                left -= slot;
            }
        }
        while (n > 0 && a[n - 1] == 0) n--;   // el silencio final solo retrasaría el siguiente toque
        if (n == 0) return null;
        Wave wave = new Wave(n);
        System.arraycopy(t, 0, wave.timings, 0, n);
        System.arraycopy(a, 0, wave.amplitudes, 0, n);
        return wave;
    }
    // Dos ranuras seguidas iguales se funden: fuerza máxima = un encendido continuo, no un tren.
    private static int push(long[] t, int[] a, int n, long ms, int amp) {
        if (n > 0 && a[n - 1] == amp) { t[n - 1] += ms; return n; }
        t[n] = ms; a[n] = amp; return n + 1;
    }
}
