# App de Gestão Acadêmica/Financeira — Seminário Teológico

## Objetivo

Construir um app web para um seminário teológico (~200 alunos) com três perfis de acesso — Aluno, Pedagógico, Financeiro (master) — cobrindo matrícula, disciplinas, cobrança recorrente via Pix, e solicitações acadêmicas com fluxo de assinatura. Orçamento mensal alvo: até R$300 (idealmente próximo de zero fora de taxas de transação Pix). Construção conduzida pelo usuário em conjunto com Claude Code.

## Contexto e restrições

- Instituição já usa Google Workspace (será usado para SSO do financeiro/pedagógico, não como banco de dados).
- Primeira vez configurando cobrança automática — nenhum provedor de pagamento pré-existente.
- Time de desenvolvimento: o usuário + Claude Code. Sem orçamento para ferramentas no-code pagas ou serviços com mensalidade alta.
- Seminário Teológico Nazareno do Brasil | Polo Recife — Os polos sao independentes. O sistema atende apenas 1 polo do STNB que é o STNB polo recife.

## Arquitetura

- **Frontend + Backend**: Next.js (App Router), hospedado no Vercel (free tier).
- **Banco de dados**: PostgreSQL via Supabase (free tier), com Row Level Security (RLS) como camada extra de isolamento por papel/aluno.
- **Autenticação**:
  - Alunos: Firebase Auth (email/senha).
  - Pedagógico e Financeiro: Google OAuth restrito ao domínio do Google Workspace do seminário.
- **Pagamentos**: Asaas (Pix Cobrança via API) — sem mensalidade fixa, só taxa por transação paga.
- **Geração de PDF**: biblioteca própria no app (`@react-pdf/renderer` ou `pdf-lib`), sem serviço externo pago.
- **E-mail transacional**: Gmail API (via Google Workspace já existente).
- **Armazenamento de documentos**: Google Drive API — cada aluno tem uma pasta dedicada (ver Modelo de Dados / RA).

Custo de infraestrutura fixa é praticamente zero; o único custo variável real é a taxa por transação Pix no Asaas, dentro do orçamento de R$300/mês.

## Modelo de dados (entidades principais)

- **Usuário** (base): tipo (aluno / pedagógico / financeiro), vinculado ao provedor de auth correspondente (Firebase ou Google OAuth).
- **Aluno**: RA (Registro do Aluno), dados pessoais, Polo (ex: Recife), status por disciplina (ativo, trancado, cancelado, concluído), situação de matrícula anual.
  - **RA**: gerado uma única vez, na primeira Matrícula do aluno — nunca muda (mesmo em caso de transferência de polo).
  - Ao gerar o RA, o sistema cria automaticamente uma pasta no Google Drive nomeada `RA - Nome do Aluno`. Todo upload de documento feito pelo aluno no sistema (identidade, comprovante de residência, documentos assinados, etc.) é salvo nessa pasta via Google Drive API.
- **Disciplina**: nome, valor mensal, trimestre/período de oferta, pré-requisitos (se houver).
- **Matriz Curricular**: lista das disciplinas do curso do aluno + status de cada uma (cursando, aprovado, reprovado, pendente) — funciona como o "boletim", embutido em cada disciplina.
- **Matrícula** (anual): confirmação de vínculo do aluno naquele ano. Sem isso, nenhum outro fluxo é liberado.
- **Documento Anual Obrigatório** (2 tipos: Formulário de Prática Ministerial, Recomendação Pastoral): por aluno, por ano. Segue o mesmo padrão do Trancamento (form → geração do documento → assinatura do pastor → upload do assinado → aprovação). Tarefa de aprovação é do Pedagógico (Financeiro também pode aprovar, por ter acesso total). Sem os dois aprovados no ano corrente, a Inscrição fica bloqueada.
- **Inscrição** (trimestral): disciplinas escolhidas pelo aluno naquele trimestre. Ao confirmar, o sistema soma o valor das disciplinas → define a mensalidade do trimestre. Só disponível quando o período está aberto e o aluno atende a todos os pré-requisitos de liberação (ver Fluxos).
- **Cobrança/Pagamento**: uma cobrança mensal por aluno, gerada automaticamente a partir da Inscrição ativa, com status (pendente, pago, atrasado) e código Pix (via Asaas).
- **Solicitação Acadêmica**: tipo (Declaração de Vínculo, Matriz Curricular Atualizada, Trancamento, Cancelamento, Certificado de Conclusão, Transferência de Polo — entrada/saída, Outros), status, e documento anexo (PDF gerado automaticamente para os tipos automáticos, ou upload de documento assinado para os demais).

## Papéis e permissões

- **Financeiro (master)**: acesso total — vê e edita tudo (acadêmico + financeiro), incluindo ações críticas como excluir aluno.
- **Pedagógico**: acesso completo ao lado acadêmico (disciplinas, notas, matriz curricular, inscrições, solicitações, aprovação dos documentos anuais). **Sem** visibilidade de dados financeiros. **Sem** poder de executar ações críticas (ex: excluir aluno) sem autorização do financeiro.
- **Aluno**: acesso restrito ao próprio perfil e dados — nunca aos dados de outro aluno.

