/* ============================================================
   TAB: DEUDAS
   ============================================================ */
// El borrador conserva «1,»/«1.» hasta Guardar: convertirlo en cada pulsación impedía escribir
// decimales (feedback 14/10). Vacío y cero siguen siendo desconocido y sin intereses, respectivamente.
function planEditNumber(raw,optional){
  const text=String(raw==null?"":raw).trim();
  if(text==="") return optional?null:NaN;
  if(!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text)) return NaN;
  const n=Number(text.replace(",","."));
  return Number.isFinite(n)&&n>=0?n:NaN;
}
/* «Baja cada mes» (`amort`) solo se ofrece sin interés: con TAE la cuota lleva intereses y el modelo
   lineal no sabe separarlos (`deudaDescontable`, rev. t5 R1). El préstamo familiar dado de alta con
   plazo guardaba `amort` = saldo/plazo y no había forma de corregirlo (feedback 1/11/2026). */
function debtEditAmortable(d){ return !(Number(d&&d.apr)>0); }
// Los decimales se enseñan con coma, como en el resto de la app («4,5», no «4.5»); `planEditNumber` ya acepta las dos (filtro 253).
const debtEditNum=function(n){ return String(n).replace(".",","); };
function debtEditDraft(d){
  const o={name:d.name||"",note:d.note==null?"":String(d.note),balance:debtEditNum(+debtBalance(d).toFixed(2)),monthly:debtEditNum(d.monthly||0),
    day:String(debtChargeDay(d)),months:d.months==null?"":String(d.months),apr:d.apr==null?"":debtEditNum(d.apr)};
  if(debtEditAmortable(d)) o.amort=debtEditNum(+debtAmort(d).toFixed(2));
  return o;
}
/* Cambiar el plazo de una deuda cuya bajada NO es la cuota (préstamo familiar) se validaba contra la
   bajada vieja y no había plazo que encajara: con el plazo nuevo, lo lineal es pendiente/meses que
   quedan, como en el alta. La ligada a la cuota (financiación al 0 %) no se toca: ahí cuota y plazo
   tienen que encajar y la hoja dice con qué cuota. null = no hay nada que proponer. */
function debtEditAmortDePlazo(d,form){
  if(!debtEditAmortable(d)||form.amort===undefined||planEditNumber(form.apr,true)>0) return null;
  const amort=planEditNumber(form.amort,true),monthly=planEditNumber(form.monthly),months=planEditNumber(form.months,true),balance=planEditNumber(form.balance);
  if(!(amort>0)||!(monthly>=0)||Math.round(amort*100)===Math.round(monthly*100)||months==null||!Number.isInteger(months)||!(balance>0)) return null;
  const remaining=months-debtCuotasDesdeAncla(d),principal=Math.round(balance*100)-Math.round((d.balloon||0)*100);
  if(!(remaining>0)||principal<=0) return null;
  return debtEditNum(Math.ceil(principal/remaining)/100);
}
/* AMORTIZAR `amt` de una deuda cuyo pendiente era `bal` (lo que vio el diálogo) → la deuda nueva, o la
   misma si no toca (un diálogo viejo o dos toques seguidos no amortizan dos veces). En curso, el ancla
   no se mueve: baja `value` y el plazo se acorta. Con el plazo ya VENCIDO (dato heredado con pendiente)
   solo baja `value` y el plazo se queda: acortarlo desde las cuotas sin tope dejaba un plazo más largo
   que lo contado y el saldo salía 0 (1.300 en 12×100, debiendo 100, amortizar 50 pintaba 0,00 y los 50
   desaparecían; revisión de dinero 234, H-A1). Alargarlo para cobrar el resto desde hoy tampoco: la
   cuota de este mes, si su día ya pasó, saldría como pagada sin ningún cargo. */
function deudaAmortizada(x, bal, amt){
  const current=debtBalance(x);
  if(current<=0.005 || Math.abs(current-bal)>0.005) return x;
  const applied=Math.min(amt,current), remaining=+(current-applied).toFixed(2);
  const o=Object.assign({},x,{value:+(x.value-applied).toFixed(2)});
  const paid=debtCuotasDesdeAncla(x), vencida=x.months!=null&&paid>=x.months, am=debtAmort(x);
  if(remaining<=0.005){
    // Vencida, el plazo y el pago final ya están contados: quitarlos dejaría el pago final debido.
    if(!vencida){ if(x.months!=null) o.months=paid; delete o.balloon; }
    o.settledAt=new Date().toISOString();
  /* Una bajada de menos de medio céntimo no cuenta cuotas: el plazo se quedaba en las ya pagadas con
     saldo pendiente. Como `debtEditMonths`, sin cuotas que contar el plazo no se toca (revisión 237). */
  }else if(vencida){
    // Con el plazo agotado, lo que queda (99,95 de 100 → 0,05) no es el redondeo de ninguna última cuota
    // (`debtUltimaAjuste` lo daba por cero, DIN-15): se marca para que `debtBalanceAfter` lo respete.
    o.restoDe=o.value;
  }else if(x.months!=null&&!vencida&&Math.round(am*100)>0){ const n=cuotasQueQuedan(remaining-(x.balloon||0),am); o.months=paid+(n>0?n:(x.balloon>0?1:0)); }
  return o;
}
/* Cuotas de `am` que hacen falta para `viaM`, contadas en CÉNTIMOS. En euros, 72,45 / 10,35 da
   7,000000000000001 y el `ceil` sumaba una cuota fantasma que alargaba el plazo un mes (y el asesor
   contaba una cuota menos recortada); restar un pago final también deja ese polvo de coma flotante.
   0 = no queda nada que pagar con cuotas (por debajo de medio céntimo, también). */
function cuotasQueQuedan(viaM, am){
  const v=Math.round(viaM*100), a=Math.round(am*100);
  return v>0&&a>0?Math.ceil(v/a):0;
}
/* Cuotas que quedan {n,tot}: las financiaciones lo saben por su plazo; sin plazo (hipoteca/préstamo
   a mano) se ESTIMA con el ritmo de amortización actual. Contadas en céntimos como el resto: en euros,
   72,45 con cuota de 10,35 eran 8 y la fecha de fin salía un mes tarde (revisión 237). Una bajada que
   no llega a medio céntimo no cuenta nada: null, como `debtEditMonths`, mejor que un «acabas» inventado. */
