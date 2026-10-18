package com.micartera.app;

/** Reparte pausas DESPUÉS de cada primitiva, incluyendo su duración estimada en el tope. */
final class HapticPlan {
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
    static final class Wave {
        final long[] timings;
        final int[] amplitudes;
        Wave(int count) { timings = new long[count]; amplitudes = new int[count]; }
    }
    static Wave waveform(int requestedMs) {
        int duration = Math.min(1200, requestedMs);
        if (duration <= 0) return null;
        int count = Math.min(12, duration);
        Wave wave = new Wave(count);
        for (int i = 0; i < count; i++) {
            wave.timings[i] = duration / count + (i < duration % count ? 1 : 0);
            wave.amplitudes[i] = count == 1 ? 10 : 10 + Math.round(50f * i / (count - 1));
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
        int count = Math.min(10, duration / primitiveMs);
        HapticPlan plan = new HapticPlan(count);
        int previousEnd = 0;
        for (int i = 0; i < count; i++) {
            int start = count == 1 ? 0 : Math.round((duration - primitiveMs) * (float) i / (count - 1));
            plan.delays[i] = start - previousEnd;
            plan.scales[i] = count == 1 ? .04f : .04f + .12f * i / (count - 1);
            previousEnd = start + primitiveMs;
        }
        return plan;
    }
}
