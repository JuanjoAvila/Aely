import { readBodyLimited, readInput, BODY_LIMITS } from './request_body.ts';
function assert(ok:unknown,message:string):asserts ok{if(!ok)throw Error(message);}
Deno.test('reader exact byte boundary and UTF8 decoding',async()=>{
 for(const [raw,max] of [['x'.repeat(1024),1024],['漢',3]] as const){const read=await readBodyLimited(new Request('https://synthetic.invalid/',{method:'POST',body:raw}),max);assert(read.ok&&read.text===raw,'exact byte boundary must pass');}
 const bad=await readBodyLimited(new Request('https://synthetic.invalid/',{method:'POST',body:new Uint8Array([0xff])}),1024);assert(!bad.ok&&bad.status===400,'malformed UTF8 must reject');
});
Deno.test('reader cancellation cannot block413',async()=>{
 let cancelled=false;const stream=new ReadableStream<Uint8Array>({start(c){c.enqueue(new Uint8Array(2048));},cancel(){cancelled=true;return new Promise(()=>{});}});
 const result=await Promise.race([readBodyLimited(new Request('https://synthetic.invalid/',{method:'POST',body:stream}),1024),new Promise<null>(resolve=>setTimeout(()=>resolve(null),50))]);
 assert(result&&!result.ok&&result.status===413&&cancelled,'uncooperative cancel must not stall response');
});
Deno.test('bank sync retains future acks and recognized body variants',async()=>{
 for(const body of [{recoverGaps:true,acks:{future:{v:2}},extra:{version:2}},{dateFrom:'2026-02-28T12:00:00.000Z',aspsps:[null,'Synthetic','']},{}]){const input=await readInput(new Request('https://synthetic.invalid/',{method:'POST',body:JSON.stringify(body)}),'bank-sync');assert(input.ok&&JSON.stringify(input.body)===JSON.stringify(body),'validation must not alter payload');}
});
Deno.test('field shapes reject before generic JSON can reach effects',async()=>{
 const invalid:Record<string,unknown[]>={'bank-aspsps':[{country:3}],'bank-connect':[{country:'ESP'},{aspsp_name:{}},{platform:'other'}],'bank-disconnect':[{aspsp_name:[]}],'bank-sync':[{recoverGaps:'true'},{aspsps:[{}]},{dateFrom:'2026-02-30'}],categorize:[{merchant:42}],'delete-account':[{password:{}}],'bank-callback':[{ignored:true}]};
 for(const [name,bodies] of Object.entries(invalid))for(const body of bodies){const r=await readInput(new Request('https://synthetic.invalid/',{method:'POST',body:JSON.stringify(body)}),name as keyof typeof BODY_LIMITS);assert(!r.ok&&r.status===400,'invalid field accepted:'+name);}
});
