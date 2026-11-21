/* ============================================================
   HOGAR — vista fusionada por snapshots (Fase 1+2)
   Cada miembro publica SU vista; el hogar suma sin escribir en app_state ajeno.
   Fase 2: gastos por categoría + fijos (solo lectura, agregados).
   ============================================================ */

/* 10 caracteres y ALEATORIO DE VERDAD (13/9, OPS-06 P1). Eran 6 con `Math.random`: 32⁶ ≈ mil
   millones y sin freno al probar. Con 10 (32¹⁰ ≈ 10¹⁵) y el freno de la migración 0022, adivinar
   un hogar ajeno deja de ser posible. Los códigos viejos de 6 siguen valiendo. Sin I/O/0/1 para
   que no se confundan al dictarlo. */
function mcInviteCode(){
  const c="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf=new Uint32Array(10);
  (window.crypto||self.crypto).getRandomValues(buf);
  let s=""; for(let i=0;i<10;i++) s+=c[buf[i]%c.length];
  return s;
}

function buildHouseholdSnapshot(state, totals, email){
  /* Cada cuenta con SU saldo pintado (`saldoCuentaMostrada`, con los mismos insumos que `totals`),
     no el total de su banco (ronda 240, P3.4 de la revisión 238): con dos cuentas del mismo banco
     cada fila llevaba `bankBal[ent]` entero y la foto enseñaba el banco dos veces. Sumadas por
     banco dan justo `bankBal`. Sin `totals` (pruebas y arranque), `value` a pelo, como antes. */
  const ins={ injTR:totals.injTR, spentByBank:totals.spentByBank, paidNetByBank:totals.paidNetByBank,
    roundup:totals.roundupThisMonth, monthlyInvest:totals.monthlyInvestThisMonth };
  const accounts=(state.accounts||[]).map(function(a){
    const ent=entOf(a.ent);
    const val=saldoCuentaMostrada(a, ins);
    return { name:a.name||ent.label, ent:a.ent, label:ent.label, value:+Number(val).toFixed(2) };
  });
  // Gastos del mes por categoría (sin comercios: privacidad)
  const byCat={};
  const monthStart=startOfMonth();
  (state.expenses||[]).forEach(function(e){
    if(!(e.amount>0)) return;
    // Un posible repetido (también la fila oculta de una pareja automática) no mueve ninguna cifra:
    // la foto del hogar contaba dos veces la misma compra (14/10/2026).
    if(e.possibleDup) return;
    if(parseDate(e.date)<monthStart) return;
    // El cargo de un recibo ya sale en los fijos de esta misma foto: aquí lo contaría dos veces.
    if(cargoDeRecibo(e, state)) return;
    // Lo que va a una meta no es gasto: tampoco lo es en la foto del hogar.
    if(metaDeGasto(e)) return;
    // Dinero que cambia de cuenta: la foto del hogar lo enseñaría como gasto de «Otros».
    if(traspasoPropioDerivado(e,state)) return;
    const k=e.category||"otros";
    byCat[k]=(byCat[k]||0)+e.amount;
  });
  const expensesByCat=Object.keys(byCat).map(function(id){
    return { id:id, spent:+Number(byCat[id]).toFixed(2) };
  }).sort(function(a,b){ return b.spent-a.spent; }).slice(0,8);
  /* «Gastado» = el bruto menos las patas de un traspaso entre tus cuentas (derivado al leer): con las patas en
     meses distintos (31/10 y 02/11) el bruto de noviembre queda en negativo y no cuadra con el desglose.
     Sin tocar `thisMonthSpent` ni los saldos; nunca por debajo de 0. */
  let gastadoHogar=Number(totals.thisMonthSpent||0);
  if(gastadoHogar!==0){
    (state.expenses||[]).forEach(function(e){
      if(parseDate(e.date)>=monthStart&&expenseCountsCash(e,state)&&traspasoPropioDerivado(e,state)) gastadoHogar-=Number(e.amount)||0;
    });
    gastadoHogar=Math.max(0,gastadoHogar);
  }
  // Fijos: total mensual + top 5 (nombre + importe, sin cuentas bancarias)
  const fixedTop=(state.fixed||[]).map(function(f){
    // Misma mensualidad que el total de arriba (`fixedMonthlyOf`): respeta los importes por cobro.
    return { name:f.name||"?", amount:+Number(fixedMonthlyOf(f)).toFixed(2) };
  }).filter(function(f){ return f.amount>0; })
    .sort(function(a,b){ return b.amount-a.amount; }).slice(0,5);
  return {
    displayName:(email&&email.split("@")[0])||"Usuario",
    netWorth:+Number(totals.netWorth||0).toFixed(2),
    activos:+Number(totals.activos||0).toFixed(2),
    debtTotal:+Number(totals.debtTotal||0).toFixed(2),
    invested:+Number(totals.invested||0).toFixed(2),
    liquid:+Number((totals.liquid)||0).toFixed(2),
    thisMonthSpent:+Number(gastadoHogar).toFixed(2),
    budget:state.budget||0,
    accounts:accounts,
    expensesByCat:expensesByCat,
    fixedMonthly:+Number(totals.fijosMensual||0).toFixed(2),
    fixedThisMonth:+Number(totals.fijosEsteMes||0).toFixed(2),
    fixedTop:fixedTop,
    appVersion:CONFIG.APP_VERSION,
    publishedAt:new Date().toISOString(),
  };
}