function debtLeftInfo(d){
  const left=debtLeft(d);
  if(left!=null) return {n:left, tot:d.months||left};
  const am=debtAmort(d), bal=debtBalance(d);
  if(!(Math.round(am*100)>0) || !(bal>0.005)) return null;
  return {n:cuotasQueQuedan(bal,am), tot:cuotasQueQuedan(d.original||bal,am)};
}
// Un plazo agotado puede dejar céntimos de redondeo o saldo legado: aún debe poder corregirse.
function debtEditFinished(d){ return d.months!=null&&debtPaidCount(d)>=d.months&&debtBalance(d)<=0.005; }
// La sugerencia y el recálculo existente comparten céntimos y última cuota parcial.
function debtEditMonths(d,balance,am,paid){
  const viaM=Math.max(0,Math.round(balance*100)-Math.round((d.balloon||0)*100)),perMonth=Math.round(am*100);
  if(viaM>0&&perMonth<=0) return null;
  return paid+(viaM>0?Math.ceil(viaM/perMonth):(d.balloon>0&&balance>0.005?1:0));
}
function debtEditResult(d,form){
  const balance=planEditNumber(form.balance),monthly=planEditNumber(form.monthly),day=planEditNumber(form.day),
    months=planEditNumber(form.months,true),apr=planEditNumber(form.apr,true);
  // Vacío o sin el campo (deuda con TAE, borradores de antes) = no se toca lo que baja.
  const amortIn=debtEditAmortable(d)&&!(apr>0)?planEditNumber(form.amort,true):null;
  if(!form.name.trim() || [balance,monthly,day,months,apr,amortIn].some(function(n){ return Number.isNaN(n); }) ||
    !Number.isInteger(day)||day<1||day>31 || months!=null&&!Number.isInteger(months)) return {error:"plan_edit_invalid"};
  const next=Object.assign({},d),oldBalance=+debtBalance(d).toFixed(2);
  const amountChanged=balance!==oldBalance,quotaChanged=monthly!==(d.monthly||0),dayChanged=day!==debtChargeDay(d),
    termChanged=months!==(d.months==null?null:d.months),aprChanged=apr!==(d.apr==null?null:d.apr),
    // Tecleada en la hoja (`amortSet`) también cuenta si es la de antes pero la cuota ligada se movió:
    // si no, «cuota 197, baja 250» en una deuda que bajaba 250 se guardaba bajando 197 (rev. lo-descuento B1).
    tiedMoves=quotaChanged&&(d.amort==null||Math.abs(d.amort-(d.monthly||0))<=0.005),
    // Ligada y siguiendo a la cuota en pantalla (bajada = cuota nueva) sigue siendo la ligadura de siempre.
    amortChanged=amortIn!=null&&(tiedMoves?Math.round(amortIn*100)!==Math.round(monthly*100)&&
      (form.amortSet===true||Math.round(amortIn*100)!==Math.round(debtAmort(d)*100)):Math.round(amortIn*100)!==Math.round(debtAmort(d)*100));
  // Cambiar el calendario de una deuda terminada puede reabrirla o reescribir su historia.
  // La guardia también protege llamadas que no pasan por los campos bloqueados de la ficha.
  if(debtEditFinished(d)&&(amountChanged||quotaChanged||dayChanged||termChanged||aprChanged||amortChanged)) return {error:"db_finished_edit_hint"};
  if(form.name.trim()!==(d.name||"")) next.name=form.name.trim();
  if(form.note!==undefined&&form.note!==(d.note==null?"":String(d.note)))next.note=form.note;
  // El alta con plazo pone `amort` lineal (saldo/plazo), no la cuota tecleada: si coinciden (o no hay
  // `amort`), la cuota ES lo que amortiza y se mueven juntas; si difieren (intereses, préstamo familiar
  // que paga 197 y amortiza 250), cambiar la cuota solo cambia lo que se paga, no el calendario (revisión d139).
  const quotaIsAmort=d.amort==null||Math.abs(d.amort-(d.monthly||0))<=0.005;
  if(quotaChanged){ next.monthly=+monthly.toFixed(2); if(quotaIsAmort&&d.amort!=null) next.amort=next.monthly; }
  // Lo que baja, tecleado, manda sobre la ligadura con la cuota; igual a la cuota no hace falta guardarlo.
  if(amortChanged){ next.amort=+amortIn.toFixed(2); if(Math.abs(next.amort-(next.monthly||0))<0.005) delete next.amort; }
  if(amortChanged&&!(amortIn>0)&&balance>0.005) return {error:"db_edit_amort_zero"};
  if(dayChanged) next.day=day;
  if(termChanged){ if(months==null) delete next.months; else next.months=months; }
  if(aprChanged) next.apr=apr;
  // Cambiar nombre/TAE o guardar lo mismo nunca re-ancla ni redondea una deuda heredada.
  // Si cambia el saldo, se conserva el contrato anterior: ancla nueva sin plazo, cuotas pagadas
  // intactas con plazo. Mover día/cuota conserva el pendiente real antes de proyectarlo de nuevo.
  // Cambiar lo que baja re-ancla `value` (si no, el saldo de hoy cambiaría hacia atrás: value − amort×pagadas).
  if(amountChanged||quotaChanged||dayChanged||termChanged||amortChanged){
    const am=debtAmort(next),paid=debtCuotasDesdeAncla(next);
    // Plazo y cuota deben cancelar el pendiente: ni cuotas a cero ni principal sin pagar.
    // La última fracción es válida; amort y pago final mantienen su contrato original.
    // También al tocar SOLO la cuota que amortiza: antes se alargaba el plazo en silencio y una cuota
    // que no cubría lo pendiente en el plazo de la hoja se guardaba igual (rechazo de beta 4.26.138.1).
    if((termChanged||quotaChanged&&quotaIsAmort)&&next.months!=null){
      const remaining=next.months-paid,perMonth=Math.round(am*100),principal=Math.round(balance*100)-Math.round((next.balloon||0)*100);
      if(remaining<=0||principal<=(remaining-1)*perMonth||principal>remaining*perMonth){
        // Con la bajada tecleada, el rango de cuotas no dice nada: lo que no encaja es lo que baja.
        if(amortChanged) return {error:"db_err_term_amort"};
        // Con solo la cuota tocada se dice qué cuota encaja: «no encajan» a secas dejaba a la
        // hipoteca heredada sin forma de saber qué valor aceptaba (revisión d139c).
        const lo=remaining>0?Math.ceil(principal/remaining):0,hi=remaining>1?Math.ceil(principal/(remaining-1))-1:null;
        // Sin `amort` y con TAE, la cuota real lleva intereses que este cálculo no ve: el rango saldría
        // muy por debajo de lo que paga (481 frente a 700 en la revisión d139d) y engañaría.
        if(quotaChanged&&!termChanged&&principal>0&&lo>0&&(hi==null||hi>=lo)&&!(d.amort==null&&d.apr>0))
          return {error:"db_err_term_quota",range:{n:remaining,min:lo/100,max:hi==null?null:hi/100}};
        return {error:"db_err_term_quota"};
      }
    }
    // Una cuota a 0 con saldo pendiente deja la deuda parada para siempre. La que no amortiza no pasa
    // por la cuenta de arriba, así que se guardaba sin aviso (revisión d139c: 1.000 € y cuota 0).
    if(quotaChanged&&!(next.monthly>0)&&balance>0.005) return {error:"db_edit_quota_zero"};
    if(termChanged&&months!=null&&balance>0.005&&months<=paid) return {error:"db_err_paid"};
    if(amountChanged&&next.months==null){ next.asOf=ymNow(); next.value=+balance.toFixed(2); }
    else if(next.months!=null&&paid>=next.months&&!termChanged){
      /* Plazo ya VENCIDO (dato heredado con pendiente): se corrige lo que se debe y el plazo se queda.
         Alargarlo desde las cuotas sin tope la reactivaba y, con el día de cargo pasado, Recibos daba
         por PAGADA una cuota de este mes sin cargo y el neto del banco restaba 100 (revisión de dinero
         234, R2-1). Igual que `deudaAmortizada`. */
      next.value=+(balance+am*next.months+(next.balloon>0?next.balloon:0)).toFixed(2);
    }else{
      // Saldo/día también cambian la proyección: mantener el plazo dejaba principal huérfano.
      // Con la cuota que amortiza no se recalcula: ya se validó contra el plazo que el usuario ve.
      // Si la cuota no amortiza (amort distinta), saldo+cuota a la vez sigue recalculando: si no,
      // nadie miraba el plazo y quedaba principal sin cuotas o cuotas fantasma (revisión d139).
      // Cuenta en céntimos para no añadir una cuota por el error binario de una división exacta.
      // Con otra bajada y el plazo intacto, el plazo sale de ella (y la hoja pide confirmarlo).
      if((amountChanged||dayChanged||amortChanged)&&!(quotaChanged&&quotaIsAmort)&&!termChanged&&next.months!=null&&am>0){
        const calculated=debtEditMonths(next,balance,am,paid);
        if(calculated==null) return {error:"plan_edit_invalid"};
        next.months=calculated;
      }
      next.value=+(balance+am*paid+(next.balloon>0&&next.months!=null&&paid>=next.months?next.balloon:0)).toFixed(2);
    }
    if(balance>0.005){ next.settledAt=null; next.archivedAt=null; }
  }
  return {item:JSON.stringify(next)===JSON.stringify(d)?d:next};
}
function debtEditExtension(d,form){
  const monthly=planEditNumber(form.monthly),months=planEditNumber(form.months,true);
  if(d.months==null||months!==d.months||!(monthly>0&&monthly<(d.monthly||0))||debtEditResult(d,form).error!=="db_err_term_quota") return null;
  // La TAE sin amortización conocida no permite prometer un plazo con el modelo lineal.
  if(d.amort==null&&(d.apr>0||planEditNumber(form.apr,true)>0)) return {error:"db_extend_unknown"};
  const next=Object.assign({},d,{monthly:+monthly.toFixed(2),day:planEditNumber(form.day)});
  if(d.amort!=null&&Math.abs(d.amort-(d.monthly||0))<=0.005) next.amort=next.monthly;
  const n=debtEditMonths(next,planEditNumber(form.balance),debtAmort(next),debtCuotasDesdeAncla(next));
  if(!Number.isSafeInteger(n)||n<=months||debtEditResult(d,Object.assign({},form,{months:String(n)})).error) return null;
  return {months:n};
}
function goalEditDraft(g){ return {name:g.name||"",emoji:g.emoji||"🎯",target:String(g.target||0),saved:String(g.saved||0),deadline:g.deadline||"",monthly:g.monthly==null?"":String(g.monthly)}; }
function goalEditResult(g,form){
  const target=planEditNumber(form.target),saved=planEditNumber(form.saved),monthly=planEditNumber(form.monthly,true);
  if(!form.name.trim()||!(target>0)||Number.isNaN(saved)||Number.isNaN(monthly)) return {error:"plan_edit_invalid"};
  const next=Object.assign({},g);
  if(form.name.trim()!==(g.name||"")) next.name=form.name.trim();
  if(form.emoji!==(g.emoji||"🎯")) next.emoji=form.emoji;
  if(target!==g.target) next.target=+target.toFixed(2);
  if(saved!==(g.saved||0)) next.saved=+saved.toFixed(2);
  if((monthly||null)!==(g.monthly||null)) next.monthly=monthly>0?+monthly.toFixed(2):null;
  if(form.deadline!==(g.deadline||"")) next.deadline=form.deadline||null;
  if(next.target!==g.target||next.saved!==g.saved){ next.done=(next.saved||0)>=next.target; next.doneAt=next.done?(g.doneAt||new Date().toISOString()):null; }
  return {item:JSON.stringify(next)===JSON.stringify(g)?g:next};
}
function planEditSame(a,b){ return JSON.stringify(a)===JSON.stringify(b); }
function debtEditRateError(s,before,next){
  if(Number(before&&before.apr)>0||!(Number(next&&next.apr)>0)) return "";
  const linked=function(r){ return Array.isArray(r)&&r.some(function(x){ return x&&x.via==="debt"&&x.debtId===before.id; }); };
  const p=madridYmdParts(Date.now()),cur=p.y*12+p.m;
  // La relación sigue viva aunque el recibo esté pausado o aún no toque cobrarlo. Los repartos
  // congelados de pagos anteriores se conservan: quitarlos no es requisito para cambiar la TAE.
  const has=(s.fixed||[]).some(function(e){
    if(linked(e.reparto)) return true;
    return Object.keys(e.soloMes||{}).some(function(k){
      const ym=Number(k),o=e.soloMes[k];
      return Number.isInteger(ym)&&ym>=cur&&o&&linked(o.reparto)&&
        (ym>cur||!fixedPaymentState(s,e,p.y,p.m,p.d).paid);
    });
  });
  return has?"db_rate_discount_remove":"";
}
function debtEditTermChange(d,form,result){
  if(!result.item||d.months==null||planEditNumber(form.months,true)!==d.months||result.item.months===d.months) return null;
  return {before:d.months,after:result.item.months,leftBefore:debtLeft(d),leftAfter:debtLeft(result.item)};
}
function debtEditConfirmResult(state,debt,form,confirmed){
  const rows=(state.debts||[]).filter(function(d){return d.id===debt.id;});
  if(rows.length!==1||!planEditSame(rows[0],debt)) return {error:"plan_edit_changed"};
  const result=debtEditResult(rows[0],form);
  if(result.error) return result;
  // La confirmación no autoriza otra proyección si cambió el borrador o pasó el día de cobro.
  if(!planEditSame(result.item,confirmed.item)||!planEditSame(debtEditTermChange(rows[0],form,result),confirmed.change)) return {error:"db_edit_projection_changed"};
  return result;
}
function planEditCommit(s,field,before,next){
  const matches=(s[field]||[]).filter(function(x){ return x.id===before.id; });
  if(matches.length!==1||planEditSame(matches[0],next)||!planEditSame(matches[0],before)) return s;
  if(field==="debts"&&debtEditRateError(s,matches[0],next)) return s;
  return Object.assign({},s,{[field]:s[field].map(function(x){ return x.id===before.id?next:x; })});
}
function usePlanEditSave({state,set,field,item,onClose,showToast,review}){
  const [pending,setPending]=useState(null),[error,setError]=useState(""),[range,setRange]=useState(null);
  const sending=useRef(false),outcome=useRef(null);
  useLayoutEffect(function(){
    if(!pending||!outcome.current) return;
    if(outcome.current.error){ sending.current=false; setPending(null); setError(typeof outcome.current.error==="string"?outcome.current.error:"plan_edit_changed"); return; }
    const rows=(state[field]||[]).filter(function(x){ return x.id===item.id; });
    // La hoja ya no se desmonta aquí sino tras bajar: durante esa salida otra escritura (la nube,
    // un sync) volvía a pasar por este efecto y repetía el cierre y el «Cambios guardados».
    if(rows.length===1&&planEditSame(rows[0],pending)){ outcome.current=null; onClose(); if(showToast) showToast(t("plan_edit_saved")); }
  },[pending,state[field]]);
  const save=function(result){
    if(sending.current) return;
    if(result.error){ setError(result.error); setRange(result.range||null); return; }
    const next=result.item;
    const rateError=field==="debts"?debtEditRateError(state,item,next):"";
    if(rateError){ setError(rateError); setRange(null); return; }
    sending.current=true; const response={error:false}; outcome.current=response; setError(""); setRange(null);
    // Pendiente y escritura comparten prioridad: un Guardar urgente se confirmaba antes de
    // rebasarse sobre una corrección ya en cola y desmontaba la hoja antes de poder avisar.
    React.startTransition(function(){ setPending(next); set(function(s){
      if(review&&!goalSyncEqual(planSyncConflict(s,field,item.id),review)){response.error=true;return s;}
      // Un recibo puede llegar de la nube sin cambiar la deuda que abrió esta hoja.
      const current=field==="debts"?(s.debts||[]).find(function(d){return d.id===item.id;}):null;
      const rateError=field==="debts"?debtEditRateError(s,current||item,next):"";
      if(rateError){response.error=rateError;return s;}
      let changed=field==="debts"&&review&&!(s.debts||[]).some(function(d){return d.id===item.id;})
        ?planSyncRecoverDebt(s,review,next):planEditCommit(s,field,item,next);
      const rows=(changed[field]||[]).filter(function(x){ return x.id===item.id; });
      response.error=rows.length!==1||!planEditSame(rows[0],next);
      if(!response.error&&review)changed=planSyncDiscard(changed,review);
      return changed;
    }); });
  };
  return {save:save,error:error,range:range,pending:!!pending,clearError:function(){setError("");setRange(null);}};
}
function PlanEditSheet({title,onClose,closer,children}){
  const swipe=useSheetSwipe(true,onClose); useBackClose(true,swipe.close);
  // Guardar también cierra bajando la hoja. Con el `onClose` pelado desaparecía de un fotograma
  // al siguiente, hoja y velo a la vez: el «suave parpadeo cuando se cierra solo» de beta
  // 4.26.139.1 (2026-10-17). Apuntar ya guardaba así.
  if(closer) closer.current=swipe.close;
  // Misma hoja que Apuntar/Modificar: con `.tabsheet` el fondo se iba de golpe a negro al 55 % y
  // la hoja subía en 280 ms, justo lo que ya se había rechazado allí (velo 2026-07-17, ritmo
  // 2026-09-23). En beta 4.26.138.1 se leyó como «parpadea o salta» al abrir Deudas y Metas.
  return ReactDOM.createPortal(React.createElement("div",{className:"v4-sheet-back",onClick:swipe.close},
    React.createElement("div",Object.assign({className:"v4-sheet plan-edit-sheet",role:"dialog","aria-modal":true,"aria-label":title,
      ref:swipe.sheetRef,onClick:function(e){e.stopPropagation();}},swipe.sheetTouch),
      React.createElement("div",{className:"v4-sheet-handle"}),
      React.createElement("div",{className:"plan-edit-head"},React.createElement("h2",{className:"serif"},title),
        React.createElement("button",{type:"button",className:"btn btn-ghost","aria-label":t("gl_cancel"),onClick:swipe.close},"✕")),children)),document.body);
}
function planReviewDraft(current,record){
  const draft=Object.assign({},current);
  (record&&record.fields||[]).forEach(function(k){
    if(["id","owner","user_id","type","paidYm","paidDay","wait","paymentProofs"].indexOf(k)>=0)return;
    if(Object.prototype.hasOwnProperty.call(record.local,k))Object.defineProperty(draft,k,{value:record.local[k],enumerable:true,writable:true,configurable:true});else delete draft[k];
  });
  return draft;
}
function planFixedReviewResult(state,current,record,patch){
  const bad=function(){return {error:"plan_edit_invalid"};},has=function(o,k){return Object.prototype.hasOwnProperty.call(o,k);};
  if(!current||!record||record.kind!=="fixed"||record.id!==current.id)return bad();
  if(Object.keys(patch||{}).some(function(k){return ["id","owner","user_id","type","paymentProofs","paidYm","paidDay","wait"].indexOf(k)>=0;}))return bad();
  const draft=Object.assign({},planReviewDraft(current,record),patch||{});
  const number=function(n){return typeof n==="number"&&Number.isFinite(n);},month=function(m){return Number.isInteger(m)&&m>=1&&m<=12;},day=function(d){return d==null||Number.isInteger(d)&&d>=1&&d<=31;};
  if(typeof draft.name!=="string"||!draft.name.trim()||!number(draft.amount)||draft.bankAmount!=null&&!number(draft.bankAmount)||!day(draft.day))return bad();
  if(draft.freq!=null&&["mes","mensual","bimestral","trimestral","semestral","año","anual"].indexOf(draft.freq)<0)return bad();
  if(draft.account!=null&&typeof draft.account!=="string")return bad();
  if(draft.months!=null&&(!Array.isArray(draft.months)||draft.months.some(function(m){return !month(m);})||new Set(draft.months).size!==draft.months.length))return bad();
  if(draft.schedule!=null&&(!Array.isArray(draft.schedule)||draft.schedule.some(function(x){return !x||!month(x.m)||!day(x.day)||!number(x.amt);})||new Set(draft.schedule.map(function(x){return x.m;})).size!==draft.schedule.length))return bad();
  // El grupo local se conserva entero, incluidas sus ausencias. La puerta canónica
  // recibe también los cambios de cuenta/importe para invalidar las marcas como siempre.
  const delta={};new Set(Object.keys(current).concat(Object.keys(draft))).forEach(function(k){if(has(current,k)!==has(draft,k)||!goalSyncEqual(current[k],draft[k]))delta[k]=draft[k];});
  const base=Object.assign({},state,{fixed:(state.fixed||[]).map(function(f){return f.id===current.id?current:f;})});
  let next=base;patchFixedById(function(fn){next=fn(base);},current.id,delta);
  const item=next.fixed.find(function(f){return f.id===current.id;});if(!item)return bad();
  Object.keys(delta).forEach(function(k){if(!has(draft,k))delete item[k];});
  return {item:item};
}
function PlanConflictDot({record}){
  return record?React.createElement("span",{"data-plan-conflict-dot":record.kind,"aria-label":t("plan_conflict_title"),style:{color:"var(--tan)",marginLeft:6}},"●"):null;
}
function PlanConflictSheet({record,current,onReview,onDiscard,onClose}){
  const detail=function(item){
    const rows=[[t("plan_edit_name"),item.name||"—"]];
    if(record.kind==="fixed")rows.push([t("plan_conflict_amount"),item.amount==null?"—":eur(item.amount)],[t("plan_conflict_category"),item.category||item.cat||"—"]);
    else rows.push([t("db_pending"),eur(debtBalance(item))],[t("plan_edit_quota"),item.monthly==null?"—":eur(item.monthly)],[t("plan_conflict_note"),item.note||"—"]);
    rows.push([t("fj_day"),item.day==null?"—":String(item.day)]);
    rows.push([t("plan_conflict_account"),item.account?entOf(item.account).label:"—"]);
    if(record.kind==="fixed"){
      const frequency={mes:"gb_freq_m",bimestral:"gb_freq_2m",trimestral:"gb_freq_3m",semestral:"gb_freq_6m",año:"gb_freq_y",anual:"gb_freq_y"};
      rows.push([gbTxt("gb_step_how_often"),frequency[item.freq]?gbTxt(frequency[item.freq]):item.freq||"—"]);
      if(Array.isArray(item.months)&&item.months.length)rows.push([gbTxt("gb_months_q"),item.months.map(function(m){return monthShort(m-1);}).join(", ")]);
      if(Array.isArray(item.schedule)&&item.schedule.length)rows.push([gbTxt("gb_step_when"),item.schedule.map(function(x){return monthShort(x.m-1)+" · "+(x.day||"—")+" · "+(x.amt==null?"—":eur(x.amt));}).join("; ")]);
    }else{
      if(item.months!=null)rows.push([t("db_months_ph"),String(item.months)]);
      if(item.apr!=null)rows.push([t("da_rate"),String(item.apr)]);
    }
    return React.createElement("dl",{style:{margin:"8px 0 16px"}},rows.map(function(r){return React.createElement("div",{key:r[0],style:{display:"flex",justifyContent:"space-between",gap:12}},React.createElement("dt",null,r[0]),React.createElement("dd",{style:{margin:0,overflowWrap:"anywhere"}},r[1]));}));
  };
  return React.createElement(PlanEditSheet,{title:t("plan_conflict_title"),onClose:onClose},
    React.createElement("div",{"data-plan-conflict":record.kind},
      React.createElement("h3",null,t("plan_conflict_current")),detail(current),
      React.createElement("h3",null,t("plan_conflict_local")),detail(record.local),
      React.createElement("button",{type:"button",className:"btn btn-primary btn-block",onClick:onReview},t("plan_conflict_review")),
      React.createElement("button",{type:"button",className:"btn btn-ghost btn-block",onClick:onDiscard},t("plan_conflict_discard"))));
}
function debtNeedsChargeDay(d){ return !!d&&debtActive(d)&&!d.settledAt&&!d.archivedAt&&cleanDay(dayOf(d))==null; }
function DebtDayPrompt({debt,onOpen}){
  if(!debtNeedsChargeDay(debt)) return null;
  return React.createElement("button",{type:"button",className:"link","data-debt-day-id":debt.id,
    "aria-label":debt.name+" · "+t("db_day_prompt"),style:{display:"block",minHeight:44,textAlign:"left",color:"var(--mint)",textDecoration:"underline",textUnderlineOffset:3},
    onClick:function(){ onOpen(debt); }},t("db_day_prompt"));
}
function DebtEditSheet({debt,state,set,onClose,onDelete,onAmortize,showToast,review,recovery,initialFocus}){
  const [form,setForm]=useState(function(){
    const source=planReviewDraft(debt,review),draft=debtEditDraft(source);
    // Revisar un conflicto conserva el día local aunque la copia remota aún no tenga uno.
    if(initialFocus==="day"&&!recovery&&debtNeedsChargeDay(debt)&&cleanDay(dayOf(source))==null) draft.day="";
    return draft;
  });
  // Amortizar desde la ficha (decisión del dueño, 18/11/2026) cierra la hoja al aplicarse: su borrador
  // lleva el pendiente de antes y «Guardar cambios» lo devolvería. Con algo ya tecleado no se ofrece
  // por lo mismo, para no tirar lo escrito.
  const formInicial=useRef(form).current;
  const tocado=Object.keys(form).some(function(k){ return form[k]!==formInicial[k]; });
  const viva=(state.debts||[]).find(function(x){ return x.id===debt.id; });
  /* Si «Baja la deuda» va ligada a la cuota se decide UNA vez, con la deuda tal y como se abre. Antes
     se decidía en cada tecla comparando los dos campos en vivo: en un préstamo familiar (paga 197,
     baja 250) la cuota pasaba un instante por «250» al teclearla, la bajada se enganchaba y se
     guardaba sin sus 250 (revisión independiente de la 4.26.214). Con la misma tolerancia que el
     guardado (`quotaIsAmort`): una cuota guardada con tres decimales (197,333) y sin bajada propia
     abre la bajada a 197,33 y es la misma ligadura. */
  const tied=useRef(function(){
    if(form.amort===undefined) return false;
    const a=planEditNumber(form.amort,true),m=planEditNumber(form.monthly);
    return Number.isFinite(a)&&Number.isFinite(m)?Math.abs(a-m)<=0.005:a===m;
  }()).current;
  const dayRef=useRef(null);
  useEffect(function(){
    if(initialFocus!=="day"||recovery) return;
    const frame=requestAnimationFrame(function(){ if(dayRef.current){ dayRef.current.focus({preventScroll:true}); dayRef.current.scrollIntoView({block:"nearest",behavior:mcReduced()?"auto":"smooth"}); } });
    return function(){ cancelAnimationFrame(frame); };
  },[]);
  const [attempt,setAttempt]=useState(0),errorRef=useRef(null);
  const finished=debtEditFinished(debt);
  const closer=useRef(null);
  const save=usePlanEditSave({state:state,set:set,field:"debts",item:debt,review:review,onClose:function(){ closer.current?closer.current():onClose(); },showToast:showToast});
  const extension=save.error?debtEditExtension(debt,form):null;
  // El rechazo puede quedar bajo el borde de la hoja. Cada Guardar vuelve a mostrarlo, incluso
  // si se repite el mismo error: el borrador y las guardas financieras no cambian (18/10).
  // Suave, como en el resto de hojas: el salto seco desorientaba (auditoría de diseño 14/11).
  useLayoutEffect(function(){
    if(save.error&&errorRef.current){ errorRef.current.focus({preventScroll:true}); errorRef.current.scrollIntoView({block:"center",behavior:mcReduced()?"auto":"smooth"}); }
  },[save.error,save.range,attempt]);
  const [confirmPending,setConfirmPending]=useState(false),confirming=useRef(false),latest=useRef(null);
  useLayoutEffect(function(){ latest.current={state:state,form:form,save:save}; });
  useEffect(function(){ return function(){latest.current=null;}; },[]);
  // El editor legado compara contra el día 1 de respaldo: elegirlo expresamente desde el
  // aviso debe persistir ese campo, sin cambiar las validaciones ni los cálculos del editor.
  const chosenDayResult=function(result,draft){
    if(initialFocus==="day"&&!recovery&&debtNeedsChargeDay(debt)&&result.item&&!result.error&&
      planEditNumber(draft.day)===1&&cleanDay(dayOf(result.item))==null)
      return Object.assign({},result,{item:Object.assign({},result.item,{day:1})});
    return result;
  };
  const submit=function(){
    if(confirming.current||save.pending) return;
    setAttempt(function(n){return n+1;});
    const result=debtEditResult(debt,form);
    if(recovery&&result.item)result.item=Object.assign({},result.item,{restoredAt:new Date().toISOString()});
    const change=debtEditTermChange(debt,form,result);
    if(!change){ save.save(chosenDayResult(result,form)); return; }
    confirming.current=true; setConfirmPending(true);
    askConfirm({title:t("db_edit_term_confirm"),sub:tf(change.after===1?"db_edit_term_summary_one":"db_edit_term_summary",change),ok:t("db_savechanges"),cancel:t("db_edit_term_cancel")}).then(function(yes){
      confirming.current=false; const current=latest.current;
      if(!current) return;
      setConfirmPending(false);
      if(!yes) return;
      current.save.save(chosenDayResult(debtEditConfirmResult(current.state,debt,current.form,{item:result.item,change:change}),current.form));
    });
  };
  const amortOn=form.amort!==undefined&&!(planEditNumber(form.apr,true)>0);
  // `unit` (€, %) es un adorno a la derecha: el valor del campo sigue siendo solo el número que se parsea.
  const input=function(key,label,mode,unit){ return React.createElement("label",{key:key},t(label),
    React.createElement("span",{className:"af-wrap"},
    React.createElement("input",{className:"af-in"+(mode?" num":"")+(unit?" af-u":""),inputMode:mode||"text",value:form[key],"data-debt-field":key,
      ref:key==="day"?dayRef:undefined,disabled:finished&&key!=="name"&&key!=="note",readOnly:!!recovery&&key!=="name"&&key!=="note",
      onChange:function(e){
        const f=Object.assign({},form,{[key]:e.target.value});
        // Se ve antes de guardar: el plazo nuevo mueve lo que baja (si va por libre de la cuota).
        if(key==="months"){ const a=debtEditAmortDePlazo(debt,f); if(a!=null) f.amort=a; }
        // Ligada y sin tocar, lo que baja sigue a la cuota en pantalla: lo que se ve es lo que se guarda.
        // Con `tied` fijo, borrar la cuota o dejarla mal formada a medias tampoco suelta el vínculo
        // (antes NaN!==NaN lo soltaba y Guardar fallaba: INC1810, beta 4.26.213).
        if(key==="monthly"&&tied&&!form.amortSet&&form.amort!==undefined) f.amort=e.target.value;
        if(key==="amort") f.amortSet=true;
        setForm(f); }}),unit&&React.createElement("span",{className:"af-unit","aria-hidden":"true"},unit))); };
  return React.createElement(PlanEditSheet,{title:t("db_edit_title"),onClose:onClose,closer:closer},React.createElement("div",{className:"add-form dbx-form"},
    React.createElement("div",{className:"dbx-grp"},input("name","plan_edit_name"),input("note","plan_conflict_note")),
    React.createElement("div",{className:"dbx-grp"},
      input("balance","db_pending","decimal","€"),
      React.createElement("div",{className:"af-row"},input("monthly","plan_edit_quota","decimal","€"),input("day","db_day_ph","numeric")),
      amortOn&&input("amort","db_amort_ph","decimal","€"),
      amortOn&&React.createElement("div",{className:"dbx-help"},t("db_amort_hint")),
      input("months","db_months_ph","numeric"),
      finished&&React.createElement("div",{className:"dbx-help"},t("db_finished_edit_hint"))),
    React.createElement("div",{className:"dbx-grp"},
      input("apr","da_rate","decimal","%")),
    save.error&&React.createElement("div",{className:"hint dbx-err",role:"alert",tabIndex:-1,ref:errorRef},t(save.error),
      // En euros como el campo, no con eur(): esa pasa a la moneda de visualización (revisión d139d).
      save.range&&" "+(save.range.max==null?tf("db_err_quota_min",{n:save.range.n,min:NF.format(save.range.min)+" €"}):
        tf("db_err_quota_range",{n:save.range.n,min:NF.format(save.range.min)+" €",max:NF.format(save.range.max)+" €"}))),
    extension&&extension.error&&React.createElement("div",{className:"hint dbx-err",role:"status"},t(extension.error)),
    // Un solo botón primario (Guardar); lo demás es secundario o texto, en este orden de peso.
    React.createElement("div",{className:"dbx-acts"},
      extension&&extension.months&&React.createElement("button",{type:"button",className:"btn dbx-soft",disabled:save.pending||confirmPending,onClick:function(){
        const current=debtEditExtension(debt,form);
        if(current&&current.months){setForm(Object.assign({},form,{months:String(current.months)}));save.clearError();}
      }},tf("db_extend_term",{n:extension.months})),
      React.createElement("button",{type:"button",className:"btn btn-primary btn-block",disabled:save.pending||confirmPending,"data-act":recovery?"plan-orphan-save":undefined,onClick:submit},t("db_savechanges")),
      // Botón y su porqué en un mismo bloque: sueltos, la línea quedaba más cerca de «Eliminar esta deuda»
      // y parecía avisar de ese botón (filtro de diseño 242b).
      onAmortize&&!recovery&&!review&&viva&&debtBalance(viva)>0.005&&React.createElement("div",{className:"debt-amort-wrap"},
        React.createElement("button",{type:"button",className:"btn dbx-soft v4-debt-amort","data-act":"debt-amortize",
          disabled:tocado||save.pending||confirmPending,onClick:function(){
            onAmortize(viva,function(){ closer.current?closer.current():onClose(); });
          }},t("v4_amort_now")),
        // Apagado sin decir por qué parecía roto (filtro de diseño 242). Guardar y amortizar de un toque
        // se descartó: Guardar puede pedir confirmación del plazo o rechazar la cuota, y amortizar sobre un
        // borrador a medio validar es justo lo que hay que evitar.
        tocado&&React.createElement("div",{className:"hint rise","data-testid":"debt-amortize-save-first"},t("db_amortize_save_first"))),
      !recovery&&React.createElement("button",{type:"button",className:"btn dbx-del",onClick:function(){onDelete(debt);}},t("db_delete")))));
}
/* Hoja de meta: la comparten el alta y la edición para que sean la misma (objetivo grande y teclado propio como en
   Añadir recibo; ya ahorrado y fecha en celdas; «al mes» plegado; emoji junto al nombre). La fecha usa el calendario
   de la app y no el selector de mes nativo, que salía sin estilo (filtro 253). `attr` es el data-* que ya usaban los e2e. */
