-- ODONTO JARDIM — executar no SQL Editor de um projeto Supabase NOVO.
-- Dados de pacientes/financeiros NÃO são públicos. Sem cadastro livre de funcionários.
create extension if not exists pgcrypto;

create table if not exists public.staff_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null,
 role text not null default 'atendente' check (role in ('admin','dentista','atendente')),
 active boolean not null default true,
 created_at timestamptz not null default now()
);

create or replace function public.is_active_staff() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.staff_profiles s where s.id=(select auth.uid()) and s.active=true) $$;

create table if not exists public.patients (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(btrim(name)) between 2 and 160),
 birth_date date not null,
 phone text not null check (phone ~ '^[0-9]{10,13}$'),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.treatments (
 id uuid primary key default gen_random_uuid(),
 patient_id uuid not null references public.patients(id),
 referral text not null check (referral in ('Fabio Lucena','Amanda Layse')),
 started_on date not null,
 treatment_name text not null check (char_length(btrim(treatment_name)) between 2 and 160),
 notes text,
 treatment_at timestamptz not null,
 teeth text[] not null default '{}',
 price_cents integer not null check (price_cents >= 0 and price_cents <= 200000000),
 return_at timestamptz,
 ended_on date,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint end_after_start check (ended_on is null or ended_on >= started_on),
 constraint teeth_fdi_format check (teeth <@ array[
  '11','12','13','14','15','16','17','18',
  '21','22','23','24','25','26','27','28',
  '31','32','33','34','35','36','37','38',
  '41','42','43','44','45','46','47','48',
  '51','52','53','54','55','61','62','63','64','65',
  '71','72','73','74','75','81','82','83','84','85'
 ]::text[])
);

create table if not exists public.payments (
 id uuid primary key default gen_random_uuid(),
 treatment_id uuid not null references public.treatments(id),
 amount_cents integer not null check (amount_cents > 0),
 paid_at timestamptz not null default now(),
 method text not null check (method in ('pix','dinheiro','cartao','transferencia','outro')),
 note text,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now()
);

create table if not exists public.treatment_audit (
 id bigint generated always as identity primary key,
 treatment_id uuid not null references public.treatments(id),
 changed_by uuid default auth.uid() references auth.users(id),
 changed_at timestamptz not null default now(),
 before_record jsonb not null,
 after_record jsonb not null
);

create index if not exists patients_name_idx on public.patients (name);
create index if not exists patients_phone_idx on public.patients (phone);
create index if not exists treatments_patient_idx on public.treatments (patient_id);
create index if not exists treatments_at_idx on public.treatments (treatment_at);
create index if not exists treatments_return_idx on public.treatments (return_at) where return_at is not null;
create index if not exists treatments_started_idx on public.treatments (started_on);
create index if not exists treatments_referral_idx on public.treatments (referral);
create index if not exists payments_at_idx on public.payments (paid_at);
create index if not exists payments_treatment_idx on public.payments (treatment_id);
create index if not exists audit_treatment_idx on public.treatment_audit (treatment_id);

create or replace function public.patient_new_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
 if new.birth_date > (now() at time zone 'America/Recife')::date then
  raise exception 'Nascimento não pode estar no futuro.';
 end if;
 return new;
end; $$;

create or replace function public.patient_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
 if new.birth_date > (now() at time zone 'America/Recife')::date then
  raise exception 'Nascimento não pode estar no futuro.';
 end if;
 if new.name is distinct from old.name then
  raise exception 'O nome do paciente não pode ser alterado.' using errcode='P0001';
 end if;
 if new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
  raise exception 'Campos de auditoria são imutáveis.';
 end if;
 new.updated_at = now();
 return new;
end; $$;

create or replace function public.treatment_guard() returns trigger
language plpgsql set search_path = '' as $$
declare received bigint;
begin
 if old.ended_on is not null then
  raise exception 'Tratamento finalizado: edição bloqueada no banco de dados.' using errcode='P0001';
 end if;
 if new.ended_on > (now() at time zone 'America/Recife')::date then
  raise exception 'Não é permitido finalizar tratamentos com data futura.';
 end if;
 if new.patient_id is distinct from old.patient_id or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
  raise exception 'Não é permitido transferir tratamentos ou modificar auditoria.';
 end if;
 select coalesce(sum(amount_cents),0) into received from public.payments where treatment_id=old.id;
 if new.price_cents < received then
  raise exception 'O valor do tratamento não pode ser menor que o total já recebido.';
 end if;
 new.updated_at=now();
 return new;
end; $$;

create or replace function public.audit_treatment_edit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.treatment_audit(treatment_id, changed_by, before_record, after_record)
 values (new.id,auth.uid(),to_jsonb(old),to_jsonb(new));
 return new;
end; $$;

create or replace function public.payment_guard() returns trigger
language plpgsql set search_path = '' as $$
declare total bigint; price integer; final_date date;
begin
 -- Tratamento é bloqueado enquanto valida recebimentos simultâneos.
 select t.price_cents,t.ended_on into price,final_date
 from public.treatments t where t.id=new.treatment_id for update;
 if not found then raise exception 'Tratamento não encontrado'; end if;
 if final_date is not null then raise exception 'Não é possível receber pagamentos em tratamento finalizado.'; end if;
 select coalesce(sum(amount_cents),0) into total from public.payments where treatment_id=new.treatment_id;
 if total + new.amount_cents > price then raise exception 'O recebimento excede o valor do tratamento.'; end if;
 if new.paid_at > now() + interval '2 minutes' then raise exception 'Data futura de recebimento não permitida.'; end if;
 return new;
