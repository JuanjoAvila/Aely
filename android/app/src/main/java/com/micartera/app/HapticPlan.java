package com.micartera.app;

/** El relleno es una onda continua; las primitivas quedan reservadas a un solo toque de borde. */
final class HapticPlan {
    static final int EDGE_AMPLITUDE = 30;
    static final float EDGE_SCALE = .25f;
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