function GoalHoja({form,setForm,attr,title,onClose,closer,ctaLabel,ctaOn,onSave,notes,del}){
  const [dlCal,setDlCal]=useState(false), [emoOpen,setEmoOpen]=useState(false);
  const set1=function(patch){ setForm(function(o){ return Object.assign({},o,patch); }); };
  // Un emoji que no está en la lista (el de una meta antigua) se suma al principio: si no, ninguno salía marcado (filtro 253b).
  const emojis=form.emoji&&GOAL_EMOJIS.indexOf(form.emoji)<0?[form.emoji].concat(GOAL_EMOJIS):GOAL_EMOJIS;
  return React.createElement(AddHoja,{title:title,onClose:onClose,closer:closer,attr:attr,testid:"goal-add-form",
    name:form.name,setName:function(v){ set1({name:v}); },namePh:t("gl_name_ph"),
    nameLead:React.createElement("button",{type:"button",className:"rpa-emo","aria-label":t("ah_icono"),"aria-expanded":emoOpen,[attr]:"emoji",onClick:function(){ setEmoOpen(!emoOpen); }},form.emoji||"🎯"),
    amtKey:"target",amtLabel:t("ah_objetivo"),vals:form,setVals:setForm,
    cells:[{key:"saved",label:t("ah_ya_ahorrado"),kind:"dec",unit:"€"},
      {key:"deadline",label:t("ah_fecha"),text:form.deadline?monthLong(+form.deadline.slice(5,7)-1)+" "+form.deadline.slice(0,4):t("gl_deadline_none"),on:dlCal,onTap:function(){ setDlCal(!dlCal); }}],
    more:{cells:[{key:"monthly",label:t("ah_al_mes"),kind:"dec",unit:"€"}]},
    ctaOn:ctaOn,ctaLabel:ctaLabel,onSave:onSave,notes:notes,del:del},
    emoOpen&&React.createElement("div",{className:"emoji-pick"},emojis.map(function(e){
      return React.createElement("button",{key:e,type:"button",className:form.emoji===e?"on":"","aria-pressed":form.emoji===e,onClick:function(){ set1({emoji:e}); setEmoOpen(false); }},e);
    })),
    dlCal&&React.createElement(McCal,{soloMes:true,value:form.deadline?form.deadline+"-01":"",onPick:function(iso){ set1({deadline:String(iso).slice(0,7)}); setDlCal(false); }}),
    dlCal&&form.deadline&&React.createElement("button",{type:"button",className:"v4-chip",style:{alignSelf:"flex-start"},onClick:function(){ set1({deadline:""}); setDlCal(false); }},t("gl_deadline_none")));
}
function GoalEditSheet({goal,state,set,onClose,onDelete,showToast}){
  const [form,setForm]=useState(function(){return goalEditDraft(goal);});
  const closer=useRef(null);
  const save=usePlanEditSave({state:state,set:set,field:"goals",item:goal,onClose:function(){ closer.current?closer.current():onClose(); },showToast:showToast});
  const aportado=metaConAportes(goal,state).aportado;
  return React.createElement(GoalHoja,{title:t("gl_edit_title"),form:form,setForm:setForm,attr:"data-goal-field",onClose:onClose,closer:closer,
    ctaOn:!save.pending,ctaLabel:t("gl_save"),onSave:function(){ save.save(goalEditResult(goal,form)); },
    del:{label:t("gl_delete"),onClick:function(){ onDelete(goal); }},
    notes:(aportado>0||save.error)&&React.createElement(React.Fragment,null,
      // Lo marcado desde Gastos NO está en este campo (se suma al vuelo): se dice para que no lo apunte otra vez.
      aportado>0&&React.createElement("div",{className:"hint","data-testid":"goal-edit-from-gastos"},tf("gl_from_gastos",{x:eur(aportado)})),
      save.error&&React.createElement("div",{className:"hint",role:"alert"},t(save.error)))});
}
/* ASESOR DE AMORTIZACIÓN (#11) — «¿cuándo amortizar?»
   El interés (TAE) es opcional por deuda (d.apr, se edita en su hoja): con él la tarjeta
   estima intereses ahorrados, el coste de esperar y compara contra el efectivo remunerado
   (interestApr de las cuentas, p.ej. TR). Sin él, al menos simula cuántas cuotas te quitas.
   Los números usan el modelo lineal de la app (ver debtBalance): son una estimación honesta,
   no la liquidación exacta del banco.
   Solo informa: amortizar se hace desde «Amortizar ahora», dentro de la ficha de cada deuda
   (decisión DIS-26, 15/11/2026: dos puertas al mismo dinero eran una de más; el botón pasó de la
   tarjeta a la ficha el 18/11). */
