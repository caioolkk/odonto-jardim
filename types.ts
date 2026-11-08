export type Referral = 'Fabio Lucena' | 'Amanda Layse'
export type PaymentMethod = 'pix' | 'dinheiro' | 'cartao' | 'transferencia' | 'outro'
export type Patient = {
  id: string; name: string; birth_date: string; phone: string;
  created_at: string; updated_at?: string;
}
export type Treatment = {
  id: string; patient_id: string; referral: Referral; started_on: string;
  treatment_name: string; notes: string | null; treatment_at: string;
  teeth: string[]; price_cents: number; return_at: string | null;
  ended_on: string | null; created_at: string; updated_at?: string;
}
export type Payment = {
  id: string; treatment_id: string; amount_cents: number; paid_at: string;
  method: PaymentMethod; note: string | null; created_at: string; is_adjustment?: boolean;
}
export type ArchivedRecord = { entity_type: 'patient' | 'treatment'; entity_id: string }
export type ClinicData = { patients: Patient[]; treatments: Treatment[]; payments: Payment[]; archivedRecords?: ArchivedRecord[] }
export type Intake = {
  patient_id: string | null; name: string; birth_date: string; phone: string;
  referral: Referral; started_on: string; treatment_name: string; notes: string;
  treatment_at: string; teeth: string[]; price_cents: number;
  return_at: string | null; initial_payment_cents: number;
  payment_method: PaymentMethod;
}
export type Appointment = { id: string; kind: 'Tratamento' | 'Retorno'; at: string; treatment: Treatment; patient: Patient }
