-- ODONTO JARDIM: exclusão lógica para preservar prontuários/financeiro e correções de recebimentos auditáveis.
-- Aplicada no projeto Supabase em 08/11/2026. Em um banco existente não reaplique sem revisar.

CREATE TABLE IF NOT EXISTS public.archived_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('patient','treatment')),
  entity_id uuid NOT NULL,
  reason text,
  archived_by uuid NOT NULL REFERENCES auth.users(id),
  archived_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_type,entity_id)
);
CREATE INDEX IF NOT EXISTS archived_records_lookup_idx ON public.archived_records(entity_type,entity_id);
ALTER TABLE public.archived_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.archived_records FROM PUBLIC, anon;
GRANT SELECT ON public.archived_records TO authenticated;
DROP POLICY IF EXISTS archived_records_staff_select ON public.archived_records;
CREATE POLICY archived_records_staff_select ON public.archived_records FOR SELECT TO authenticated
  USING ((SELECT public.is_active_staff()));

CREATE TABLE IF NOT EXISTS public.payment_adjustments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 treatment_id uuid NOT NULL REFERENCES public.treatments(id),
 delta_cents integer NOT NULL CHECK (delta_cents <> 0),
 method text NOT NULL CHECK (method IN ('pix','dinheiro','cartao','transferencia','outro')),
 note text NOT NULL CHECK (length(btrim(note)) >= 3),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_adjustments_treatment_id_idx ON public.payment_adjustments(treatment_id);
ALTER TABLE public.payment_adjustments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_adjustments FROM PUBLIC, anon;
GRANT SELECT ON public.payment_adjustments TO authenticated;
DROP POLICY IF EXISTS payment_adjustments_staff_select ON public.payment_adjustments;
CREATE POLICY payment_adjustments_staff_select ON public.payment_adjustments FOR SELECT TO authenticated
  USING ((SELECT public.is_active_staff()));

