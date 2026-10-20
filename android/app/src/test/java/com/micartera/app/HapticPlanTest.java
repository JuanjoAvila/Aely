package com.micartera.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class HapticPlanTest {
    private static int maxAmp(HapticPlan.Wave w) { int m = 0; for (int a : w.amplitudes) m = Math.max(m, a); return m; }

    @Test public void round5StrengthChangesAmplitudeWithControl() {
        int prevAmp = 0; long prevOn = 0;
        for (int s : new int[]{1, 30, 70, 128, 200, 255}) {
            HapticPlan.Wave w = HapticPlan.shape(HapticPlan.single(12, s), true);
            assertNotNull(w);
            assertTrue("amplitud crece con la fuerza", maxAmp(w) > prevAmp);
            assertTrue("y el tiempo encendido no baja", HapticPlan.onTime(w) >= prevOn);
            prevAmp = maxAmp(w); prevOn = HapticPlan.onTime(w);
        }
        assertEquals(HapticPlan.MIN_FELT, maxAmp(HapticPlan.shape(HapticPlan.single(12, 1), true)));
        assertEquals(255, maxAmp(HapticPlan.shape(HapticPlan.single(12, 255), true)));
    }
    @Test public void round5StrengthChangesPatternWithoutControl() {
        HapticPlan.Wave soft = HapticPlan.shape(HapticPlan.single(12, 1), false);
        HapticPlan.Wave mid = HapticPlan.shape(HapticPlan.single(12, 128), false);
        HapticPlan.Wave hard = HapticPlan.shape(HapticPlan.single(12, 255), false);
        for (HapticPlan.Wave w : new HapticPlan.Wave[]{soft, mid, hard})
            for (int a : w.amplitudes) assertTrue("sin control: solo encendido o apagado", a == 0 || a == HapticPlan.ON_AMPLITUDE);
        assertTrue("fuerza 1 sigue vibrando", HapticPlan.onTime(soft) > 0);
        assertTrue(HapticPlan.onTime(soft) < HapticPlan.onTime(mid));
        assertTrue(HapticPlan.onTime(mid) < HapticPlan.onTime(hard));
        assertEquals("fuerza máxima = encendido continuo", 1, hard.timings.length);
        assertEquals(12, hard.timings[0]);
        assertTrue("el patrón suave alterna", soft.timings.length > 1);
    }
    @Test public void round5ShapeKeepsDurationAndBudget() {
        for (int ms : new int[]{1, 4, 8, 12, 60, 100}) for (int s : new int[]{1, 64, 255}) {
            HapticPlan.Wave w = HapticPlan.shape(HapticPlan.single(ms, s), true);
            assertTrue(HapticPlan.total(w) <= ms);
            assertTrue(HapticPlan.onTime(w) > 0);
            for (long t : w.timings) assertTrue(t > 0);
            assertTrue("termina encendido, sin silencio de cola", w.amplitudes[w.amplitudes.length - 1] > 0);
        }
        assertNull(HapticPlan.shape(HapticPlan.single(12, 0), true));
        assertNull(HapticPlan.shape(null, true));
    }
    @Test public void round5FillFollowsStrengthPerSegment() {
        HapticPlan.Wave raw = HapticPlan.custom(new long[]{20, 20, 20}, new int[]{0, 40, 200});
        HapticPlan.Wave w = HapticPlan.shape(raw, false);
        assertTrue(HapticPlan.total(w) <= 60);
        long onSecond = 0, onThird = 0, at = 0;
        for (int i = 0; i < w.timings.length; i++) {
            if (w.amplitudes[i] > 0) { if (at >= 40) onThird += w.timings[i]; else if (at >= 20) onSecond += w.timings[i]; }
            at += w.timings[i];
        }
        assertTrue("tramo más fuerte, más rato encendido", onThird > onSecond);
        assertEquals("el tramo a 0 calla", 0, w.amplitudes[0]);
    }
    @Test public void legacyRampStillShapes() {
        HapticPlan.Wave raw = HapticPlan.waveform(1100);
        assertEquals(1100, HapticPlan.total(raw));
        HapticPlan.Wave w = HapticPlan.shape(raw, true);
        assertTrue(HapticPlan.total(w) <= 1100 && HapticPlan.total(w) > 1000);
        assertNull(HapticPlan.waveform(0));
    }
    @Test public void customWaveFromWebIsBounded() {
        HapticPlan.Wave wave = HapticPlan.custom(new long[]{20,20,20}, new int[]{0,300,-5});
        assertNotNull(wave);
        assertArrayEquals(new int[]{0,255,0}, wave.amplitudes);
        assertNull("todo a cero no vibra", HapticPlan.custom(new long[]{20}, new int[]{0}));
        assertNull("longitudes distintas", HapticPlan.custom(new long[]{20,20}, new int[]{9}));
        assertNull("tramo nulo", HapticPlan.custom(new long[]{0}, new int[]{9}));
        assertNull("tramo larguísimo", HapticPlan.custom(new long[]{201}, new int[]{9}));
        assertNull("sin onda", HapticPlan.custom(new long[0], new int[0]));
    }
    @Test public void pathNeedsVibratorAndApi26() {
        assertEquals(HapticPlan.Path.WAVEFORM, HapticPlan.select(36, true, true));
        assertEquals(HapticPlan.Path.WAVEFORM, HapticPlan.select(26, true, true));
        assertEquals(HapticPlan.Path.NONE, HapticPlan.select(36, false, true));
        assertEquals(HapticPlan.Path.NONE, HapticPlan.select(36, true, false));
        assertEquals(HapticPlan.Path.NONE, HapticPlan.select(25, true, true));
    }
    @Test public void round6UsageFromWeb() {
        assertEquals(HapticPlan.Usage.HARDWARE, HapticPlan.usage("hardware"));
        assertEquals(HapticPlan.Usage.MEDIA, HapticPlan.usage("media"));
        assertEquals(HapticPlan.Usage.UNKNOWN, HapticPlan.usage("unknown"));
        assertEquals("sin elegir, el de siempre", HapticPlan.Usage.TOUCH, HapticPlan.usage(null));
        assertEquals(HapticPlan.Usage.TOUCH, HapticPlan.usage("touch"));
        assertEquals("basura = el de siempre", HapticPlan.Usage.TOUCH, HapticPlan.usage("HARDWARE; drop"));
    }
    @Test public void round8ContinuousWithAmplitudeControl() {
        for (int strength : new int[]{1, 42, 128, 203, 255}) {
            HapticPlan.Wave w = HapticPlan.shape(HapticPlan.single(33, strength), true);
            assertEquals("un solo pulso continuo, sin ristra", 1, w.timings.length);
            assertEquals(33, w.timings[0]);
            assertEquals(HapticPlan.felt(strength), w.amplitudes[0]);
        }
        HapticPlan.Wave off = HapticPlan.shape(HapticPlan.single(33, 128), false);
        assertTrue("sin control de amplitud sigue troceando", off.timings.length > 1);
    }
}
