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

  it("recusa quando o papel é aluno", async () => {
    const { editarOferta } = await import("@/lib/academico/ofertas")
    const resultado = await editarOferta("aluno", "oferta-1", { dataInicioAulas: "2027-02-05" })
    expect(resultado).toEqual({
      ok: false,
      erro: "Apenas pedagógico ou financeiro podem editar ofertas.",
    })
    expect(ofertaSingleMock).not.toHaveBeenCalled()
    expect(editarEqChainMock).not.toHaveBeenCalled()
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
