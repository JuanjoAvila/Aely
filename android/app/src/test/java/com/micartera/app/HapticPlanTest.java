package com.micartera.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class HapticPlanTest {
    @Test public void includesPrimitiveDurationAndSpansRing() {
        HapticPlan plan = HapticPlan.create(1100, 12);
        assertEquals(10, plan.delays.length);
        int total = 0;
        for (int delay : plan.delays) { assertTrue(delay >= 0); total += delay + 12; }
        assertEquals(1100, total);
        assertEquals(.12f, plan.scales[0], .001f);
        assertEquals(.55f, plan.scales[9], .001f);
        for (int i = 1; i < 10; i++) assertTrue(plan.scales[i] > plan.scales[i-1]);
    }
    @Test public void capsDurationAndCountAcrossMotorDurations() {
        for (int duration : new int[]{1,10,200,1100,1200,5000,Integer.MAX_VALUE}) {
            for (int primitive : new int[]{1,6,20,100,400,1200,2000}) {
                HapticPlan plan = HapticPlan.create(duration, primitive);
                if (primitive > Math.min(1200, duration)) { assertNull(plan); continue; }
                assertNotNull(plan);assertTrue(plan.delays.length <= 10);
                int total = 0;
                for (int delay : plan.delays) { assertTrue(delay >= 0); total += delay + primitive; }
                assertTrue(total <= Math.min(1200, duration));
            }
        }
    }
    @Test public void invalidOrUnknownDurationsRequireFallback() {
        assertNull(HapticPlan.create(0, 12));assertNull(HapticPlan.create(-1, 12));
        assertNull(HapticPlan.create(1100, 0));assertNull(HapticPlan.create(1100, -1));
        assertNull(HapticPlan.create(8, 12));
    }
}
