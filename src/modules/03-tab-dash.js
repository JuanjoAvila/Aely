/* ============================================================
   TAB: INICIO (v4) — SPEC-v4.md §3
   ============================================================ */
function dashOrderOf(s, allIds){
  const saved=((s.settings&&s.settings.dashOrder)||[]).filter(function(id){ return allIds.indexOf(id)>=0; });
  return saved.concat(allIds.filter(function(id){ return saved.indexOf(id)<0; }));
}
function Dashboard({state, totals, set, onOpenSettings, onOpenProfile, onGoGastos, onGoPlan, showToast}){
  const tt=totals;
  const simple=!!(state.settings&&state.settings.simpleMode);
  const [budgetOpen,setBudgetOpen]=useState(false);
  /* Barra de letra FUERA de Ajustes (11/9): la quería a mano mientras usa la app, no enterrada
     en dos sitios de settings. Vive en Inicio, junto al avatar. */
  /* Puertas de arranque: el count-up y los esqueletos NO pueden vivir detrás del splash ni
     adelantarse a la nube (B2/B4 — misma lección: animar a puerta cerrada es peor que no animar). */
  const [splashGone,setSplashGone]=useState(function(){
    try{ return !!(window.__mcSplashGone) || !document.getElementById("mc-load"); }catch(e){ return true; }
  });
  const [bootReady,setBootReady]=useState(function(){
    try{ return !!window.__mcBootReady; }catch(e){ return true; }
  });
  useEffect(function(){
    if(splashGone) return undefined;
    const on=function(){ setSplashGone(true); };
    window.addEventListener("mc-splash-gone", on);
    return function(){ window.removeEventListener("mc-splash-gone", on); };
  },[splashGone]);
  useEffect(function(){
    if(bootReady || !splashGone) return undefined;
    const on=function(){ setBootReady(true); };
    window.addEventListener("mc-boot-ready", on);
    // Por si el evento se emitió entre el useState inicial y este effect.
    try{ if(window.__mcBootReady) setBootReady(true); }catch(e){}
    /* Tope duro (14/9): sin internet el pull de la nube puede colgarse y `mc-boot-ready` no
       llega nunca → 3 esqueletos eternos. Tras ~2 s se pinta el estado LOCAL; si la nube llega
       después, `set()` repinta solo. No acorta un boot lento CON red: 2 s de skel bastan. */
    const tope=setTimeout(function(){
      setBootReady(true);
      try{ mcBootReady(); }catch(e){}
    }, 2000);
    return function(){ window.removeEventListener("mc-boot-ready", on); clearTimeout(tope); };
  },[bootReady, splashGone]);
  const shownNet=useCountUp(tt.netWorth||0, splashGone);
  const showSkel=splashGone && !bootReady;

  const nameGuess=(function(){
    try{
      const em=(window.__mcEmail)||"";
      if(em&&em.indexOf("@")>0) return em.split("@")[0].replace(/[._]/g," ");
    }catch(e){}
    return "";
  })();
  const greetName=(function(){
    if(!nameGuess) return "";
    const first=nameGuess.trim().split(/\s+/)[0]||"";
    return first.charAt(0).toUpperCase()+first.slice(1);
  })();
  const initials=(function(){
    if(!nameGuess) return "MC";
    const parts=nameGuess.trim().split(/\s+/);
    return ((parts[0]||"M").charAt(0)+(parts[1]||parts[0]||"C").charAt(0)).toUpperCase();
  })();

  // Misma cifra que la cabecera de Gastos / widget (no `thisMonthSpent`, que mete neutras).
  const bud=monthBudgetStats(state);
  const budAmt=bud.budget!=null?bud.budget:(state.budget||0);
  const spentAgainst=Math.max(0, bud.against);
  const ratio=budAmt>0 ? spentAgainst/budAmt : 0;
  const dim=new Date(tt.curYear, tt.curMonth, 0).getDate();
  const elapsed=Math.max(1, tt.today||1);
  const leftDays=Math.max(1, dim-elapsed);
  const rem=bud.remaining!=null?bud.remaining:(budAmt-spentAgainst);
  const dailyAllow=rem/leftDays;
  const pace=spentAgainst/elapsed;
  const projected=spentAgainst+pace*leftDays;
  const overTrack=projected>budAmt+0.5;
  // Sin gasto aún, «Vas muy bien» suena a vacío (feedback 11/9, modo recién instalada).
  let stCls="st", stHead=spentAgainst>0.005 ? t("st_good_h") : t("st_start_h");
  if(ratio>1 || overTrack&&ratio>0.85){ stCls="st bad"; stHead=t("st_over_h"); }
  else if(ratio>0.8 || !overTrack&&ratio>0.8){ stCls="st warn"; stHead=t("st_tight_h"); }
  else if(ratio<=0.8 && !overTrack){ stCls="st"; stHead=spentAgainst>0.005 ? t("st_good_h") : t("st_start_h"); }

  // Próximos cargos: misma regla que Plan›Recibos (día del mes + isPaidIn). Antes usaba
  // f.day crudo y mostraba recibos ya cobrados (luz/seguros) — feedback 2026-07-17.
  const upcoming=(function(){
    const today=tt.today||new Date().getDate();
    const cm=tt.curMonth;
    const rows=[];
    (state.fixed||[]).forEach(function(f){
      const amount=occAmountIn(f,cm);
      if(!(amount>0) || !occursIn(f,cm)) return;
      if(isPaidIn(f,cm,today)) return;
      const day=dayIn(f,cm)||1;
      rows.push({day:day, name:f.name||t("fj_fixed"), sub:(entOf(accOf(f)).label||""), amount:amount, pos:false});
    });
    (state.debts||[]).forEach(function(d){
      if(!debtActive(d) || !(d.monthly>0)) return;
      if(isDebtPaidThisMonth(d,today)) return;
      rows.push({day:debtChargeDay(d), name:d.name, sub:t("fj_debt_tag"), amount:d.monthly, pos:false});
    });
    (state.flows||[]).forEach(function(f){
      if(!(f.amount>0) || f.kind==="transfer") return;
      if(!flowOccursIn(f,cm,tt.curYear)) return;
      if(flowPaid(f,tt.curYear,cm,today)) return;
      const day=flowDay(f,tt.curYear,cm)||1;
      rows.push({day:day, name:f.name||t("cat_ingreso"), sub:entOf(f.ent||f.account||"").label||"", amount:f.amount, pos:true});
    });
    rows.sort(function(a,b){ return a.day-b.day; });
    return rows.slice(0,3);
  })();

  // 🎉 Deudas a las que les queda LA ÚLTIMA cuota: alegría en Inicio (petición 2026-07-18
  // «para alegrar un poco el mes»). debtLeft<=1 = la cuota de este mes (o la próxima) es la última.
  /* Y SE PUEDE QUITAR (2026-09-12, reportado por él desde la app): «está chulo que te aparezca
     el aviso pero cansa mucho verlo cada día… estaría bien poder quitarlo». La tarjeta se queda
     —le gusta— pero se descarta como el informe del mes cerrado, con el mismo «Descartar».
     Se descarta POR DEUDA, no de golpe: cada deuda llega a su última cuota UNA vez, así que
     esto es «ya lo he visto», no «no me lo cuentes nunca más». Y vive en `settings` para que
     viaje a la nube: si no, el otro móvil se lo volvería a enseñar cada día. */
  const partyOff=(state.settings&&state.settings.partyDismissed)||[];
  const partyDebts=(state.debts||[]).filter(function(d){
    const l=debtLeft(d); return debtActive(d) && l!=null && l<=1 && partyOff.indexOf(d.id)===-1;
  });
  const dismissParty=function(id){
    set(function(s){
      const prev=(s.settings&&s.settings.partyDismissed)||[];
      if(prev.indexOf(id)!==-1) return s;
      return Object.assign({},s,{settings:Object.assign({},s.settings,{partyDismissed:prev.concat([id])})});
    });
  };

  const goals=(state.goals||[]).filter(function(g){ return !g.done; }).slice(0,4);
  const recent=(state.expenses||[]).slice().sort(function(a,b){ return String(b.date).localeCompare(String(a.date)); }).slice(0,3);
  const p=eurParts(shownNet);
  const ringC=2*Math.PI*48;
  const ringPct=Math.max(0,Math.min(1,ratio));
  /* P6 — EL ANILLO SE DIBUJA, NO APARECE YA LLENO.
     El circulo recibia el `strokeDashoffset` FINAL y una `transition` de 1s, y una transicion no
     anima el primer pintado: el anillo salia relleno de golpe y la animacion del spec §10 no se
     veia nunca. Se monta vacio (offset = circunferencia entera) y se pasa al valor real en el
     frame siguiente, que es cuando la transicion si tiene de donde salir.
     Enganchado al MISMO `mc-splash-gone` que el count-up: si no, se gasta detras de la cortina
     de entrada, que es exactamente lo que ya le paso una vez con el numero del hero.
     `prefers-reduced-motion` -> valor final directo, sin animar. */
  const [ringDraw,setRingDraw]=useState(false);
  useEffect(function(){
    const reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    if(reduce){ setRingDraw(true); return undefined; }
    let raf=0, cancelado=false;
    const arrancar=function(){ if(cancelado) return; raf=requestAnimationFrame(function(){ if(!cancelado) setRingDraw(true); }); };
    if(window.__mcSplashGone || !document.getElementById("mc-load")){ arrancar(); }
    else window.addEventListener("mc-splash-gone", arrancar, {once:true});
    return function(){ cancelado=true; cancelAnimationFrame(raf); window.removeEventListener("mc-splash-gone", arrancar); };
  },[]);
  const monthName=monthLong(new Date().getMonth());
  const closedCard=closedMonthCardOf(state);

  return React.createElement("div",{className:"v4-screen"},
    React.createElement("div",{className:"v4-inicio-head rise"},
      React.createElement("div",null,
        React.createElement("div",{className:"v4-inicio-date"}, new Date().toLocaleDateString(loc(),{weekday:"long",day:"numeric",month:"long"})),
        React.createElement("div",{className:"v4-inicio-hi"}, greetName?tf("v4_hola",{n:greetName}):t("v4_hola_anon"))
      ),
      React.createElement("button",{className:"v4-avatar","data-tour":"avatar","aria-label":t("pf_title"),
        onClick:function(){ if(onOpenProfile) onOpenProfile(); else if(onOpenSettings) onOpenSettings(); }}, initials)
    ),

    /* B4 — entre splash fuera y nube lista: siluetas, no ceros. Si se pintan detrás del splash
       nadie las ve (misma trampa que el count-up). prefers-reduced-motion: sin brillo (CSS). */
    showSkel && React.createElement("div",{"data-tour":"boot-skel","aria-hidden":"true",style:{marginTop:10}},
      [0,1,2].map(function(i){ return React.createElement("div",{key:"sk"+i,className:"v4-skel"}); })
    ),

    !showSkel && closedCard && React.createElement("div",{className:"v4-card rise","data-tour":"closed-month",style:{animationDelay:".02s",marginTop:4}},
      React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}},
        React.createElement("div",null,
          React.createElement("div",{style:{fontWeight:800,fontSize:15}}, tf("mr_title",{mes:monthLong(closedCard.month)+" "+closedCard.year})),
          React.createElement("div",{style:{fontSize:12.5,color:"var(--muted)",marginTop:4,lineHeight:1.4}}, t("mr_sub"))
        ),
        React.createElement("button",{type:"button",className:"link",style:{flexShrink:0,fontSize:13},onClick:function(){
          set(function(s){ return dismissClosedMonthCard(s, closedCard.ym); });
        }}, t("mr_later"))
      ),
      React.createElement("div",{className:"num",style:{fontWeight:800,fontSize:26,marginTop:10}}, eur0(closedCard.stats.shown)),
      React.createElement("div",{style:{fontSize:12,color:"var(--muted)"}}, t("rp_spent")),
      closedCard.stats.budget!=null && closedCard.stats.budget>0 && React.createElement("div",{style:{fontSize:12.5,marginTop:6}},
        tf("rp_of_budget",{b:eur0(closedCard.stats.budget),p:Math.round(Math.min(100,(closedCard.stats.against/(closedCard.stats.budget||1))*100))})),
      closedCard.topCat && React.createElement("div",{style:{fontSize:12.5,marginTop:6}},
        tf("mr_top",{cat:catName(closedCard.topCat.id), x:eur0(closedCard.topCat.amount)})),
      React.createElement("div",{style:{fontSize:12.5,marginTop:6}},
        closedCard.saved>=0 ? tf("mr_saved",{x:eur0(closedCard.saved)}) : tf("mr_over",{x:eur0(Math.abs(closedCard.saved))})),
      React.createElement("button",{type:"button",className:"btn btn-primary btn-block",style:{marginTop:12},onClick:function(){
        shareMonthReport(state, totals, showToast, {startMs:closedCard.startMs, endMs:closedCard.endMs, ym:closedCard.ym});
        if(showToast) showToast(t("mr_shared"));
      }}, t("mr_share"))
    ),

    !showSkel && React.createElement("div",{className:"v4-hero rise","data-tour":"hero",style:{animationDelay:".05s"}},
      React.createElement("div",{className:"v4-micro"}, t(simple?"v4_money_total":"d_networth")),
      React.createElement("div",{className:"v4-hero-amt num","data-tour":"hero-amt"},
        p.sign+p.ent, React.createElement("span",{style:{fontSize:28,color:"var(--muted)"}},","+(p.dec||"00")+" "+p.sym)),
      // La pastilla del mes solo si dice algo (P2): recien instalado, «+0 € este mes» no informa
      // de nada y dejaba el hero con dos elementos muertos, ella y el grafico plano de P1.
      ((tt.delta||0)!==0 || (state.history&&state.history.length>0)) && React.createElement("div",{style:{marginTop:12}},
        React.createElement("span",{className:"v4-pill"},
          React.createElement(tt.delta>=0?I.up:I.down,null),
          (tt.delta>=0?"+":"")+eur0(tt.delta)+" "+t("v4_this_month"))
      ),
      React.createElement("div",{style:{marginTop:14}},
        // Sin al menos dos puntos, `Sparkline` devuelve null (P1). Se reserva el hueco con una
        // linea discreta para que el hero no pegue un salto en cuanto haya histórico.
        (state.history&&state.history.length>=1)
          ? React.createElement(Sparkline,{data:state.history,current:tt.netWorth})
          : React.createElement("div",{style:{fontSize:12.5,color:"var(--muted-2)",padding:"6px 0 2px"}}, t("v4_hist_empty")))
    ),

    // Sin presupuesto, Inicio escondia su tarjeta estrella y te quedabas sin la mitad de la app
    // sin saber por que (P3). En vez de esconderla, la misma tarjeta en vacio y con salida: abre
    // el `BudgetSheet` que ya existe, el mismo que el boton de editar presupuesto.
    !showSkel && !(state.budget>0) && React.createElement("div",{className:"v4-card rise",style:{animationDelay:".1s",marginTop:8}},
      React.createElement("div",{className:"v4-empty"},
        React.createElement("div",{className:"em"}, "🎯"),
        React.createElement("div",{className:"ti"}, t("v4_nobud_t")),
        React.createElement("div",{className:"ph"}, t("v4_nobud_p")),
        React.createElement("button",{className:"btn cta",onClick:function(){ setBudgetOpen(true); }}, t("v4_nobud_cta"))
      )
    ),

    !showSkel && state.budget>0 && React.createElement("div",{className:"v4-card rise",style:{animationDelay:".1s",marginTop:8}},
      React.createElement("div",{className:"v4-budget",role:"button",tabIndex:0,onClick:function(){ setBudgetOpen(true); },onKeyDown:function(e){ if(e.key==="Enter") setBudgetOpen(true); }},
        React.createElement("div",{style:{position:"relative",width:104,height:104,flex:"0 0 auto"}},
          React.createElement("svg",{width:104,height:104,viewBox:"0 0 104 104"},
            React.createElement("circle",{cx:52,cy:52,r:48,fill:"none",stroke:"var(--sur2)",strokeWidth:10}),
            React.createElement("circle",{cx:52,cy:52,r:48,fill:"none",stroke:stCls.indexOf("bad")>=0?"var(--coral)":(stCls.indexOf("warn")>=0?"var(--tan)":"var(--mint)"),
              strokeWidth:10,strokeLinecap:"round",strokeDasharray:String(ringC),
              strokeDashoffset:String(ringDraw ? ringC*(1-ringPct) : ringC),
              transform:"rotate(-90 52 52)",style:{transition:"stroke-dashoffset 1s var(--ease)"}})
          ),
          React.createElement("div",{style:{position:"absolute",inset:0,display:"grid",placeItems:"center",textAlign:"center",pointerEvents:"none"}},
            React.createElement("div",null,
              // P7 — es el numero mas mirado de la app y era el unico que iba en Manrope: desentonaba
              // con el resto de cifras grandes, que son Fraunces. Mismo tamaño y peso que el mockup.
              React.createElement("div",{className:"num",style:{fontFamily:"'Fraunces',Georgia,serif",fontWeight:600,fontSize:24,lineHeight:1,letterSpacing:"-0.5px"}}, Math.round(ringPct*100)+"%"),
              React.createElement("div",{style:{fontSize:10.5,color:"var(--muted-2)",fontWeight:600,marginTop:1}}, t("v4_of_month"))
            )
          )
        ),
        React.createElement("div",{className:"v4-budget-txt"},
          React.createElement("div",{className:stCls}, stHead),
          React.createElement("div",{className:"ph"},
            tf("v4_budget_spent",{spent:eur0(bud.shown),budget:eur0(budAmt)}),
            " ",
            rem>=0 ? tf("v4_budget_daily",{x:eur0(Math.max(0,dailyAllow))}) : t("st_over_l")
          )
        )
      ),
      React.createElement("div",{className:"v4-budget-foot"},
        // Con 0, «0 meses sin pasarte» resta en vez de sumar: el primer mes se dice en positivo (P5).
        React.createElement("span",null, (state.streak||0)>0 ? ("🔥 "+tf("v4_streak",{n:state.streak})) : t("v4_streak_zero")),
        React.createElement("button",{className:"link",onClick:function(e){ e.stopPropagation(); if(onGoGastos) onGoGastos(); }}, t("v4_see_gastos"))
      )
    ),
    React.createElement(BudgetSheet,{open:budgetOpen,budget:state.budget,onClose:function(){ setBudgetOpen(false); },onSave:function(b){
      set(function(s){ return Object.assign({},s,{budget:b}); });
    }}),

    !showSkel && partyDebts.length>0 && React.createElement("div",{className:"v4-card rise v4-party",style:{animationDelay:".12s",marginTop:8,padding:"14px 16px"}},
      partyDebts.map(function(d){
        return React.createElement("div",{key:d.id,style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}},
          React.createElement("div",null,
            React.createElement("div",{style:{fontWeight:800,fontSize:15,lineHeight:1.35}}, tf("v4_debt_party_1",{name:d.name,x:eur0(d.monthly||0)})),
            React.createElement("div",{style:{fontSize:13,color:"var(--muted)",marginTop:3}}, tf("v4_debt_party_sub",{x:eur0(d.monthly||0)}))
          ),
          React.createElement("button",{type:"button",className:"link","data-testid":"party-dismiss",style:{flexShrink:0,fontSize:13},
            onClick:function(){ dismissParty(d.id); }}, t("mr_later"))
        );
      })
    ),

    // Estado vacio en vez de esconder la seccion (P4, spec §27): un Inicio recien instalado se
    // quedaba en hero + «Ultimos movimientos» vacio y no se veia que la app hace mas cosas.
    !showSkel && upcoming.length===0 && React.createElement("div",{className:"v4-section rise",style:{animationDelay:".15s"}},
      React.createElement("div",{className:"v4-section-h"}, React.createElement("span",null, t("v4_upcoming"))),
      React.createElement("div",{className:"v4-empty"},
        React.createElement("div",{className:"em"}, "🧾"),
        React.createElement("div",{className:"ti"}, t("v4_noup_t")),
        React.createElement("div",{className:"ph"}, t("v4_noup_p")),
        React.createElement("button",{className:"btn cta",onClick:function(){
          try{ window.dispatchEvent(new CustomEvent("mc-open-banks",{detail:{focus:null}})); }catch(e){}
        }}, t("v4_noup_cta"))
      )
    ),

    !showSkel && upcoming.length>0 && React.createElement("div",{className:"v4-section rise",style:{animationDelay:".15s"}},
      React.createElement("div",{className:"v4-section-h"},
        React.createElement("span",null, t("v4_upcoming")),
        // «Ver plan» fuerza el segmento Recibos: sin esto aterrizabas en el último subtab
        // usado (Deudas) — feedback 2026-07-18.
        React.createElement("button",{className:"link",onClick:function(){ if(onGoPlan) onGoPlan("recibos"); }}, t("v4_see_plan"))
      ),
      React.createElement("div",{className:"v4-card",style:{padding:"6px 16px"}},
        upcoming.map(function(u,i){
              return React.createElement("div",{key:i,className:"v4-charge"},
                React.createElement("div",{className:"dt"},
                  React.createElement("div",{className:"d"}, String(u.day).padStart(2,"0")),
                  React.createElement("div",{className:"m"}, monthName.slice(0,3))
                ),
                React.createElement("div",{style:{flex:1,minWidth:0}},
                  React.createElement("div",{className:"nm"}, u.name),
                  u.sub && React.createElement("div",{className:"sub"}, u.sub)
                ),
                React.createElement("div",{className:"am num"+(u.pos?" pos":"")}, (u.pos?"+":"")+eur(u.amount))
              );
            })
      )
    ),

    !showSkel && goals.length===0 && React.createElement("div",{className:"v4-section rise",style:{animationDelay:".2s"}},
      React.createElement("div",{className:"v4-section-h"}, React.createElement("span",null, t("v4_your_goals"))),
      React.createElement("div",{className:"v4-empty"},
        React.createElement("div",{className:"em"}, "🎯"),
        React.createElement("div",{className:"ti"}, t("v4_nogoal_t")),
        React.createElement("div",{className:"ph"}, t("v4_nogoal_p")),
        React.createElement("button",{className:"btn cta",onClick:function(){ if(onGoPlan) onGoPlan("metas"); }}, t("v4_nogoal_cta"))
      )
    ),

    !showSkel && goals.length>0 && React.createElement("div",{className:"v4-section rise",style:{animationDelay:".2s"}},
      React.createElement("div",{className:"v4-section-h"},
        React.createElement("span",null, t("v4_your_goals")),
        React.createElement("button",{className:"link",onClick:function(){ if(onGoPlan) onGoPlan("metas"); }}, t("v4_see_plan"))
      ),
      // stopPropagation: el carrusel scrollea en horizontal y sin esto el gesto burbujeaba al
      // viewport y cambiaba de pestaña a la vez (feedback 2026-07-18, aparecía al crear metas).
      React.createElement("div",{className:"v4-goals",
        onTouchStart:function(e){ e.stopPropagation(); },
        onTouchMove:function(e){ e.stopPropagation(); }},
        goals.map(function(g){
          const pct=goalPct(g); const eta=goalEta(g, tt.ahorroMensual);
          return React.createElement("div",{key:g.id,className:"v4-goal"},
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:10}},
              React.createElement("span",{style:{fontSize:28}}, g.emoji||"🎯"),
              React.createElement("div",{style:{flex:1,minWidth:0}},
                React.createElement("div",{style:{fontWeight:800,fontSize:15.5}}, g.name),
                React.createElement("div",{style:{fontSize:12.5,color:"var(--muted)",marginTop:2}}, eur0(g.saved||0)+" "+t("gl_of")+" "+eur0(g.target||0))
              ),
              React.createElement("div",{className:"serif num v4-goal-pct",style:{fontWeight:600,fontSize:18}}, Math.round(pct)+"%")
            ),
            React.createElement("div",{className:"bar"}, React.createElement("i",{style:{width:pct+"%"}})),
            React.createElement("div",{style:{fontSize:12.5,color:"var(--muted)"}}, eta.text)
          );
        })
      )
    ),

    !showSkel && React.createElement("div",{className:"v4-section rise",style:{animationDelay:".25s"}},
      React.createElement("div",{className:"v4-section-h"},
        React.createElement("span",null, t("v4_recent")),
        React.createElement("button",{className:"link",onClick:function(){ if(onGoGastos) onGoGastos(); }}, t("v4_all"))
      ),
      React.createElement("div",{className:"v4-card",style:{padding:"6px 14px"}},
        recent.length===0
          ? React.createElement("div",{style:{padding:"18px 4px",color:"var(--muted)",fontSize:14}}, t("v4_recent_empty"))
          : recent.map(function(e){
              const c=catOf(e.category); const pos=e.amount<0;
              return React.createElement("div",{key:e.id||(e.date+e.amount+e.merchant),className:"v4-mov"},
                React.createElement("div",{className:"tile",style:{background:(c.color||"#5FD08A")+"22"}}, c.icon||"📦"),
                React.createElement("div",{style:{flex:1,minWidth:0}},
                  React.createElement("div",{className:"nm"}, e.merchant||catName(e.category)),
                  React.createElement("div",{className:"meta"}, catName(e.category)+(e.source&&String(e.source).indexOf("ob:")===0?" · "+t("g_bank_ob"):""))
                ),
                React.createElement("div",{className:"am num"+(pos?" pos":"")}, (pos?"+":"")+eur(Math.abs(e.amount)))
              );
            })
      )
    )
  );
}