V1 usa papéis fixos (financeiro / pedagógico / aluno). Permissões configuráveis (financeiro ligando/desligando funções específicas do pedagógico) fica como evolução futura (V2), para não adicionar a complexidade de um editor de permissões antes de validar o essencial.

Aplicação em duas camadas: toda rota de API valida o papel do usuário autenticado antes de liberar dado ou ação; Row Level Security no Postgres/Supabase garante isolamento de dados mesmo em caso de bug no backend.

## Fluxos de negócio

**Matrícula (anual)** → aparece no perfil do aluno somente se ele ainda não confirmou vínculo naquele ano.

**Documentos anuais obrigatórios** → aluno preenche dados → sistema gera o documento → e-mail para assinatura do pastor → aluno faz upload do assinado → Pedagógico (ou Financeiro) aprova. Sem essa aprovação no ano corrente, a Inscrição fica bloqueada.

**Inscrição (trimestral)** → só disponível quando Pedagógico/Financeiro abre o período. Requisitos para o aluno se inscrever: (1) matrícula do ano em dia, (2) os 2 documentos anuais aprovados, (3) nenhuma pendência financeira do trimestre anterior. Ao confirmar, o sistema calcula a mensalidade (soma das disciplinas escolhidas).

**Cobrança automática (Pix)** → mensalmente (todo dia 10), o sistema gera uma cobrança Pix via Asaas no valor da mensalidade vigente, para todo aluno com Inscrição ativa. Pagamento em atraso bloqueia a próxima Inscrição — não bloqueia a disciplina em andamento.

**Confirmação de dados antes de gerar PDF** → regra vale para todo documento gerado pelo sistema (Declaração de Vínculo, Matriz Curricular Atualizada, Trancamento/Cancelamento, documentos anuais): antes de gerar o PDF, o sistema mostra ao aluno os dados que serão usados e pergunta se estão corretos. Se o aluno editar algum dado nessa etapa, o sistema pergunta se a alteração deve **também** ser salva no perfil dele (ou seja, se é uma correção permanente do cadastro, ou só vale para aquele documento específico).

**Solicitações Acadêmicas**:
- Declaração de Vínculo e Matriz Curricular Atualizada: PDF gerado automaticamente pelo sistema, após a confirmação de dados descrita acima.
- Trancamento / Cancelamento: o sistema preenche os dados e o aluno verifica e autoriza ou edita caso esteja errado (mesma confirmação de dados) → sistema gera termo de ciência → e-mail para aluno, pastor titular, financeiro e pedagógico, solicitando assinatura do pastor titular → upload do documento assinado no sistema.
- Certificado de Conclusão e Transferência de Polo: pedido com prazo e acompanhamento via notificação — detalhes finos do fluxo a definir (ver Itens em aberto).
- Outros: campo livre, tratado caso a caso pelo Pedagógico.

## Fases de implementação

1. **Fundação** — autenticação (Firebase Auth + Google OAuth), modelo de dados no Supabase, geração de RA + criação automática da pasta no Google Drive, fluxo de Matrícula anual.
2. **Acadêmico** — Disciplinas, Matriz Curricular, Inscrição trimestral com regras de bloqueio.
3. **Financeiro** — integração Asaas, geração automática de Pix mensal, status pago/atrasado, bloqueio de inscrição por pendência.
4. **Solicitações e Documentos** — PDFs automáticos, fluxo de assinatura (Trancamento, Cancelamento, documentos anuais), pedidos simples (Certificado, Transferência, Outros).
5. **Acabamento** — revisão de permissões/segurança (RLS), painéis financeiro/pedagógico com visão consolidada.

## Estratégia de testes

Testes automatizados concentrados no que envolve dinheiro e regras de bloqueio: cálculo de mensalidade, geração de cobrança, lógica de liberação/bloqueio de Inscrição — áreas onde um bug é caro e silencioso. Fluxos de tela/navegação são validados manualmente no navegador durante a construção, dado o tamanho da equipe (2 pessoas).

## Itens em aberto

- **Certificado de Conclusão** e **Transferência de Polo** (entrada/saída do Polo Recife): fluxo exato ainda não definido pelo usuário. Modelado por ora como solicitação com prazo e notificação de tarefa pendente; refinar antes da Fase 4.
- **Sem suporte multi-polo**: o sistema atende exclusivamente o STNB Polo Recife. Os polos são independentes entre si — não há gestão de outros polos dentro deste sistema. "Transferência de Polo" é apenas o registro de entrada/saída de um aluno em relação a este polo específico.
- **Permissões configuráveis** por função (Financeiro ligando/desligando o que o Pedagógico pode fazer): adiado para V2, fora do escopo desta primeira construção.
