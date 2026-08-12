import { describe, expect, it, vi, beforeEach } from "vitest"

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

describe("calcularAprovacao", () => {
  it("aprovado quando a média é igual à mínima", async () => {
    const { calcularAprovacao } = await import("@/lib/academico/notas")
    expect(calcularAprovacao(7, 7, 7)).toEqual({ status: "aprovado", media: 7 })
  })

  it("aprovado quando a média é maior que a mínima", async () => {
    const { calcularAprovacao } = await import("@/lib/academico/notas")
    expect(calcularAprovacao(9, 8, 7)).toEqual({ status: "aprovado", media: 8.5 })
  })

  it("reprovado quando a média é menor que a mínima", async () => {
    const { calcularAprovacao } = await import("@/lib/academico/notas")
    expect(calcularAprovacao(5, 6, 7)).toEqual({ status: "reprovado", media: 5.5 })
  })
})

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

  it("retorna erro quando a configuração acadêmica falha", async () => {
    obterConfiguracaoAcademicaMock.mockRejectedValueOnce(new Error("falha no banco"))
    const { lancarNotas } = await import("@/lib/academico/notas")
    const resultado = await lancarNotas("pedagogico", "aluno-1", "disc-1", 8, 9)
    expect(resultado).toEqual({ ok: false, erro: "Falha ao carregar configuração acadêmica: falha no banco" })
    expect(upsertMock).not.toHaveBeenCalled()
  })
})
