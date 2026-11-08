# ODONTO JARDIM — Gestão odontológica

Projeto web responsivo para recepção e profissionais da clínica. Front-end React + TypeScript + Vite, banco PostgreSQL e autenticação Supabase.

## O que está incluído

- **Agenda do dia** com horário, data, nome, telefone, procedimento e retorno.
- **Agendamento** com paciente novo ou existente, nascimento, telefone, profissional que indicou, início, procedimento, observações, data/hora do procedimento, data/hora do retorno, valores e situação do pagamento.
- **Odontograma FDI** selecionável: dentes permanentes (11–48) e decíduos (51–85).
- **Meus clientes** com retorno, procedimentos, valores, ficha completa e edição de telefone/nascimento. **Nome imutável**, inclusive por chamadas diretas à API.
- **Filtros** por nome a partir de três caracteres, telefone, início, data do procedimento, retorno, tipo de tratamento e indicação.
- **Atualizar pedido**: permite remarcar retorno, alterar dados de tratamento e informar data de conclusão, sempre exibindo uma confirmação. Uma vez concluído, o banco proíbe novas edições e novos pagamentos no tratamento.
- **Financeiro** com faturamento por dia/mês/ano/período, saldo a receber e exportação CSV. O faturamento se baseia em pagamentos registrados, não em cobranças prometidas.
- Login por e-mail/senha, usuários autorizados na tabela de funcionários, Row-Level Security e trilha de alterações dos tratamentos.
- **Modo demonstração** com pacientes fictícios, ativado quando as variáveis de conexão ainda não foram configuradas.

## Preparar o Supabase

> Use preferencialmente um **projeto Supabase novo**, pois a migration foi escrita para uma base nova. Não execute sem revisar em projeto existente com dados reais.

1. No Dashboard do Supabase, abra **SQL Editor** e execute todo o arquivo `supabase/migrations/202611060001_initial.sql`.
2. Abra **Authentication → Users → Add user** e crie um usuário com e-mail e senha forte. Copie o UUID desse usuário.
3. No SQL Editor, execute, substituindo apenas o UUID pelo valor criado:

```sql
insert into public.staff_profiles(id,display_name,role,active)
values ('UUID-DO-USUARIO-CRIADO', 'Administrador ODONTO JARDIM', 'admin', true);
```

4. Em **Authentication**, desative novos cadastros públicos (sign-ups). O aplicativo não expõe cadastro de funcionários; autorize cada funcionário explicitamente na tabela `staff_profiles`.
5. Em **Project Settings → API**, copie a URL do projeto e a **chave publicável (publishable / anon)**. Nunca use a chave `service_role` ou chave secreta no front-end.

## Rodar no computador

Requer Node.js 20.19+ (ou 22+).

```bash
npm install
cp .env.example .env
npm run dev
```

No Windows PowerShell, em vez de `cp` pode usar `Copy-Item .env.example .env`.

Preencha `.env` com os dois valores da sua conta:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publicavel-ou-anon
```

Acesse a URL local informada pelo Vite, geralmente `http://localhost:5173`. Para compilar uma versão de produção:

```bash
npm run build
```

A pasta `dist/` resultante pode ser publicada em Vercel ou Netlify (Framework: Vite; build: `npm run build`; output: `dist`). Na hospedagem, configure também as duas variáveis `VITE_...` com os mesmos valores. É necessário executar um novo build ao alterar essas variáveis.

## Segurança, privacidade e implantação

**IMPORTANTE:** estamos lidando com dados pessoais e de saúde. Antes de cadastrar pacientes reais, valide o ambiente com dados fictícios, faça uma revisão de segurança e adequação à LGPD, estabeleça controle de acesso para cada funcionário e procedimentos de backup/recuperação.

