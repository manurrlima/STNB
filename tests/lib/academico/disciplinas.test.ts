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
