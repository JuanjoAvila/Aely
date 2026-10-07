import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {test,expect} from '@playwright/test';
import {authFragments,authWorld} from '../tests/helpers/auth-disposal-fixture.mjs';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
// React/ReactDOM exactos y autohospedados del shell; solo se monta el efecto bajo estudio.
const reactScripts=[...read('src/shell.html').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>/react.production.min.js|react-dom.production.min.js/.test(s));
assert.equal(reactScripts.length,2,'React y ReactDOM reales deben estar presentes');
const old=f=>execFileSync('git',['show','77b7d5e4d6188ec08c7aea0a598c741bb3025d13:'+f],{encoding:'utf8',maxBuffer:8e6});
for(const baseline of [false,true])test('React real: disposición de auth '+(baseline?'control rojo anterior':'sin callbacks retirados'),async({page})=>{
  await page.route('**/*',route=>route.abort());
  await page.setContent('<div id="mount"></div>');
  for(const content of reactScripts)await page.addScriptTag({content});
  const parts=authFragments((baseline?old:read)('src/modules/00-core.js'),(baseline?old:read)('src/modules/11-app-main.js'));
  await page.evaluate(({parts,factory})=>{
    const w=new Function('return ('+factory+')')()(parts),env=w.env;
    window.__world=w;
    const body=new Function(...Object.keys(env),'useEffect',parts.effect);
    function Fixture(){const [s,setS]=React.useState(null);const ref=React.useRef(null);
      const own={...env,sessionRef:ref,setSession(s){env.setSession(s);setS(s);}};
      body(...Object.values(own),React.useEffect);
      return React.createElement('span',{'data-testid':'session'},s?.user?.id||'none');}
    window.__mount=()=>{window.__root=ReactDOM.createRoot(document.getElementById('mount'));ReactDOM.flushSync(()=>window.__root.render(React.createElement(Fixture)));};
    window.__off=()=>ReactDOM.flushSync(()=>window.__root.unmount());
    window.__mount();
  },{parts,factory:authWorld.toString()});
  await expect(page.getByTestId('session')).toHaveText('none');
  for(let i=0;i<6;i++){
    await page.evaluate(()=>window.__off());
    await expect(page.getByTestId('session')).toHaveCount(0);
    await page.evaluate(()=>window.__mount());
    await expect(page.getByTestId('session')).toHaveText('none');
  }
  expect(await page.evaluate(()=>window.__world.live.size)).toBe(baseline?7:1);
  await page.evaluate(()=>window.__world.event('SIGNED_IN',{user:{id:'synthetic-active'}},true));
  await expect(page.getByTestId('session')).toHaveText('synthetic-active');
  expect(await page.evaluate(()=>window.__world.trace.filter(x=>x.type==='sync').length)).toBe(baseline?7:1);
  await page.evaluate(()=>window.__off());
  const before=await page.evaluate(()=>window.__world.trace.length);
  await page.evaluate(async()=>{const w=window.__world;w.event('SIGNED_OUT',null,true);w.event('PASSWORD_RECOVERY',{user:{id:'late'}},true);
    w.sessions.forEach(r=>r.resolve({user:{id:'late'}}));for(let i=0;i<8;i++)await Promise.resolve();w.idle();w.fireTimers();});
  const after=await page.evaluate(()=>window.__world.trace.length);
  if(baseline)expect(after).toBeGreaterThan(before);else expect(after).toBe(before);
  await expect(page.getByTestId('session')).toHaveCount(0);
});
