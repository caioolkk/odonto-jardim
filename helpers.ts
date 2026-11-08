import type { ClinicData, Payment, Treatment, Appointment, Patient } from './types'
export const CLINIC_TZ = 'America/Recife'
export const BR_OFFSET = '-03:00' // Fusos do Nordeste; ajuste caso a clínica se mude de região.
export const dateOnly = (d: Date = new Date()) => new Intl.DateTimeFormat('en-CA',{timeZone: CLINIC_TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d)
export const timeOnly = (d: string | Date) => new Intl.DateTimeFormat('pt-BR',{timeZone:CLINIC_TZ,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(d))
export const niceDate = (date: string) => date ? new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(date.slice(0,10)+'T12:00:00Z')).replace('.','') : '—'
export const niceDateTime = (value: string | null | undefined) => value ? `${niceDate(dateOnly(new Date(value)))} • ${timeOnly(value)}` : '—'
export const dateLabel = (value: string) => new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long'}).format(new Date(value+'T12:00:00Z'))
export const money = (cents: number) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((cents||0)/100)
export const toCents = (value: string | number) => Math.round(Number(String(value).replace(',','.'))*100)
export const toInputMoney = (cents: number) => (cents/100).toFixed(2)
export const digits = (value: string) => value.replace(/\D/g,'')
export const phoneDisplay = (p: string) => { const d=digits(p); return d.length===11 ? `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}` : d.length===10 ? `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}` : p }
export const waUrl = (p:string) => {let d=digits(p); if(d.length===10||d.length===11) d='55'+d; return d.length>=12 && d.length<=13 ? `https://wa.me/${d}`:null}
export const dateTimeFromInput = (value: string) => value ? new Date(value+':00'+BR_OFFSET).toISOString(): null
export const inputFromDateTime = (value: string | null) => value ? `${dateOnly(new Date(value))}T${timeOnly(value)}` : ''
export const addDay = (day: string, amount=1) => {const d = new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+amount);return d.toISOString().slice(0,10)}
export const amountReceived = (treatmentId:string, payments:Payment[]) => payments.filter(x=>x.treatment_id===treatmentId).reduce((sum,x)=>sum+x.amount_cents,0)
export const payStatus = (t:Treatment,ps:Payment[]) => {const received=amountReceived(t.id,ps);return received <= 0?'Pendente':received >= t.price_cents?'Pago':'Parcial'}
export const allAppointments = (data:ClinicData, day:string):Appointment[] => {
  const byId = new Map<string,Patient>(data.patients.map(p=>[p.id,p]))
  const arr:Appointment[]=[]
  for(const treatment of data.treatments){
    const patient=byId.get(treatment.patient_id);if(!patient)continue
    if(dateOnly(new Date(treatment.treatment_at))===day)arr.push({id:treatment.id+'-t',kind:'Tratamento',at:treatment.treatment_at,patient,treatment})
    if(treatment.return_at && (!treatment.ended_on || dateOnly(new Date(treatment.return_at)) <= treatment.ended_on) && dateOnly(new Date(treatment.return_at))===day)arr.push({id:treatment.id+'-r',kind:'Retorno',at:treatment.return_at,patient,treatment})
  }
  return arr.sort((a,b)=>a.at.localeCompare(b.at))
}
export const toothGroups = [
 {name:'Superior direito',numbers:['18','17','16','15','14','13','12','11']},
 {name:'Superior esquerdo',numbers:['21','22','23','24','25','26','27','28']},
 {name:'Inferior esquerdo',numbers:['38','37','36','35','34','33','32','31']},
 {name:'Inferior direito',numbers:['41','42','43','44','45','46','47','48']}
]
export const treatmentSuggestions=['Avaliação','Limpeza / profilaxia','Restauração','Tratamento de canal','Extração','Clareamento','Aparelho ortodôntico','Implante','Prótese','Raspagem','Cirurgia','Retorno / revisão']
export const uid=()=>crypto.randomUUID()
export function initialDemo():ClinicData{
 const today=dateOnly(), tomorrow=addDay(today), past=addDay(today,-7)
 const at=(day:string,h:string)=>dateTimeFromInput(day+'T'+h)!
 const patients:Patient[]=[
  {id:'p1',name:'Mariana Oliveira',birth_date:'1991-04-12',phone:'81987654321',created_at:at(past,'09:00')},
  {id:'p2',name:'João Pedro Santos',birth_date:'1987-08-25',phone:'81998765432',created_at:at(past,'09:00')},
  {id:'p3',name:'Ana Beatriz Costa',birth_date:'2000-02-07',phone:'81991234567',created_at:at(past,'09:00')},
  {id:'p4',name:'Ricardo Almeida',birth_date:'1979-12-20',phone:'81994561234',created_at:at(past,'09:00')},
  {id:'p5',name:'Camila Ferreira',birth_date:'1996-06-11',phone:'81996543210',created_at:at(past,'09:00')},
 ]
 const treatments:Treatment[]=[
  {id:'t1',patient_id:'p1',referral:'Fabio Lucena',started_on:past,treatment_name:'Restauração',notes:'Paciente prefere atendimento pela manhã.',treatment_at:at(today,'08:30'),return_at:at(tomorrow,'09:00'),teeth:['16'],price_cents:35000,ended_on:null,created_at:at(past,'08:00')},
  {id:'t2',patient_id:'p2',referral:'Amanda Layse',started_on:past,treatment_name:'Limpeza / profilaxia',notes:null,treatment_at:at(today,'09:45'),return_at:null,teeth:['11','21'],price_cents:22000,ended_on:null,created_at:at(past,'08:00')},
  {id:'t3',patient_id:'p3',referral:'Fabio Lucena',started_on:past,treatment_name:'Tratamento de canal',notes:'Retorno para avaliação.',treatment_at:at(past,'11:00'),return_at:at(today,'11:15'),teeth:['36'],price_cents:95000,ended_on:null,created_at:at(past,'08:00')},
  {id:'t4',patient_id:'p4',referral:'Amanda Layse',started_on:past,treatment_name:'Implante',notes:null,treatment_at:at(today,'14:00'),return_at:at(addDay(today,15),'14:00'),teeth:['46'],price_cents:240000,ended_on:null,created_at:at(past,'08:00')},
  {id:'t5',patient_id:'p5',referral:'Fabio Lucena',started_on:past,treatment_name:'Clareamento',notes:null,treatment_at:at(today,'15:30'),return_at:null,teeth:[],price_cents:70000,ended_on:null,created_at:at(past,'08:00')},
  {id:'t6',patient_id:'p1',referral:'Amanda Layse',started_on:addDay(past,-60),treatment_name:'Avaliação',notes:'Tratamento concluído.',treatment_at:at(addDay(past,-50),'10:00'),return_at:null,teeth:[],price_cents:10000,ended_on:addDay(past,-40),created_at:at(addDay(past,-60),'09:00')}
 ]
 const payments:Payment[]=[
  {id:'r1',treatment_id:'t1',amount_cents:15000,paid_at:at(today,'08:40'),method:'pix',note:null,created_at:at(today,'08:40')},
  {id:'r2',treatment_id:'t2',amount_cents:22000,paid_at:at(today,'10:10'),method:'cartao',note:null,created_at:at(today,'10:10')},
  {id:'r3',treatment_id:'t3',amount_cents:40000,paid_at:at(past,'11:20'),method:'pix',note:null,created_at:at(past,'11:20')},
  {id:'r4',treatment_id:'t4',amount_cents:50000,paid_at:at(today,'14:05'),method:'dinheiro',note:null,created_at:at(today,'14:05')},
  {id:'r5',treatment_id:'t6',amount_cents:10000,paid_at:at(addDay(past,-40),'10:00'),method:'pix',note:null,created_at:at(addDay(past,-40),'10:00')}
 ]
 return {patients,treatments,payments}
}
export const escapeCsv = (v:string|number)=> {let x=String(v??''); if(/^[=+@\-]/.test(x))x="'"+x;return '"'+x.replace(/"/g,'""')+'"'}
