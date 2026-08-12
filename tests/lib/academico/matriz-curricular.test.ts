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
