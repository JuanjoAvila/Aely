import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
/* Punto 5 del encargo del 19/11/2026: sin ajustador de vibración, lo que él eligió pasa a ser lo
 * de todos. Sus números no están en la nube y alguien tiene que copiarlos a MC_HAPTIC_DEF a mano:
 * este test FALLA A PROPÓSITO mientras el marcador siga en el código, para que no se suba con los
 * de serie creyendo que ya son los suyos. */
const source=fs.readFileSync(new URL('../src/modules/02-ui-shared.js',import.meta.url),'utf8');

test('vibración fija: los valores del dueño ya están en MC_HAPTIC_DEF (sin marcador pendiente)',()=>{
  assert.doesNotMatch(source,/MC_HAPTIC_PENDIENTE|RELLENAR_CON_LOS_VALORES_DEL_DUE/,
    'Falta copiar sus valores a MC_HAPTIC_DEF / MC_HAPTIC_DEF_USAGE y borrar MC_HAPTIC_PENDIENTE (02-ui-shared.js)');
});

test('vibración fija: los de serie son números dentro de rango y un uso válido',()=>{
  const a=source.indexOf('const MC_HAPTIC_DEF='), b=source.indexOf('const MC_HAPTIC_KEY=');
  assert.ok(a>=0&&b>a,'bloque de constantes localizable');
  const ctx={};vm.createContext(ctx);
  vm.runInContext(source.slice(a,b)+'\n;globalThis.r={DEF:MC_HAPTIC_DEF,USO:MC_HAPTIC_DEF_USAGE,RANGE:MC_HAPTIC_RANGE,USOS:MC_HAPTIC_USAGES};',ctx);
  const {DEF,USO,RANGE,USOS}=ctx.r;
  assert.deepEqual(Object.keys(DEF).sort(),Object.keys(RANGE).sort(),'las nueve claves, ni una más');
  for(const k of Object.keys(RANGE)){
    assert.ok(Number.isInteger(DEF[k])&&DEF[k]>=RANGE[k][0]&&DEF[k]<=RANGE[k][1],k+'='+DEF[k]+' fuera de '+RANGE[k]);
  }
  assert.ok(USOS.includes(USO),'uso '+USO);
});
