// La cifra animada de useCountUp no puede bajar del valor de partida aunque el primer
// requestAnimationFrame llegue con un `now` anterior al performance.now() del efecto
// (e2e pulido-vacios B2 recibió 4315 cuando debía ser ≥4321).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync(new URL("../src/modules/02-ui-shared.js", import.meta.url), "utf8");
const m = src.match(/function useCountUp\(target, ready\)\{[\s\S]*?\r?\n\}\r?\n/);
assert.ok(m, "no encuentro useCountUp en 02-ui-shared.js");

function simula(offsetPrimerFrame) {
  const visto = [];
  let efecto = null, cb = null;
  const refs = [];
  let refIdx = 0;
  const React = {
    useState: (v) => [v, (n) => visto.push(n)],
    useRef: (v) => (refs[refIdx] ||= { current: v }, refs[refIdx++]),
    useEffect: (f) => { efecto = f; },
  };
  const T0 = 10000;
  const fabrica = new Function("React", "mcReduced", "requestAnimationFrame", "cancelAnimationFrame", "performance",
    "const {useState,useRef,useEffect}=React;" + m[0] + "return useCountUp;");
  const useCountUp = fabrica(React, () => false, (f) => { cb = f; return 1; }, () => {}, { now: () => T0 });
  useCountUp(4000, true);
  // Segunda pasada con otro objetivo: el ref ya guarda 4000 como valor mostrado.
  refIdx = 0;
  useCountUp(4321, true);
  efecto();
  cb(T0 + offsetPrimerFrame);
  cb(T0 + 5000);
  return visto;
}

test("now anterior a t0: la cifra nunca baja del valor inicial", () => {
  const visto = simula(-16);
  assert.ok(visto.length > 0);
  for (const v of visto) assert.ok(v >= 4000 && v <= 4321, "valor fuera de rango: " + v);
  assert.equal(visto[visto.length - 1], 4321);
});
