# Fase 2 (Acadêmico) — Disciplinas, Matriz Curricular e Inscrição

## Objetivo

Construir a Fase 2 do app do Seminário (STNB Polo Recife): gestão de Disciplinas, a Matriz Curricular do curso, lançamento de notas com aprovação automática, o planejamento anual de ofertas por trimestre, e o fluxo de Inscrição do aluno com janelas de tempo automáticas por disciplina. Constrói sobre a Fase 1 (Fundação), já mesclada em `main`, reutilizando `getCurrentUser()`, o modelo de Aluno/Usuário e o padrão de acesso via `supabaseAdmin` no servidor.

## Contexto e decisão de sequenciamento

O spec original (Fase 1) definia que a Inscrição só libera com: matrícula em dia + documentos anuais aprovados + sem pendência financeira. Documentos anuais (Fase 4) e pendência financeira (Fase 3) ainda não existem. Decisão tomada nesta conversa: **manter a ordem original das fases** — a Fase 2 implementa a Inscrição com matrícula e pré-requisitos ativos, e as duas checagens restantes ficam como "sempre liberado" (checagem que sempre retorna verdadeiro) até as Fases 3 e 4 existirem. A validação é desenhada como uma lista de regras de liberação, para que plugar as duas checagens futuras seja apenas adicionar mais uma regra à lista, não reescrever a lógica.

## Modelo de dados (novo/estendido sobre a Fase 1)

- **Configuração Acadêmica** (registro único global): `media_minima` (padrão 7.0) e `janela_inscricao_dias` (padrão 20). Edição restrita ao financeiro.
- **Disciplina**: nome, valor mensal, pré-requisito(s) (referência a outra Disciplina, opcional). Não guarda mais trimestre/período fixo — isso passa a viver em Oferta, já que a mesma disciplina pode ser ofertada em trimestres diferentes ao longo dos anos.
- **Oferta** (nova): liga uma Disciplina a um ano+trimestre específico. Campos: `disciplina_id`, `ano`, `trimestre` (identificador livre, definido pelo pedagógico — não há um número fixo de trimestres por ano), `data_inicio_aulas`, `horario_aula` (horário fixo semanal, ex: 19h toda terça). Criada pelo pedagógico durante o planejamento anual; alterá-la depois de o planejamento estar fechado é ação crítica exclusiva do financeiro.
- **Matriz Curricular**: lista fixa e única de Disciplinas que compõem o curso (curso único confirmado — não há múltiplos cursos/matrizes no Polo Recife).
- **Progresso do Aluno**: por aluno + disciplina, guarda status (cursando/aprovado/reprovado/pendente) e as notas N1 e N2 quando cursando. É o que a Fase 1 chamava de "status dentro da disciplina" — agora explicitamente modelado com as notas.
- **Inscrição** (ajuste da Fase 1): passa a vincular o aluno a uma **Oferta** específica, não a uma Disciplina genérica.

## Notas e aprovação

Estrutura fixa: nota **N1** e nota **N2** por disciplina cursada, lançadas pelo pedagógico. O sistema calcula a média simples das duas e compara com `media_minima` da Configuração Acadêmica, definindo automaticamente o status (Aprovado/Reprovado) no Progresso do Aluno — o pedagógico não define o status manualmente. Alterar a estrutura de notas (ex.: adicionar uma N3 no futuro) ou o valor de `media_minima` são ações críticas, exclusivas do financeiro.

## Planejamento anual e janela de Inscrição

No fim do ano, o pedagógico monta o planejamento do ano seguinte: escolhe quais Disciplinas rodam em cada trimestre e define `data_inicio_aulas` e `horario_aula` de cada Oferta. Alterar esse planejamento depois de fechado é ação crítica, restrita ao financeiro.

Cada Oferta abre sua janela de inscrição automaticamente `janela_inscricao_dias` (padrão 20, editável só pelo financeiro) **antes** de `data_inicio_aulas`. Como a aula é semanal, a 2ª aula acontece 7 dias após a 1ª — a janela **fecha automaticamente 1 hora depois do horário de início dessa 2ª aula**, ou seja, em `data_inicio_aulas + 7 dias`, no instante `horario_aula + 1h`.

Na tela de Inscrição, o aluno vê as Ofertas do trimestre corrente cuja janela está aberta agora. Disciplinas com pré-requisito não cumprido aparecem na lista, porém desabilitadas, com aviso indicando qual é a pendência (o pré-requisito precisa estar com status Aprovado no Progresso do Aluno). Ao confirmar, o sistema soma o valor das Ofertas escolhidas, definindo a mensalidade do trimestre (mesma lógica de cálculo da Fase 1, agora referenciando Ofertas).

**Gate de liberação da Inscrição** (lista de regras, extensível):
1. Matrícula do ano em dia — ativo (Fase 1).
2. Pré-requisitos cumpridos — ativo (Fase 2).
3. Documentos anuais aprovados — sempre libera até a Fase 4 existir.
4. Sem pendência financeira do trimestre anterior — sempre libera até a Fase 3 existir.

## Permissões (resumo consolidado da Fase 2)

- **Pedagógico**: cria/edita Disciplinas, monta o planejamento anual (Ofertas) pela primeira vez, lança notas N1/N2, visualiza a Matriz Curricular e o progresso de qualquer aluno.
- **Financeiro**: tudo que o pedagógico faz, mais as ações críticas exclusivas — alterar planejamento anual já fechado, alterar `media_minima`, alterar `janela_inscricao_dias`, alterar a estrutura de notas.
- **Aluno**: vê a própria Matriz Curricular (com notas e status) e a tela de Inscrição com as Ofertas disponíveis no momento.

## Estratégia de testes

Testes automatizados concentrados na lógica crítica: cálculo de média/aprovação automática (N1+N2 vs. `media_minima`), abertura/fechamento automático da janela de inscrição por Oferta (incluindo o cálculo de `data_inicio_aulas + 7 dias` no `horario_aula + 1h`), bloqueio por pré-requisito não cumprido, e que as ações críticas (editar planejamento fechado, `media_minima`, `janela_inscricao_dias`) só sejam permitidas para o papel financeiro. Telas e navegação seguem validadas manualmente, como na Fase 1.

## Itens em aberto

- Número de trimestres por ano não é fixo no sistema — o pedagógico define livremente ao montar o planejamento anual.
- As checagens de documentos anuais (item 3 do gate) e pendência financeira (item 4) ficam como regras "sempre libera" até as Fases 4 e 3, respectivamente, existirem — nesse momento, cada uma vira uma nova regra na lista de liberação da Inscrição, sem alterar a estrutura existente.
