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
