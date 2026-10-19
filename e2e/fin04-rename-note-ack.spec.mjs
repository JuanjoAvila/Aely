import {test} from "@playwright/test";
import {runFin04} from "./fin04-fixture.mjs";

test.describe.configure({mode:"serial"});
for(const scenario of ["rename-note","note-api","note-zero","sandbox","late-note-ack","late-rename-ack","legacy-duplicates","rename-unrelated"]){
  test("FIN04 · "+scenario,{annotation:{type:"own-clock",description:"Fechas sintéticas relativas al instante de ejecución"}},async({browser,baseURL},info)=>{
    await runFin04({browser,baseURL,scenario,onEvidence:async data=>info.attach("fin04-trace",{body:JSON.stringify(data,null,2),contentType:"application/json"})});
  });
}