// Cuotas que quita un importe: la usan el asesor y el diálogo de amortizar, para que los dos
// cuenten lo mismo. null si la deuda no tiene plazo (no hay cuotas que contar).
function amortRecorte(d,amt){
  const am=debtAmort(d);
  // Bajada por debajo de medio céntimo: no hay cuotas que contar (ver `deudaAmortizada`).
  if(d.months==null || !(Math.round(am*100)>0)) return null;
  const leftNow=debtLeft(d), nb=+(debtBalance(d)-amt).toFixed(2);
  const n=cuotasQueQuedan(nb-(d.balloon||0),am);
  const leftNew=n>0?n:((d.balloon>0&&nb>0.005)?1:0);
  return {leftNow:leftNow, leftNew:leftNew, cut:Math.max(0,(leftNow||0)-leftNew)};
}
function AmortAdvisor({state, onEdit}){
  const debts=(state.debts||[]).filter(function(d){ return debtBalance(d)>0.005; });
  const [selId,setSelId]=useState(null);
  const [amtStr,setAmtStr]=useState("500");
  // Todos los hooks ANTES del `return null`: con la última deuda amortizada el asesor desaparece y, si este useState
  // quedaba detrás, React tumbaba la pestaña entera («Rendered fewer hooks»).
  const [open,setOpen]=useState(function(){ const g=store.get("col_debt_advisor"); return g==null?false:!!g; });
  if(!debts.length) return null;
  const d=debts.find(function(x){ return x.id===selId; })||debts[0];
  const bal=debtBalance(d);
  const apr=d.apr!=null?d.apr:null;
  const amt=Math.min(Math.max(0,parseFloat(String(amtStr).replace(',','.'))||0), bal);
  const rc=amortRecorte(d,amt), leftNow=rc?rc.leftNow:null, leftNew=rc?rc.leftNew:null, cut=rc?rc.cut:null;
  // El mes mostrado parte de Madrid, también cuando el dispositivo aún está en otro mes.
  const inMonths=function(k){ const p=madridYmdParts(Date.now()), m=p.m-1+k; return monthLong(m%12)+" "+(p.y+Math.floor(m/12)); };
  const r=(apr||0)/1200;
  // ahorro ≈ el importe deja de «deber» durante lo que queda de vida del préstamo + la cola que se corta
  const savedTerm=(apr>0&&leftNew!=null)?(amt*r*leftNew+(amt/2)*r*(cut||0)):null;
  const savedYr=(apr>0&&leftNew==null)?amt*(apr/100):null;
  const waitCost=(apr>0)?bal*r:null;
  const cashApr=(state.accounts||[]).reduce(function(mx,a){ return Math.max(mx,a.interestApr||0); },0);
  const ranked=debts.filter(function(x){ return x.apr>0; }).sort(function(a,b){ return b.apr-a.apr; });
  // Cada lectura del simulador lleva su punto de color (ahorro = menta, espera/aviso = ocre): sin emojis, que cambian de
  // dibujo según el móvil y no casan con los iconos de la casa.
  const res=function(txt,tono){ return React.createElement("div",{className:"dbx-res-row"},React.createElement("i",{className:"rpt-dot"+(tono==="ok"?" ok":tono==="mute"?" mute":"")}),React.createElement("span",null,txt)); };
  // Plegable propio con la misma cabecera que «Deudas archivadas»: la tarjeta suelta de antes (borde amarillo y
  // CollapsibleCard dentro) era lo que chocaba con el lenguaje de Inicio (dueño, 23/11/2026).
  const toggle=function(){ const n=!open; setOpen(n); store.set("col_debt_advisor",n); };
  const lecturas=[
    cut!=null && (cut>0 ? res(tf("da_cut",{n:cut,d:inMonths(leftNew),d0:inMonths(leftNow)}),"ok") : res(t("da_nocut"),"mute")),
    savedTerm!=null && savedTerm>=0.5 && res(tf("da_saved",{x:eur(savedTerm)}),"ok"),
    savedYr!=null && savedYr>=0.5 && res(tf("da_saved_yr",{x:eur(savedYr)}),"ok"),
    waitCost!=null && waitCost>=0.5 && res(tf("da_wait",{x:eur(waitCost)})),
    apr===0 && res(tf("da_rate0",{p:cashApr>0?tf("da_rate0_cash",{b:cashApr}):""}),"mute")
  ].filter(Boolean).slice(0,2).map(function(x,i){ return React.cloneElement(x,{key:i}); });
  return React.createElement("section",{className:"dbx-sec","data-open":open?"1":"0"},
    React.createElement("button",{type:"button",className:"dbx-hd","aria-expanded":open,onClick:toggle},
      React.createElement("span",{className:"dbx-hd-t"},React.createElement("b",null,t("da_title")),React.createElement("small",null,t("da_sub"))),
      React.createElement(I.chev,{className:"dbx-chev"+(open?" open":"")})),
    React.createElement("div",{className:"collapsible"+(open?" open":""),inert:open?undefined:""},React.createElement("div",null,React.createElement("div",{className:"dbx-in"},
      debts.length>1 && React.createElement("div",{className:"chips dbx-pick",role:"group"},
        debts.map(function(x){ return React.createElement("button",{type:"button",key:x.id,className:"chip"+(x.id===d.id?" active":""),"aria-pressed":x.id===d.id,onClick:function(){ setSelId(x.id); }},x.name); })),
      React.createElement("div",{className:"dbx-tiles"},
        React.createElement("button",{type:"button",className:"dbx-tile",onClick:function(){onEdit(d);}},
          React.createElement("span",null,t("da_rate")),
          React.createElement("b",{className:"serif"},apr!=null?String(apr).replace(".",",")+" %":"—"),
          React.createElement("em",null,apr!=null?t("fj_edit"):t("db_set_rate"))),
        React.createElement("label",{className:"dbx-tile"},
          React.createElement("span",null,t("da_amount")),
          React.createElement("div",{className:"dbx-amt"},React.createElement("input",{className:"serif num",inputMode:"decimal",value:amtStr,onChange:function(e){ setAmtStr(e.target.value); }}),
            React.createElement("b",{className:"serif"},"€")))),
      apr==null && React.createElement("div",{className:"dbx-help"}, t("da_rate_hint")),
      React.createElement("div",{className:"chips dbx-quick"},
        [100,250,500].filter(function(v){ return v<=bal; }).map(function(v){
          return React.createElement("button",{type:"button",key:v,className:"chip",onClick:function(){ setAmtStr(String(v)); }}, eur0(v)); })),
      // Dos lecturas como mucho, las que más pesan (antes cinco o seis viñetas largas y una nota de «es una estimación»; filtro 253).
      amt>0 && lecturas.length>0 && React.createElement("div",{className:"dbx-res"},lecturas)))));
}
// Trazos de 24 px como los de la barra de abajo (la casa es la misma de Inicio).
const DEBT_ICO={
  home:[["path",{d:"M3 10.5L12 3l9 7.5"}],["path",{d:"M5 10v10h14V10"}],["path",{d:"M10 20v-6h4v6"}]],
  car:[["path",{d:"M3 16v-4l2.2-5.5h13.6L21 12v4z"}],["path",{d:"M3 12h18"}],["circle",{cx:7.5,cy:16.5,r:1.8}],["circle",{cx:16.5,cy:16.5,r:1.8}]],
  phone:[["rect",{x:7,y:2.5,width:10,height:19,rx:2}],["path",{d:"M11 18h2"}]],
  study:[["path",{d:"M2 9l10-5 10 5-10 5z"}],["path",{d:"M6 11v5c3 2.5 9 2.5 12 0v-5"}]],
  person:[["circle",{cx:12,cy:8,r:4}],["path",{d:"M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"}]],
  card:[["rect",{x:2.5,y:5,width:19,height:14,rx:2}],["path",{d:"M2.5 10h19M6 15h4"}]]
};
const DEBT_BLANK={name:"",value:"",monthly:"",months:"",day:"",account:"sabadell",down:"",balloon:"",paid:""};
function Debts({state, set, showToast,editDayRequest,onEditDayClose,editorOnly,tabs}){
  // Una corrección de saldo desde otro dispositivo nunca debe dejar una obligación activa oculta.
  const visibleDebts=state.debts.filter(function(d){ return !d.archivedAt || debtBalance(d)>0.005; });
  const archivedDebts=state.debts.filter(function(d){ return !!d.archivedAt && debtBalance(d)<=0.005; });
  const [showArchive,setShowArchive]=useState(false);
  // El último estado pintado: amortizar comprueba contra él al confirmar, no contra el del toque.
  const estadoRef=useRef(state); estadoRef.current=state;
  const [editingDebt,setEditingDebt]=useState(null);
  const [reviewDebt,setReviewDebt]=useState(null);
  const [dayFocus,setDayFocus]=useState(false);
  const openDay=function(d){ setReviewDebt(null);setDayFocus(true);setEditingDebt(d); };
  useEffect(function(){
    if(!editDayRequest) return;
    const d=state.debts.find(function(x){return String(x.id)===String(editDayRequest.id);});
    if(debtNeedsChargeDay(d)) openDay(d); else if(onEditDayClose) onEditDayClose();
  },[editDayRequest&&editDayRequest.ts]);
  const conflict=editingDebt&&planSyncConflict(state,"debts",editingDebt.id);
  const orphaned=state._planSync&&state._planSync.owner===state._historyOwner?(state._planSync.conflicts||[]).filter(function(c){return c.kind==="debts"&&!state.debts.some(function(d){return d.id===c.id;});}):[];
  const recovering=!!(editingDebt&&reviewDebt&&!state.debts.some(function(d){return d.id===editingDebt.id;}));
  const [adding,setAdding]=useState(false);
  const [form,setForm]=useState(DEBT_BLANK);
  const addCloser=useRef(null), addedRef=useRef(false);
  const banks=(function(){ const b=[]; (state.accounts||[]).forEach(a=>{ if(b.indexOf(a.ent)<0) b.push(a.ent); }); ["sabadell","trade_republic","familia"].forEach(x=>{ if(b.indexOf(x)<0) b.push(x); }); return b; })();
  // La cuenta con la que ya pagas tus deudas (la más repetida) o, si no hay, la del gasto diario: la hoja nace con ella elegida.
  const cuentaHabitual=function(){
    const n={}; state.debts.forEach(function(d){ if(d.account&&banks.indexOf(d.account)>=0) n[d.account]=(n[d.account]||0)+1; });
    const top=Object.keys(n).sort(function(a,b){ return n[b]-n[a]; })[0];
    if(top) return top;
    const diaria=(state.accounts||[]).find(function(a){ return accDaily(a); });
    return diaria&&diaria.ent||DEBT_BLANK.account;
  };
  const total=state.debts.reduce((a,d)=>a+debtBalance(d),0);
  const monthly=state.debts.reduce((a,d)=>a+(debtActive(d)?debtCuotaIn(d):0),0);
  const addDebt=()=>{
    // La hoja baja animada con el formulario aún vivo: un segundo toque daba otra deuda igual
    // (revisión de dinero 235, M1). Desde el primer alta hasta que se desmonta, no se vuelve a crear.
    if(addedRef.current) return;
    const v=parseFloat(String(form.value).replace(',','.'))||0;
    const months=parseInt(form.months,10)||0;
    const balloon=parseFloat(String(form.balloon).replace(',','.'))||0;
    const down=parseFloat(String(form.down).replace(',','.'))||0;
    const paid=parseInt(form.paid,10)||0;
    const viaMonthly=Math.max(0, v-balloon);                 // lo que cubren las cuotas (el resto = pago final)
    let m=parseFloat(String(form.monthly).replace(',','.'))||0;
    if(v<=0){ showToast(t("db_err_amount")); return; }
    if(m<=0 && months<=0){ showToast(t("db_err_quota")); return; }
    if(paid>0 && months>0 && paid>=months){ showToast(t("db_err_paid")); return; }
    if(months>0 && m<=0) m=+(viaMonthly/months).toFixed(2);  // 0%: cuota = (financiado − pago final) / plazo
    const it={id:uid(),ent:"familia",name:form.name||t("db_newdebt"),value:v,original:v,monthly:m,asOf:ymNow(),account:form.account||"sabadell",note:t("db_addedmanual")};
    const day=cleanDay(form.day); it.day=day||1;   // día 1 por defecto → entra en el motor de líquido
    if(months>0){ it.months=months; it.amort=+(viaMonthly/months).toFixed(2); }   // amortiza principal lineal; el pago final limpia el resto
    if(balloon>0) it.balloon=balloon;
    if(down>0) it.downPayment=down;
    // deuda ya empezada: retrasa el ancla tantos meses como cuotas pagadas para que
    // debtPaidCount()===paid hoy (compensa el +1 que suma si la cuota de este mes ya pasó)
    if(paid>0){ let anchor=ymNow()-paid; if(months>0 && it.day!=null && it.day<=madridYmdParts(Date.now()).d) anchor+=1; it.asOf=anchor; }
    if(months>0) it.startMonth=it.asOf;
    if(months>0&&paid===0) it.startDay=netWorthDay(); // Con cuotas previas no conocemos el día de origen.
    set(s=>Object.assign({},s,{debts:s.debts.concat([it])}));
    // Se vacía al terminar de bajar la hoja, no antes: si no, los campos se quedan en blanco a la vista.
    addedRef.current=true; if(addCloser.current) addCloser.current(); else { addedRef.current=false; setForm(DEBT_BLANK); setAdding(false); }
    showToast(t("db_added"));
  };
  const delDebt=(d)=>{
    // Una cuota ya vinculada necesita su deuda para conservar nombre e identidad en Gastos.
    if((state.expenses||[]).some(function(e){ return e.debtId===d.id; })){ showToast(t("db_delete_linked")); return; }
    askConfirm({title:tf("db_delete_q",{name:d.name}),sub:t("db_delete_sub"),ok:t("db_delete"),danger:true})
      .then(function(yes){ if(!yes) return; set(function(s){
        if((s.expenses||[]).some(function(e){ return e.debtId===d.id; })) return s;
        return planSyncDeleteDebt(s,d.id);
      }); setEditingDebt(null);setReviewDebt(null); });
  };
  const confirmSettled=(d)=>{
    askConfirm({title:tf("db_settle_q",{name:d.name}),sub:t("db_settle_sub"),ok:t("db_settle_ok")})
      .then(function(yes){ if(!yes) return; set(function(s){
        let changed=false;
        const debts=s.debts.map(function(x){
          if(x.id!==d.id || x.settledAt || debtBalance(x)>0.005) return x;
          changed=true; return Object.assign({},x,{settledAt:new Date().toISOString()});
        });
        return changed?Object.assign({},s,{debts:debts}):s;
      }); showToast(t("db_settled")); });
  };
  const archiveDebt=(d)=>{
    set(function(s){
      let changed=false;
      const debts=s.debts.map(function(x){
        if(x.id!==d.id || !x.settledAt || x.archivedAt || debtBalance(x)>0.005) return x;
        changed=true; return Object.assign({},x,{archivedAt:new Date().toISOString()});
      });
      return changed?Object.assign({},s,{debts:debts}):s;
    });
    showToast(t("db_archived"));
  };
  const unarchiveDebt=(d)=>{
    set(function(s){
      let changed=false;
      const debts=s.debts.map(function(x){
        if(x.id!==d.id || !x.archivedAt) return x;
        changed=true; return Object.assign({},x,{archivedAt:null});
      });
      return changed?Object.assign({},s,{debts:debts}):s;
    });
  };
  // amortización anticipada: baja el pendiente y acorta el plazo (misma cuota, menos meses).
  // doAmort es la operación; amortize solo pregunta el importe.
  const doAmort=(d,rawAmt)=>{
    const bal=debtBalance(d);
    const amt=Math.min(rawAmt||0, bal);
    if(amt<=0) return false;
    const nb=+(bal-amt).toFixed(2);
    /* La deuda pudo cambiar con el diálogo abierto (otro móvil, un pull): entonces `deudaAmortizada` no
       aplica nada y aquí se decía «Amortizado» y se cerraba la ficha sin haber amortizado (revisión 242,
       P3). Se mira contra el estado de AHORA, no el del pintado en que se abrió el diálogo. */
    const viva=(estadoRef.current.debts||[]).find(function(x){ return x.id===d.id; });
    if(!viva||deudaAmortizada(viva,bal,amt)===viva){ showToast(t("db_amortize_changed")); return false; }
    set(function(s){
      let changed=false;
      const debts=s.debts.map(function(x){
        if(x.id!==d.id) return x;
        const o=deudaAmortizada(x,bal,amt);
        if(o===x) return x;
        changed=true; return o;
      });
      return changed?Object.assign({},s,{debts:debts}):s;
    });
    showToast(nb<=0.005?t("db_amortize_full"):tf("db_amortized",{x:eur(amt),y:eur(nb)}));
    return true;
  };
  // `hecho`: lo que sigue a una amortización aplicada (la ficha se cierra); cancelar o un 0 no lo llaman.
  const amortize=(d,hecho)=>{
    const bal=debtBalance(d);
    askText({ title:tf("db_amortize_prompt",{name:d.name}), sub:tf("db_amortize_sub",{x:eur(bal)}),
      ph:NF.format(0)+" €", ok:t("db_amortize"),
      // atajos: los importes redondos que quepan + «todo» para liquidarla de un toque
      chips:[100,250,500].filter(function(v){ return v<bal; }).map(function(v){ return {v:v,label:eur0(v)}; })
        .concat([{v:+bal.toFixed(2), label:tf("ask_all",{x:eur0(bal)})}]),
      // Lo que antes solo contaba el asesor (DIS-26): con el importe ya puesto, cuántas cuotas
      // quita. Sin importe no hay cifra honesta que dar, y no se pinta nada. El campo enseña lo tecleado
      // en crudo («2500»); aquí va con formato lo que de verdad se amortiza, ya topado al pendiente
      // (filtro de diseño 242). En euros como el campo, no con eur(), que pasa a la moneda de pantalla.
      live:function(raw){
        const a=Math.min(parseFloat(String(raw).replace(',','.'))||0, bal);
        if(!(a>0)) return null;
        const rc=amortRecorte(d,a), cifra=NF.format(a)+" €";
        return rc&&rc.cut>0?"📆 "+cifra+" · "+tf("db_amortize_cut",{n:rc.cut}):cifra;
      }
    }).then(function(raw){
      if(raw==null) return;
      if(doAmort(d, parseFloat(String(raw).replace(',','.'))||0)&&hecho) hecho();
    });
  };
  const leftInfo=debtLeftInfo;
  // «Acabas en …» de una deuda. La cuenta del mes es `debtUltimoMes` (17-plan-reparto.js), la MISMA que usa la
  // escalera de la ficha: una sola fuente para que las dos fechas no se separen (test plan-fin-deuda).
  const endsLabel=function(d){
    const m=debtUltimoMes(d,undefined,leftInfo(d));
    if(m==null) return null;
    return tf("v4_debts_ends",{d:monthLong(m%12)+" "+Math.floor(m/12)});
  };
  const editor=editingDebt&&(conflict&&!reviewDebt?React.createElement(PlanConflictSheet,{record:conflict,current:state.debts.find(function(d){return d.id===editingDebt.id;})||editingDebt,
    onClose:function(){setEditingDebt(null);setReviewDebt(null);if(onEditDayClose)onEditDayClose();},onDiscard:function(){set(function(s){return planSyncDiscard(s,conflict);});setEditingDebt(null);setReviewDebt(null);if(onEditDayClose)onEditDayClose();},
    onReview:function(){setEditingDebt(state.debts.find(function(d){return d.id===editingDebt.id;})||editingDebt);setReviewDebt(conflict);}}):
    React.createElement(DebtEditSheet,{key:editingDebt.id,debt:editingDebt,state:state,set:set,review:reviewDebt,recovery:recovering,initialFocus:dayFocus?"day":undefined,
      onClose:function(){setEditingDebt(null);setReviewDebt(null);setDayFocus(false);if(onEditDayClose)onEditDayClose();},onDelete:delDebt,onAmortize:amortize,showToast:showToast}));
  // Plan › Deudas nuevo: la lista sale del reparto del periodo y cada deuda abre su ficha (escalera, interruptor y datos).
  const rep=useMemo(function(){ return planReparto(state,{}); },RPT_DEPS_REPARTO(state));
  const [fichaId,setFichaId]=useState(null);
  const fichaDeuda=fichaId?state.debts.find(function(x){ return x.id===fichaId; }):null;
  const hFicha={abrir:function(d){ setFichaId(d.id); },amortizar:amortize,eliminar:delDebt,archivar:archiveDebt,liquidada:confirmSettled,ponerDia:openDay,
    editar:function(d){ setDayFocus(false);setReviewDebt(null);setEditingDebt(d); }};
  if(editorOnly) return editor;
  return React.createElement("div",null,
    orphaned.map(function(record){return React.createElement("div",{key:record.id,className:"v4-card","data-plan-orphan":record.id},
      React.createElement("div",{className:"hint"},t("plan_deleted_while_editing")),
      React.createElement("div",{style:{marginTop:8,fontWeight:700}},record.local.name||"—"),
      React.createElement("button",{type:"button",className:"btn btn-primary btn-block","data-act":"plan-orphan-recover",onClick:function(){setReviewDebt(record);setEditingDebt(goalSyncCopy(record.local));}},t("plan_recover")),
      React.createElement("button",{type:"button",className:"btn btn-ghost btn-block","data-act":"plan-orphan-discard",onClick:function(){
        askConfirm({title:t("plan_discard_draft_q"),sub:t("plan_discard_draft_sub"),ok:t("plan_conflict_discard"),danger:true}).then(function(yes){if(yes)set(function(s){return planSyncDiscard(s,record);});});
      }},t("plan_conflict_discard")));}),
    React.createElement(RptDeudasVista,{state:state,r:rep,visibles:visibleDebts,archivadas:archivedDebts,h:hFicha,total:total,showArchive:showArchive,setShowArchive:setShowArchive,tabs:tabs,onAdd:function(){ setForm(Object.assign({},DEBT_BLANK,{account:cuentaHabitual()})); setAdding(true); }}),
    // Asesor y archivadas en UNA tarjeta con dos filas plegables (antes: caja de borde amarillo, botón ghost suelto y
    // otro ghost para añadir; dueño 23/11/2026). `.v4-tip` se queda como nombre: los e2e lo usan de ancla.
    React.createElement("div",{className:"v4-tip dbx-tools"},
      React.createElement(AmortAdvisor,{state:state,onEdit:function(d){setDayFocus(false);setEditingDebt(d);}}),
      archivedDebts.length>0 && React.createElement("section",{className:"dbx-sec"},
        React.createElement("button",{type:"button",className:"dbx-hd","aria-expanded":showArchive,onClick:function(){ setShowArchive(!showArchive); }},
          React.createElement("span",{className:"dbx-hd-t"},React.createElement("b",null,tf("db_archive_title",{n:archivedDebts.length}))),
          React.createElement(I.chev,{className:"dbx-chev"+(showArchive?" open":"")})),
        showArchive && React.createElement("div",{className:"dbx-in rise"},
          React.createElement("div",{className:"dbx-help"},t("db_archive_hint")),
          archivedDebts.map(function(d){ return React.createElement("div",{className:"dbx-arow",key:d.id,"data-archived-debt":d.id},
            React.createElement("span",null,d.name),
            React.createElement("button",{type:"button",className:"dbx-link",onClick:function(){ unarchiveDebt(d); }},t("db_unarchive"))
          ); })))),
    /* Añadir deuda va en su hoja con una etiqueta encima de cada campo (DIS-31, 15/11/2026): abierto
       dentro de la lista, el texto de ejemplo era la única pista y se cortaba («Cuota/mes € (vací…»).
       Los campos, `addDebt` y lo que guarda son los de antes; solo cambia dónde se pinta. */
    adding && React.createElement(AddHoja,{title:t("db_add"),closer:addCloser,testid:"debt-add-form",attr:"data-debt-add",
      onClose:function(){ setAdding(false); if(addedRef.current){ addedRef.current=false; setForm(DEBT_BLANK); } },
      name:form.name,setName:function(v){ setForm(function(o){ return Object.assign({},o,{name:v}); }); },namePh:t("db_concept"),
      amtKey:"value",amtLabel:t("ah_debes"),vals:form,setVals:setForm,
      cells:[{key:"monthly",label:t("ah_cuota"),kind:"dec",unit:"€"},{key:"day",label:t("ah_dia_cobro"),kind:"int"},
        {key:"months",label:t("ah_plazo"),kind:"int",unit:t("ah_meses")}],
      // La cuenta nace elegida (la de tus otras deudas o la del gasto diario): cambiarla es lo raro, va plegada con lo opcional.
      more:{cells:[{key:"down",label:t("ah_entrada"),kind:"dec",unit:"€"},{key:"balloon",label:t("ah_pago_final"),kind:"dec",unit:"€"},
        {key:"paid",label:t("ah_pagadas"),kind:"int"}],children:
        React.createElement("div",{className:"rpa-cuentas"},
          React.createElement("div",{className:"rp4-dim rpa-k"},t("plan_conflict_account")),
          React.createElement("div",{className:"v4-chips"},banks.map(function(b){
            return React.createElement("button",{type:"button",key:b,className:"v4-chip"+(form.account===b?" on":""),"aria-pressed":form.account===b,"data-debt-add-account":b,
              onClick:function(){ setForm(function(o){ return Object.assign({},o,{account:b}); }); }},entOf(b).label);
          })))},
      ctaOn:(parseFloat(String(form.value).replace(',','.'))||0)>0&&((parseFloat(String(form.monthly).replace(',','.'))||0)>0||(parseInt(form.months,10)||0)>0),
      ctaLabel:t("db_add"),onSave:addDebt}),
    fichaDeuda&&React.createElement(RptDeudaFicha,{key:fichaDeuda.id,d:fichaDeuda,state:state,set:set,r:rep,h:hFicha,onClose:function(){ setFichaId(null); }}),
    editor
  );
}

