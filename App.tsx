import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChartNoAxesCombined, CheckCircle2, CircleHelp, Cloud, HeartPulse, LockKeyhole, LogOut, Menu, Plus, ShieldCheck, Stethoscope, Users, X } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase, configured } from './supabase'
import { amountReceived, dateOnly, initialDemo, uid } from './helpers'
import type { ClinicData, Intake, Patient, PaymentMethod, Treatment } from './types'
import { AddPayment, Agenda, EditTreatment, FinancePage, IntakePage, PatientDetails, PatientsPage, EditPaymentStatus, ConfirmArchive } from './components'

type Page = 'agenda'|'new'|'patients'|'finance'
type Popup = {type:'patient'|'treatment'|'payment'|'editPayment'|'deletePatient'|'deleteTreatment',id:string}|null
const tabs=[
 {id:'agenda' as Page,label:'Agenda',icon:CalendarDays},
 {id:'new' as Page,label:'Agendar',icon:Plus},
 {id:'patients' as Page,label:'Clientes',icon:Users},
 {id:'finance' as Page,label:'Financeiro',icon:ChartNoAxesCombined},
]
const empty:ClinicData={patients:[],treatments:[],payments:[],archivedRecords:[]}

function Logo({compact=false}:{compact?:boolean}){return <div className="brand"><div className="brand-icon"><Stethoscope size={24} strokeWidth={2.25}/></div>{!compact&&<div className="brand-label"><strong>ODONTO <em>JARDIM</em></strong><span>GESTÃO ODONTOLÓGICA</span></div>}</div>}
function Setup({onDemo}:{onDemo:()=>void}){return <div className="auth-layout"><div className="auth-art"><div className="auth-art-inner"><Logo/><span className="auth-tag"><HeartPulse size={16}/> Gestão inteligente</span><h1>Mais organização.<br/>Mais sorrisos.</h1><p>Atendimentos, pacientes e financeiro. Tudo no mesmo lugar, onde você estiver.</p><div className="art-decor"><CalendarDays size={70}/></div></div></div><main className="auth-main"><div className="auth-box"><div className="auth-icon"><Cloud size={24}/></div><h2>Seu sistema está pronto</h2><p>Para usar com dados reais, conecte o projeto ao Supabase e adicione as credenciais públicas no arquivo <code>.env</code>.</p><div className="setup-steps"><div><span>1</span>Execute o SQL da pasta <strong>supabase/migrations</strong></div><div><span>2</span>Crie o funcionário no Supabase Auth e autorize o UUID</div><div><span>3</span>Preencha <strong>VITE_SUPABASE_URL</strong> e <strong>VITE_SUPABASE_ANON_KEY</strong></div></div><button className="btn primary full" onClick={onDemo}>Explorar demonstração <span aria-hidden="true">→</span></button><p className="security-note"><ShieldCheck size={16}/> Demonstração com dados fictícios. Nada é enviado ou salvo.</p></div></main></div>}
function Login({onLogged}:{onLogged:()=>void}){const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false)
 const login=async(e:React.FormEvent)=>{e.preventDefault();if(!supabase)return;setLoading(true);setError('');const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error){setError('Credenciais inválidas ou acesso indisponível.');setLoading(false)}else{setLoading(false);onLogged()}}
 return <div className="auth-layout"><div className="auth-art"><div className="auth-art-inner"><Logo/><span className="auth-tag"><HeartPulse size={16}/> Gestão inteligente</span><h1>Seu consultório.<br/>No seu ritmo.</h1><p>O cuidado começa com uma rotina mais simples. Acesse sua área segura.</p><div className="art-decor"><CalendarDays size={70}/></div></div></div><main className="auth-main"><form className="auth-box" onSubmit={login}><div className="auth-icon"><LockKeyhole size={24}/></div><h2>Bem-vindo de volta</h2><p>Entre com as credenciais autorizadas da clínica.</p><label className="field">E-mail <input autoComplete="username" type="email" required placeholder="voce@odontojardim.com.br" value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="field">Senha <input autoComplete="current-password" type="password" required placeholder="Sua senha" value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<div className="form-error">{error}</div>}<button className="btn primary full" disabled={loading} type="submit">{loading?'Entrando...':'Entrar no sistema'}</button><p className="security-note"><ShieldCheck size={16}/> Acesso restrito a funcionários autorizados.</p></form></main></div>}

