/* ============================================================
   TAB: PATRIMONIO
   ============================================================ */
function Wealth({state, set, totals, v4Embed, parte}){
  const [delAcc,setDelAcc]=React.useState("");   // id de la cuenta manual pendiente de confirmar borrado
  // Quitar a mano una cuenta manual del patrimonio (la del onboarding no se va sola al desloguear el banco:
  // las manuales viven en state.accounts, no en obAccounts, y bankDisconnect solo purga obAccounts).
  const removeAccount=(id)=>{ setDelAcc(""); set(function(s){ return Object.assign({},s,{accounts:(s.accounts||[]).filter(function(a){ return a.id!==id; })}); }); };
  const pn=(i)=> (totals.paidNetByBank&&totals.paidNetByBank[i.ent])||0;   // movimientos ya ocurridos este mes
  const ruM=totals.roundupThisMonth||0;                                     // round-up del mes (sale del efectivo de gasto)
  const miM=totals.monthlyInvestThisMonth||0;                               // aporte periódico del mes (idem)
  const spentOwn=(i)=> (totals.spentByBank&&i.ent&&totals.spentByBank[i.ent])||0;
  const spendBal=(i)=> saldoCuentaGasto({value:i.value, injTR:totals.injTR||0, spentOwn:spentOwn(i), roundup:ruM, monthlyInvest:miM, ambos:accRole(i)==="ambos", paidNet:pn(i)});
  // ROLES DE CUENTA: al cambiar el rol se RE-ANCLA `value` para que el saldo mostrado no cambie
  // (despejamos value de la fórmula del rol nuevo). Solo puede haber UNA cuenta de gasto diario.
  const setRole=(id,r)=>{ set(function(s){ return applyAccountRole(s, totals, id, r); }); };   // lógica compartida (applyAccountRole)
  const accEd=useEditable(state.accounts,it=>set(s=>Object.assign({},s,{accounts:it})),{
    // Editas el SALDO REAL de hoy; por dentro se guarda la base (inicio de mes) correcta.
    display:  i => accDaily(i) ? spendBal(i) : (i.value + pn(i)),
    // editar a mano re-ancla: typed = spendBal(nuevo value) → despeja value (incluye miM, que faltaba)
    toStored: (i,typed) => accDaily(i) ? valueDesdeSaldo({shown:typed, injTR:totals.injTR||0, spentOwn:spentOwn(i), roundup:ruM, monthlyInvest:miM, ambos:accRole(i)==="ambos", paidNet:pn(i)}) : (typed - pn(i))
  });
  const astEd=useEditable(state.assets,it=>set(s=>Object.assign({},s,{assets:it})));
  const accSum=totals.liquid;
  const astSum=state.assets.reduce((a,i)=>a+i.value,0);
  const tt=totals;
  // En Cartera (v4Embed) pintamos cuentas y bienes planos; inversiones van aparte (Investments).
  if(v4Embed){
    // Rol EFECTIVO para pintar (feedback 2026-07-21, como Trade Republic original: el rol va
    // DEBAJO del banco, sin carritos sueltos): «gasto diario» cuenta tanto si la cuenta es la
    // principal (rol diario/ambos) como si su banco es extra de gasto diario (expenseBanks);
    // «recibos» se apaga en los extras marcados solo-diario (settings.dailyOnlyBanks — flag
    // SOLO visual: sin recibos domiciliados en ese banco no mueve ningún número).
    const expDaily=expenseBankEnts(state);
    const dailyOnlyEnts=function(s){ return ((s&&s.settings&&s.settings.dailyOnlyBanks)||[]); };
    const dailyEffOf=function(a){ return accDaily(a) || expDaily.indexOf(a.ent)>=0; };
    const fixedEffOf=function(a){ return accRole(a)==="ambos" || (accFixed(a) && !(dailyEffOf(a) && dailyOnlyEnts(state).indexOf(a.ent)>=0)); };
    const roleLab=function(a){
      const dy=dailyEffOf(a), fx=fixedEffOf(a);
      if(dy&&fx) return t("rl_diario")+" · "+t("rl_fijos");
      if(dy) return t("rl_diario");
      if(fx) return t("rl_fijos");
      return a.name||"";
    };
    // Cuenta re-anclada por Open Banking: su saldo lo trae el banco (no se edita a mano).
    const isSynced=function(a){ return !!a.bankIban; };
    const badge=function(txt, color){
      return React.createElement("span",{className:"v4-ob-badge",style:{background:color+"22",color:color}}, txt);
    };
    const accRow=function(a){
      return React.createElement("div",{className:"v4-mov",key:a.id},
        React.createElement("div",{className:"tile",style:{background:"transparent",border:"none",padding:0}},React.createElement(Mono,{ent:a.ent,size:44})),
        React.createElement("div",{className:"nm"},
          React.createElement("div",null,entOf(a.ent).label, isSynced(a)&&badge(t("pt_ob_badge"),"#7FB5E8")),
          React.createElement("div",{className:"meta"}, [roleLab(a),a.name].filter(Boolean).join(" · ")||"—")
        ),
        React.createElement("div",{className:"am num"},eur(accDaily(a)?spendBal(a):(a.value+pn(a))))
      );
    };
    const obRow=function(o){
      const custom=(state.obLabels||{})[o.key]; const disp=(custom!=null&&custom!=="")?custom:niceObName(o);
      // La badge va en la línea de meta, no pegada al nombre: con nombres largos (o «caducado»)
      // se cortaba y descuadraba la fila (feedback 2026-07-18).
      return React.createElement("div",{className:"v4-mov",key:"ob_"+o.key},
        React.createElement("div",{className:"tile",style:{background:"transparent",border:"none",padding:0}},React.createElement(Mono,{ent:o.ent||"",size:44})),
        React.createElement("div",{className:"nm"},
          React.createElement("div",null, disp),
          React.createElement("div",{className:"meta"}, entOf(o.ent).label,
            o.stale ? badge(t("pt_ob_badge")+" · "+t("bp_st_expired"),"#E2A05F") : badge(t("pt_ob_badge"),"#7FB5E8"))
        ),
        React.createElement("div",{className:"am num"}, eur(toEurAmt(o.value||0, o.cur||"EUR", state)))
      );
    };
    // «Gasto diario» sigue admitiendo VARIOS bancos (v4.6.3). Modelo por debajo: UNA cuenta
    // PRINCIPAL de gasto (spendFrom — el motor necesita una sola) + bancos extra en
    // settings.expenseBanks. Lo que cambia (feedback 2026-07-21) es la selección: cada banco
    // muestra UN solo estado — o Recibos, o Gasto diario, o Todo — nada de «recibos fijo» en
    // los extras. En un extra, «Gasto diario» = expenseBanks + dailyOnlyBanks (recibos fuera);
    // «Todo» = expenseBanks sin dailyOnly (recibos y gasto diario a la vez).
    const pickRole=function(a,r){
      // Pide un sync en cuanto se suelta el bloque `set` (React agrupa el estado, el evento no
      // tiene por qué esperar a eso): el banco nuevo puede llevar días sin sincronizar porque
      // hasta ahora no era «suyo» — sin esto sus compras de esta semana se quedan sin traer hasta
      // que alguien pulse «Sincronizar» a mano (2026-08-01, ver 11-app-main.js).
      try{ window.dispatchEvent(new CustomEvent("mc-bank-role-changed")); }catch(e){}
      set(function(s){
        const patchSet=function(ns,patch){ return Object.assign({},ns,{settings:Object.assign({},ns.settings,patch)}); };
        const drop=function(list,e){ const i=list.indexOf(e); if(i>=0) list.splice(i,1); return list; };
        const add=function(list,e){ if(list.indexOf(e)<0) list.push(e); return list; };
        const eb=expenseBankEnts(s).slice();
        const dOnly=dailyOnlyEnts(s).slice();
        const isPrimary=accDaily(a);
        const hasPrimary=(s.accounts||[]).some(function(x){ return accDaily(x); });
        let ns=s;
        if(r==="fijos"){
          if(isPrimary) ns=applyAccountRole(ns, totals, a.id, "fijos");
          return patchSet(ns,{expenseBanks:drop(eb,a.ent), dailyOnlyBanks:drop(dOnly,a.ent)});
        }
        if(r==="diario"){
          // La principal (o la primera que se marca) lleva el rol de verdad; un banco extra
          // se apunta a expenseBanks y apaga su «recibos» visual con dailyOnlyBanks.
          if(isPrimary || !hasPrimary){
            ns=applyAccountRole(ns, totals, a.id, "diario");
            return patchSet(ns,{dailyOnlyBanks:drop(dOnly,a.ent)});
          }
          return patchSet(ns,{expenseBanks:add(eb,a.ent), dailyOnlyBanks:add(dOnly,a.ent)});
        }
        // «Todo»: la principal pasa a rol ambos; un extra queda en expenseBanks CON recibos.
        if(isPrimary || !hasPrimary){
          ns=applyAccountRole(ns, totals, a.id, "ambos");
          return patchSet(ns,{dailyOnlyBanks:drop(dOnly,a.ent)});
        }
        return patchSet(ns,{expenseBanks:add(eb,a.ent), dailyOnlyBanks:drop(dOnly,a.ent)});
      });
    };
    const roleChips=function(a){
      const dy=dailyEffOf(a), fx=fixedEffOf(a);
      const on={fijos:fx&&!dy, diario:dy&&!fx, ambos:fx&&dy};
      return React.createElement("div",{className:"rolechips",style:{padding:"8px 0 2px"}},
        [["fijos","rl_fijos"],["diario","rl_diario"],["ambos","rl_ambos"]].map(function(rr){
          return React.createElement("button",{key:rr[0],className:"rchip"+(on[rr[0]]?" on":""),onClick:function(){ pickRole(a, rr[0]); }}, t(rr[1]));
        }),
        React.createElement("button",{className:"ex-del",style:{marginLeft:"auto"},title:t("pt_acc_del"),onClick:function(){ setDelAcc(a.id); }},"🗑")
      );
    };
    const anySynced=state.accounts.some(isSynced);
    /* CUENTAS Y BIENES SON DOS BLOQUES, NO UNO (feedback 2026-07-25: «¿por qué has metido bienes
       junto con mis cuentas? sepáralo»). Al hacer Cartera ordenable quedaron dentro del mismo
       bloque, así que el piso y el coche viajaban pegados a las cuentas del banco y no se podían
       colocar por separado. `parte` los separa sin duplicar nada: sin `parte` sigue pintando los
       dos, que es como lo usa el resto de la app. */
    return React.createElement("div",null,
      parte!=="bienes" && React.createElement("div",{className:"v4-card-list"},
        state.accounts.map(accRow),
        (state.obAccounts||[]).map(obRow),
        React.createElement("button",{className:"edit-link",style:{margin:"8px 4px"},onClick:function(){ accEd.editing?accEd.save():accEd.start(); }},accEd.editing?t("fj_save"):t("fj_edit"))
      ),
      // Editor completo (2026-07-18): nombre + rol (recibos/diario/todo) SIEMPRE; el saldo solo
      // en cuentas manuales — el de las conectadas lo trae el banco y editarlo aquí sería mentirse.
      accEd.editing && React.createElement("div",{className:"add-form",style:{marginTop:8}},
        state.accounts.map(function(a){
          const synced=isSynced(a);
          return React.createElement("div",{key:a.id,style:{borderBottom:"1px solid var(--line-soft)",paddingBottom:8}},
            React.createElement("div",{className:"af-row",style:{alignItems:"center"}},
              React.createElement("span",{style:{flex:"0 0 auto",fontWeight:700}},entOf(a.ent).label),
              React.createElement("input",{className:"af-in",style:{flex:1,fontSize:13,padding:"7px 10px"},value:a.name||"",placeholder:t("pt_name_ph"),
                onChange:function(e){ const v=e.target.value; set(function(s){ return Object.assign({},s,{accounts:s.accounts.map(function(x){ return x.id===a.id?Object.assign({},x,{name:v}):x; })}); }); }}),
              synced
                ? React.createElement("span",{className:"am num",style:{flex:"0 0 auto",color:"var(--muted)",fontSize:14}}, eur(accDaily(a)?spendBal(a):(a.value+pn(a))))
                : React.createElement("input",{className:"af-in num",style:{width:104,flex:"0 0 auto"},value:accEd.draft[a.id],inputMode:"decimal",
                    onChange:function(e){const v=e.target.value;accEd.setDraft(function(d){return Object.assign({},d,{[a.id]:v});});}})
            ),
            roleChips(a),
            delAcc===a.id && React.createElement("div",{className:"rolechips",style:{alignItems:"center",flexWrap:"wrap",padding:"4px 0"}},
              React.createElement("span",{style:{fontSize:12.5,color:"var(--muted)",flex:"1 1 100%",marginBottom:2}}, t("pt_acc_del_q")),
              React.createElement("button",{className:"rchip",style:{color:"var(--coral)",borderColor:"var(--coral)"},onClick:function(){ removeAccount(a.id); }}, t("pt_acc_del_yes")),
              React.createElement("button",{className:"rchip",onClick:function(){ setDelAcc(""); }}, t("pt_acc_del_no"))
            )
          );
        }),
        // Cuentas extra del banco: nombre editable + darles rol las promociona (como en v3).
        (state.obAccounts||[]).map(function(o){
          const custom=(state.obLabels||{})[o.key]; const disp=(custom!=null&&custom!=="")?custom:niceObName(o);
          return React.createElement("div",{key:"obed_"+o.key,style:{borderBottom:"1px solid var(--line-soft)",paddingBottom:8}},
            React.createElement("div",{className:"af-row",style:{alignItems:"center"}},
              React.createElement("span",{style:{flex:"0 0 auto",fontWeight:700}},entOf(o.ent).label),
              React.createElement("input",{className:"af-in",style:{flex:1,fontSize:13,padding:"7px 10px"},value:custom!=null?custom:disp,placeholder:disp,
                onChange:function(e){ const v=e.target.value; set(function(s){ const ob=Object.assign({},s.obLabels); ob[o.key]=v; return Object.assign({},s,{obLabels:ob}); }); }}),
              React.createElement("span",{className:"am num",style:{flex:"0 0 auto",color:"var(--muted)",fontSize:14}}, eur(toEurAmt(o.value||0, o.cur||"EUR", state)))
            ),
            o.ent && React.createElement("div",{className:"rolechips",style:{padding:"8px 0 2px"}},
              [["fijos","rl_fijos"],["diario","rl_diario"],["ambos","rl_ambos"]].map(function(rr){
                return React.createElement("button",{key:rr[0],className:"rchip",onClick:function(){
                  const nid=uid();
                  set(function(s){ return promoteObAccount(s, totals, o.key, rr[0], nid); });
                  accEd.setDraft(function(d){ const nd=Object.assign({},d); nd[nid]=+toEurAmt(o.value||0, o.cur||"EUR", state).toFixed(2); return nd; });
                }}, t(rr[1]));
              })
            )
          );
        }),
        anySynced && React.createElement("div",{className:"hint"}, t("v4_acc_locked")),
        React.createElement("div",{className:"hint"}, t("rl_hint")),
        // Pista: «Gasto diario» se puede marcar en varios bancos (cuentan en el mismo presupuesto).
        (state.accounts||[]).length>1 && React.createElement("div",{className:"hint"}, t("v4_expdaily_row_hint"))
      ),
      parte!=="cuentas" && (state.assets||[]).length>0 && React.createElement(React.Fragment,null,
        // El título solo cuando van juntos: en Cartera lo pone el bloque ordenable, y repetirlo
        // dejaría «Bienes» dos veces seguidas.
        parte!=="bienes" && React.createElement("div",{className:"v4-sec-h"}, t("pt_goods")),
        state.assets.map(function(a){
          return React.createElement("div",{className:"v4-mov",key:a.id},
            React.createElement("div",{className:"tile"},a.kind==="piso"?"🏡":"🚙"),
            React.createElement("div",{className:"nm"},
              React.createElement("div",null,a.name),
              a.note && React.createElement("div",{className:"meta"},a.note)
            ),
            astEd.editing
              ? React.createElement("input",{className:"editv num",value:astEd.draft[a.id],inputMode:"decimal",onChange:function(e){const v=e.target.value;astEd.setDraft(function(d){return Object.assign({},d,{[a.id]:v});})}})
              : React.createElement("div",{className:"am num"},eur0(a.value))
          );
        }),
        // El botón de editar bienes «desapareció» con el rediseño (feedback 2026-07-18):
        // mismo patrón edit-link que las cuentas de arriba.
        React.createElement("button",{className:"edit-link",style:{margin:"8px 4px"},onClick:function(){ astEd.editing?astEd.save():astEd.start(); }},astEd.editing?t("fj_save"):t("v4_edit_goods")),
        astEd.editing && React.createElement("div",{className:"add-form",style:{marginTop:4}},
          state.assets.map(function(a){
            return React.createElement("div",{className:"af-row",key:"an_"+a.id,style:{alignItems:"center"}},
              React.createElement("span",{style:{flex:"0 0 auto",fontSize:18}},a.kind==="piso"?"🏡":"🚙"),
              React.createElement("input",{className:"af-in",style:{flex:1,fontSize:13,padding:"7px 10px"},value:a.name||"",
                onChange:function(e){ const v=e.target.value; set(function(s){ return Object.assign({},s,{assets:s.assets.map(function(x){ return x.id===a.id?Object.assign({},x,{name:v}):x; })}); }); }})
            );
          }),
          React.createElement("div",{className:"hint"}, t("pt_nonliquid"))
        )
      )
    );
  }
  return React.createElement("div",null,
    !v4Embed && React.createElement("div",{className:"hero",style:{marginBottom:14}},
      React.createElement("div",{className:"hero-label"},t("d_networth")),
      (function(){const p=eurParts(tt.netWorth);return React.createElement("div",{className:"hero-amount serif num"},p.ent,React.createElement("span",{className:"cents"},","+p.dec+" "+p.sym));})(),
      React.createElement("div",{className:"hero-pills"},
        React.createElement("div",{className:"pill ghost"},t("d_assets")+" "+eur0(tt.activos)),
        React.createElement("div",{className:"pill neg"},t("d_debts")+" "+eur0(tt.debtTotal))
      )
    ),
    React.createElement(OrderableSections,{tab:"patri",state:state,set:set,items:[
      {id:"acc",label:t("pt_accounts"),el:
    React.createElement(CollapsibleCard,{title:t("pt_accounts"),sub:t("pt_cash_avail"),dot:"#5FD08A",storageKey:"w_acc",help:t("h_roles"),
      right:React.createElement("button",{className:"edit-link"+(accEd.editing?" save":""),onClick:e=>{e.stopPropagation();accEd.editing?accEd.save():accEd.start();}},accEd.editing?t("fj_save"):t("fj_edit"))},
      state.accounts.map(a=>React.createElement(React.Fragment,{key:a.id},
        React.createElement("div",{className:"row"},
          React.createElement("div",{className:"rl"},React.createElement(Mono,{ent:a.ent,size:38}),
            React.createElement("div",{style:{minWidth:0}},React.createElement("div",{className:"rname"},entOf(a.ent).label),
              // subtítulo = el NOMBRE de la cuenta (editable abajo en modo edición). Nada de
              // desgloses aquí: el gasto del mes ya vive en Gastos (feedback 2026-07-06).
              accEd.editing
                ? React.createElement("input",{className:"af-in",style:{fontSize:13,padding:"5px 9px",maxWidth:170,marginTop:3},value:a.name||"",placeholder:t("pt_name_ph"),onChange:function(e){ const v=e.target.value; set(function(s){ return Object.assign({},s,{accounts:s.accounts.map(function(x){ return x.id===a.id?Object.assign({},x,{name:v}):x; })}); }); }})
                : (a.name?React.createElement("div",{className:"rsub"},a.name):null))),
          accEd.editing
            ? React.createElement("input",{className:"editv num",value:accEd.draft[a.id],inputMode:"decimal",onChange:e=>{const v=e.target.value;accEd.setDraft(d=>Object.assign({},d,{[a.id]:v}));}})
            : React.createElement("div",{className:"rval num"},eur(accDaily(a)? spendBal(a) : a.value + pn(a)))
        ),
        // rol de la cuenta (solo en modo edición): recibos / gasto diario / todo + quitar cuenta
        accEd.editing && React.createElement("div",{className:"rolechips"},
          [["fijos","rl_fijos"],["diario","rl_diario"],["ambos","rl_ambos"]].map(function(rr){
            const on=accRole(a)===rr[0];
            return React.createElement("button",{key:rr[0],className:"rchip"+(on?" on":""),onClick:function(){ setRole(a.id, rr[0]); }}, t(rr[1]));
          }),
          React.createElement("button",{className:"ex-del",style:{marginLeft:"auto"},title:t("pt_acc_del"),onClick:function(){ setDelAcc(a.id); }},"🗑")
        ),
        // confirmación de borrado de la cuenta manual (inline, para no borrar sin querer)
        accEd.editing && delAcc===a.id && React.createElement("div",{className:"rolechips",style:{alignItems:"center",flexWrap:"wrap"}},
          React.createElement("span",{style:{fontSize:12.5,color:"var(--muted)",flex:"1 1 100%",marginBottom:2}}, t("pt_acc_del_q")),
          React.createElement("button",{className:"rchip",style:{color:"var(--coral)",borderColor:"var(--coral)"},onClick:function(){ removeAccount(a.id); }}, t("pt_acc_del_yes")),
          React.createElement("button",{className:"rchip",onClick:function(){ setDelAcc(""); }}, t("pt_acc_del_no"))
        )
      )),
      accEd.editing && state.accounts.length>0 && React.createElement("div",{className:"hint"}, t("pt_acc_del_hint")),
      accEd.editing && React.createElement("div",{className:"hint"}, t("rl_hint")),
      // Cuentas extra de Open Banking (compartidas, 2ª cuenta de un banco…): saldo real sincronizado.
      // Nombre editable (obLabels) con un default "bonito" (niceObName); el saldo es solo lectura.
      (state.obAccounts||[]).map(function(o){ const custom=(state.obLabels||{})[o.key]; const disp=(custom!=null&&custom!=="")?custom:niceObName(o);
        return React.createElement(React.Fragment,{key:"ob_"+o.key},
        React.createElement("div",{className:"row"},
        React.createElement("div",{className:"rl"},React.createElement(Mono,{ent:o.ent||"",size:38}),
          React.createElement("div",{style:{minWidth:0}},
            accEd.editing
              ? React.createElement("input",{className:"af-in",style:{fontSize:13,padding:"5px 9px",maxWidth:170},value:custom!=null?custom:disp,placeholder:disp,onChange:function(e){ const v=e.target.value; set(function(s){ const ob=Object.assign({},s.obLabels); ob[o.key]=v; return Object.assign({},s,{obLabels:ob}); }); }})
              : React.createElement("div",{className:"rname"}, disp, o.stale
                  ? React.createElement("span",{className:"day-badge",style:{marginLeft:6,background:"#E2A05F22",color:"#E2A05F"}}, t("pt_ob_badge")+" · "+t("bp_st_expired"))
                  : React.createElement("span",{className:"day-badge",style:{marginLeft:6,background:"#7FB5E822",color:"var(--blue)"}}, t("pt_ob_badge"))),
            React.createElement("div",{className:"rsub"}, entOf(o.ent).label))),
        React.createElement("div",{className:"rval num"}, eur(toEurAmt(o.value||0, o.cur||"EUR", state)))
        ),
        // ROL también para las cuentas OB (bug pareja 2026-07-11: sin rol no podían recibir
        // gastos fijos ni diarios — al elegir uno, la cuenta se «promociona» a cuenta con rol,
        // sale de esta lista y aparece arriba con las manuales; el banco la sigue re-anclando).
        accEd.editing && o.ent && React.createElement("div",{className:"rolechips"},
          [["fijos","rl_fijos"],["diario","rl_diario"],["ambos","rl_ambos"]].map(function(rr){
            return React.createElement("button",{key:rr[0],className:"rchip",onClick:function(){
              const nid=uid();
              set(function(s){ return promoteObAccount(s, totals, o.key, rr[0], nid); });
              // siembra el borrador del editor con el saldo real: sin esto la fila nueva salía vacía
              accEd.setDraft(function(d){ const nd=Object.assign({},d); nd[nid]=+toEurAmt(o.value||0, o.cur||"EUR", state).toFixed(2); return nd; });
            }}, t(rr[1]));
          })
        )
      ); }),
      React.createElement("div",{className:"subtotal"},React.createElement("span",{className:"muted"},t("pt_total_liquid")),React.createElement("span",{className:"num"},eur(accSum)))
    )},
      // (el desglose de efectivo de TR se quitó 2026-07-06: los movimientos ya viven en Gastos)
      {id:"inv",label:t("pt_investments"),el:
    React.createElement(CollapsibleCard,{title:t("pt_investments"),sub:t("pt_byBroker"),dot:"#7FB5E8",storageKey:"w_inv",help:t("h_ptinv")},
      // Solo brókers con posiciones (los 3 fijos confundían a usuarios nuevos — feedback 2026-07-10)
      ["revolut","trade_republic","myinvestor"].filter(g=>state.investments.some(i=>i.ent===g)).map(g=>{
        const v=state.investments.filter(i=>i.ent===g).reduce((a,i)=>a+invValueEur(i, state),0);
        return React.createElement("div",{className:"row",key:g},
          React.createElement("div",{className:"rl"},React.createElement(Mono,{ent:g,size:38}),React.createElement("div",{className:"rname"},entOf(g).label)),
          React.createElement("div",{className:"rval num"},eur(v)));
      }),
      React.createElement("div",{className:"subtotal"},React.createElement("span",{className:"muted"},t("pt_total_inv")),React.createElement("span",{className:"num"},eur(totals.invested)))
    )},
      {id:"goods",label:t("pt_goods"),el:
    React.createElement(CollapsibleCard,{title:t("pt_goods"),sub:t("pt_nonliquid"),dot:"#E6C36A",storageKey:"w_ast",help:t("h_goods"),
      right:React.createElement("button",{className:"edit-link"+(astEd.editing?" save":""),onClick:e=>{e.stopPropagation();astEd.editing?astEd.save():astEd.start();}},astEd.editing?t("fj_save"):t("fj_edit"))},
      state.assets.map(a=>React.createElement("div",{className:"row",key:a.id},
        React.createElement("div",{className:"rl"},React.createElement("div",{className:"ric"},a.kind==="piso"?"🏡":"🚙"),
          React.createElement("div",null,React.createElement("div",{className:"rname"},a.name),a.note&&React.createElement("div",{className:"rsub"},a.note))),
        astEd.editing
          ? React.createElement("input",{className:"editv num",value:astEd.draft[a.id],inputMode:"decimal",onChange:e=>{const v=e.target.value;astEd.setDraft(d=>Object.assign({},d,{[a.id]:v}));}})
          : React.createElement("div",{className:"rval num"},eur0(a.value))
      )),
      React.createElement("div",{className:"subtotal"},React.createElement("span",{className:"muted"},t("pt_total_goods")),React.createElement("span",{className:"num"},eur0(astSum)))
    )}
    ]})
  );
}