/* ============================================================
   METAS DE AHORRO (#15)
   ============================================================ */
/* ============================================================
   RESERVAR DINERO (2026-08-03) — petición del usuario: su caso es una sola cuenta (Trade
   Republic) que hace de fondo de emergencia + round-up + inversión + gasto diario a la vez, y
   quería que ahorrar para una meta se notara de verdad en "lo que puede gastar", no solo en un
   bote aparte. Ver la explicación larga en `08-motor-bank.js` (reservaPlanFor/applyReserva).
   ============================================================ */
// Los importes del reparto con sus céntimos cuando los tienen: una regla de 1.200,50 € no puede
// leerse «1201 €» en la fila y apartar 1.200,50 al aplicar. Los redondos se quedan como estaban.
function reservaEur(n){ return Math.round((n||0)*100)%100===0 ? eur0(n) : eur(n); }
// La frase del editor para cada estado del reparto. La fecha es la del ingreso detectado; sin
// ingreso no se pone ninguna. Habla de «ingreso», no de nómina: `lastPaydayOf` no distingue.
function reservaEstadoTexto(st){
  const d=st.income ? parseDate(st.income.date).toLocaleDateString(loc(),{day:'2-digit',month:'2-digit'}) : "";
  if(st.estado==="pendiente") return tf("rr_st_pending",{d:d});
  if(st.estado==="repartido") return tf("rr_st_applied",{d:d});
  if(st.estado==="descartado") return tf("rr_st_dismissed",{d:d});
  if(st.estado==="sinPlan") return t("rr_st_noplan");
  return t("rr_st_none");
}
/* Lo que llega a UNA meta cada mes, para su previsión. «Ahorro mensual» y las reglas de reservar
   eran dos tarjetas para lo mismo, y la previsión de cada meta usaba la suma de las aportaciones al
   bróker, que no van a ninguna meta: con 200 € al fondo, una meta sin un euro apartado decía «llegas
   en marzo» (dueño, 18/11/2026: se fusionan en las reglas). Manda el aporte elegido en la propia
   meta; si no, lo que sus reglas apartan al mes. Las de % del presupuesto, con el presupuesto de hoy
   (`reservaMensualImporte`); las antiguas por ingreso, solo las de importe fijo: un % de un ingreso
   que aún no ha llegado no es una cifra. */