end; $$;

create trigger patients_new_guard before insert on public.patients for each row execute function public.patient_new_guard();
create trigger patients_guard before update on public.patients for each row execute function public.patient_guard();
create trigger treatments_guard before update on public.treatments for each row execute function public.treatment_guard();
create trigger treatments_audit after update on public.treatments for each row execute function public.audit_treatment_edit();
create trigger payments_guard before insert on public.payments for each row execute function public.payment_guard();

alter table public.staff_profiles enable row level security;
alter table public.patients enable row level security;
alter table public.treatments enable row level security;
alter table public.payments enable row level security;
alter table public.treatment_audit enable row level security;

-- Revoke permissões legadas amplas; políticas restringem a usuários autorizados.
revoke all on table public.staff_profiles,public.patients,public.treatments,public.payments,public.treatment_audit from anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.staff_profiles to authenticated;
grant select,insert,update on public.patients to authenticated;
grant select,insert,update on public.treatments to authenticated;
grant select,insert on public.payments to authenticated;
grant select on public.treatment_audit to authenticated;
-- identity sequence para tabela de auditoria disparada pela trigger SECURITY DEFINER.

create policy staff_self_select on public.staff_profiles for select to authenticated using (id=(select auth.uid()));

create policy patients_staff_select on public.patients for select to authenticated using ((select public.is_active_staff()));
create policy patients_staff_insert on public.patients for insert to authenticated with check ((select public.is_active_staff()) and created_by=(select auth.uid()));
create policy patients_staff_update on public.patients for update to authenticated using ((select public.is_active_staff())) with check ((select public.is_active_staff()));

create policy treatments_staff_select on public.treatments for select to authenticated using ((select public.is_active_staff()));
create policy treatments_staff_insert on public.treatments for insert to authenticated with check ((select public.is_active_staff()) and created_by=(select auth.uid()));
create policy treatments_staff_update on public.treatments for update to authenticated using ((select public.is_active_staff()) and ended_on is null) with check ((select public.is_active_staff()));

create policy payments_staff_select on public.payments for select to authenticated using ((select public.is_active_staff()));
create policy payments_staff_insert on public.payments for insert to authenticated with check ((select public.is_active_staff()) and created_by=(select auth.uid()));
create policy audit_staff_select on public.treatment_audit for select to authenticated using ((select public.is_active_staff()));

-- Registro completo de paciente + tratamento + recebimento em uma transação.
-- security invoker: respeita RLS e Grants atuais.
revoke all on function public.is_active_staff() from public,anon;
grant execute on function public.is_active_staff() to authenticated;

create or replace function public.create_intake(
 p_patient_id uuid,
 p_name text,
 p_birth_date date,
 p_phone text,
 p_referral text,
 p_started_on date,
 p_treatment_name text,
 p_notes text,
 p_treatment_at timestamptz,
 p_teeth text[],
 p_price_cents integer,
 p_return_at timestamptz,
 p_initial_payment_cents integer,
 p_payment_method text
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare v_patient uuid; v_treatment uuid;
begin
 if not (select public.is_active_staff()) then raise exception 'Acesso não autorizado'; end if;
 if p_price_cents < 0 or p_initial_payment_cents < 0 or p_initial_payment_cents > p_price_cents then
  raise exception 'Valores de pagamento inválidos';
 end if;
 if p_patient_id is null then
   insert into public.patients(name,birth_date,phone)
   values (btrim(p_name),p_birth_date,btrim(p_phone)) returning id into v_patient;
 else
   if not exists (select 1 from public.patients where id=p_patient_id) then raise exception 'Paciente não localizado'; end if;
   v_patient := p_patient_id;
 end if;
 insert into public.treatments(patient_id,referral,started_on,treatment_name,notes,treatment_at,teeth,price_cents,return_at)
 values (v_patient,p_referral,p_started_on,btrim(p_treatment_name),nullif(btrim(p_notes),''),p_treatment_at,coalesce(p_teeth,'{}'::text[]),p_price_cents,p_return_at)
 returning id into v_treatment;
 if p_initial_payment_cents > 0 then
  insert into public.payments(treatment_id,amount_cents,method)
  values(v_treatment,p_initial_payment_cents,p_payment_method);
 end if;
 return v_patient;
end; $$;
revoke all on function public.create_intake(uuid,text,date,text,text,date,text,text,timestamptz,text[],integer,timestamptz,integer,text) from public,anon;
grant execute on function public.create_intake(uuid,text,date,text,text,date,text,text,timestamptz,text[],integer,timestamptz,integer,text) to authenticated;

-- Primeiro usuário: Authentication > Users > Add user (não habilite cadastro público).
-- Copie o UUID e rode a linha abaixo DESCOMENTADA, trocando pelo ID correto:
-- insert into public.staff_profiles(id,display_name,role,active)
-- values ('COLE-AQUI-O-UUID','Administrador ODONTO JARDIM','admin',true);
