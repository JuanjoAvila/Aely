package com.micartera.app;

/** El relleno es una onda continua; las primitivas quedan reservadas a un solo toque de borde. */
final class HapticPlan {
    static final int EDGE_AMPLITUDE = 30;
    static final float EDGE_SCALE = .25f;
    static final int EDGE_MS = 8, MAX_EDGE_MS = 100;
    // Topes de la onda que manda la web: ni un zumbido de segundos ni un array sin fin.
    static final int MAX_STEPS = 120, MAX_STEP_MS = 200, MAX_CUSTOM_MS = 3000;
    static int clamp(int value, int lo, int hi) { return Math.max(lo, Math.min(hi, value)); }
    // Escala de primitiva para motores sin amplitud: 30 (el borde de siempre) sigue dando .25.
    static float scaleFor(int amplitude) { return Math.max(.02f, Math.min(1f, amplitude / 120f)); }
    static long total(Wave wave) { long sum = 0; for (long t : wave.timings) sum += t; return sum; }
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
    enum Path { NONE, WAVEFORM, LOW_TICK, SOFT_TICK }
    static Path select(int api, boolean allowed, boolean amplitudeControl, boolean lowTick, int primitiveMs) {
        if (!allowed) return Path.NONE;
        // Sin control de amplitud, algunos motores convierten la onda en un zumbido al máximo.
        if (api >= 33) {
            if (amplitudeControl) return Path.WAVEFORM;
            if (lowTick && primitiveMs > 0) return Path.LOW_TICK;
        }
        return api >= 34 ? Path.SOFT_TICK : Path.NONE;
    }
    static Path selectFill(int api, boolean allowed, boolean amplitudeControl) {
        // Un tren de primitivas no es una rampa continua: en estos motores preferimos callar.
        return api >= 33 && allowed && amplitudeControl ? Path.WAVEFORM : Path.NONE;
    }
    static final class Wave {
        final long[] timings;
        final int[] amplitudes;
        Wave(int count) { timings = new long[count]; amplitudes = new int[count]; }
    }
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
    final int[] delays;
    final float[] scales;

    private HapticPlan(int count) {
        delays = new int[count];
        scales = new float[count];
    }

    static HapticPlan create(int requestedMs, int primitiveMs) {
        int duration = Math.min(1200, requestedMs);
        if (primitiveMs <= 0 || duration < primitiveMs) return null;
        HapticPlan plan = new HapticPlan(1);
        plan.scales[0] = EDGE_SCALE;
        return plan;
    }
}