function metaRitmoMensual(state, g){
  if(!g) return 0;
  if(g.monthly>0) return g.monthly;
  return metaRitmoReglas(state,g);
}
/* Lo que el PLAN cuenta como «apartas»: solo lo respaldado por una REGLA de reserva. El «importe mensual» de
   la ficha de la meta (`g.monthly`) es una intención para la previsión (`goalEta`), no dinero asignado:
   sin regla no resta de Libre ni sale como «Apartas» (22/11: 290 € en el Plan sin que él moviera nada). */
function metaRitmoReglas(state, g){
  if(!g) return 0;
  return ((state&&state.settings&&state.settings.reservaRules)||[]).reduce(function(n,r){
    if(!r||r.goalId!==g.id) return n;
    if(r.mensual===true){ const imp=reservaMensualImporte(state,r); return n+(imp.amount||0); }
    return n+(r.kind==="fixed"&&r.value>0?r.value:0);
  },0);
}
// Editor de reglas: nombre opcional, importe fijo o % de la nómina, y a qué meta va.
function ReservaRules({state, set}){
  const goals=(state.goals||[]).filter(function(g){ return !g.done; });
  const rules=(state.settings&&state.settings.reservaRules)||[];
  const [adding,setAdding]=useState(false);
  const blank={name:"",kind:"fixed",value:"",goalId:goals[0]&&goals[0].id||""};
  const [form,setForm]=useState(blank);
  const [err,setErr]=useState("");
  const cycle=useMemo(function(){ return lastPaydayOf(state.expenses,null,expenseDeletedSet(state),noEsTraspasoDerivado(state)); },[state.expenses,state.deleted,state.obAbsorbedConfirmed,state._historyOwner,state.accounts,state.flows,state.reciboNo,state.settings]);
  const st=reservaEstadoDe(state,cycle);
  // La línea de cada regla mensual dice lo que ESTE mes tiene asentado, no lo que «debería».
  const clave=reservaMensualClave();
  const mensualTexto=function(r){
    const id="mensual|"+r.id+"|"+clave, log=state.reservaLog||[];
    const hecho=log.find(function(x){ return x&&x.id===id; });
    if(hecho && !log.some(function(x){ return x&&x.releaseOf===id; })) return tf("rr_m_ok",{x:reservaEur(hecho.amount)})+(hecho.goalId!==r.goalId?" → "+goalName(hecho.goalId):"");
    const motivo=reservaMensualImporte(state,r).motivo;
    return motivo==="base"?t("rr_m_base"):(motivo==="meta"?t("rr_m_meta"):t("rr_m_none"));
  };
  /* La última alta enviada. `addReservaRule` puede no escribirla (la meta dejó de valer entre el
     toque y la escritura) y desde el toque no se sabe: cerrar el formulario ahí repetía el fallo
     de siempre, una regla que no se guarda y nadie lo dice. El formulario se cierra cuando la
     regla APARECE en el estado. Si no está y su meta ya no vale, se reabre con lo escrito y el
     aviso — también si primero apareció y luego se retiró: React puede pintarla y quitarla al
     aplicar una escritura anterior que aún tenía en cola, y eso no tiene plazo (en un móvil
     cargado puede tardar). Por eso NO se olvida por tiempo: solo la sustituye otra alta, o la
     descartan Cancelar, abrir el formulario de nuevo o borrar esa misma regla. */
  const [sent,setSent]=useState(null);
  const [editing,setEditing]=useState(null);
  const saving=useRef(false);
  const editResult=useRef(null);
  const sentIn=!!sent && rules.some(function(r){ return r.id===sent.id && (!sent.edit || sent.seen || reservaRuleSame(r,sent.rule)); });
  // En el propio commit (layout): el cierre y la recuperación no esperan al trabajo pendiente del
  // planificador, que en un móvil cargado puede tardar justo cuando más falta hace el aviso.
  useLayoutEffect(function(){
    if(!sent) return;
    // React puede pintar el guardado antes de rebasarlo sobre una escritura anterior en cola.
    // Recuperar SOLO el rechazo de ese updater no reabre una edición posterior legítima.
    const rejected=sent.edit && editResult.current && editResult.current.id===sent.id && editResult.current.error;
    if(rejected){ saving.current=false; setSent(null); setEditing(sent.edit); setForm(sent.form); setErr(rejected); setAdding(true); return; }
    if(sentIn){ if(!sent.seen){ setSent(Object.assign({},sent,{seen:true})); saving.current=false; setAdding(false); setEditing(null); setForm(blank); setErr(""); } return; }
    const changed=sent.edit && !sent.seen && (rules.filter(function(r){ return r.id===sent.id; }).length!==1 || !rules.some(function(r){ return reservaRuleSame(r,sent.edit); }));
    if(changed){ saving.current=false; setSent(null); setEditing(sent.edit); setForm(sent.form); setErr("changed"); setAdding(true); return; }
    if(!reservaMetaActiva(state,sent.goalId)) saving.current=false;
    if(!reservaMetaActiva(state,sent.goalId)){ setSent(null); setForm(sent.form); setErr("goal"); setAdding(true); }
  },[sent,sentIn,state.goals,rules]);
  const addRule=function(){
    if(saving.current || (sent && !sent.seen)) return;
    /* Un alta que no vale se quedaba con el formulario abierto y sin una palabra (feedback 3/10).
       La meta se comprueba AL GUARDAR: el formulario abierto puede conservar una que entretanto
       se cumplió o se borró (otro móvil, la nube), y no se elige otra por él.
       El tope del 100 % es solo para lo que se escribe ahora: las reglas ya guardadas no se tocan. */
    if(!reservaMetaActiva(state,form.goalId)){ setErr("goal"); return; }
    const v=reservaImporteDe(form.value);
    if(v==null || !(v>0)){ setErr("amount"); return; }
    if(form.kind==="pct" && v>100){ setErr("pct"); return; }
    // Solo las altas eligen contrato mensual; editar conserva también campos desconocidos.
    const r=editing?Object.assign({},editing,{name:form.name||"",kind:form.kind,value:v,goalId:form.goalId})
      :{id:uid(),name:form.name||"",kind:form.kind,value:v,goalId:form.goalId,mensual:true};
    const outcome={id:r.id,error:""};
    saving.current=true; editResult.current=outcome;
    if(editing){ setErr(""); setSent({id:r.id,goalId:r.goalId,form:form,edit:editing,rule:r}); }
    else{ setErr(""); setSent({id:r.id,goalId:r.goalId,form:form}); }
    set(function(s){
      const next=editing?editReservaRule(s,editing,r):addReservaRule(s,r);
      if(editing && editResult.current===outcome){
        const present=((next.settings&&next.settings.reservaRules)||[]).filter(function(x){ return x&&x.id===r.id; });
        const active=reservaMetaActiva(s,r.goalId);
        outcome.accepted=present.length===1&&reservaRuleSame(present[0],r)&&(outcome.accepted||active);
        outcome.error=outcome.accepted?"":active?"changed":"goal";
      }
      return next;
    });
  };
  const delRule=function(id){
    askConfirm({title:t("rr_delete_q"),sub:t("rr_delete_sub"),ok:t("rr_delete"),danger:true})
      .then(function(ok){ if(!ok) return; if(sent&&sent.id===id) setSent(null); set(function(s){ return removeReservaRule(s,id); }); });
  };
  const goalName=function(id){ const g=(state.goals||[]).find(function(x){ return x.id===id; }); return g?((g.emoji||"🎯")+" "+g.name):t("rr_goal_gone"); };
  /* Sin metas activas ni reglas no hay nada que configurar… salvo que el formulario esté abierto:
     si la ÚLTIMA meta se cumple o se borra con el borrador a medias, esconder la tarjeta era otra
     vez la regla que no se guarda y nadie lo dice. El formulario y su aviso se quedan hasta que se
     cancela; no se elige ni se crea otra meta por él. */
  if(!goals.length && !rules.length && !adding) return null;
  const closeForm=function(){ saving.current=false; setSent(null); setEditing(null); setAdding(false); setErr(""); setForm(blank); };
  return React.createElement(CollapsibleCard,{title:t("rr_title"),sub:rules.length===1?t("rr_sub_one"):rules.length?tf("rr_sub",{n:rules.length}):t("rr_sub_empty"),dot:"var(--mint)",storageKey:"g_reserva_rules",help:t("h_reserva")},
    rules.map(function(r){
      return React.createElement("div",{key:r.id,className:"sub-row plan-rule-row","data-reserva-rule":r.id},
        React.createElement("div",{className:"sub-mid"},
          React.createElement("div",{className:"sub-name"}, r.name||goalName(r.goalId)),
          React.createElement("div",{className:"sub-meta"}, (r.mensual===true
            ?(r.kind==="pct"?tf("rr_row_pct_m",{v:r.value}):tf("rr_row_fixed_m",{v:reservaEur(r.value)}))
            :(r.kind==="pct"?tf("rr_row_pct",{v:r.value}):tf("rr_row_fixed",{v:reservaEur(r.value)})))+(r.name?" → "+goalName(r.goalId):"")),
          r.mensual===true && React.createElement("div",{className:"sub-meta","data-reserva-mensual":r.id}, mensualTexto(r))
        ),
        React.createElement("button",{className:"chip",onClick:function(){ saving.current=false; setSent(null); setEditing(JSON.parse(JSON.stringify(r))); setForm({name:r.name||"",kind:r.kind,value:String(r.value).replace(".",numPadDecSep()),goalId:r.goalId}); setErr(""); setAdding(true); }},t("rr_edit")),
        React.createElement("button",{className:"chip","aria-label":t("rr_delete"),style:{fontSize:11.5,padding:"3px 10px"},onClick:function(){ delRule(r.id); }}, "✕")
      );
    }),
    st.estado!=="sinReglas" && React.createElement("div",{className:"hint","data-reserva-estado":st.estado,style:{marginTop:8}}, reservaEstadoTexto(st)),
    (goals.length>0 || adding) && (adding
      ? React.createElement(PlanEditSheet,{title:t(editing?"rr_edit":"rr_add"),onClose:closeForm},React.createElement("div",{className:"add-form",style:{marginTop:10}},
          React.createElement("input",{className:"af-in",placeholder:t("rr_name_ph"),value:form.name,onChange:function(e){ setForm(Object.assign({},form,{name:e.target.value})); }}),
          React.createElement("div",{className:"af-row"},
            React.createElement("select",{className:"af-in",value:form.kind,onChange:function(e){ setErr(""); setForm(Object.assign({},form,{kind:e.target.value})); }},
              React.createElement("option",{value:"fixed"},t("rr_kind_fixed")),
              React.createElement("option",{value:"pct"},t(editing&&editing.mensual!==true?"rr_kind_pct":"rr_kind_pct_m"))),
            React.createElement("input",{className:"af-in num",inputMode:"decimal",placeholder:form.kind==="pct"?"%":"€",value:form.value,onChange:function(e){ setErr(""); setForm(Object.assign({},form,{value:e.target.value})); }})
          ),
          React.createElement("select",{className:"af-in",value:form.goalId,onChange:function(e){ setErr(""); setForm(Object.assign({},form,{goalId:e.target.value})); }},
            goals.map(function(g){ return React.createElement("option",{key:g.id,value:g.id}, (g.emoji||"🎯")+" "+g.name); })),
          err && React.createElement("div",{className:"hint",role:"alert",style:{color:"var(--coral)",marginTop:6}}, err==="changed"?t("rr_err_changed"):(err==="pct"?t("rr_err_pct"):(err==="goal"?t("rr_err_goal"):t("rr_err_amount")))),
          React.createElement("div",{className:"hint",style:{marginTop:6}}, t(editing?(editing.mensual===true?"rr_edit_monthly_hint":"rr_edit_income_hint"):"rr_m_hint")),
          React.createElement("button",{className:"btn btn-primary btn-block",style:{marginTop:8},onClick:addRule}, t("rr_save")),
          React.createElement("button",{className:"btn btn-ghost btn-block",onClick:closeForm}, t("gl_cancel"))
        ))
      : React.createElement("button",{className:"v4-ghost-add",style:{marginTop:8},onClick:function(){ saving.current=false; setSent(null); setEditing(null); setForm(blank); setErr(""); setAdding(true); }}, t("rr_add"))
    )
  );
}
// Banner de "nómina detectada": aparece cuando `lastPaydayOf` encuentra un ingreso grande que aún
// no se ha repartido ni descartado. Nunca aplica en silencio — siempre pide confirmación, porque
// aunque solo mueva cifras dentro de la app, es DINERO DE VERDAD para quien lo mira.
function ReservaDetect({state, set, showToast}){
  const cycle=useMemo(function(){ return lastPaydayOf(state.expenses,null,expenseDeletedSet(state),noEsTraspasoDerivado(state)); },[state.expenses,state.deleted,state.obAbsorbedConfirmed,state._historyOwner,state.accounts,state.flows,state.reciboNo,state.settings]);
  const st=reservaEstadoDe(state,cycle);
  if(st.estado!=="pendiente") return null;
  const income=st.income;
  const key=reservaKeyOf(income);
  const plan=st.plan;
  const dailyEnt=(state.accounts||[]).find(function(a){ return accDaily(a); });
  const apply=function(){
    set(function(s){ return applyReserva(s, income, reservaPlanFor(s,income.amount).plan, dailyEnt&&dailyEnt.ent); });
    if(showToast) showToast(t("rr_applied_ok"));
  };
  const dismiss=function(){ set(function(s){ return Object.assign({},s,{reservaDismissed:(s.reservaDismissed||[]).concat([key])}); }); };
  return React.createElement("div",{className:"v4-card rise",style:{borderColor:"var(--mint-dim)",marginBottom:14}},
    React.createElement("div",{style:{fontWeight:800,fontSize:14.5}}, tf("rr_detect_t",{x:reservaEur(Math.abs(income.amount))})),
    React.createElement("div",{style:{fontSize:12.5,color:"var(--muted)",marginTop:4}}, tf("rr_detect_sub",{d:parseDate(income.date).toLocaleDateString(loc(),{day:'2-digit',month:'2-digit'})})),
    React.createElement("div",{style:{marginTop:10}}, plan.plan.map(function(p){
      return React.createElement("div",{key:p.ruleId,style:{display:"flex",justifyContent:"space-between",fontSize:13,padding:"4px 0"}},
        React.createElement("span",null, p.name), React.createElement("span",{className:"num"}, reservaEur(p.amount)));
    })),
    plan.remainder>0 && React.createElement("div",{style:{fontSize:12,color:"var(--muted-2)",marginTop:4}}, tf("rr_remainder",{x:reservaEur(plan.remainder)})),
    React.createElement("div",{className:"af-row",style:{marginTop:10}},
      React.createElement("button",{className:"btn btn-primary",style:{flex:1},onClick:apply}, t("rr_apply")),
      React.createElement("button",{className:"btn btn-ghost",style:{flex:1},onClick:dismiss}, t("rr_dismiss"))
    )
  );
}
/* APORTACIÓN MENSUAL a bancos y brókers (`state.aportaciones`). Vivía en Metas como «Ahorro
   mensual», junto a las reglas que sí apartan dinero para cada meta, y se confundían (dueño,
   18/11/2026). No va a ninguna meta: alimenta la proyección de Inversiones y reconoce la salida al
   bróker en la gráfica de Inicio. Por eso vive ahora en Cartera › Inversiones, al lado de esa
   proyección; el ahorro de cada meta son sus reglas (`metaRitmoMensual`).
   Es PLANIFICACIÓN: no crea movimientos ni toca saldos. Se edita en borrador y solo se escribe
   al Guardar (el editor v3, commit 87191f41, añadía y borraba en vivo y Cancelar no deshacía). */
