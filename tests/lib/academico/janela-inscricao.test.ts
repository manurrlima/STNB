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
