import { describe, expect, it, vi, beforeEach } from "vitest"

const rpcMock = vi.fn()
const updateMaybeSingleMock = vi.fn()
const alunoSingleMock = vi.fn()
const filesCreateMock = vi.fn()

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    rpc: rpcMock,
    from: () => ({
      update: () => ({
        eq: () => ({
          is: () => ({
            select: () => ({ maybeSingle: updateMaybeSingleMock }),
          }),
        }),
      }),
      select: () => ({ eq: () => ({ single: alunoSingleMock }) }),
    }),
  },
}))

vi.mock("googleapis", () => ({
  google: {
    auth: { JWT: vi.fn().mockImplementation(() => ({})) },
    drive: () => ({ files: { create: filesCreateMock } }),
  },
}))

describe("gerarRA", () => {
  beforeEach(() => {
    rpcMock.mockReset()
    updateMaybeSingleMock.mockReset()
    alunoSingleMock.mockReset()
    filesCreateMock.mockReset()
  })

  it("formata o RA como RA-{ano}-{sequência com 4 dígitos}, cria a pasta no Drive e salva no aluno", async () => {
    rpcMock.mockResolvedValueOnce({ data: 7, error: null })
    filesCreateMock.mockResolvedValueOnce({ data: { id: "drive-folder-id-123" } })
    updateMaybeSingleMock.mockResolvedValueOnce({ data: { ra: `RA-${new Date().getFullYear()}-0007` }, error: null })

    const { gerarRA } = await import("@/lib/ra/generate")
    const ano = new Date().getFullYear()
    const resultado = await gerarRA("aluno-id-1", "Fulano de Tal")

    expect(resultado).toEqual({ ra: `RA-${ano}-0007`, driveFolderId: "drive-folder-id-123" })
    expect(filesCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          name: `RA-${ano}-0007 - Fulano de Tal`,
          mimeType: "application/vnd.google-apps.folder",
        }),
      })
    )
  })

  it("lança erro se a sequência de RA não puder ser gerada", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "falha no banco" } })

    const { gerarRA } = await import("@/lib/ra/generate")

    await expect(gerarRA("aluno-id-1", "Fulano de Tal")).rejects.toThrow("Falha ao gerar sequência de RA")
  })

  it("lança erro se o Google Drive não retornar o id da pasta", async () => {
    rpcMock.mockResolvedValueOnce({ data: 8, error: null })
    filesCreateMock.mockResolvedValueOnce({ data: {} })

    const { gerarRA } = await import("@/lib/ra/generate")

    await expect(gerarRA("aluno-id-1", "Fulano de Tal")).rejects.toThrow(
      "Google Drive não retornou o id da pasta criada"
    )
  })

  it("quando outra chamada concorrente já salvou o RA primeiro, retorna o RA que venceu em vez de sobrescrever", async () => {
    rpcMock.mockResolvedValueOnce({ data: 9, error: null })
    filesCreateMock.mockResolvedValueOnce({ data: { id: "drive-folder-id-perdedor" } })
    updateMaybeSingleMock.mockResolvedValueOnce({ data: null, error: null })
    alunoSingleMock.mockResolvedValueOnce({ data: { ra: "RA-2026-0005" }, error: null })

    const { gerarRA } = await import("@/lib/ra/generate")
    const resultado = await gerarRA("aluno-id-1", "Fulano de Tal")

    expect(resultado).toEqual({ ra: "RA-2026-0005", driveFolderId: "drive-folder-id-perdedor" })
  })
})
