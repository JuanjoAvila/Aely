import assert from 'node:assert/strict';import vm from 'node:vm';import {codeMask} from '../../scripts/beta-source-code.mjs';
// El banco aplica el estado primero y ejecuta después el callback real de layout.
// El caso de render retenido se prueba por separado sin invocar este commit.
export function commitCloudFixture(app,context,refs,state){
 const mask=codeMask(app),start=mask.indexOf('const commitCloudRead=function(');assert.ok(start>=0);
 let end=mask.indexOf('{',start)+1,n=1;for(;n;end++){if(mask[end]==='{')n++;if(mask[end]==='}')n--;}
 const names=['state','cloudMergeKey','cloudPullRef','cloudReadRef','cloudUpdatedAtRef','sessionRef','stateRef','obAbsorbedWriteBlocked'];
 vm.runInContext('(function('+names.join(',')+'){'+app.slice(start,end)+';commitCloudRead();})',context)(state,...names.slice(1).map(k=>refs[k]));
}