export default function App(){
 const [demo,setDemo]=useState(false),[session,setSession]=useState<Session|null>(null),[authReady,setAuthReady]=useState(!configured),[staffName,setStaffName]=useState(''),[isAdmin,setIsAdmin]=useState(false),[authorized,setAuthorized]=useState(false),[staffReady,setStaffReady]=useState(false)
 const [page,setPage]=useState<Page>('agenda'),[day,setDay]=useState(dateOnly()),[data,setData]=useState<ClinicData>(empty),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[toast,setToast]=useState(''),[popup,setPopup]=useState<Popup>(null),[mobileMenu,setMobileMenu]=useState(false)
 const notice=(s:string)=>{setToast(s);window.setTimeout(()=>setToast(''),4500)}
 useEffect(()=>{if(!supabase)return;let mounted=true;void supabase.auth.getSession().then(({data:{session}})=>{if(mounted){setSession(session);setAuthReady(true)}});const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{if(mounted){setSession(session);setAuthReady(true)}});return ()=>{mounted=false;subscription.unsubscribe()}},[])
 useEffect(()=>{let active=true;if(demo){setAuthorized(true);setStaffReady(true);setStaffName('Equipe ODONTO JARDIM');setIsAdmin(true);return}if(!session||!supabase){setStaffReady(false);setAuthorized(false);setIsAdmin(false);return}
  setStaffReady(false);void (async()=>{const {data:profile,error}=await supabase!.from('staff_profiles').select('display_name,active,role').eq('id',session.user.id).maybeSingle();if(!active)return;setAuthorized(!error&&!!profile?.active);setStaffName(profile?.display_name||'');setIsAdmin(!!profile?.active&&profile?.role==='admin');setStaffReady(true)})();return ()=>{active=false}
 },[session,demo])
 const reload=useCallback(async()=>{if(demo)return;if(!supabase)return;setLoading(true);try{
  // Paginação: evita o limite padrão de linhas do PostgREST e não deixa o faturamento incompleto.
  const fetchAll=async <T,>(table:'patients'|'treatments'|'payments'|'archived_records'|'payment_adjustments',columns:string,sort:string):Promise<T[]>=>{
   const result:T[]=[];const pageSize=500;
   for(let from=0;;from+=pageSize){
    const response=await supabase!.from(table).select(columns).order(sort,{ascending:false}).range(from,from+pageSize-1);
    if(response.error)throw response.error;
    const batch=(response.data||[]) as unknown as T[];result.push(...batch);
    if(batch.length<pageSize)break;
   }
   return result;
  };
  const [patients,treatments,payments,archivedRecords,adjustments]=await Promise.all([
   fetchAll<Patient>('patients','id,name,birth_date,phone,created_at,updated_at','created_at'),
   fetchAll<Treatment>('treatments','id,patient_id,referral,started_on,treatment_name,notes,treatment_at,teeth,price_cents,return_at,ended_on,created_at,updated_at','created_at'),
   fetchAll<ClinicData['payments'][number]>('payments','id,treatment_id,amount_cents,paid_at,method,note,created_at','paid_at'),
   fetchAll<{entity_type:'patient'|'treatment';entity_id:string}>('archived_records','entity_type,entity_id,archived_at','archived_at'),
   fetchAll<{id:string;treatment_id:string;delta_cents:number;method:PaymentMethod;note:string;created_at:string}>('payment_adjustments','id,treatment_id,delta_cents,method,note,created_at','created_at')
  ]);
  const mappedAdjustments=adjustments.map(a=>({id:a.id,treatment_id:a.treatment_id,amount_cents:a.delta_cents,method:a.method,note:a.note,created_at:a.created_at,paid_at:a.created_at,is_adjustment:true}));
  setData({patients,treatments,payments:[...payments,...mappedAdjustments],archivedRecords});
 }catch(e){notice('Erro ao carregar os dados. Confira sua conexão e as permissões.');console.error(e)}finally{setLoading(false)}},[demo])
 useEffect(()=>{if(authorized&&!demo)void reload()},[authorized,demo,reload])
 useEffect(()=>{if(demo||!session||!supabase||!authorized)return;let last=Date.now();const activity=()=>{last=Date.now()};const events=['mousemove','keydown','touchstart','pointerdown'];events.forEach(event=>window.addEventListener(event,activity,{passive:true}));const interval=window.setInterval(()=>{if(Date.now()-last>20*60*1000){void supabase!.auth.signOut();notice('Sessão encerrada por inatividade.')}},60*1000);return ()=>{window.clearInterval(interval);events.forEach(e=>window.removeEventListener(e,activity))}},[demo,session,authorized])
 const exec=async(action:()=>Promise<void>,message:string)=>{setBusy(true);try{await action();if(!demo)await reload();notice(message)}catch(e){console.error(e);notice(e instanceof Error?e.message:'Ocorreu um erro. Tente novamente.');throw e}finally{setBusy(false)}}
 const onCreate=async(v:Intake)=>{try{let patientId='';await exec(async()=>{if(demo){patientId=v.patient_id||uid();const now=new Date().toISOString();const p:Patient={id:patientId,name:v.name,birth_date:v.birth_date,phone:v.phone,created_at:now};const tr:Treatment={id:uid(),patient_id:patientId,referral:v.referral,started_on:v.started_on,treatment_name:v.treatment_name,notes:v.notes||null,treatment_at:v.treatment_at,return_at:v.return_at,teeth:v.teeth,price_cents:v.price_cents,ended_on:null,created_at:now};setData(prev=>({...prev,patients:v.patient_id?prev.patients:[...prev.patients,p],treatments:[...prev.treatments,tr],payments:v.initial_payment_cents>0?[...prev.payments,{id:uid(),treatment_id:tr.id,amount_cents:v.initial_payment_cents,paid_at:now,method:v.payment_method,note:null,created_at:now}]:prev.payments}));return}
 if(!supabase)throw new Error('Supabase indisponível');const {data,error}=await supabase.rpc('create_intake',{p_patient_id:v.patient_id,p_name:v.name,p_birth_date:v.birth_date||null,p_phone:v.phone,p_referral:v.referral,p_started_on:v.started_on,p_treatment_name:v.treatment_name,p_notes:v.notes,p_treatment_at:v.treatment_at,p_teeth:v.teeth,p_price_cents:v.price_cents,p_return_at:v.return_at,p_initial_payment_cents:v.initial_payment_cents,p_payment_method:v.payment_method});if(error)throw new Error(error.message);patientId=data as string
 },'Agendamento cadastrado com sucesso!');setPage('patients');setPopup({type:'patient',id:patientId})}catch{/* toast mostrado */}}
 const onEditPatient=async(p:Patient)=>{try{await exec(async()=>{if(demo){setData(prev=>({...prev,patients:prev.patients.map(x=>x.id===p.id?{...x,birth_date:p.birth_date,phone:p.phone}:x)}));return}const {error}=await supabase!.from('patients').update({birth_date:p.birth_date,phone:p.phone}).eq('id',p.id);if(error)throw new Error(error.message)},'Dados do paciente atualizados.')}catch{/* toast */}}
 const onEditTreatment=async(t:Treatment)=>{try{await exec(async()=>{if(demo){const old=data.treatments.find(x=>x.id===t.id);if(old?.ended_on)throw new Error('Tratamento já finalizado.');if(amountReceived(t.id,data.payments)>t.price_cents)throw new Error('Valor menor que os recebimentos.');setData(prev=>({...prev,treatments:prev.treatments.map(x=>x.id===t.id?t:x)}));return}const {error}=await supabase!.from('treatments').update({referral:t.referral,started_on:t.started_on,treatment_name:t.treatment_name,notes:t.notes,treatment_at:t.treatment_at,teeth:t.teeth,price_cents:t.price_cents,return_at:t.return_at,ended_on:t.ended_on}).eq('id',t.id);if(error)throw new Error(error.message)},t.ended_on?'Tratamento finalizado e bloqueado.':'Tratamento atualizado com sucesso.');setPopup({type:'patient',id:t.patient_id})}catch{/* toast */}}
 const onPay=async(id:string,amount:number,method:PaymentMethod,note:string)=>{try{await exec(async()=>{if(demo){const t=data.treatments.find(t=>t.id===id);if(!t||t.ended_on||amountReceived(id,data.payments)+amount>t.price_cents)throw new Error('Pagamento não permitido.');setData(prev=>({...prev,payments:[...prev.payments,{id:uid(),treatment_id:id,amount_cents:amount,method,note:note||null,paid_at:new Date().toISOString(),created_at:new Date().toISOString()}]}));return}const {error}=await supabase!.from('payments').insert({treatment_id:id,amount_cents:amount,method,note:note||null});if(error)throw new Error(error.message)},'Pagamento registrado com sucesso.');const t=data.treatments.find(t=>t.id===id);setPopup(t?{type:'patient',id:t.patient_id}:null)}catch{/* toast */}}
 const onArchive=async(kind:'patient'|'treatment',id:string,reason:string)=>{
  try{await exec(async()=>{
   if(demo){setData(prev=>({...prev,archivedRecords:[...(prev.archivedRecords||[]),{entity_type:kind,entity_id:id}]}));return}
   const {error}=await supabase!.rpc('archive_clinic_record',{p_entity_type:kind,p_entity_id:id,p_reason:reason||null});if(error)throw new Error(error.message)
  },kind==='patient'?'Cliente excluído das listas. Histórico preservado.':'Pedido excluído da agenda. Histórico preservado.');
  if(kind==='patient')setPopup(null);else{const t=data.treatments.find(t=>t.id===id);setPopup(t?{type:'patient',id:t.patient_id}:null)}
 }catch{/* toast */}
 }
 const onAdjustPayment=async(id:string,target:number,method:PaymentMethod,reason:string)=>{
  try{await exec(async()=>{
   if(demo){const current=amountReceived(id,data.payments),delta=target-current;const t=data.treatments.find(t=>t.id===id)
    if(!t||t.ended_on||target<0||target>t.price_cents)throw new Error('Ajuste não permitido.');
    if(delta!==0){const now=new Date().toISOString();setData(prev=>({...prev,payments:[...prev.payments,{id:uid(),treatment_id:id,amount_cents:delta,paid_at:now,method,note:reason,created_at:now,is_adjustment:true}]}))}return}
   const {error}=await supabase!.rpc('adjust_payment_status',{p_treatment_id:id,p_target_cents:target,p_method:method,p_reason:reason});if(error)throw new Error(error.message)
  },'Situação do pagamento atualizada e registrada no financeiro.');
  const t=data.treatments.find(t=>t.id===id);setPopup(t?{type:'patient',id:t.patient_id}:null)
 }catch{/* toast */}
 }
 const hiddenPatients=new Set((data.archivedRecords||[]).filter(a=>a.entity_type==='patient').map(a=>a.entity_id))
 const hiddenTreatments=new Set((data.archivedRecords||[]).filter(a=>a.entity_type==='treatment').map(a=>a.entity_id))
 const visibleData:ClinicData={...data,patients:data.patients.filter(p=>!hiddenPatients.has(p.id)),treatments:data.treatments.filter(t=>!hiddenTreatments.has(t.id)&&!hiddenPatients.has(t.patient_id))}
 const patient=popup?.type==='patient'?visibleData.patients.find(p=>p.id===popup.id):null
 const treatment=['treatment','payment','editPayment'].includes(popup?.type||'')?visibleData.treatments.find(t=>t.id===popup?.id):null
 const currentPage=useMemo(()=>({agenda:'Agenda do dia',new:'Novo agendamento',patients:'Meus clientes',finance:'Faturamento'}[page]),[page])
 if(!configured&&!demo)return <Setup onDemo={()=>{setDemo(true);setData(initialDemo());setPage('agenda')}}/>
 if(configured&&!demo&&!authReady)return <div className="loading-screen"><Logo/><p>Verificando sessão...</p></div>
 if(configured&&!demo&&!session)return <Login onLogged={()=>{}}/>
 if(configured&&!demo&&!staffReady)return <div className="loading-screen"><Logo/><p>Validando credenciais...</p></div>
 if(configured&&!demo&&!authorized)return <div className="auth-denied"><Logo/><div className="auth-box"><LockKeyhole size={32}/><h2>Acesso não autorizado</h2><p>Este usuário ainda não foi habilitado como funcionário da ODONTO JARDIM. Peça ao administrador que cadastre seu UUID na tabela <code>staff_profiles</code>.</p><button className="btn secondary full" onClick={()=>void supabase?.auth.signOut()}>Sair</button></div></div>
 return <div className="app-shell"><aside className={'sidebar '+(mobileMenu?'sidebar-open':'')}><div className="sidebar-head"><Logo/><button aria-label="Fechar menu" className="icon-btn sidebar-close" onClick={()=>setMobileMenu(false)}><X size={20}/></button></div><div className="sidebar-nav-label">MENU PRINCIPAL</div><nav className="sidebar-links">{tabs.map(t=><button key={t.id} onClick={()=>{setPage(t.id);setMobileMenu(false)}} className={'nav-link '+(page===t.id?'active':'')}><t.icon size={19}/><span>{t.label}</span></button>)}</nav><div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={19}/></div><strong>Cuidado em cada detalhe.</strong><p>Organização para um atendimento ainda melhor.</p></div><div className="account"><div className="account-avatar">OJ</div><div><strong>{staffName||'Equipe ODONTO JARDIM'}</strong><span>{demo?'Modo demonstração':'Acesso autorizado'}</span></div><button title="Sair" className="icon-btn" onClick={()=>{if(demo){setDemo(false);setData(empty);setPopup(null);setPage('agenda')}else void supabase?.auth.signOut()}}><LogOut size={17}/></button></div></div></aside>
 <div className="content-wrap"><header className="topbar"><button aria-label="Abrir menu" className="icon-btn hamburger" onClick={()=>setMobileMenu(true)}><Menu size={22}/></button><div className="topbar-crumb"><span>ODONTO JARDIM</span><span className="crumb-slash">/</span><strong>{currentPage}</strong></div><div className="topbar-right"><div className="today-chip"><CalendarDays size={15}/>{new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date())}</div>{demo?<span className="demo-chip">DEMO</span>:<span className="secure-chip"><ShieldCheck size={16}/> Seguro</span>}</div></header>
 <main className="content">{demo&&<div className="demo-banner"><Cloud size={18}/><p><strong>Demonstração:</strong> os dados são fictícios e as alterações desaparecem ao atualizar a página.</p><button onClick={()=>{setDemo(false);setData(empty)}}>Sair da demo</button></div>}
 {loading&&<div className="loading-inline">Atualizando informações...</div>}
 {page==='agenda'&&<Agenda data={visibleData} day={day} onDay={setDay} onOpen={id=>setPopup({type:'patient',id})} onNew={()=>setPage('new')}/>}
 {page==='new'&&<IntakePage data={visibleData} busy={busy} onSubmit={onCreate} onCancel={()=>setPage('agenda')}/>}
 {page==='patients'&&<PatientsPage data={visibleData} onNew={()=>setPage('new')} onOpen={id=>setPopup({type:'patient',id})}/>}
 {page==='finance'&&<FinancePage data={data}/>}
 <footer className="footer">© {new Date().getFullYear()} ODONTO JARDIM <span>•</span> Gestão clínica com cuidado e segurança.</footer></main></div>
 <nav className="bottom-nav" aria-label="Navegação inferior">{tabs.map(t=><button key={t.id} onClick={()=>setPage(t.id)} className={page===t.id?'active':''}><t.icon size={21}/><span>{t.label}</span></button>)}</nav>
 {mobileMenu&&<button aria-label="Fechar navegação" className="menu-backdrop" onClick={()=>setMobileMenu(false)}></button>}
 {toast&&<div role="status" className="toast"><CheckCircle2 size={18}/>{toast}<button aria-label="Fechar mensagem" onClick={()=>setToast('')}><X size={16}/></button></div>}
 {patient&&<PatientDetails patient={patient} data={visibleData} busy={busy} onClose={()=>setPopup(null)} onEditPatient={onEditPatient} onEditTreatment={id=>setPopup({type:'treatment',id})} onPay={id=>setPopup({type:'payment',id})} onEditPayment={id=>setPopup({type:'editPayment',id})} onDeletePatient={id=>setPopup({type:'deletePatient',id})} onDeleteTreatment={id=>setPopup({type:'deleteTreatment',id})} isAdmin={isAdmin}/>}
 {treatment&&popup?.type==='treatment'&&!treatment.ended_on&&<EditTreatment t={treatment} paymentTotal={amountReceived(treatment.id,data.payments)} busy={busy} onClose={()=>setPopup({type:'patient',id:treatment.patient_id})} onSave={onEditTreatment}/>}
 {treatment&&popup?.type==='editPayment'&&isAdmin&&!treatment.ended_on&&<EditPaymentStatus t={treatment} received={amountReceived(treatment.id,data.payments)} busy={busy} onClose={()=>setPopup({type:'patient',id:treatment.patient_id})} onSave={(target,method,reason)=>onAdjustPayment(treatment.id,target,method,reason)}/>}
 {popup?.type==='deleteTreatment'&&isAdmin&&visibleData.treatments.find(t=>t.id===popup.id)&&<ConfirmArchive kind="treatment" name={visibleData.treatments.find(t=>t.id===popup.id)!.treatment_name} busy={busy} onClose={()=>setPopup({type:'patient',id:visibleData.treatments.find(t=>t.id===popup!.id)!.patient_id})} onConfirm={reason=>onArchive('treatment',popup!.id,reason)}/>}
 {popup?.type==='deletePatient'&&isAdmin&&visibleData.patients.find(p=>p.id===popup.id)&&<ConfirmArchive kind="patient" name={visibleData.patients.find(p=>p.id===popup.id)!.name} counts={visibleData.treatments.filter(t=>t.patient_id===popup.id).length} busy={busy} onClose={()=>setPopup({type:'patient',id:popup!.id})} onConfirm={reason=>onArchive('patient',popup!.id,reason)}/>}
 {treatment&&popup?.type==='payment'&&!treatment.ended_on&&<AddPayment t={treatment} total={amountReceived(treatment.id,data.payments)} busy={busy} onClose={()=>setPopup({type:'patient',id:treatment.patient_id})} onSave={(amount,method,note)=>onPay(treatment.id,amount,method,note)}/>}
 </div>
}
