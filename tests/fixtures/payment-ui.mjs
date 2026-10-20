// Synthetic regressions for the two October Plan/detail disagreements. No personal data.
export function paymentFixture(kind='receipt'){
  const expense={id:'expense-synthetic',extId:'ref-synthetic',obAcc:'account-synthetic',date:'2026-10-17',merchant:'TRANSFERENCIA A PERSONA SINTETICA',obName:'TRANSFERENCIA A PERSONA SINTETICA',amount:197,ent:'sabadell',category:'recibos',source:'ob',status:'BOOK'};
  const s={accounts:[{id:'account-synthetic',ent:'sabadell',role:'ambos',spendFrom:true,value:800}],fixed:[],expenses:[expense],bankTx:[],debts:[],oneoffs:[],deleted:[],flows:[]};
  if(kind==='receipt'){
    Object.assign(expense,{date:'2026-10-10',merchant:'YOUTUBE PREMIUM',obName:'YOUTUBE PREMIUM',amount:29.99,category:'suscripciones'});
    const receipt={id:'receipt-synthetic',name:'YouTube Premium',amount:29.99,account:'sabadell',freq:'mes',day:10};
    receipt.paymentProofs={24322:{kind:'book',key:'sabadell|ref-synthetic',identity:'["sabadell","2026-10-10",29.99,"YOUTUBE PREMIUM"]',date:'2026-10-10',bank:'sabadell',merchant:'YOUTUBE PREMIUM',amount:29.99,modelVersion:2,receiptId:receipt.id,receiptName:receipt.name,model:'["receipt-synthetic","sabadell",29.99,null]'}};
    s.fixed=[receipt];s.bankTx=[{id:expense.extId,ent:expense.ent,date:expense.date,amount:expense.amount,merchant:expense.merchant,status:'BOOK',acc:expense.obAcc}];
  }else{
    s.debts=[{id:'debt-synthetic',name:'Prestamo vivienda sintetico',value:9000,original:9000,monthly:197,account:'sabadell',day:5}];
    s.fixed=[{id:'light-synthetic',name:'Luz sintetica',amount:42,account:'sabadell',freq:'mes',day:10}];
    if(kind==='linked-debt')Object.assign(expense,{debtId:s.debts[0].id,category:'deudas'});
  }
  return s;
}