/* ============================================================
   TAB: GASTOS FIJOS
   ============================================================ */
const FREQ_LABEL={mes:"mensual",bimestral:"bimestral",trimestral:"trimestral",semestral:"semestral","año":"anual"};
const FREQ_OPTS=["mes","bimestral","trimestral","semestral","año"];
const MONTHS_ES=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

/* ============================================================
   MOTOR DINÁMICO — calendario de gastos fijos
   Cada gasto fijo sabe en qué meses (1-12) se cobra. Si no se ha
   asignado a mano, se deriva de la frecuencia. Los anuales sin mes
   quedan "sin programar" hasta que el usuario elige el mes.
   ============================================================ */
function chargeMonths(e){
  if(e && e.schedule && e.schedule.length) return e.schedule.map(x=>x.m).slice().sort((a,b)=>a-b);
  if(e && e.months && e.months.length) return e.months.slice().sort((a,b)=>a-b);
  const f=e&&e.freq;
  if(f==="mes"||f==="mensual") return [1,2,3,4,5,6,7,8,9,10,11,12];
  if(f==="bimestral")  return [1,3,5,7,9,11];
  if(f==="trimestral") return [1,4,7,10];
  if(f==="semestral")  return [1,7];
  return [];   // anual sin mes asignado → sin programar
}
// ¿se cobra este gasto en el mes m (1-12)?
const occursIn=(e,m)=> chargeMonths(e).indexOf(m)>=0;
// importe del cobro EN EL MES m. Si hay `schedule` (importes a medida, p.ej. seguro 172,05 + 166,94)
// usa ese importe; si es anual sin schedule reparte el total entre los meses marcados; si no, amount.
function occAmountIn(e,m){
  if(e.schedule && e.schedule.length){ const s=e.schedule.find(x=>x.m===m); return s?(s.amt||0):0; }
  if(e.freq==="año"||e.freq==="anual"){ const n=chargeMonths(e).length||1; return e.amount/n; }
  return e.amount;
}
// compat: importe "representativo" de una ocurrencia (primer mes) — para etiquetas
const occAmount=(e)=> occAmountIn(e, chargeMonths(e)[0]||(new Date().getMonth()+1));
// banco del que se cobra (por defecto Sabadell)
const accOf=(e)=> e.account||"sabadell";
// día válido (1-31) o null — global para que lo usen Fijos y Deudas
const cleanDay=(v)=>{ const n=parseInt(String(v),10); return (n>=1&&n<=31)?n:null; };
// día del cobro en el mes m (schedule tiene su propio día por cobro)
function dayIn(e,m){ if(e&&e.schedule&&e.schedule.length){ const s=e.schedule.find(x=>x.m===m); return s?(s.day||null):null; } return (e&&e.day)||null; }
// día simple (objetos sin schedule: deudas)
const dayOf=(e)=> (e&&e.day)||null;
// Deudas sin día explícito: día 1 (entran en el motor de líquido como los fijos; antes quedaban
// fuera hasta cerrar mes — bug #2 «deuda no dinámica»).
function debtChargeDay(d){ const dd=dayOf(d); return (dd!=null && dd>0) ? dd : 1; }
function isDebtPaidThisMonth(d,today){ return debtChargeDay(d)<=today; }
// ¿ya se cobró en el mes m? (su día ya pasó o ES HOY). Solo tiene sentido para el mes actual.
// `<=`: lo programado para HOY cuenta como hecho. Clave para no duplicar la nómina/cargos del día
// con el saldo real del banco (que ya los refleja) → si no, fin de mes los sumaría por segunda vez.
const isPaidIn=(e,m,today)=>{ const d=dayIn(e,m); return d!=null && d<=today; };
const isPaidThisMonth=(e,today)=>{ const d=dayOf(e); return d!=null && d<=today; };
// ¿el gasto necesita que el usuario le asigne un mes? (anual sin programar)
const needsMonth=(e)=> (e.freq==="año"||e.freq==="anual") && !(e.months&&e.months.length) && !(e.schedule&&e.schedule.length);
// ¿tiene importes/días a medida por cobro?
const hasSchedule=(e)=> !!(e&&e.schedule&&e.schedule.length);

