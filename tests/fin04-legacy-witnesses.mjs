import assert from 'node:assert/strict';
export const uuid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const expense={id:uuid,date:'2026-10-19T10:00:00.000Z',amount:20,merchant:'Nuevo',category:'super',source:'manual',ent:'sabadell'};
const plain=x=>JSON.parse(JSON.stringify(x));
const cents=(c,rows,deleted)=>rows.filter(e=>!c.expenseIsTombstoned(e,deleted)).reduce((n,e)=>n+Math.round(e.amount*100),0);
export function legacyWitness(c,kind){
  const live={...expense},old={...live,merchant:'Anterior'};
  if(kind==='tombstone'){
    const deleted={[c.keyOfExpense(old)]:1};
    for(const rows of [[old,live],[live,old]]){
      assert.equal(cents(c,rows,deleted),2000,'oráculo inicial: solo la copia viva cuenta');
      const one=c.uniqueExpenseUuids(rows,deleted);
      assert.equal(cents(c,one,deleted),2000,'dedup no puede convertir20euros en0');
      assert.equal(one.length,1);assert.equal(one[0].merchant,'Nuevo');
      const merged=c.mergeExpensesFromCloud(rows,[],undefined,deleted);
      assert.equal(cents(c,merged.list,deleted),2000,'pull sin fila no pierde importe');
      assert.equal(cents(c,c.mergeExpensesFromCloud(rows,[old],undefined,deleted).list,deleted),2000,'pull de copia borrada no oculta la copia viva');
    }
    assert.equal(c.uniqueExpenseUuids([old,live],{})[0].merchant,'Nuevo','empate legacy sin sellos: última copia');
    const all={[c.keyOfExpense(old)]:1,[c.keyOfExpense(live)]:1};
    assert.equal(cents(c,c.uniqueExpenseUuids([old,live],all),all),0,'no resucitar si ambas están borradas');
    const s={accounts:[],investments:[],assets:[],debts:[],fixed:[],flows:[],oneoffs:[],aportaciones:[],goals:[],shared:[],history:[],catOverrides:{},obAccounts:[],settings:{autoPrices:false},expenses:[old,live],deleted:[c.keyOfExpense(old)],_dataVer:6,onboarded:true};
    for(const expenses of [[old,live],[live,old]]){
      c.mcSaveRaw('micartera_v3',{...s,expenses});const loaded=c.loadState(),stored=c.mcLoadRaw('micartera_v3');
      assert.equal(cents(c,loaded.expenses,deleted),2000,'loadState conserva importe vivo');
      assert.equal(cents(c,stored.expenses,deleted),2000,'persistencia partida conserva importe vivo');
    }
  }else if(kind==='metadata'){
    for(const [field,value,mark] of [['category','ocio',{catStale:['super']}],['debtId','debt-synthetic',{}],['noCard',true,{}],['note','Humana',{noteEdited:true}]]){
      for(const rows of [[{...old,[field]:value,...mark},live],[old,{...live,[field]:value,...mark}]]){
        const one=c.uniqueExpenseUuids(rows.map(e=>({...e,source:'ob'})),{});assert.equal(one.length,1);assert.equal(one[0][field],value,'preservar '+field+' desde cualquiera de las copias');assert.equal(cents(c,one,{}),2000);
        const stale={...live,source:'ob',noCard:false,debtId:'stale-debt'};
        const pulled=c.mergeExpensesFromCloud(one,[stale],undefined,{}).list;
        assert.equal(pulled[0][field],value,'pull viejo conserva '+field);
        assert.equal(c.mergeExpensesFromCloud(plain(pulled),[stale],undefined,{}).list[0][field],value,'recarga conserva '+field);
      }
    }
    const cleared=c.uniqueExpenseUuids([{...old,noCard:true,debtId:'debt-old',note:'Vieja',noteEdited:true},{...live,noCard:false,debtId:null,note:'',noteEdited:true}],{});
    assert.equal(cleared[0].noCard,false,'false explícito no vuelve a true');assert.equal(cleared[0].debtId,null,'null explícito no vuelve a cuota');assert.equal(cleared[0].note,'','borrado humano explícito');
    const clearPull=c.mergeExpensesFromCloud(plain(cleared),[{...old,noCard:true,debtId:'debt-old',note:'Vieja'}],undefined,{}).list[0];
    assert.equal(clearPull.noCard,false,'pull tras recarga respeta false explícito');assert.equal(clearPull.debtId,null,'pull tras recarga respeta null explícito');assert.equal(clearPull.note,'','pull tras recarga respeta nota borrada');
  }else if(kind==='amounts'){
    const rows=[old,{...live,amount:-8.97}];
    const expected=[-897,2000];
    for(const result of [c.uniqueExpenseUuids(rows,{}),c.mergeExpensesFromCloud(rows,[],undefined,{}).list,c.mergeExpensesFromCloud(plain(rows),[live],undefined,{}).list])assert.deepEqual(plain(result.map(e=>Math.round(e.amount*100)).sort((a,b)=>a-b)),expected,'UUID conflictivo no permite perder un importe ni el signo');
    c.mcSaveRaw('micartera_v3',{accounts:[],investments:[],assets:[],debts:[],fixed:[],flows:[],oneoffs:[],aportaciones:[],goals:[],shared:[],history:[],catOverrides:{},obAccounts:[],settings:{autoPrices:false},expenses:rows,deleted:[],_dataVer:6,onboarded:true});
    assert.deepEqual(plain(c.loadState().expenses.map(e=>Math.round(e.amount*100)).sort((a,b)=>a-b)),expected,'loadState conserva ambos importes');
    assert.deepEqual(plain(c.mcLoadRaw('micartera_v3').expenses.map(e=>Math.round(e.amount*100)).sort((a,b)=>a-b)),expected,'partición durable conserva ambos importes');
    assert.equal(cents(c,rows,{}),1103);assert.equal(cents(c,c.mergeExpensesFromCloud(rows,[],undefined,{}).list,{}),1103);
  }else if(kind==='references'){
    const rows=[{...old,source:'ob',extId:'ref-A'},{...live,source:'ob',extId:'ref-B'}];
    assert.equal(c.uniqueExpenseUuids(rows,{}).length,2,'referencias distintas no se borran aunque un UUID legacy colisione');
    assert.equal(c.mergeExpensesFromCloud(rows,[],undefined,{}).list.length,2);
  }else throw Error(kind);
}
