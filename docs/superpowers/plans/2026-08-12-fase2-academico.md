# Fase 2 (Acadêmico) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir Disciplinas, Matriz Curricular, lançamento de notas com aprovação automática, planejamento anual de Ofertas por trimestre, e o fluxo de Inscrição do aluno com janelas de tempo automáticas por Oferta.

**Architecture:** Extensão direta da Fase 1 (já em `main`) — mesmo padrão de Server Actions/Route Handlers autenticados via `getCurrentUser()`, acesso a dados sempre via `supabaseAdmin` (service role, nunca no cliente), RLS habilitado sem políticas (deny-by-default). Regras de acesso crítico (papel financeiro) são checadas por pequenas funções puras (`lib/auth/guards.ts`) reutilizadas em cada Server Action, e não em middleware. A liberação de Inscrição é modelada como uma lista de regras avaliadas em sequência (`lib/academico/gate-inscricao.ts`), para permitir plugar as regras de documentos anuais (Fase 4) e pendência financeira (Fase 3) mais tarde sem reescrever a lógica existente.

**Tech Stack:** Mesmo da Fase 1 — Next.js (App Router) + TypeScript, Supabase (Postgres), Vitest.

## Global Constraints

- Curso único — uma única Matriz Curricular para todos os alunos (sem múltiplos cursos).
- Notas: estrutura fixa N1 + N2, média simples comparada com `media_minima` (padrão 7.0) da Configuração Acadêmica. Status Aprovado/Reprovado é calculado automaticamente pelo sistema, nunca definido manualmente.
- Alterar a estrutura de notas, `media_minima`, `janela_inscricao_dias`, ou um planejamento anual (Ofertas) já fechado são ações críticas exclusivas do papel **financeiro**.
- Cada Oferta (Disciplina + ano + trimestre) tem sua própria `data_inicio_aulas` e `horario_aula`. A janela de inscrição de uma Oferta abre `janela_inscricao_dias` (padrão 20) antes de `data_inicio_aulas`, e fecha 1 hora depois do horário de início da 2ª aula semanal (`data_inicio_aulas + 7 dias`, no instante `horario_aula + 1h`).
- Pré-requisito não cumprido bloqueia a inscrição naquela Oferta especificamente (a disciplina aparece desabilitada com aviso).
- Gate de liberação da Inscrição (nível aluno, não por disciplina): matrícula do ano em dia (ativo) + documentos anuais aprovados (**sempre libera** até a Fase 4 existir) + sem pendência financeira (**sempre libera** até a Fase 3 existir).
- Testes automatizados priorizam regras de bloqueio/gating e cálculos (aprovação automática, janela de inscrição, gate de liberação, restrição de ações críticas ao financeiro).

---

### Task 1: Schema do banco (migration)

**Files:**
- Create: `supabase/migrations/0002_academico.sql`

**Interfaces:**
- Produces (schema): `configuracao_academica` (singleton), `disciplinas`, `ofertas`, `progresso_aluno`, `inscricoes`, `inscricao_ofertas`.

- [ ] **Step 1: Criar `supabase/migrations/0002_academico.sql`**

```sql
create table configuracao_academica (
  id integer primary key default 1,
  media_minima numeric(4,2) not null default 7.0,
  janela_inscricao_dias integer not null default 20,
  constraint configuracao_academica_singleton check (id = 1)
);

insert into configuracao_academica (id) values (1);

create table disciplinas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  valor_mensal numeric(10,2) not null,
  pre_requisito_id uuid references disciplinas(id),
  criado_em timestamptz not null default now()
);

create table ofertas (
  id uuid primary key default gen_random_uuid(),
  disciplina_id uuid not null references disciplinas(id),
  ano integer not null,
  trimestre text not null,
  data_inicio_aulas date not null,
  horario_aula time not null,
  fechado boolean not null default false,
  criado_em timestamptz not null default now()
);

create type status_progresso as enum ('cursando', 'aprovado', 'reprovado', 'pendente');

create table progresso_aluno (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references alunos(usuario_id) on delete cascade,
  disciplina_id uuid not null references disciplinas(id),
  status status_progresso not null default 'pendente',
  n1 numeric(4,2),
  n2 numeric(4,2),
  atualizado_em timestamptz not null default now(),
  unique (aluno_id, disciplina_id)
);

create table inscricoes (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references alunos(usuario_id) on delete cascade,
  ano integer not null,
  trimestre text not null,
  valor_mensalidade numeric(10,2) not null,
  confirmada_em timestamptz not null default now(),
  unique (aluno_id, ano, trimestre)
);

create table inscricao_ofertas (
  inscricao_id uuid not null references inscricoes(id) on delete cascade,
  oferta_id uuid not null references ofertas(id),
  primary key (inscricao_id, oferta_id)
);

alter table configuracao_academica enable row level security;
alter table disciplinas enable row level security;
alter table ofertas enable row level security;
alter table progresso_aluno enable row level security;
alter table inscricoes enable row level security;
alter table inscricao_ofertas enable row level security;
```

- [ ] **Step 2: Aplicar a migration no Supabase**

Abra o painel do projeto Supabase → SQL Editor → cole o conteúdo de `supabase/migrations/0002_academico.sql` → Run. (Ou `supabase db push` se o CLI estiver linkado.)
Expected: as 6 tabelas novas e o enum `status_progresso` aparecem no Table Editor sem erro, e a linha singleton de `configuracao_academica` existe com os valores padrão.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_academico.sql
git commit -m "feat: add Fase 2 academic schema (disciplinas, ofertas, progresso, inscricoes)"
```

---

### Task 2: Guards de papel

**Files:**
- Create: `lib/auth/guards.ts`
- Test: `tests/lib/auth/guards.test.ts`

**Interfaces:**
- Produces: `ehFinanceiro(papel): boolean`, `ehPedagogicoOuFinanceiro(papel): boolean` — usados por toda ação crítica das próximas tasks.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/lib/auth/guards.test.ts
import { describe, expect, it } from "vitest"
import { ehFinanceiro, ehPedagogicoOuFinanceiro } from "@/lib/auth/guards"

describe("ehFinanceiro", () => {
  it("true para financeiro", () => {
    expect(ehFinanceiro("financeiro")).toBe(true)
  })
  it("false para pedagogico e aluno", () => {
    expect(ehFinanceiro("pedagogico")).toBe(false)
    expect(ehFinanceiro("aluno")).toBe(false)
  })
})

describe("ehPedagogicoOuFinanceiro", () => {
  it("true para pedagogico e financeiro", () => {
    expect(ehPedagogicoOuFinanceiro("pedagogico")).toBe(true)
    expect(ehPedagogicoOuFinanceiro("financeiro")).toBe(true)
  })
  it("false para aluno", () => {
    expect(ehPedagogicoOuFinanceiro("aluno")).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run tests/lib/auth/guards.test.ts`
Expected: FAIL com "Cannot find module '@/lib/auth/guards'".

- [ ] **Step 3: Implementar**

```ts
// lib/auth/guards.ts
export type Papel = "aluno" | "pedagogico" | "financeiro"

export function ehFinanceiro(papel: Papel): boolean {
  return papel === "financeiro"
}

export function ehPedagogicoOuFinanceiro(papel: Papel): boolean {
  return papel === "pedagogico" || papel === "financeiro"
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run tests/lib/auth/guards.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/auth/guards.ts tests/lib/auth/guards.test.ts
git commit -m "feat: add role guard helpers"
```

