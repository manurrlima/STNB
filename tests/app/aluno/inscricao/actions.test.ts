// tests/app/aluno/inscricao/actions.test.ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

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
    // ofertaMatematica.data_inicio_aulas ("2027-02-01") is a fixed future date; its
    // inscription window (~2027-01-12 to 2027-02-08) does not overlap the real wall
    // clock, so the "now" used by ofertaEstaAberta must be pinned inside that window
    // for the happy-path/pre-requisito tests to be meaningful and deterministic
    // regardless of when the suite actually runs.
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2027-01-20T12:00:00-03:00"))

    getCurrentUserMock.mockReset()
    avaliarGateInscricaoMock.mockReset()
    obterConfiguracaoAcademicaMock.mockReset().mockResolvedValue({ mediaMinima: 7, janelaInscricaoDias: 20 })
    ofertasSelectMock.mockReset()
    progressoSelectMock.mockReset().mockResolvedValue({ data: null })
    inscricaoInsertSingleMock.mockReset()
    inscricaoOfertasInsertMock.mockReset().mockResolvedValue({ error: null })
    progressoUpsertMock.mockReset().mockResolvedValue({ error: null })
  })

  afterEach(() => {
    vi.useRealTimers()
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