function mergeHouseholdSnapshots(snaps){
  const list=(snaps||[]).filter(function(s){ return s&&s.payload; });
  let net=0, activos=0, debts=0, invested=0, spent=0, fixedM=0;
  const catMap={};
  const byMember=[];
  list.forEach(function(row){
    const p=row.payload||{};
    net+=Number(p.netWorth)||0;
    activos+=Number(p.activos)||0;
    debts+=Number(p.debtTotal)||0;
    invested+=Number(p.invested)||0;
    spent+=Number(p.thisMonthSpent)||0;
    fixedM+=Number(p.fixedMonthly)||0;
    (p.expensesByCat||[]).forEach(function(c){
      catMap[c.id]=(catMap[c.id]||0)+(Number(c.spent)||0);
    });
    byMember.push({
      userId:row.user_id,
      name:p.displayName||"?",
      netWorth:Number(p.netWorth)||0,
      thisMonthSpent:Number(p.thisMonthSpent)||0,
      fixedMonthly:Number(p.fixedMonthly)||0,
      accounts:p.accounts||[],
      fixedTop:p.fixedTop||[],
      expensesByCat:p.expensesByCat||[],
      publishedAt:row.published_at||p.publishedAt,
    });
  });
  const expensesByCat=Object.keys(catMap).map(function(id){
    return { id:id, spent:+Number(catMap[id]).toFixed(2) };
  }).sort(function(a,b){ return b.spent-a.spent; });
  return {
    netWorth:+net.toFixed(2),
    activos:+activos.toFixed(2),
    debtTotal:+debts.toFixed(2),
    invested:+invested.toFixed(2),
    thisMonthSpent:+spent.toFixed(2),
    fixedMonthly:+fixedM.toFixed(2),
    expensesByCat:expensesByCat,
    members:byMember,
  };
}