function SavingsPlanCard({state, set, totals, showToast}){
  const aps=state.aportaciones||[];
  const total=(totals&&typeof totals.ahorroMensual==="number")?totals.ahorroMensual
    :aps.reduce(function(a,x){ return a+(Number(x.amount)||0); },0);
  const [drafts,setDrafts]=useState(null);   // null = cerrado; array = editando
  const AP_ENTS=Object.keys(ENT).filter(function(k){ return k!=="familia"; });
  const start=function(){
    setDrafts(aps.map(function(a){ return {id:a.id,name:a.name||"",amount:a.amount?String(a.amount).replace(".",numDecSep()):"",ent:a.ent||"myinvestor"}; }));
  };
  const setD=function(id,k,v){ setDrafts(function(ds){ return ds.map(function(d){ return d.id===id?Object.assign({},d,{[k]:v}):d; }); }); };
  const add=function(){ setDrafts(function(ds){ return ds.concat([{id:uid(),name:"",amount:"",ent:"myinvestor",nuevo:true}]); }); };
  const del=function(id){ setDrafts(function(ds){ return ds.filter(function(d){ return d.id!==id; }); }); };
  const amountOf=function(raw){
    /* El campo usa el teclado del sistema y puede traer «1.200,50» o «1,200.50». Interpretar
       el separador ajeno al idioma como miles solo cuando deja tres cifras evita el fallo real
       de guardar 1 € al escribir 1.000 €, sin convertir «1.50» en 150 (review 23/9). */
    let s=String(raw==null?"":raw).trim().replace(/\s/g,"").replace(/[^0-9.,]/g,"");
    if(!s) return 0;
    if(s.indexOf(".")>=0 && s.indexOf(",")>=0){
      s=s.lastIndexOf(",")>s.lastIndexOf(".")?s.replace(/\./g,"").replace(/,/g,"."):s.replace(/,/g,"");
    }else{
      const sep=s.indexOf(",")>=0?",":(s.indexOf(".")>=0?".":"");
      if(sep){
        const parts=s.split(sep); const decimal=numPadDecSep();
        if(parts.length>2) s=parts.join("");
        else if(sep!==decimal && parts[1]&&parts[1].length===3) s=parts.join("");
        else if(sep===",") s=parts.join(".");
      }
    }
    const n=parseFloat(s); return isFinite(n)?Math.max(0,n):0;
  };
  const save=function(){
    const prev={}; aps.forEach(function(a){ prev[a.id]=a; });
    const next=drafts.map(function(d){
      const n=amountOf(d.amount);
      return Object.assign({}, prev[d.id]||{}, {id:d.id, name:d.name.trim()||t("d_saving"), amount:+n.toFixed(2), ent:d.ent});
    }).filter(function(a){ return a.amount>0 || prev[a.id]; });   // una fila nueva vacía no se guarda
    set(function(s){ return Object.assign({},s,{aportaciones:next}); });
    setDrafts(null);
    if(showToast) showToast(t("sv_saved"));
  };
  const editing=!!drafts;
  /* Sin aportaciones la tarjeta es UNA fila, «Aportación mensual · Añadir»: «0,00 €/mes» en grande y
     dos frases de ayuda para no decir nada ocupaban media pantalla (auditoría 237, P1-7). La nota
     de que solo planifica se queda cuando hay algo que planificar: es la línea que evita creer que
     esto mueve dinero. */
  const vacia=!editing && aps.length===0 && !(Math.round(total*100)>0);
  return React.createElement("div",{className:"v4-card rise aely-savings"+(vacia?" aely-savings-vacia":""),"data-savings-plan":"1"},
    // Título a lo ancho y el botón en la fila de la cifra: al lado del título, con Enorme a 360 el
    // título se partía en dos y «Editar» caía debajo de todo (gate 240, D-05).
    React.createElement("div",{className:"aely-savings-h"},
      React.createElement("div",{className:"v4-micro aely-savings-t"}, t("sv_title")),
      !vacia && React.createElement("div",{className:"serif num aely-savings-total","data-savings-total":"1"}, tf("fj_permonth",{x:eur(total)})),
      React.createElement("button",{type:"button",className:"btn btn-ghost aely-savings-edit","data-savings-edit":"1",
        onClick:function(){ editing?setDrafts(null):(vacia?setDrafts([{id:uid(),name:"",amount:"",ent:"myinvestor",nuevo:true}]):start()); }},
        editing?t("fj_cancel"):(vacia?t("sv_add_short"):t("fj_edit")))),
    !vacia && React.createElement("p",{className:"hint aely-savings-note"}, t("sv_note")),
    !editing && aps.map(function(ap){
      return React.createElement("div",{className:"aely-savings-row",key:ap.id,"data-savings-row":ap.id},
        React.createElement("span",{className:"aely-savings-name"}, ap.name, React.createElement("span",{className:"aely-savings-bank"}, entOf(ap.ent).label)),
        React.createElement("span",{className:"num aely-savings-amt"}, tf("fj_permonth",{x:eur(Number(ap.amount)||0)})));
    }),
    editing && drafts.map(function(d){
      return React.createElement("div",{className:"aely-savings-edit-row",key:d.id,"data-savings-draft":d.id},
        React.createElement("input",{className:"af-in","aria-label":t("sv_name_aria"),placeholder:t("sv_name_ph"),value:d.name,
          onChange:function(e){ setD(d.id,"name",e.target.value); }}),
        React.createElement("div",{className:"aely-savings-edit-line"},
          React.createElement("input",{className:"af-in num","aria-label":t("sv_amount_aria"),placeholder:"0 €",inputMode:"decimal",value:d.amount,
            onFocus:function(e){ e.target.select(); },onChange:function(e){ setD(d.id,"amount",e.target.value); }}),
          React.createElement("select",{className:"af-in","aria-label":t("sv_bank_aria"),value:d.ent,onChange:function(e){ setD(d.id,"ent",e.target.value); }},
            AP_ENTS.map(function(k){ return React.createElement("option",{key:k,value:k},entOf(k).label); })),
          React.createElement("button",{type:"button",className:"ex-del","aria-label":t("sv_del_aria"),onClick:function(){ del(d.id); }},"✕")));
    }),
    editing && React.createElement("button",{type:"button",className:"btn btn-ghost btn-block",style:{marginTop:10},onClick:add}, "+ "+t("sv_add")),
    editing && React.createElement("button",{type:"button",className:"btn btn-primary btn-block",style:{marginTop:8},"data-savings-save":"1",onClick:save}, t("fj_save"))
  );
}