CREATE OR REPLACE FUNCTION public.archive_clinic_record(p_entity_type text, p_entity_id uuid, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_patient_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.staff_profiles s WHERE s.id=auth.uid() AND s.active AND s.role='admin'
 ) THEN RAISE EXCEPTION 'Somente administradores podem excluir registros'; END IF;
 IF p_entity_type = 'patient' THEN
   IF NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.id=p_entity_id) THEN
     RAISE EXCEPTION 'Cliente não localizado'; END IF;
 ELSIF p_entity_type = 'treatment' THEN
   SELECT t.patient_id INTO v_patient_id FROM public.treatments t WHERE t.id=p_entity_id;
   IF v_patient_id IS NULL THEN RAISE EXCEPTION 'Pedido não localizado'; END IF;
   IF EXISTS (SELECT 1 FROM public.archived_records a WHERE a.entity_type='patient' AND a.entity_id=v_patient_id) THEN
     RAISE EXCEPTION 'O cliente já está excluído das listas'; END IF;
 ELSE RAISE EXCEPTION 'Tipo de registro inválido'; END IF;
 INSERT INTO public.archived_records(entity_type,entity_id,reason,archived_by)
 VALUES(p_entity_type,p_entity_id,nullif(btrim(p_reason),''),auth.uid())
 ON CONFLICT(entity_type,entity_id) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.archive_clinic_record(text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.archive_clinic_record(text,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.adjust_payment_status(p_treatment_id uuid, p_target_cents integer, p_method text, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_price integer; v_ended date; v_patient uuid; v_total bigint; v_delta bigint;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.staff_profiles s WHERE s.id=auth.uid() AND s.active AND s.role='admin'
 ) THEN RAISE EXCEPTION 'Somente administradores podem alterar situações de pagamento'; END IF;
 SELECT t.price_cents,t.ended_on,t.patient_id INTO v_price,v_ended,v_patient
 FROM public.treatments t WHERE t.id=p_treatment_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
 IF v_ended IS NOT NULL THEN RAISE EXCEPTION 'Pedido finalizado: pagamentos bloqueados'; END IF;
 IF EXISTS (SELECT 1 FROM public.archived_records a WHERE (a.entity_type='treatment' AND a.entity_id=p_treatment_id)
 OR (a.entity_type='patient' AND a.entity_id=v_patient)) THEN
   RAISE EXCEPTION 'Pedido excluído: pagamentos bloqueados'; END IF;
 IF p_target_cents IS NULL OR p_target_cents<0 OR p_target_cents>v_price THEN
   RAISE EXCEPTION 'Valor pago deve ficar entre zero e o preço do pedido'; END IF;
 IF p_method NOT IN ('pix','dinheiro','cartao','transferencia','outro') OR p_method IS NULL THEN
   RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;
 IF length(btrim(coalesce(p_reason,'')))<3 THEN RAISE EXCEPTION 'Informe o motivo do ajuste (mínimo 3 caracteres)'; END IF;
 SELECT coalesce((SELECT sum(p.amount_cents) FROM public.payments p WHERE p.treatment_id=p_treatment_id),0)
      + coalesce((SELECT sum(a.delta_cents) FROM public.payment_adjustments a WHERE a.treatment_id=p_treatment_id),0)
 INTO v_total;
 v_delta := p_target_cents::bigint - v_total;
 IF v_delta=0 THEN RETURN; END IF;
 INSERT INTO public.payment_adjustments(treatment_id,delta_cents,method,note,created_by)
 VALUES(p_treatment_id,v_delta::integer,p_method,btrim(p_reason),auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.adjust_payment_status(uuid,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.adjust_payment_status(uuid,integer,text,text) TO authenticated;

-- Guardas de integridade: o saldo considera pagamentos originais + ajustes assinados.
CREATE OR REPLACE FUNCTION public.payment_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_total bigint;v_price integer;v_ended date;v_patient uuid;
BEGIN
 SELECT t.price_cents,t.ended_on,t.patient_id INTO v_price,v_ended,v_patient
 FROM public.treatments t WHERE t.id=new.treatment_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tratamento não encontrado'; END IF;
 IF v_ended IS NOT NULL THEN RAISE EXCEPTION 'Tratamento finalizado: recebimento bloqueado'; END IF;
 IF EXISTS (SELECT 1 FROM public.archived_records a WHERE
 (a.entity_type='treatment' AND a.entity_id=new.treatment_id) OR
 (a.entity_type='patient' AND a.entity_id=v_patient)) THEN
   RAISE EXCEPTION 'Pedido ou cliente excluído: recebimento bloqueado'; END IF;
 SELECT coalesce((SELECT sum(amount_cents) FROM public.payments WHERE treatment_id=new.treatment_id),0)
     +coalesce((SELECT sum(delta_cents) FROM public.payment_adjustments WHERE treatment_id=new.treatment_id),0)
 INTO v_total;
 IF v_total+new.amount_cents>v_price THEN RAISE EXCEPTION 'Pagamento excede valor do tratamento'; END IF;
 IF new.paid_at>now()+interval '2 minutes' THEN RAISE EXCEPTION 'Pagamento futuro não permitido'; END IF;
 RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.treatment_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_received bigint;
BEGIN
 IF old.ended_on IS NOT NULL THEN RAISE EXCEPTION 'Tratamento finalizado: edição bloqueada'; END IF;
 IF new.ended_on>(now() AT TIME ZONE 'America/Recife')::date THEN
   RAISE EXCEPTION 'Data futura de encerramento não permitida'; END IF;
 IF new.patient_id IS DISTINCT FROM old.patient_id
    OR new.created_by IS DISTINCT FROM old.created_by
    OR new.created_at IS DISTINCT FROM old.created_at THEN
    RAISE EXCEPTION 'Auditoria e paciente imutáveis'; END IF;
 IF EXISTS (SELECT 1 FROM public.archived_records a WHERE
    (a.entity_type='treatment' AND a.entity_id=old.id) OR
    (a.entity_type='patient' AND a.entity_id=old.patient_id)) THEN
    RAISE EXCEPTION 'Pedido ou cliente excluído: edição bloqueada'; END IF;
 SELECT coalesce((SELECT sum(amount_cents) FROM public.payments WHERE treatment_id=old.id),0)
      +coalesce((SELECT sum(delta_cents) FROM public.payment_adjustments WHERE treatment_id=old.id),0) INTO v_received;
 IF new.price_cents<v_received THEN RAISE EXCEPTION 'Valor inferior aos pagamentos recebidos'; END IF;
 new.updated_at=now(); RETURN new;
END;
$$;

-- Não permita criar novos pedidos para clientes arquivados.
CREATE OR REPLACE FUNCTION public.prevent_archived_patient_treatment()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.archived_records a WHERE a.entity_type='patient' AND a.entity_id=new.patient_id) THEN
 RAISE EXCEPTION 'Cliente excluído não aceita novos pedidos'; END IF;
 RETURN new;
END;
$$;
DROP TRIGGER IF EXISTS trg_prevent_archived_patient_treatment ON public.treatments;
CREATE TRIGGER trg_prevent_archived_patient_treatment BEFORE INSERT ON public.treatments
FOR EACH ROW EXECUTE FUNCTION public.prevent_archived_patient_treatment();
REVOKE ALL ON FUNCTION public.prevent_archived_patient_treatment() FROM PUBLIC,anon,authenticated;
