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