---

### Task 3: Configuração Acadêmica

**Files:**
- Create: `lib/academico/configuracao.ts`
- Test: `tests/lib/academico/configuracao.test.ts`

**Interfaces:**
- Consumes: `ehFinanceiro` de `@/lib/auth/guards` (Task 2), `supabaseAdmin` de `@/lib/supabase/admin`.
- Produces: `obterConfiguracaoAcademica(): Promise<{ mediaMinima: number; janelaInscricaoDias: number }>`, `atualizarConfiguracaoAcademica(papel, campos): Promise<{ok:true}|{ok:false; erro:string}>` — usados pelas Tasks 5 (notas) e 6 (janela).

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/lib/academico/configuracao.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest"

const singleMock = vi.fn()
const eqMock = vi.fn(() => ({}))
const updateMock = vi.fn(() => ({ eq: eqMock }))

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({ single: singleMock }),
      update: updateMock,
    }),
  },
}))

describe("obterConfiguracaoAcademica", () => {
  it("retorna a configuração convertendo os campos do banco", async () => {
    singleMock.mockResolvedValueOnce({
      data: { media_minima: "7.00", janela_inscricao_dias: 20 },
      error: null,
    })
    const { obterConfiguracaoAcademica } = await import("@/lib/academico/configuracao")
    const config = await obterConfiguracaoAcademica()
    expect(config).toEqual({ mediaMinima: 7, janelaInscricaoDias: 20 })
  })
})