- O acesso aos dados só é permitido a usuários autenticados com `staff_profiles.active = true` pela Row-Level Security (RLS). Não há leitura pública.
- Nome do paciente é travado por gatilho PostgreSQL. Tratamentos finalizados ficam imutáveis por gatilho e política RLS.
- Pagamentos são somente inseridos e consultados, sem exclusão/alteração comum. Para corrigir lançamento equivocado, deverá existir um procedimento administrativo de estorno e reconciliação; não altere pagamentos diretamente em produção.
- A trilha `treatment_audit` registra atualizações, com antes/depois. Trate o acesso a esses dados como informação confidencial.
- O aplicativo encerra a sessão após 20 minutos sem interação **na aba ativa**; o servidor deve aplicar políticas de sessão, MFA e controles adicionais de acesso adequados. Em dispositivos compartilhados, sempre saia da conta.
- Use HTTPS no domínio publicado. Não exponha arquivos `.env`, chaves secretas, senhas de banco ou tokens de `service_role`.
- O cálculo e os relatórios atuais carregam os registros do banco em páginas. Para dezenas de milhares de pacientes/pagamentos, implemente filtros e agregações no servidor, respeitando RLS, para obter melhor desempenho.
- Este projeto cobre a gestão solicitada, mas **não é um prontuário eletrônico regulamentado**, nem contempla assinatura de documentos clínicos, receitas, guarda de radiografias ou exigências profissionais específicas de prontuário e retenção.

## Estrutura

```text
odonto-jardim/
  index.html
  package.json
  .env.example
  src/
    App.tsx           navegação, login, dados e operações
    components.tsx    agenda, cadastro, pacientes, pagamentos e financeiro
    helpers.ts       formatação, odontograma, demonstração
    style.css        visual responsivo e navegação mobile
    supabase.ts      cliente de API Supabase
    types.ts         tipos do banco e do front-end
  supabase/migrations/
    202611060001_initial.sql
```

## Limitações desta entrega

O pacote inclui todos os **arquivos de implementação**, mas a migração deve ser executada em um projeto Supabase específico, com acesso autorizado ao projeto. Não há confirmação de implantação ou teste funcional contra um banco real nesta entrega. Uma revisão de produção, incluindo testes de permissões com dois usuários e processos de backup, é necessária antes de utilizar dados sensíveis.

## Projeto Supabase conectado em 07/11/2026

O projeto ODONTO JARDIM foi criado em sa-east-1 e as tabelas foram aplicadas diretamente. O arquivo `.env` já contém a URL e a chave **publicável** do novo projeto. Não inclui nenhum segredo administrativo.

Antes de usar: crie o primeiro funcionário em Supabase Authentication > Users e depois adicione o UUID à tabela `staff_profiles` com role `admin` (conforme `supabase/primeiro-admin.sql`). Desative cadastro público no Auth; o aplicativo não registra usuários por conta própria. Sem funcionário autorizado o login não libera os dados. Faça testes de ponta a ponta antes de registrar dados reais de saúde.

## Atualização de 08/11/2026: exclusão e edição de situação de pagamento

Os novos controles são exibidos na ficha do paciente para funcionários com perfil `admin`. **Excluir pedido** e **Excluir cliente** são arquivamentos lógicos, com confirmação explícita; não apagam pagamentos ou dados históricos. A agenda e a lista de clientes ocultam os registros arquivados, enquanto o financeiro conserva o histórico.

**Editar situação do pagamento** permite mudar entre Pendente, Parcial e Pago em pedidos ainda não finalizados. O sistema registra ajustes positivos ou negativos na tabela append-only `payment_adjustments`, sempre com motivo, sem modificar nem apagar pagamentos originais. A posição financeira líquida é recalculada após cada ajuste.

O Supabase original foi atualizado diretamente em 08/11/2026 com a migração `supabase/migrations/202611080001_archive_and_payment_corrections.sql`. Não reexecute em produção sem revisão. Testes transacionais das RPCs passaram e foram revertidos; não houve exclusão de registros existentes. É necessário testar em navegador com dados fictícios após publicação.
