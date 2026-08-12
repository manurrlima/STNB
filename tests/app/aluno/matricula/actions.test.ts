// tests/app/aluno/matricula/actions.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest"

const getCurrentUserMock = vi.fn()
const gerarRAMock = vi.fn()
const matriculaMaybeSingleMock = vi.fn()
const alunoSingleMock = vi.fn()
const insertMock = vi.fn()

vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock("@/lib/ra/generate", () => ({ gerarRA: gerarRAMock }))
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (tabela: string) => {
      if (tabela === "matriculas") {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: matriculaMaybeSingleMock }) }) }),
          insert: insertMock,
        }
      }
      return {
        select: () => ({ eq: () => ({ single: alunoSingleMock }) }),
      }
    },
  },
}))

describe("confirmarMatricula", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    gerarRAMock.mockReset()
    matriculaMaybeSingleMock.mockReset()
    alunoSingleMock.mockReset()
    insertMock.mockReset()
  })

  it("recusa quando não há usuário autenticado como aluno", async () => {
    getCurrentUserMock.mockResolvedValueOnce(null)

    const { confirmarMatricula } = await import("@/app/aluno/matricula/actions")
    const resultado = await confirmarMatricula()

    expect(resultado).toEqual({ ok: false, erro: "Não autenticado como aluno." })
  })

  it("recusa quando a matrícula do ano já existe", async () => {
    getCurrentUserMock.mockResolvedValueOnce({ usuarioId: "aluno-1", papel: "aluno", email: "a@a.com" })
    matriculaMaybeSingleMock.mockResolvedValueOnce({ data: { id: "matricula-1" } })

    const { confirmarMatricula } = await import("@/app/aluno/matricula/actions")
    const resultado = await confirmarMatricula()

    expect(resultado.ok).toBe(false)
    expect(gerarRAMock).not.toHaveBeenCalled()
  })

  it("gera RA quando o aluno ainda não tem um e confirma a matrícula", async () => {
    getCurrentUserMock.mockResolvedValueOnce({ usuarioId: "aluno-1", papel: "aluno", email: "a@a.com" })
    matriculaMaybeSingleMock.mockResolvedValueOnce({ data: null })
    alunoSingleMock.mockResolvedValueOnce({ data: { ra: null, nome: "Fulano" } })
    gerarRAMock.mockResolvedValueOnce({ ra: "RA-2026-0001", driveFolderId: "drive-1" })
    insertMock.mockResolvedValueOnce({ error: null })

    const { confirmarMatricula } = await import("@/app/aluno/matricula/actions")
    const resultado = await confirmarMatricula()

    expect(gerarRAMock).toHaveBeenCalledWith("aluno-1", "Fulano")
    expect(resultado).toEqual({ ok: true, ra: "RA-2026-0001" })
  })

  it("não gera RA de novo quando o aluno já tem um", async () => {
    getCurrentUserMock.mockResolvedValueOnce({ usuarioId: "aluno-1", papel: "aluno", email: "a@a.com" })
    matriculaMaybeSingleMock.mockResolvedValueOnce({ data: null })
    alunoSingleMock.mockResolvedValueOnce({ data: { ra: "RA-2025-0042", nome: "Fulano" } })
    insertMock.mockResolvedValueOnce({ error: null })

    const { confirmarMatricula } = await import("@/app/aluno/matricula/actions")
    const resultado = await confirmarMatricula()

    expect(gerarRAMock).not.toHaveBeenCalled()
    expect(resultado).toEqual({ ok: true, ra: "RA-2025-0042" })
  })
})