function Goals({state, set, totals, showToast, abrir, tabs}){
  const tt=totals||{};
  const goals=state.goals||[];
  const [adding,setAdding]=useState(false);
  const [editingGoal,setEditingGoal]=useState(null);
  // La meta tocada en Inicio ({id,ts}) se abre como si se hubiera tocado aquí (PlanTab ya la ha centrado).
  useEffect(function(){
    if(!abrir) return;
    const g=goals.find(function(x){ return String(x.id)===abrir.id; });
    if(g) setFichaMetaId(g.id);
  },[abrir&&abrir.ts]);
  const [contribGoal,setContribGoal]=useState(null);   // meta abierta en la hoja de aportar
  // Plan › Metas nuevo: cada meta abre su ficha (estado, ritmo, fecha) con aportar, editar y eliminar al pie.
  const [fichaMetaId,setFichaMetaId]=useState(null);
  const fichaMeta=fichaMetaId?goals.find(function(x){ return x.id===fichaMetaId; }):null;
  const blank={name:"",emoji:"🎯",target:"",saved:"",deadline:"",monthly:""};
  const [form,setForm]=useState(blank);
  const addCloser=useRef(null), sentRef=useRef(false);
  const closeAdd=function(){ if(addCloser.current) addCloser.current(); else { sentRef.current=false; setAdding(false); setForm(blank); } };

  const addGoal=function(){
    // Igual que addDebt: mientras la hoja baja, otro toque no crea otra meta (revisión 235, M1).
    if(sentRef.current) return;
    const tg=parseFloat(String(form.target).replace(',','.'))||0; if(tg<=0) return;
    sentRef.current=true;
    const sv=parseFloat(String(form.saved).replace(',','.'))||0;
    const mo=parseFloat(String(form.monthly).replace(',','.'))||0;
    const done=sv>=tg;
    const g={id:uid(),name:form.name||t("gl_newdefault"),emoji:form.emoji||"🎯",target:tg,saved:sv,deadline:form.deadline||null,monthly:mo>0?mo:null,color:"#5FD08A",createdAt:new Date().toISOString(),done:done,doneAt:done?new Date().toISOString():null};
    set(function(s){ return Object.assign({},s,{goals:(s.goals||[]).concat([g])}); });
    closeAdd();
  };
  // Aportar a una meta: hoja propia con teclado numérico in-app (como el + de gastos) y elección
  // de banco de origen — así no salta el teclado del sistema y no rompe la estética (2026-07-18).
  const contribute=function(g){ setContribGoal(g); };
  const addToGoal=function(g,amt,bank){
    if(!amt) return;
    set(function(s){ return Object.assign({},s,{goals:(s.goals||[]).map(function(x){
      if(x.id!==g.id) return x;
      const ns=Math.max(0,(x.saved||0)+amt);
      const becameDone=!x.done && ns>=x.target;
      if(becameDone){ celebrate(); if(showToast) showToast(tf("gl_celebrate",{name:x.name})); }
      // fromBank: recuerda el último banco de origen (para pre-seleccionarlo la próxima vez y mostrarlo).
      return Object.assign({},x,{saved:ns,fromBank:bank||x.fromBank,done:ns>=x.target,doneAt:(ns>=x.target&&!x.doneAt)?new Date().toISOString():x.doneAt});
    })}); });
  };
  // Con gastos marcados como aportación a esta meta no se borra, igual que una deuda con pagos: esos
  // cargos se quedarían fuera del gasto sin meta a la que sumar. Primero se quita la marca.
  const delGoal=function(g){
    if(metaTieneAportes(state, g.id)){ if(showToast) showToast(t("gl_delete_linked")); return; }
    askConfirm({title:tf("gl_delete_q",{name:g.name}),sub:t("gl_delete_sub"),ok:t("gl_delete"),danger:true}).then(function(yes){
      if(!yes) return;
      set(function(s){ if(metaTieneAportes(s, g.id)) return s; return Object.assign({},s,{goals:(s.goals||[]).filter(function(x){return x.id!==g.id;})});}); setEditingGoal(null);
    });
  };

  const hMeta={abrir:function(g){ setFichaMetaId(g.id); },aportar:contribute,eliminar:delGoal,editar:function(g){ setEditingGoal(g); }};

  return React.createElement("div",null,
    goals.length>0 ? React.createElement(RptMetasVista,{state:state,goals:goals,h:hMeta,tabs:tabs,onAdd:function(){ setAdding(true); }}) : tabs,
    React.createElement(ReservaDetect,{state:state,set:set,showToast:showToast}),
    goals.length===0 && React.createElement("div",{className:"empty"},
      React.createElement("div",{className:"ttl"},t("gl_empty_t")), t("gl_empty_d")),

    React.createElement("div",{style:{marginTop:14}}, React.createElement(ReservaRules,{state:state,set:set})),

    /* Nueva meta en su hoja, con etiquetas y el calendario de la app en vez del selector de mes
       nativo, que salía sin estilo (DIS-31, 15/11/2026). Se guarda el mismo «aaaa-mm» que daba el
       selector: del día que se toca solo cuenta el mes. Cerrar la hoja descarta, como «Cancelar». */
    adding && React.createElement(GoalHoja,{title:t("gl_create"),form:form,setForm:setForm,attr:"data-goal-add",closer:addCloser,
      onClose:function(){ sentRef.current=false; setAdding(false); setForm(blank); },
      ctaOn:(parseFloat(String(form.target).replace(',','.'))||0)>0,ctaLabel:t("gl_create"),onSave:addGoal}),
    // Con metas, «+ Añadir» va en la cabecera (como Recibos y Deudas). Solo la pantalla vacía conserva el botón grande: la primera meta es LA acción.
    goals.length===0&&React.createElement("button",{type:"button",className:"btn btn-primary btn-block v4-goal-first","data-act":"goal-first",onClick:function(){ setAdding(true); }},t("gl_first")),

    React.createElement(ContributeGoalSheet,{goal:contribGoal,state:state,onClose:function(){ setContribGoal(null); },
      onContribute:function(amt,bank){ addToGoal(contribGoal,amt,bank); setContribGoal(null); }}),
    fichaMeta&&React.createElement(RptMetaFicha,{key:fichaMeta.id,g:fichaMeta,state:state,h:hMeta,onClose:function(){ setFichaMetaId(null); }}),
    editingGoal&&React.createElement(GoalEditSheet,{key:editingGoal.id,goal:editingGoal,state:state,set:set,onClose:function(){setEditingGoal(null);},onDelete:delGoal,showToast:showToast})
  );
}

/* Hoja «Aportar a una meta» — teclado numérico propio + banco de origen (2026-07-18).
   El teclado del sistema rompía la estética y no dejaba elegir el banco; esto es igual que
   el sheet «Apuntar» del +. No mueve saldos de cuentas (la hucha de metas es un bote aparte),
   solo suma a la meta y recuerda de qué banco la nutres. */
function ContributeGoalSheet({goal, state, onClose, onContribute}){
  const [raw,setRaw]=useState("");
  const [bank,setBank]=useState(null);
  const bankOpts=useMemo(function(){
    const seen={}; const out=[];
    (state.accounts||[]).forEach(function(a){ if(a&&a.ent&&!seen[a.ent]){ seen[a.ent]=1; out.push(a.ent); } });
    return out;
  },[state.accounts]);
  useEffect(function(){
    if(goal){
      setRaw("");
      // Pre-selecciona el último banco usado en esta meta, o la cuenta de gasto diario, o la 1ª.
      const daily=(state.accounts||[]).find(function(a){ return accDaily(a); });
      setBank(goal.fromBank || (daily&&daily.ent) || (bankOpts[0]||null));
    }
  },[goal]);
  const swipe=useSheetSwipe(!!goal, onClose);
  useBackClose(!!goal, swipe.close);
  if(!goal) return null;
  const amt=parseNumPadRaw(raw);
  const save=function(){
    if(!(amt>0)) return;
    try{ if(navigator.vibrate) navigator.vibrate(12); }catch(e){}
    onContribute(amt, bank);
  };
  return ReactDOM.createPortal(
    React.createElement("div",{className:"v4-sheet-back",onClick:onClose},
      React.createElement("div",Object.assign({className:"v4-sheet",ref:swipe.sheetRef,onClick:function(e){ e.stopPropagation(); }}, swipe.sheetTouch),
        React.createElement("div",{className:"v4-sheet-handle"}),
        React.createElement("div",{className:"serif",style:{fontSize:20,fontWeight:600,textAlign:"center",marginBottom:2}}, (goal.emoji||"🎯")+" "+tf("gl_contribute_title",{name:goal.name})),
        React.createElement("div",{className:"v4-apuntar-amt serif num"},
          raw?raw+" €":React.createElement("span",{style:{color:"var(--muted-2)"}},"0 €")),
        bankOpts.length>0 && React.createElement(React.Fragment,null,
          React.createElement("div",{className:"v4-exp-sec",style:{marginTop:2}}, t("gl_contribute_from")),
          React.createElement("div",{className:"v4-chips"},
            bankOpts.map(function(b){
              return React.createElement("button",{key:b,className:"v4-chip"+(bank===b?" on":""),onClick:function(){ setBank(b); }},
                "🏦 "+entOf(b).label);
            })
          )
        ),
        React.createElement(NumPad,{value:raw, onChange:setRaw}),
        React.createElement("button",{className:"v4-cta",disabled:!(amt>0),style:!(amt>0)?{opacity:.5}:null,onClick:save},
          amt>0?tf("gl_contribute_save",{x:eur(amt)}):t("gl_contribute"))
      )
    ), document.body);
}

