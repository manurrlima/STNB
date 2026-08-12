import { describe, expect, it } from "vitest"
import { ehFinanceiro, ehPedagogicoOuFinanceiro } from "@/lib/auth/guards"

describe("ehFinanceiro", () => {
  it("true para financeiro", () => {
    expect(ehFinanceiro("financeiro")).toBe(true)
  })
  it("false para pedagogico e aluno", () => {
    expect(ehFinanceiro("pedagogico")).toBe(false)
    expect(ehFinanceiro("aluno")).toBe(false)
  })
})

describe("ehPedagogicoOuFinanceiro", () => {
  it("true para pedagogico e financeiro", () => {
    expect(ehPedagogicoOuFinanceiro("pedagogico")).toBe(true)
    expect(ehPedagogicoOuFinanceiro("financeiro")).toBe(true)
  })
  it("false para aluno", () => {
    expect(ehPedagogicoOuFinanceiro("aluno")).toBe(false)
  })
})
