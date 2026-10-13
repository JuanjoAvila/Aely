// Doble de tabla con filtros reales y ACK completo. No se conecta a ningún backend.
export async function installExpenseTable(page,initialMode='zero'){
  await page.addInitScript(initialMode=>{
    const saved=JSON.parse(localStorage.getItem('_expenseAckRows')||'null');
    if(saved)window.__e2eCloudRows.expenses=saved;
    (window.__e2eCloudRows.expenses||[]).forEach(r=>{r.user_id=r.user_id||'e2e-user';});
    const f=window.__expenseTable={mode:localStorage.getItem('_expenseAckMode')||initialMode,calls:[],session:true,
      save(){localStorage.setItem('_expenseAckRows',JSON.stringify(window.__e2eCloudRows.expenses));localStorage.setItem('_expenseAckMode',this.mode);}};
    const desc=Object.getOwnPropertyDescriptor(window,'supabase');
    Object.defineProperty(window,'supabase',{configurable:true,set:desc.set,get(){
      const lib=desc.get();if(!lib)return lib;
      return {createClient(){const base=lib.createClient();return {...base,
        auth:{...base.auth,getSession:async()=>f.session?base.auth.getSession():{data:{session:null}}},
        from(table){
          if(table!=='expenses')return base.from(table);
          const filters=[];let patch=null,deleted=false,single=false,limit=Infinity,before=null;
          const q={select(){return q},eq(k,v){filters.push([k,v]);return q},is(k,v){filters.push([k,v]);return q},
            update(v){patch=v;return q},delete(){deleted=true;return q},order(){return q},limit(n){limit=n;return q},lt(k,v){before=v;return q},
            upsert(){f.calls.push({insert:true});return {then:resolve=>resolve({data:[],error:null})}},
            maybeSingle(){single=true;return q},then(resolve,reject){return Promise.resolve().then(()=>{
              const rows=window.__e2eCloudRows.expenses||[],write=patch||deleted;
              if(write)f.calls.push({patch,deleted,filters:[...filters]});
              if(f.mode==='error')return {data:null,error:{message:'synthetic offline'}};
              if(write&&f.mode==='unique')return {data:null,error:{code:'23505',message:'synthetic collision'}};
              const hit=rows.filter(r=>filters.every(([k,v])=>(r[k]??null)===v)&&(!before||r.id<before)).sort((a,b)=>b.id.localeCompare(a.id)).slice(0,limit);
              if(write&&f.mode==='zero')return {data:null,error:null};
              const result=hit.map(r=>({...r,...patch}));
              if(patch)hit.forEach(r=>Object.assign(r,patch));
              if(deleted)window.__e2eCloudRows.expenses=rows.filter(r=>!hit.includes(r));
              if(write)f.save();
              if(write&&f.mode==='lost')throw Error('synthetic lost response');
              return {data:single?result[0]||null:result,error:null};
            }).then(resolve,reject)}};return q;
        }};}};
    }});
  },initialMode);
}
