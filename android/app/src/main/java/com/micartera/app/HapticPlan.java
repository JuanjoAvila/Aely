package com.micartera.app;

/** Reparte pausas DESPUÉS de cada primitiva, incluyendo su duración estimada en el tope. */
final class HapticPlan {
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
            plan.scales[i] = count == 1 ? .12f : .12f + .43f * i / (count - 1);
            previousEnd = start + primitiveMs;
        }
        return plan;
    }
}