/* --- Días laborables (lun-vie; sin festivos, aproximación) --- */
// día del mes (número, mes 1-12) del primer/último día laborable
function firstWorkDom(y,m){ for(let d=1;d<=7;d++){ const wd=new Date(y,m-1,d).getDay(); if(wd!==0 && wd!==6) return d; } return 1; }
function lastWorkDom(y,m){ const last=new Date(y,m,0).getDate(); for(let d=last;d>=1;d--){ const wd=new Date(y,m-1,d).getDay(); if(wd!==0 && wd!==6) return d; } return last; }
// día efectivo de un movimiento recurrente según su regla (`when`) o su día fijo
function flowDay(f,y,m){ if(f.when==="last") return lastWorkDom(y,m); if(f.when==="first") return firstWorkDom(y,m); return f.day||null; }
const flowPaid=(f,y,m,today)=>{ const d=flowDay(f,y,m); return d!=null && d<=today; };
// Movimientos recurrentes (nómina/transferencias): por defecto cada mes salvo que tengan months
const flowMonths=(f)=> (f&&f.months&&f.months.length)?f.months:[1,2,3,4,5,6,7,8,9,10,11,12];
// Un flow puntual (f.once={y,m}) solo ocurre en ese mes/año concreto (como un cargo puntual);
// el resto son recurrentes (mensuales por defecto). Si f.once existe, el año importa.
const flowOccursIn=(f,m,y)=> f && f.once ? (f.once.y===y && f.once.m===m) : (flowMonths(f).indexOf(m)>=0);
// ¿este flow puntual ya pasó (mes/año cerrado)? para ocultarlo de la lista una vez cumplido
const flowOncePast=(f,y,m)=> f && f.once && (f.once.y<y || (f.once.y===y && f.once.m<m));
// Cargos puntuales (un solo cobro en un mes/año concreto): imprevistos, amortizaciones…
const oneoffOccurs=(o,y,m)=> o && o.year===y && o.month===m;
const oneoffPast=(o,y,m)=> o && (o.year<y || (o.year===y && o.month<m));   // de un mes ya cerrado

