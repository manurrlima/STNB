import { describe, expect, it } from "vitest"
import { isWorkspaceEmail } from "@/lib/auth/workspace"

describe("isWorkspaceEmail", () => {
  it("aceita e-mail do domínio do Workspace", () => {
    expect(isWorkspaceEmail("financeiro@stnbnec.com", "stnbnec.com")).toBe(true)
  })

  it("rejeita e-mail de outro domínio", () => {
    expect(isWorkspaceEmail("qualquer@gmail.com", "stnbnec.com")).toBe(false)
  })

  it("rejeita e-mail undefined ou vazio", () => {
    expect(isWorkspaceEmail(undefined, "stnbnec.com")).toBe(false)
    expect(isWorkspaceEmail("", "stnbnec.com")).toBe(false)
  })

  it("não aceita domínio como substring solta (ex: naostnbnec.com)", () => {
    expect(isWorkspaceEmail("financeiro@naostnbnec.com", "stnbnec.com")).toBe(false)
  })
})