describe("atualizarConfiguracaoAcademica", () => {
  beforeEach(() => {
    eqMock.mockReset().mockReturnValue({ error: null })
    updateMock.mockReset().mockReturnValue({ eq: eqMock })
  })

  it("recusa quando o papel não é financeiro", async () => {
    const { atualizarConfiguracaoAcademica } = await import("@/lib/academico/configuracao")
    const resultado = await atualizarConfiguracaoAcademica("pedagogico", { mediaMinima: 8 })
    expect(resultado).toEqual({ ok: false, erro: "Apenas o financeiro pode alterar a configuração acadêmica." })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it("atualiza quando o papel é financeiro", async () => {
    const { atualizarConfiguracaoAcademica } = await import("@/lib/academico/configuracao")
    const resultado = await atualizarConfiguracaoAcademica("financeiro", { mediaMinima: 8 })
    expect(resultado).toEqual({ ok: true })
    expect(updateMock).toHaveBeenCalledWith({ media_minima: 8 })
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run tests/lib/academico/configuracao.test.ts`
Expected: FAIL com "Cannot find module '@/lib/academico/configuracao'".

- [ ] **Step 3: Implementar**

```ts
// lib/academico/configuracao.ts
import { supabaseAdmin } from "@/lib/supabase/admin"
import { ehFinanceiro, type Papel } from "@/lib/auth/guards"

export type ConfiguracaoAcademica = {
  mediaMinima: number
  janelaInscricaoDias: number
}

export async function obterConfiguracaoAcademica(): Promise<ConfiguracaoAcademica> {
  const { data, error } = await supabaseAdmin
    .from("configuracao_academica")
    .select("media_minima, janela_inscricao_dias")
    .single()

  if (error || !data) {
    throw new Error(`Falha ao carregar configuração acadêmica: ${error?.message ?? "não encontrada"}`)
  }

  return {
    mediaMinima: Number(data.media_minima),
    janelaInscricaoDias: Number(data.janela_inscricao_dias),
  }
}

export type ConfiguracaoAcademicaResult = { ok: true } | { ok: false; erro: string }

export async function atualizarConfiguracaoAcademica(
  papel: Papel,
  campos: Partial<{ mediaMinima: number; janelaInscricaoDias: number }>
): Promise<ConfiguracaoAcademicaResult> {
  if (!ehFinanceiro(papel)) {
    return { ok: false, erro: "Apenas o financeiro pode alterar a configuração acadêmica." }
  }

  const camposBanco: Record<string, number> = {}
  if (campos.mediaMinima !== undefined) camposBanco.media_minima = campos.mediaMinima
  if (campos.janelaInscricaoDias !== undefined) camposBanco.janela_inscricao_dias = campos.janelaInscricaoDias

  const { error } = await supabaseAdmin.from("configuracao_academica").update(camposBanco).eq("id", 1)

  if (error) {
    return { ok: false, erro: `Falha ao atualizar configuração acadêmica: ${error.message}` }
  }

  return { ok: true }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run tests/lib/academico/configuracao.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/academico/configuracao.ts tests/lib/academico/configuracao.test.ts
git commit -m "feat: add configuração acadêmica read/update with financeiro-only guard"
```

---

### Task 4: Disciplinas

**Files:**
- Create: `lib/academico/disciplinas.ts`
- Test: `tests/lib/academico/disciplinas.test.ts`

**Interfaces:**
- Consumes: `ehPedagogicoOuFinanceiro` de `@/lib/auth/guards` (Task 2).
- Produces: `criarDisciplina(papel, dados): Promise<{ok:true; disciplina}|{ok:false; erro}>`, `listarDisciplinas(): Promise<Disciplina[]>` — `Disciplina = { id: string; nome: string; valorMensal: number; preRequisitoId: string | null }`. Usado pela Task 6 (Ofertas) e Task 8 (gate por pré-requisito).

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/lib/academico/disciplinas.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest"

const insertSingleMock = vi.fn()
const selectMock = vi.fn()

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: () => ({
      insert: () => ({ select: () => ({ single: insertSingleMock }) }),
      select: selectMock,
    }),
  },
}))

describe("criarDisciplina", () => {
  beforeEach(() => {
    insertSingleMock.mockReset()
  })

  it("recusa quando o papel é aluno", async () => {
    const { criarDisciplina } = await import("@/lib/academico/disciplinas")
    const resultado = await criarDisciplina("aluno", { nome: "Grego I", valorMensal: 80 })
    expect(resultado).toEqual({ ok: false, erro: "Apenas pedagógico ou financeiro podem criar disciplinas." })
    expect(insertSingleMock).not.toHaveBeenCalled()
  })

  it("cria quando o papel é pedagogico", async () => {
    insertSingleMock.mockResolvedValueOnce({
      data: { id: "disc-1", nome: "Grego I", valor_mensal: "80.00", pre_requisito_id: null },
      error: null,
    })
    const { criarDisciplina } = await import("@/lib/academico/disciplinas")
    const resultado = await criarDisciplina("pedagogico", { nome: "Grego I", valorMensal: 80 })
    expect(resultado).toEqual({
      ok: true,
      disciplina: { id: "disc-1", nome: "Grego I", valorMensal: 80, preRequisitoId: null },
    })
  })
})

describe("listarDisciplinas", () => {
  it("converte as linhas do banco", async () => {
    selectMock.mockResolvedValueOnce({
      data: [{ id: "disc-1", nome: "Grego I", valor_mensal: "80.00", pre_requisito_id: null }],
      error: null,
    })
    const { listarDisciplinas } = await import("@/lib/academico/disciplinas")
    const disciplinas = await listarDisciplinas()
    expect(disciplinas).toEqual([{ id: "disc-1", nome: "Grego I", valorMensal: 80, preRequisitoId: null }])
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run tests/lib/academico/disciplinas.test.ts`
Expected: FAIL com "Cannot find module '@/lib/academico/disciplinas'".

- [ ] **Step 3: Implementar**

```ts
// lib/academico/disciplinas.ts
import { supabaseAdmin } from "@/lib/supabase/admin"
import { ehPedagogicoOuFinanceiro, type Papel } from "@/lib/auth/guards"

export type Disciplina = {
  id: string
  nome: string
  valorMensal: number
  preRequisitoId: string | null
}

type DisciplinaRow = {
  id: string
  nome: string
  valor_mensal: string | number
  pre_requisito_id: string | null
}

function converterDisciplina(linha: DisciplinaRow): Disciplina {
  return {
    id: linha.id,
    nome: linha.nome,
    valorMensal: Number(linha.valor_mensal),
    preRequisitoId: linha.pre_requisito_id,
  }
}

export type CriarDisciplinaResult = { ok: true; disciplina: Disciplina } | { ok: false; erro: string }

export async function criarDisciplina(
  papel: Papel,
  dados: { nome: string; valorMensal: number; preRequisitoId?: string | null }
): Promise<CriarDisciplinaResult> {
  if (!ehPedagogicoOuFinanceiro(papel)) {
    return { ok: false, erro: "Apenas pedagógico ou financeiro podem criar disciplinas." }
  }

  const { data, error } = await supabaseAdmin
    .from("disciplinas")
    .insert({
      nome: dados.nome,
      valor_mensal: dados.valorMensal,
      pre_requisito_id: dados.preRequisitoId ?? null,
    })
    .select("id, nome, valor_mensal, pre_requisito_id")
    .single()

  if (error || !data) {
    return { ok: false, erro: `Falha ao criar disciplina: ${error?.message ?? "erro desconhecido"}` }
  }

  return { ok: true, disciplina: converterDisciplina(data) }
}

export async function listarDisciplinas(): Promise<Disciplina[]> {
  const { data, error } = await supabaseAdmin.from("disciplinas").select("id, nome, valor_mensal, pre_requisito_id")

  if (error || !data) {
    throw new Error(`Falha ao listar disciplinas: ${error?.message ?? "erro desconhecido"}`)
  }

  return data.map(converterDisciplina)
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run tests/lib/academico/disciplinas.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/academico/disciplinas.ts tests/lib/academico/disciplinas.test.ts
git commit -m "feat: add disciplina creation and listing"
```

---

### Task 5: Janela de inscrição

**Files:**
- Create: `lib/academico/janela-inscricao.ts`
- Test: `tests/lib/academico/janela-inscricao.test.ts`

**Interfaces:**
- Produces: `calcularJanela(oferta, janelaInscricaoDias): { abreEm: Date; fechaEm: Date }`, `ofertaEstaAberta(oferta, janelaInscricaoDias, agora): boolean` onde `oferta` é `{ dataInicioAulas: string; horarioAula: string }` (`dataInicioAulas` no formato `"YYYY-MM-DD"`, `horarioAula` no formato `"HH:MM"`). Usado pelas Tasks 6 e 9.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/lib/academico/janela-inscricao.test.ts
import { describe, expect, it } from "vitest"
import { calcularJanela, ofertaEstaAberta } from "@/lib/academico/janela-inscricao"

const oferta = { dataInicioAulas: "2026-09-01", horarioAula: "19:00" }

describe("calcularJanela", () => {
  it("abre N dias antes do início e fecha 1h depois do horário da 2ª aula (início + 7 dias)", () => {
    const janela = calcularJanela(oferta, 20)
    expect(janela.abreEm.toISOString()).toBe(new Date("2026-08-12T19:00:00").toISOString())
    expect(janela.fechaEm.toISOString()).toBe(new Date("2026-09-08T20:00:00").toISOString())
  })
})

describe("ofertaEstaAberta", () => {
  it("false antes da abertura", () => {
    expect(ofertaEstaAberta(oferta, 20, new Date("2026-08-01T00:00:00"))).toBe(false)
  })

  it("true dentro da janela", () => {
    expect(ofertaEstaAberta(oferta, 20, new Date("2026-08-20T00:00:00"))).toBe(true)
  })

  it("true no instante exato de abertura", () => {
    expect(ofertaEstaAberta(oferta, 20, new Date("2026-08-12T19:00:00"))).toBe(true)
  })

  it("false no instante exato de fechamento", () => {
    expect(ofertaEstaAberta(oferta, 20, new Date("2026-09-08T20:00:00"))).toBe(false)
  })

  it("false depois do fechamento", () => {
    expect(ofertaEstaAberta(oferta, 20, new Date("2026-09-10T00:00:00"))).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run tests/lib/academico/janela-inscricao.test.ts`
Expected: FAIL com "Cannot find module '@/lib/academico/janela-inscricao'".

- [ ] **Step 3: Implementar**

```ts
// lib/academico/janela-inscricao.ts
export type OfertaParaJanela = {
  dataInicioAulas: string
  horarioAula: string
}

function dataHoraInicio(oferta: OfertaParaJanela): Date {
  const [hora, minuto] = oferta.horarioAula.split(":").map(Number)
  const data = new Date(`${oferta.dataInicioAulas}T00:00:00`)
  data.setHours(hora, minuto, 0, 0)
  return data
}

export function calcularJanela(oferta: OfertaParaJanela, janelaInscricaoDias: number): { abreEm: Date; fechaEm: Date } {
  const inicio = dataHoraInicio(oferta)

  const abreEm = new Date(inicio)
  abreEm.setDate(abreEm.getDate() - janelaInscricaoDias)

  const fechaEm = new Date(inicio)
  fechaEm.setDate(fechaEm.getDate() + 7)
  fechaEm.setHours(fechaEm.getHours() + 1)

  return { abreEm, fechaEm }
}

export function ofertaEstaAberta(oferta: OfertaParaJanela, janelaInscricaoDias: number, agora: Date): boolean {
  const { abreEm, fechaEm } = calcularJanela(oferta, janelaInscricaoDias)
  return agora.getTime() >= abreEm.getTime() && agora.getTime() < fechaEm.getTime()
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run tests/lib/academico/janela-inscricao.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/academico/janela-inscricao.ts tests/lib/academico/janela-inscricao.test.ts
git commit -m "feat: add per-oferta enrollment window calculation"
```

---

### Task 6: Ofertas (planejamento anual)

**Files:**
- Create: `lib/academico/ofertas.ts`
- Test: `tests/lib/academico/ofertas.test.ts`

**Interfaces:**
- Consumes: `ehPedagogicoOuFinanceiro`, `ehFinanceiro` de `@/lib/auth/guards` (Task 2).
- Produces: `Oferta = { id: string; disciplinaId: string; ano: number; trimestre: string; dataInicioAulas: string; horarioAula: string; fechado: boolean }`, `criarOferta(papel, dados)`, `listarOfertas(ano, trimestre): Promise<Oferta[]>`, `editarOferta(papel, ofertaId, dados)`, `fecharPlanejamento(papel, ano, trimestre)`. Usado pela Task 9 (Inscrição).

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/lib/academico/ofertas.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest"

const insertSingleMock = vi.fn()
const listarEqMock = vi.fn()
const ofertaSingleMock = vi.fn()
const editarEqChainMock = vi.fn()
const fecharEqChainMock = vi.fn()

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (tabela: string) => {
      if (tabela !== "ofertas") throw new Error(`tabela inesperada: ${tabela}`)
      return {
        insert: () => ({ select: () => ({ single: insertSingleMock }) }),
        select: (colunas: string) => {
          if (colunas === "fechado") return { eq: () => ({ single: ofertaSingleMock }) }
          return { eq: () => ({ eq: listarEqMock }) }
        },
        update: (campos: Record<string, unknown>) => ({
          eq: (coluna: string, valor: unknown) => {
            if (coluna === "id") return editarEqChainMock(campos, valor)
            return { eq: () => fecharEqChainMock(campos) }
          },
        }),
      }
    },
  },
}))

describe("criarOferta", () => {
  it("recusa quando o papel é aluno", async () => {
    const { criarOferta } = await import("@/lib/academico/ofertas")
    const resultado = await criarOferta("aluno", {
      disciplinaId: "disc-1",
      ano: 2027,
      trimestre: "1",
      dataInicioAulas: "2027-02-01",
      horarioAula: "19:00",
    })
    expect(resultado.ok).toBe(false)
    expect(insertSingleMock).not.toHaveBeenCalled()
  })

  it("cria quando o papel é pedagogico", async () => {
    insertSingleMock.mockResolvedValueOnce({
      data: {
        id: "oferta-1",
        disciplina_id: "disc-1",
        ano: 2027,
        trimestre: "1",
        data_inicio_aulas: "2027-02-01",
        horario_aula: "19:00:00",
        fechado: false,
      },
      error: null,
    })
    const { criarOferta } = await import("@/lib/academico/ofertas")
    const resultado = await criarOferta("pedagogico", {
      disciplinaId: "disc-1",
      ano: 2027,
      trimestre: "1",
      dataInicioAulas: "2027-02-01",
      horarioAula: "19:00",
    })
    expect(resultado).toEqual({
      ok: true,
      oferta: {
        id: "oferta-1",
        disciplinaId: "disc-1",
        ano: 2027,
        trimestre: "1",
        dataInicioAulas: "2027-02-01",
        horarioAula: "19:00:00",
        fechado: false,
      },
    })
  })
})

describe("editarOferta", () => {
  beforeEach(() => {
    ofertaSingleMock.mockReset()
    editarEqChainMock.mockReset().mockReturnValue({ error: null })
  })

  it("permite pedagogico editar oferta não fechada", async () => {
    ofertaSingleMock.mockResolvedValueOnce({ data: { fechado: false }, error: null })
    const { editarOferta } = await import("@/lib/academico/ofertas")
    const resultado = await editarOferta("pedagogico", "oferta-1", { dataInicioAulas: "2027-02-05" })
    expect(resultado).toEqual({ ok: true })
  })

  it("recusa pedagogico editar oferta já fechada", async () => {
    ofertaSingleMock.mockResolvedValueOnce({ data: { fechado: true }, error: null })
    const { editarOferta } = await import("@/lib/academico/ofertas")
    const resultado = await editarOferta("pedagogico", "oferta-1", { dataInicioAulas: "2027-02-05" })
    expect(resultado).toEqual({
      ok: false,
      erro: "Este planejamento já está fechado — apenas o financeiro pode alterá-lo.",
    })
    expect(editarEqChainMock).not.toHaveBeenCalled()
  })

  it("permite financeiro editar oferta já fechada", async () => {
    ofertaSingleMock.mockResolvedValueOnce({ data: { fechado: true }, error: null })
    const { editarOferta } = await import("@/lib/academico/ofertas")
    const resultado = await editarOferta("financeiro", "oferta-1", { dataInicioAulas: "2027-02-05" })
    expect(resultado).toEqual({ ok: true })
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run tests/lib/academico/ofertas.test.ts`
Expected: FAIL com "Cannot find module '@/lib/academico/ofertas'".

- [ ] **Step 3: Implementar**

```ts
// lib/academico/ofertas.ts
import { supabaseAdmin } from "@/lib/supabase/admin"
import { ehFinanceiro, ehPedagogicoOuFinanceiro, type Papel } from "@/lib/auth/guards"

export type Oferta = {
  id: string
  disciplinaId: string
  ano: number
  trimestre: string
  dataInicioAulas: string
  horarioAula: string
  fechado: boolean
}

type OfertaRow = {
  id: string
  disciplina_id: string
  ano: number
  trimestre: string
  data_inicio_aulas: string
  horario_aula: string
  fechado: boolean
}

function converterOferta(linha: OfertaRow): Oferta {
  return {
    id: linha.id,
    disciplinaId: linha.disciplina_id,
    ano: linha.ano,
    trimestre: linha.trimestre,
    dataInicioAulas: linha.data_inicio_aulas,
    horarioAula: linha.horario_aula,
    fechado: linha.fechado,
  }
}

export type OfertaResult = { ok: true; oferta: Oferta } | { ok: false; erro: string }
export type OfertaAcaoResult = { ok: true } | { ok: false; erro: string }

export async function criarOferta(
  papel: Papel,
  dados: { disciplinaId: string; ano: number; trimestre: string; dataInicioAulas: string; horarioAula: string }
): Promise<OfertaResult> {
  if (!ehPedagogicoOuFinanceiro(papel)) {
    return { ok: false, erro: "Apenas pedagógico ou financeiro podem criar ofertas." }
  }

  const { data, error } = await supabaseAdmin
    .from("ofertas")
    .insert({
      disciplina_id: dados.disciplinaId,
      ano: dados.ano,
      trimestre: dados.trimestre,
      data_inicio_aulas: dados.dataInicioAulas,
      horario_aula: dados.horarioAula,
    })
    .select("id, disciplina_id, ano, trimestre, data_inicio_aulas, horario_aula, fechado")
    .single()

  if (error || !data) {
    return { ok: false, erro: `Falha ao criar oferta: ${error?.message ?? "erro desconhecido"}` }
  }

  return { ok: true, oferta: converterOferta(data) }
}

export async function listarOfertas(ano: number, trimestre: string): Promise<Oferta[]> {
  const { data, error } = await supabaseAdmin
    .from("ofertas")
    .select("id, disciplina_id, ano, trimestre, data_inicio_aulas, horario_aula, fechado")
    .eq("ano", ano)
    .eq("trimestre", trimestre)

  if (error || !data) {
    throw new Error(`Falha ao listar ofertas: ${error?.message ?? "erro desconhecido"}`)
  }

  return data.map(converterOferta)
}

export async function editarOferta(
  papel: Papel,
  ofertaId: string,
  dados: Partial<{ dataInicioAulas: string; horarioAula: string }>
): Promise<OfertaAcaoResult> {
  const { data: ofertaAtual, error: buscaError } = await supabaseAdmin
    .from("ofertas")
    .select("fechado")
    .eq("id", ofertaId)
    .single()

  if (buscaError || !ofertaAtual) {
    return { ok: false, erro: `Oferta não encontrada: ${buscaError?.message ?? ofertaId}` }
  }

  if (ofertaAtual.fechado && !ehFinanceiro(papel)) {
    return { ok: false, erro: "Este planejamento já está fechado — apenas o financeiro pode alterá-lo." }
  }

  const camposBanco: Record<string, string> = {}
  if (dados.dataInicioAulas !== undefined) camposBanco.data_inicio_aulas = dados.dataInicioAulas
  if (dados.horarioAula !== undefined) camposBanco.horario_aula = dados.horarioAula

  const { error } = await supabaseAdmin.from("ofertas").update(camposBanco).eq("id", ofertaId)

  if (error) {
    return { ok: false, erro: `Falha ao editar oferta: ${error.message}` }
  }

  return { ok: true }
}

export async function fecharPlanejamento(papel: Papel, ano: number, trimestre: string): Promise<OfertaAcaoResult> {
  if (!ehPedagogicoOuFinanceiro(papel)) {
    return { ok: false, erro: "Apenas pedagógico ou financeiro podem fechar o planejamento." }
  }

  const { error } = await supabaseAdmin
    .from("ofertas")
    .update({ fechado: true })
    .eq("ano", ano)
    .eq("trimestre", trimestre)

  if (error) {
    return { ok: false, erro: `Falha ao fechar planejamento: ${error.message}` }
  }

  return { ok: true }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run tests/lib/academico/ofertas.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/academico/ofertas.ts tests/lib/academico/ofertas.test.ts
git commit -m "feat: add oferta creation, listing, and closed-plan edit guard"
```

---

### Task 7: Progresso do aluno e lançamento de notas

**Files:**
- Create: `lib/academico/notas.ts`
- Test: `tests/lib/academico/notas.test.ts`

**Interfaces:**
- Consumes: `ehPedagogicoOuFinanceiro` de `@/lib/auth/guards` (Task 2), `obterConfiguracaoAcademica` de `@/lib/academico/configuracao` (Task 3).
- Produces: `calcularAprovacao(n1, n2, mediaMinima): { status: "aprovado" | "reprovado"; media: number }`, `lancarNotas(papel, alunoId, disciplinaId, n1, n2): Promise<{ok:true; resultado}|{ok:false; erro}>`. Usado pela Task 8 (gate por pré-requisito consulta `progresso_aluno.status`).

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/lib/academico/notas.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest"
import { calcularAprovacao } from "@/lib/academico/notas"

describe("calcularAprovacao", () => {
  it("aprovado quando a média é igual à mínima", () => {
    expect(calcularAprovacao(7, 7, 7)).toEqual({ status: "aprovado", media: 7 })
  })

  it("aprovado quando a média é maior que a mínima", () => {
    expect(calcularAprovacao(9, 8, 7)).toEqual({ status: "aprovado", media: 8.5 })
  })

  it("reprovado quando a média é menor que a mínima", () => {
    expect(calcularAprovacao(5, 6, 7)).toEqual({ status: "reprovado", media: 5.5 })
  })
})

const obterConfiguracaoAcademicaMock = vi.fn()
const upsertMock = vi.fn()

vi.mock("@/lib/academico/configuracao", () => ({
  obterConfiguracaoAcademica: obterConfiguracaoAcademicaMock,
}))

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: () => ({ upsert: upsertMock }),
  },
}))

describe("lancarNotas", () => {
  beforeEach(() => {
    obterConfiguracaoAcademicaMock.mockReset().mockResolvedValue({ mediaMinima: 7, janelaInscricaoDias: 20 })
    upsertMock.mockReset().mockResolvedValue({ error: null })
  })

  it("recusa quando o papel é aluno", async () => {
    const { lancarNotas } = await import("@/lib/academico/notas")
    const resultado = await lancarNotas("aluno", "aluno-1", "disc-1", 8, 9)
    expect(resultado.ok).toBe(false)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it("lança as notas e grava o status calculado quando o papel é pedagogico", async () => {
    const { lancarNotas } = await import("@/lib/academico/notas")
    const resultado = await lancarNotas("pedagogico", "aluno-1", "disc-1", 8, 9)
    expect(resultado).toEqual({ ok: true, resultado: { status: "aprovado", media: 8.5 } })
    expect(upsertMock).toHaveBeenCalledWith(
      { aluno_id: "aluno-1", disciplina_id: "disc-1", n1: 8, n2: 9, status: "aprovado" },
      { onConflict: "aluno_id,disciplina_id" }
    )
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run tests/lib/academico/notas.test.ts`
Expected: FAIL com "Cannot find module '@/lib/academico/notas'".

- [ ] **Step 3: Implementar**

```ts
// lib/academico/notas.ts
import { supabaseAdmin } from "@/lib/supabase/admin"
import { obterConfiguracaoAcademica } from "@/lib/academico/configuracao"
import { ehPedagogicoOuFinanceiro, type Papel } from "@/lib/auth/guards"

export type ResultadoNota = { status: "aprovado" | "reprovado"; media: number }

export function calcularAprovacao(n1: number, n2: number, mediaMinima: number): ResultadoNota {
  const media = (n1 + n2) / 2
  return { status: media >= mediaMinima ? "aprovado" : "reprovado", media }
}

export type LancarNotasResult = { ok: true; resultado: ResultadoNota } | { ok: false; erro: string }

export async function lancarNotas(
  papel: Papel,
  alunoId: string,
  disciplinaId: string,
  n1: number,
  n2: number
): Promise<LancarNotasResult> {
  if (!ehPedagogicoOuFinanceiro(papel)) {
    return { ok: false, erro: "Apenas pedagógico ou financeiro podem lançar notas." }
  }

  const { mediaMinima } = await obterConfiguracaoAcademica()
  const resultado = calcularAprovacao(n1, n2, mediaMinima)

  const { error } = await supabaseAdmin
    .from("progresso_aluno")
    .upsert(
      { aluno_id: alunoId, disciplina_id: disciplinaId, n1, n2, status: resultado.status },
      { onConflict: "aluno_id,disciplina_id" }
    )

  if (error) {
    return { ok: false, erro: `Falha ao lançar notas: ${error.message}` }
  }

  return { ok: true, resultado }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run tests/lib/academico/notas.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/academico/notas.ts tests/lib/academico/notas.test.ts
git commit -m "feat: add automatic grade approval calculation and lançamento de notas"
```

---

### Task 8: Gate de liberação da Inscrição

**Files:**
- Create: `lib/academico/gate-inscricao.ts`
- Test: `tests/lib/academico/gate-inscricao.test.ts`

**Interfaces:**
- Consumes: `supabaseAdmin` de `@/lib/supabase/admin`.
- Produces: `avaliarGateInscricao(alunoId): Promise<{ liberado: boolean; motivo?: string }>`. Usado pela Task 9.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/lib/academico/gate-inscricao.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest"

const maybeSingleMock = vi.fn()

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }) }),
    }),
  },
}))

describe("avaliarGateInscricao", () => {
  beforeEach(() => {
    maybeSingleMock.mockReset()
  })

  it("bloqueia quando a matrícula do ano não existe", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null })
    const { avaliarGateInscricao } = await import("@/lib/academico/gate-inscricao")
    const resultado = await avaliarGateInscricao("aluno-1")
    expect(resultado).toEqual({ liberado: false, motivo: "Matrícula do ano ainda não confirmada." })
  })

  it("libera quando a matrícula do ano existe (documentos e pendência ainda não implementados nesta fase)", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { id: "matricula-1" } })
    const { avaliarGateInscricao } = await import("@/lib/academico/gate-inscricao")
    const resultado = await avaliarGateInscricao("aluno-1")
    expect(resultado).toEqual({ liberado: true })
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run tests/lib/academico/gate-inscricao.test.ts`
Expected: FAIL com "Cannot find module '@/lib/academico/gate-inscricao'".

- [ ] **Step 3: Implementar**

```ts
// lib/academico/gate-inscricao.ts
import { supabaseAdmin } from "@/lib/supabase/admin"

export type ResultadoGate = { liberado: boolean; motivo?: string }

type RegraGate = {
  verificar: (alunoId: string) => Promise<boolean>
  motivo: string
}

async function matriculaEmDia(alunoId: string): Promise<boolean> {
  const ano = new Date().getFullYear()
  const { data } = await supabaseAdmin
    .from("matriculas")
    .select("id")
    .eq("aluno_id", alunoId)
    .eq("ano", ano)
    .maybeSingle()

  return Boolean(data)
}

// Fase 3 (Financeiro) vai substituir esta regra por uma checagem real de pendência.
async function semPendenciaFinanceira(_alunoId: string): Promise<boolean> {
  return true
}

// Fase 4 (Solicitações) vai substituir esta regra por uma checagem real dos documentos anuais.
async function documentosAnuaisAprovados(_alunoId: string): Promise<boolean> {
  return true
}

const REGRAS: RegraGate[] = [
  { verificar: matriculaEmDia, motivo: "Matrícula do ano ainda não confirmada." },
  { verificar: documentosAnuaisAprovados, motivo: "Documentos anuais obrigatórios ainda não aprovados." },
  { verificar: semPendenciaFinanceira, motivo: "Existe pendência financeira do trimestre anterior." },
]

export async function avaliarGateInscricao(alunoId: string): Promise<ResultadoGate> {
  for (const regra of REGRAS) {
    const passou = await regra.verificar(alunoId)
    if (!passou) {
      return { liberado: false, motivo: regra.motivo }
    }
  }

  return { liberado: true }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run tests/lib/academico/gate-inscricao.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/academico/gate-inscricao.ts tests/lib/academico/gate-inscricao.test.ts
git commit -m "feat: add extensible enrollment gate (matrícula active, docs/pendência stubbed for later phases)"
```

---

### Task 9: Fluxo de Inscrição

**Files:**
- Create: `app/aluno/inscricao/actions.ts`
- Create: `app/aluno/inscricao/page.tsx`
- Test: `tests/app/aluno/inscricao/actions.test.ts`

**Interfaces:**
- Consumes: `getCurrentUser` de `@/lib/auth/current-user`, `avaliarGateInscricao` de `@/lib/academico/gate-inscricao` (Task 8), `ofertaEstaAberta` de `@/lib/academico/janela-inscricao` (Task 5), `obterConfiguracaoAcademica` de `@/lib/academico/configuracao` (Task 3), `supabaseAdmin` (a query de ofertas já traz os dados de disciplina via join, sem precisar de `listarDisciplinas`).
- Produces: `confirmarInscricao(ofertaIds: string[]): Promise<{ok:true; valorMensalidade:number}|{ok:false; erro:string}>`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/app/aluno/inscricao/actions.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest"

const getCurrentUserMock = vi.fn()
const avaliarGateInscricaoMock = vi.fn()
const obterConfiguracaoAcademicaMock = vi.fn()
const ofertasSelectMock = vi.fn()
const progressoSelectMock = vi.fn()
const inscricaoInsertSingleMock = vi.fn()
const inscricaoOfertasInsertMock = vi.fn()
const progressoUpsertMock = vi.fn()

vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock("@/lib/academico/gate-inscricao", () => ({ avaliarGateInscricao: avaliarGateInscricaoMock }))
vi.mock("@/lib/academico/configuracao", () => ({ obterConfiguracaoAcademica: obterConfiguracaoAcademicaMock }))

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (tabela: string) => {
      if (tabela === "ofertas") return { select: () => ({ in: ofertasSelectMock }) }
      if (tabela === "progresso_aluno") {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: progressoSelectMock }) }) }),
          upsert: progressoUpsertMock,
        }
      }
      if (tabela === "inscricoes") return { insert: () => ({ select: () => ({ single: inscricaoInsertSingleMock }) }) }
      if (tabela === "inscricao_ofertas") return { insert: inscricaoOfertasInsertMock }
      throw new Error(`tabela inesperada: ${tabela}`)
    },
  },
}))

const ofertaMatematica = {
  id: "oferta-1",
  disciplina_id: "disc-1",
  ano: 2027,
  trimestre: "1",
  data_inicio_aulas: "2027-02-01",
  horario_aula: "19:00:00",
  fechado: true,
  disciplinas: { valor_mensal: "80.00", pre_requisito_id: null },
}

describe("confirmarInscricao", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    avaliarGateInscricaoMock.mockReset()
    obterConfiguracaoAcademicaMock.mockReset().mockResolvedValue({ mediaMinima: 7, janelaInscricaoDias: 20 })
    ofertasSelectMock.mockReset()
    progressoSelectMock.mockReset().mockResolvedValue({ data: null })
    inscricaoInsertSingleMock.mockReset()
    inscricaoOfertasInsertMock.mockReset().mockResolvedValue({ error: null })
    progressoUpsertMock.mockReset().mockResolvedValue({ error: null })
  })

  it("recusa quando não há usuário autenticado como aluno", async () => {
    getCurrentUserMock.mockResolvedValueOnce(null)
    const { confirmarInscricao } = await import("@/app/aluno/inscricao/actions")
    const resultado = await confirmarInscricao(["oferta-1"])
    expect(resultado).toEqual({ ok: false, erro: "Não autenticado como aluno." })
  })

  it("recusa quando o gate de inscrição bloqueia", async () => {
    getCurrentUserMock.mockResolvedValueOnce({ usuarioId: "aluno-1", papel: "aluno", email: "a@a.com" })
    avaliarGateInscricaoMock.mockResolvedValueOnce({ liberado: false, motivo: "Matrícula do ano ainda não confirmada." })
    const { confirmarInscricao } = await import("@/app/aluno/inscricao/actions")
    const resultado = await confirmarInscricao(["oferta-1"])
    expect(resultado).toEqual({ ok: false, erro: "Matrícula do ano ainda não confirmada." })
  })

  it("recusa quando uma oferta está fora da janela de inscrição", async () => {
    getCurrentUserMock.mockResolvedValueOnce({ usuarioId: "aluno-1", papel: "aluno", email: "a@a.com" })
    avaliarGateInscricaoMock.mockResolvedValueOnce({ liberado: true })
    ofertasSelectMock.mockResolvedValueOnce({
      data: [{ ...ofertaMatematica, data_inicio_aulas: "2020-01-01" }],
      error: null,
    })
    const { confirmarInscricao } = await import("@/app/aluno/inscricao/actions")
    const resultado = await confirmarInscricao(["oferta-1"])
    expect(resultado.ok).toBe(false)
    expect(inscricaoInsertSingleMock).not.toHaveBeenCalled()
  })

  it("recusa quando o pré-requisito de uma oferta não está aprovado", async () => {
    getCurrentUserMock.mockResolvedValueOnce({ usuarioId: "aluno-1", papel: "aluno", email: "a@a.com" })
    avaliarGateInscricaoMock.mockResolvedValueOnce({ liberado: true })
    ofertasSelectMock.mockResolvedValueOnce({
      data: [{ ...ofertaMatematica, disciplinas: { valor_mensal: "80.00", pre_requisito_id: "disc-0" } }],
      error: null,
    })
    progressoSelectMock.mockResolvedValueOnce({ data: { status: "cursando" } })
    const { confirmarInscricao } = await import("@/app/aluno/inscricao/actions")
    const resultado = await confirmarInscricao(["oferta-1"])
    expect(resultado.ok).toBe(false)
    expect(inscricaoInsertSingleMock).not.toHaveBeenCalled()
  })

  it("confirma a inscrição, soma a mensalidade e marca as disciplinas como cursando", async () => {
    getCurrentUserMock.mockResolvedValueOnce({ usuarioId: "aluno-1", papel: "aluno", email: "a@a.com" })
    avaliarGateInscricaoMock.mockResolvedValueOnce({ liberado: true })
    ofertasSelectMock.mockResolvedValueOnce({ data: [ofertaMatematica], error: null })
    inscricaoInsertSingleMock.mockResolvedValueOnce({ data: { id: "inscricao-1" }, error: null })

    const { confirmarInscricao } = await import("@/app/aluno/inscricao/actions")
    const resultado = await confirmarInscricao(["oferta-1"])

    expect(resultado).toEqual({ ok: true, valorMensalidade: 80 })
    expect(inscricaoOfertasInsertMock).toHaveBeenCalledWith([{ inscricao_id: "inscricao-1", oferta_id: "oferta-1" }])
    expect(progressoUpsertMock).toHaveBeenCalledWith(
      [{ aluno_id: "aluno-1", disciplina_id: "disc-1", status: "cursando" }],
      { onConflict: "aluno_id,disciplina_id", ignoreDuplicates: true }
    )
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run tests/app/aluno/inscricao/actions.test.ts`
Expected: FAIL com "Cannot find module '@/app/aluno/inscricao/actions'".

- [ ] **Step 3: Implementar**

```ts
// app/aluno/inscricao/actions.ts
"use server"

import { supabaseAdmin } from "@/lib/supabase/admin"
import { getCurrentUser } from "@/lib/auth/current-user"
import { avaliarGateInscricao } from "@/lib/academico/gate-inscricao"
import { obterConfiguracaoAcademica } from "@/lib/academico/configuracao"
import { ofertaEstaAberta } from "@/lib/academico/janela-inscricao"

export type ConfirmarInscricaoResult = { ok: true; valorMensalidade: number } | { ok: false; erro: string }

type OfertaComDisciplina = {
  id: string
  disciplina_id: string
  ano: number
  trimestre: string
  data_inicio_aulas: string
  horario_aula: string
  disciplinas: { valor_mensal: string | number; pre_requisito_id: string | null }
}

export async function confirmarInscricao(ofertaIds: string[]): Promise<ConfirmarInscricaoResult> {
  const usuario = await getCurrentUser()
  if (!usuario || usuario.papel !== "aluno") {
    return { ok: false, erro: "Não autenticado como aluno." }
  }

  const gate = await avaliarGateInscricao(usuario.usuarioId)
  if (!gate.liberado) {
    return { ok: false, erro: gate.motivo ?? "Inscrição bloqueada." }
  }

  const { janelaInscricaoDias } = await obterConfiguracaoAcademica()

  const { data: ofertas, error: ofertasError } = await supabaseAdmin
    .from("ofertas")
    .select("id, disciplina_id, ano, trimestre, data_inicio_aulas, horario_aula, disciplinas(valor_mensal, pre_requisito_id)")
    .in("id", ofertaIds)

  if (ofertasError || !ofertas || ofertas.length !== ofertaIds.length) {
    return { ok: false, erro: "Uma ou mais disciplinas selecionadas não foram encontradas." }
  }

  const agora = new Date()
  for (const oferta of ofertas as unknown as OfertaComDisciplina[]) {
    if (!ofertaEstaAberta({ dataInicioAulas: oferta.data_inicio_aulas, horarioAula: oferta.horario_aula }, janelaInscricaoDias, agora)) {
      return { ok: false, erro: "A janela de inscrição de uma das disciplinas selecionadas não está aberta." }
    }

    const preRequisitoId = oferta.disciplinas.pre_requisito_id
    if (preRequisitoId) {
      const { data: progresso } = await supabaseAdmin
        .from("progresso_aluno")
        .select("status")
        .eq("aluno_id", usuario.usuarioId)
        .eq("disciplina_id", preRequisitoId)
        .maybeSingle()

      if (!progresso || progresso.status !== "aprovado") {
        return { ok: false, erro: "Pré-requisito não cumprido para uma das disciplinas selecionadas." }
      }
    }
  }

  const valorMensalidade = (ofertas as unknown as OfertaComDisciplina[]).reduce(
    (soma, oferta) => soma + Number(oferta.disciplinas.valor_mensal),
    0
  )

  const primeiraOferta = ofertas[0] as unknown as OfertaComDisciplina
  const { data: inscricao, error: inscricaoError } = await supabaseAdmin
    .from("inscricoes")
    .insert({
      aluno_id: usuario.usuarioId,
      ano: primeiraOferta.ano,
      trimestre: primeiraOferta.trimestre,
      valor_mensalidade: valorMensalidade,
    })
    .select("id")
    .single()

  if (inscricaoError || !inscricao) {
    return { ok: false, erro: `Falha ao confirmar inscrição: ${inscricaoError?.message ?? "erro desconhecido"}` }
  }

  const { error: itensError } = await supabaseAdmin
    .from("inscricao_ofertas")
    .insert(ofertaIds.map((ofertaId) => ({ inscricao_id: inscricao.id, oferta_id: ofertaId })))

  if (itensError) {
    return { ok: false, erro: `Falha ao registrar disciplinas da inscrição: ${itensError.message}` }
  }

  await supabaseAdmin
    .from("progresso_aluno")
    .upsert(
      (ofertas as unknown as OfertaComDisciplina[]).map((oferta) => ({
        aluno_id: usuario.usuarioId,
        disciplina_id: oferta.disciplina_id,
        status: "cursando",
      })),
      { onConflict: "aluno_id,disciplina_id", ignoreDuplicates: true }
    )

  return { ok: true, valorMensalidade }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run tests/app/aluno/inscricao/actions.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Criar a tela de Inscrição**

```tsx
// app/aluno/inscricao/page.tsx
"use client"

import { useState } from "react"
import { confirmarInscricao } from "./actions"

export default function InscricaoPage() {
  const [ofertaIds, setOfertaIds] = useState("")
  const [mensagem, setMensagem] = useState<string | null>(null)

  async function handleConfirmar() {
    const ids = ofertaIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
    const resultado = await confirmarInscricao(ids)
    setMensagem(resultado.ok ? `Inscrição confirmada. Mensalidade: R$ ${resultado.valorMensalidade.toFixed(2)}` : resultado.erro)
  }

  return (
    <div>
      <h1>Inscrição</h1>
      <input
        value={ofertaIds}
        onChange={(e) => setOfertaIds(e.target.value)}
        placeholder="IDs das disciplinas, separados por vírgula"
      />
      <button onClick={handleConfirmar}>Confirmar inscrição</button>
      {mensagem && <p>{mensagem}</p>}
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add app/aluno/inscricao tests/app/aluno/inscricao/actions.test.ts
git commit -m "feat: add enrollment confirmation flow (gate, window, prerequisite, mensalidade)"
```

---

### Task 10: Matriz Curricular do aluno

**Files:**
- Create: `lib/academico/matriz-curricular.ts`
- Create: `app/aluno/matriz-curricular/page.tsx`
- Test: `tests/lib/academico/matriz-curricular.test.ts`

**Interfaces:**
- Consumes: `listarDisciplinas` de `@/lib/academico/disciplinas` (Task 4), `getCurrentUser` de `@/lib/auth/current-user`, `supabaseAdmin`.
- Produces: `obterMatrizCurricularDoAluno(alunoId): Promise<ItemMatriz[]>` onde `ItemMatriz = { disciplinaId: string; nome: string; valorMensal: number; status: "cursando"|"aprovado"|"reprovado"|"pendente"; n1: number|null; n2: number|null }`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/lib/academico/matriz-curricular.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest"

const listarDisciplinasMock = vi.fn()
const progressoEqMock = vi.fn()

vi.mock("@/lib/academico/disciplinas", () => ({ listarDisciplinas: listarDisciplinasMock }))
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: () => ({ select: () => ({ eq: progressoEqMock }) }),
  },
}))

describe("obterMatrizCurricularDoAluno", () => {
  beforeEach(() => {
    listarDisciplinasMock.mockReset()
    progressoEqMock.mockReset()
  })

  it("marca como pendente disciplinas sem progresso registrado", async () => {
    listarDisciplinasMock.mockResolvedValueOnce([
      { id: "disc-1", nome: "Grego I", valorMensal: 80, preRequisitoId: null },
    ])
    progressoEqMock.mockResolvedValueOnce({ data: [], error: null })

    const { obterMatrizCurricularDoAluno } = await import("@/lib/academico/matriz-curricular")
    const matriz = await obterMatrizCurricularDoAluno("aluno-1")

    expect(matriz).toEqual([
      { disciplinaId: "disc-1", nome: "Grego I", valorMensal: 80, status: "pendente", n1: null, n2: null },
    ])
  })

  it("combina o progresso existente com a disciplina correspondente", async () => {
    listarDisciplinasMock.mockResolvedValueOnce([
      { id: "disc-1", nome: "Grego I", valorMensal: 80, preRequisitoId: null },
    ])
    progressoEqMock.mockResolvedValueOnce({
      data: [{ disciplina_id: "disc-1", status: "aprovado", n1: "9.00", n2: "8.00" }],
      error: null,
    })

    const { obterMatrizCurricularDoAluno } = await import("@/lib/academico/matriz-curricular")
    const matriz = await obterMatrizCurricularDoAluno("aluno-1")

    expect(matriz).toEqual([
      { disciplinaId: "disc-1", nome: "Grego I", valorMensal: 80, status: "aprovado", n1: 9, n2: 8 },
    ])
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run tests/lib/academico/matriz-curricular.test.ts`
Expected: FAIL com "Cannot find module '@/lib/academico/matriz-curricular'".

- [ ] **Step 3: Implementar**

```ts
// lib/academico/matriz-curricular.ts
import { supabaseAdmin } from "@/lib/supabase/admin"
import { listarDisciplinas } from "@/lib/academico/disciplinas"

export type ItemMatriz = {
  disciplinaId: string
  nome: string
  valorMensal: number
  status: "cursando" | "aprovado" | "reprovado" | "pendente"
  n1: number | null
  n2: number | null
}

type ProgressoRow = {
  disciplina_id: string
  status: ItemMatriz["status"]
  n1: string | number | null
  n2: string | number | null
}

export async function obterMatrizCurricularDoAluno(alunoId: string): Promise<ItemMatriz[]> {
  const disciplinas = await listarDisciplinas()

  const { data: progressos, error } = await supabaseAdmin
    .from("progresso_aluno")
    .select("disciplina_id, status, n1, n2")
    .eq("aluno_id", alunoId)

  if (error) {
    throw new Error(`Falha ao carregar progresso do aluno: ${error.message}`)
  }

  const progressoPorDisciplina = new Map((progressos as ProgressoRow[] | null ?? []).map((p) => [p.disciplina_id, p]))

  return disciplinas.map((disciplina) => {
    const progresso = progressoPorDisciplina.get(disciplina.id)
    return {
      disciplinaId: disciplina.id,
      nome: disciplina.nome,
      valorMensal: disciplina.valorMensal,
      status: progresso?.status ?? "pendente",
      n1: progresso?.n1 != null ? Number(progresso.n1) : null,
      n2: progresso?.n2 != null ? Number(progresso.n2) : null,
    }
  })
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run tests/lib/academico/matriz-curricular.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Criar a tela da Matriz Curricular**

```tsx
// app/aluno/matriz-curricular/page.tsx
import { getCurrentUser } from "@/lib/auth/current-user"
import { obterMatrizCurricularDoAluno } from "@/lib/academico/matriz-curricular"

export default async function MatrizCurricularPage() {
  const usuario = await getCurrentUser()
  if (!usuario || usuario.papel !== "aluno") {
    return <p>Não autenticado como aluno.</p>
  }

  const matriz = await obterMatrizCurricularDoAluno(usuario.usuarioId)

  return (
    <div>
      <h1>Matriz Curricular</h1>
      <table>
        <thead>
          <tr>
            <th>Disciplina</th>
            <th>Status</th>
            <th>N1</th>
            <th>N2</th>
          </tr>
        </thead>
        <tbody>
          {matriz.map((item) => (
            <tr key={item.disciplinaId}>
              <td>{item.nome}</td>
              <td>{item.status}</td>
              <td>{item.n1 ?? "-"}</td>
              <td>{item.n2 ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/academico/matriz-curricular.ts app/aluno/matriz-curricular/page.tsx tests/lib/academico/matriz-curricular.test.ts
git commit -m "feat: add student-facing matriz curricular view"
```

---

### Task 11: Verificação manual

**Files:** nenhum arquivo novo — apenas execução manual.

- [ ] **Step 1: Rodar a suíte de testes completa**

Run: `npm test`
Expected: todos os testes desta fase e da Fase 1 passam.

- [ ] **Step 2: Subir o servidor de desenvolvimento**

Run: `npm run dev`
Expected: servidor sobe sem erro.

- [ ] **Step 3: Testar o fluxo fim a fim (requer as credenciais reais configuradas pelo README da Fase 1)**

Via SQL Editor do Supabase: crie uma disciplina de teste em `disciplinas`, uma oferta em `ofertas` com `data_inicio_aulas` próxima da data atual (dentro da janela) e `fechado = true`, e confirme que o aluno de teste já tem matrícula do ano (Fase 1). No navegador, logado como esse aluno, acesse `/aluno/inscricao` e confirme a inscrição usando o id da oferta criada.
Expected: mensagem de sucesso com a mensalidade correta (valor da disciplina); no Supabase, uma linha aparece em `inscricoes`, uma em `inscricao_ofertas`, e uma em `progresso_aluno` com status `cursando`. Repetir com uma oferta fora da janela (`data_inicio_aulas` no passado distante) deve mostrar o erro de janela fechada.

- [ ] **Step 4: Testar a Matriz Curricular do aluno**

Logado como o mesmo aluno de teste, acesse `/aluno/matriz-curricular`.
Expected: a disciplina da Task 3 aparece com status `cursando` (herdado da inscrição confirmada no Step 3). Lance N1 e N2 para essa disciplina diretamente no Supabase (tabela `progresso_aluno`) ou via uma chamada manual a `lancarNotas`, e recarregue a página — o status deve virar `aprovado` ou `reprovado` conforme a média calculada.

- [ ] **Step 4 (nota):** Este é o único passo de verificação manual no navegador do plano — cobre os fluxos de Inscrição e Matriz Curricular de ponta a ponta antes de avançar para a Fase 3 (Financeiro).