/* --- Deuda dinámica: saldo proyectado que baja solo cada mes ---
   No mutamos el dato guardado (para no descuadrar la sync). `value` es el saldo
   ANCLA y `asOf` el mes (entero absoluto año*12+mes) en que era cierto. El saldo
   de hoy = value − amortización/mes × meses transcurridos, con suelo en 0.
   `amort` es lo que reduce el principal (por defecto la cuota); puede diferir de la
   cuota en efectivo (p.ej. préstamo familiar: paga 197 € pero amortiza 250 €/mes). */
const ymAbs=(y,m0)=> y*12+m0;                         // m0 = mes 0-indexado
const ymNow=()=>{ const n=new Date(); return ymAbs(n.getFullYear(), n.getMonth()); };
const debtAmort=(d)=> d && d.amort!=null ? d.amort : ((d&&d.monthly)||0);
// nº de pagos ya hechos. Una financiación (con `months`) cuenta TAMBIÉN el pago de ESTE mes si ya pasó
// su día (ej. financias el 599/4 con día 26 y hoy es 28 → el 1er pago del 26 ya cuenta).
function debtPaidCount(d){ const anchor=(typeof d.asOf==="number")?d.asOf:ymNow(); let n=Math.max(0, ymNow()-anchor); if(d.months!=null){ const dd=debtChargeDay(d); if(dd<=new Date().getDate()) n+=1; } return n; }
// Financiación tipo coche: además de entrada (downPayment, ya pagada = informativa) y cuotas,
// hay un PAGO FINAL (balloon) en el último mes del plazo. debtBalloonIn(d,y,m): balloon si (y,m 1-12)
// es ese último mes; 0 si no. La amort lineal ya se fija a (value−balloon)/months al crear la deuda,
// así el saldo baja con las cuotas y el balloon limpia el resto al final.
function debtBalloonIn(d, y, m){ if(!d || !(d.balloon>0) || d.months==null) return 0; const anchor=(typeof d.asOf==="number")?d.asOf:ymNow(); return (y*12+(m-1))===(anchor+d.months-1) ? d.balloon : 0; }
function debtBalance(d){ if(!d || d.value==null) return 0; let b=d.value - debtAmort(d)*debtPaidCount(d); if(d.balloon>0 && d.months!=null && debtPaidCount(d)>=d.months) b-=d.balloon; return Math.max(0, b); }
// ¿la cuota sigue cobrándose este mes? Una financiación (con `months` = plazo) deja de
// cobrar al acabar el plazo o al llegar el saldo a 0. Sin plazo (hipoteca/préstamo): mientras quede saldo.
function debtActive(d){ if(!d || !d.monthly) return false; const bal=debtBalance(d); if(d.months!=null){ const anchor=(typeof d.asOf==="number")?d.asOf:ymNow(); return (ymNow()-anchor) < d.months && bal>0.005; } return bal>0.005; }
// cuotas que quedan de una financiación (null si no tiene plazo)
function debtLeft(d){ if(!d || d.months==null) return null; return Math.max(0, d.months - debtPaidCount(d)); }
// Movimientos netos de un banco en un mes (m 1-12): +ingresos −fijos −cuotas −puntuales −transfers.
// todayLim null = mes cerrado (cuentan todos); número = solo los YA ocurridos (día <= todayLim, regla isPaidIn).
function monthNetForAccount(s, ent, y, m, todayLim){
  const closed=(todayLim==null);
  const hit=function(d){ return closed ? true : (d!=null && d<=todayLim); };
  let net=0;
  (s.fixed||[]).forEach(function(e){ if((e.account||"sabadell")===ent && occursIn(e,m) && hit(dayIn(e,m))) net -= occAmountIn(e,m); });
  (s.debts||[]).forEach(function(d){ if(debtActive(d) && (d.account||"sabadell")===ent && hit(debtChargeDay(d))) net -= (d.monthly||0) + debtBalloonIn(d,y,m); });
  (s.oneoffs||[]).forEach(function(o){ if(oneoffOccurs(o,y,m) && (o.account||"sabadell")===ent && (o.amount||0)!==0 && hit(o.day!=null?o.day:null)) net -= o.amount; });
  (s.flows||[]).forEach(function(f){ if(flowOccursIn(f,m,y)){ const dd=flowDay(f,y,m); if(hit(dd)){ if(f.kind==="income" && (f.to||"sabadell")===ent) net += (f.amount||0); else if(f.kind==="transfer" && (f.from||"sabadell")===ent) net -= (f.amount||0); } } });
  return net;
}