function HogarSection({state, totals, uid, showToast, meEmail}){
  const [hh,setHh]=useState(null);
  const [snaps,setSnaps]=useState([]);
  const [busy,setBusy]=useState(false);
  const [joinCode,setJoinCode]=useState("");
  const [createName,setCreateName]=useState("");
  const [mode,setMode]=useState(null);
  const [members,setMembers]=useState([]);
  const [myRole,setMyRole]=useState(null);

  const reload=function(){
    if(!cloud.enabled()||!uid) return Promise.resolve();
    setBusy(true);
    return cloud.fetchHouseholdBundle().then(function(b){
      setHh(b.household); setSnaps(b.snapshots||[]); setMembers(b.members||[]); setMyRole(b.myRole||null);
    }).catch(function(e){
      showToast(errTxt(e));
    }).finally(function(){ setBusy(false); });
  };

  useEffect(function(){ reload(); },[uid]);

  const merged=useMemo(function(){ return mergeHouseholdSnapshots(snaps); },[snaps]);

  const publish=function(){
    if(!hh) return;
    setBusy(true);
    const payload=buildHouseholdSnapshot(state, totals, meEmail);
    cloud.publishHouseholdSnapshot(hh.id, payload).then(function(){
      showToast(t("hh_pub_ok"));
      return reload();
    }).catch(function(e){ showToast(errTxt(e)); }).finally(function(){ setBusy(false); });
  };

  const doCreate=function(){
    const nm=(createName||"").trim()||t("hh_default_name");
    setBusy(true);
    cloud.createHousehold(nm, mcInviteCode()).then(function(){
      showToast(t("hh_created"));
      setMode(null);
      return reload();
    }).catch(function(e){
      const m=(e&&e.message)||String(e);
      // RLS rota en la BD (caso real 2026-07-18, se arregla con la migración 0015): a la familia
      // le decimos que no se guardó; lo de Supabase no lo puede arreglar ella (auditoría 14/11/2026).
      showToast(m.indexOf("row-level security")>=0 ? ("✕ "+t("hh_rls_fix")) : errTxt(e));
    }).finally(function(){ setBusy(false); });
  };

  const doJoin=function(){
    const code=(joinCode||"").trim();
    if(code.length<4){ showToast(t("hh_code_short")); return; }
    setBusy(true);
    cloud.joinHousehold(code).then(function(){
      showToast(t("hh_joined"));
      setMode(null); setJoinCode("");
      return reload();
    }).catch(function(e){
      const m=(e&&e.message)||String(e);
      showToast(m.indexOf("too_many")>=0 ? ("⚠ "+t("hh_code_wait")) : (m.indexOf("invalid")>=0?t("hh_code_bad"):errTxt(e)));
    }).finally(function(){ setBusy(false); });
  };

  const doLeave=function(){
    if(!hh) return;
    askConfirm({ title:t("hh_leave_q"), sub:t("hh_leave_sub"), ok:t("hh_leave_ok"), danger:true }).then(function(yes){
      if(!yes) return;
      setBusy(true);
      cloud.leaveHousehold(hh.id).then(function(){
        showToast(t("hh_left"));
        setHh(null); setSnaps([]);
      }).catch(function(e){ showToast(errTxt(e)); }).finally(function(){ setBusy(false); });
    });
  };

  /* SEG-10: el código ya no vale para siempre. Regenerarlo invalida el anterior (quien lo tuviera
     apuntado ya no entra) y, con la migración 0028, caduca a los 30 días. */
  const doRegen=function(){
    if(!hh) return;
    askConfirm({ title:t("hh_regen_q"), sub:t("hh_regen_sub"), ok:t("hh_regen") }).then(function(yes){
      if(!yes) return;
      setBusy(true);
      cloud.regenHouseholdCode(hh.id, mcInviteCode()).then(function(r){
        if(r) setHh(Object.assign({},hh,r));
        showToast(t("hh_regen_ok"));
      }).catch(function(e){ showToast(errTxt(e)); }).finally(function(){ setBusy(false); });
    });
  };
  // Quitar a alguien solo lo puede el dueño, y solo con la 0028 aplicada (su política de borrado):
  // sin ella la RLS no borra nada y lo decimos en vez de fingir que salió.
  const doKick=function(m){
    if(!hh||!m) return;
    askConfirm({ title:tf("hh_kick_q",{name:m.name}), sub:t("hh_kick_sub"), ok:t("hh_kick_ok"), danger:true }).then(function(yes){
      if(!yes) return;
      setBusy(true);
      cloud.kickHouseholdMember(hh.id, m.userId).then(function(){
        showToast(t("hh_kicked"));
        return reload();
      }).catch(function(e){
        const msg=(e&&e.message)||String(e);
        showToast(msg.indexOf("not_allowed")>=0 ? ("⚠ "+t("hh_kick_no")) : errTxt(e));
      }).finally(function(){ setBusy(false); });
    });
  };

  if(!cloud.enabled()){
    return React.createElement("div",{className:"card",style:{padding:"14px 16px",marginBottom:14}},
      React.createElement("div",{className:"gm-sec-h"},"🏠 "+t("hh_title")),
      React.createElement("div",{className:"hint"}, t("hh_need_cloud"))
    );
  }
  if(!uid){
    return React.createElement("div",{className:"card",style:{padding:"14px 16px",marginBottom:14}},
      React.createElement("div",{className:"gm-sec-h"},"🏠 "+t("hh_title")),
      React.createElement("div",{className:"hint"}, t("hh_need_login"))
    );
  }

  if(!hh){
    return React.createElement("div",{className:"card",style:{padding:"14px 16px",marginBottom:14}},
      React.createElement("div",{className:"gm-sec-h"},"🏠 "+t("hh_title")),
      React.createElement("div",{className:"hint",style:{marginBottom:10}}, t("hh_intro")),
      mode!=="create" && mode!=="join" && React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:8}},
        React.createElement("button",{className:"btn btn-primary btn-block",onClick:function(){ setMode("create"); }}, t("hh_create")),
        React.createElement("button",{className:"btn btn-ghost btn-block",onClick:function(){ setMode("join"); }}, t("hh_join"))
      ),
      mode==="create" && React.createElement("div",{style:{marginTop:8}},
        React.createElement("input",{className:"af-in",placeholder:t("hh_name_ph"),value:createName,onChange:function(e){ setCreateName(e.target.value); }}),
        React.createElement("button",{className:"btn btn-primary btn-block",style:{marginTop:8},onClick:doCreate,disabled:busy}, t("hh_create_go")),
        React.createElement("button",{className:"btn btn-ghost btn-block",onClick:function(){ setMode(null); }}, t("sh_cancel"))
      ),
      mode==="join" && React.createElement("div",{style:{marginTop:8}},
        React.createElement("input",{className:"af-in",placeholder:t("hh_code_ph"),value:joinCode,onChange:function(e){ setJoinCode(e.target.value.toUpperCase()); },style:{letterSpacing:"0.15em",fontWeight:700}}),
        React.createElement("button",{className:"btn btn-primary btn-block",style:{marginTop:8},onClick:doJoin,disabled:busy}, t("hh_join_go")),
        React.createElement("button",{className:"btn btn-ghost btn-block",onClick:function(){ setMode(null); }}, t("sh_cancel"))
      )
    );
  }

  const maxCat=merged.expensesByCat.length?merged.expensesByCat[0].spent:1;
  const isOwner=myRole==="owner"||(!!uid&&hh.created_by===uid);
  const flojo=isOwner&&hhCodigoFlojo(hh);
  const caduca=hh.invite_expires_at?new Date(hh.invite_expires_at):null;
  // Los nombres salen de la vista que cada uno publica; quien aún no ha publicado es «Miembro».
  const otros=isOwner?members.filter(function(m){ return m&&m.user_id&&m.user_id!==uid; }).map(function(m){
    const s=merged.members.find(function(x){ return x.userId===m.user_id; });
    return { userId:m.user_id, name:(s&&s.name&&s.name!=="?")?s.name:t("hh_member") };
  }):[];

  return React.createElement("div",{className:"card",style:{padding:"14px 16px",marginBottom:14},"data-hogar":"1"},
    React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}},
      React.createElement("div",{style:{minWidth:0}},
        React.createElement("div",{className:"gm-sec-h"},"🏠 "+hh.name),
        React.createElement("div",{className:"hint","data-hogar-code":"1",style:{overflowWrap:"anywhere"}}, tf("hh_code_show",{c:hh.invite_code})
          +(caduca&&isFinite(caduca.getTime())&&!flojo?" · "+tf("hh_code_until",{d:caduca.toLocaleDateString(loc(),{day:"2-digit",month:"2-digit"})}):""))),
      React.createElement("button",{className:"btn btn-ghost",style:{flex:"0 0 auto",fontSize:12},onClick:doLeave}, t("hh_leave"))
    ),
    flojo && React.createElement("div",{"data-hogar-flojo":"1",style:{marginTop:10}},
      React.createElement("div",{className:"hint",style:{color:"var(--coral)"}}, t("hh_code_old")),
      React.createElement("button",{className:"btn btn-primary btn-block",style:{marginTop:8},disabled:busy,"data-act":"hh-regen",onClick:doRegen}, t("hh_regen"))),
    isOwner && !flojo && React.createElement("button",{className:"chip",style:{marginTop:8},disabled:busy,"data-act":"hh-regen",onClick:doRegen}, t("hh_regen")),
    React.createElement("div",{className:"total-bar",style:{marginTop:12,marginBottom:0}},
      React.createElement("div",null,
        React.createElement("div",{className:"tl"}, t("hh_fused_net")),
        React.createElement("div",{className:"tn num"}, eur(merged.netWorth)),
        React.createElement("div",{className:"hint"}, merged.members.length===1?t("hh_members_one"):tf("hh_members_n",{n:merged.members.length}))
      )
    ),
    // Fase 2 · gasto del hogar este mes
    React.createElement("div",{style:{marginTop:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}},
      React.createElement("div",{className:"metric",style:{padding:12}},
        React.createElement("div",{className:"mlabel"}, t("hh_spent_m")),
        React.createElement("div",{className:"num",style:{fontWeight:800,fontSize:18}}, eur0(merged.thisMonthSpent))),
      React.createElement("div",{className:"metric",style:{padding:12}},
        React.createElement("div",{className:"mlabel"}, t("hh_fixed_m")),
        React.createElement("div",{className:"num",style:{fontWeight:800,fontSize:18}}, eur0(merged.fixedMonthly)))
    ),
    merged.expensesByCat.length>0 && React.createElement("div",{style:{marginTop:14}},
      React.createElement("div",{className:"gm-sec-h"}, t("hh_cats")),
      merged.expensesByCat.slice(0,6).map(function(c){
        const cat=catOf(c.id);
        const pct=Math.max(4, Math.round(100*c.spent/maxCat));
        return React.createElement("div",{key:c.id,style:{marginTop:8}},
          React.createElement("div",{style:{display:"flex",justifyContent:"space-between",fontSize:13}},
            React.createElement("span",null, (cat.icon||"")+" "+catName(c.id)),
            React.createElement("span",{className:"num",style:{fontWeight:700}}, eur0(c.spent))),
          React.createElement("div",{className:"bar",style:{marginTop:4}},
            React.createElement("i",{style:{width:pct+"%",background:cat.color||"var(--mint)"}}))
        );
      })
    ),
    merged.members.map(function(m,i){
      return React.createElement("div",{key:m.userId||i,style:{marginTop:12,paddingTop:12,borderTop:"1px solid var(--line-soft)"}},
        React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
          React.createElement("span",{style:{fontWeight:700}}, m.name),
          React.createElement("span",{className:"num",style:{fontWeight:700}}, eur(m.netWorth))),
        React.createElement("div",{className:"hint",style:{marginTop:4}},
          t("hh_spent_m")+": "+eur0(m.thisMonthSpent)+" · "+t("hh_fixed_m")+": "+eur0(m.fixedMonthly)),
        (m.accounts||[]).slice(0,6).map(function(a,j){
          return React.createElement("div",{key:j,className:"liqrow",style:{fontSize:12.5,marginTop:4}},
            React.createElement("span",{className:"muted"}, (a.label||a.name)),
            React.createElement("span",{className:"num"}, eur0(a.value)));
        }),
        (m.fixedTop||[]).length>0 && React.createElement("div",{style:{marginTop:6}},
          React.createElement("div",{className:"hint",style:{fontSize:11}}, t("hh_fixed_top")),
          m.fixedTop.map(function(f,j){
            return React.createElement("div",{key:j,className:"liqrow",style:{fontSize:12,marginTop:2}},
              React.createElement("span",{className:"muted"}, f.name),
              React.createElement("span",{className:"num"}, eur0(f.amount)));
          })
        ),
        m.publishedAt && React.createElement("div",{className:"hint",style:{fontSize:11,marginTop:4}},
          // Sin segundos ni año: «Actualizado 18 nov, 11:00» (filtro de diseño, ronda F).
          t("hh_updated")+" "+new Date(m.publishedAt).toLocaleString(loc(),{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}))
      );
    }),
    otros.length>0 && React.createElement("div",{"data-hogar-miembros":"1",style:{marginTop:14,paddingTop:12,borderTop:"1px solid var(--line-soft)"}},
      React.createElement("div",{className:"gm-sec-h"}, t("hh_members")),
      otros.map(function(m){
        return React.createElement("div",{key:m.userId,className:"liqrow","data-hogar-miembro":m.userId,style:{alignItems:"center",gap:8,marginTop:6}},
          React.createElement("span",{style:{minWidth:0,overflowWrap:"anywhere"}}, m.name),
          React.createElement("button",{className:"chip",style:{flex:"0 0 auto"},disabled:busy,onClick:function(){ doKick(m); }}, t("hh_kick")));
      })),
    React.createElement("button",{className:"btn btn-primary btn-block",style:{marginTop:14},onClick:publish,disabled:busy},
      busy?t("hh_pub_busy"):t("hh_publish")),
    React.createElement("div",{className:"hint",style:{marginTop:8}}, t("hh_pub_hint"))
  );
}
