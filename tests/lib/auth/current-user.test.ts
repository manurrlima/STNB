import { describe, expect, it, vi, beforeEach } from "vitest"

const authMock = vi.fn()
const verifySessionCookieMock = vi.fn()
const cookiesGetMock = vi.fn()
const supabaseMaybeSingleMock = vi.fn()

vi.mock("@/auth", () => ({ auth: authMock }))
vi.mock("@/lib/firebase/admin", () => ({
  firebaseAuth: { verifySessionCookie: verifySessionCookieMock },
}))
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookiesGetMock }),
}))
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: supabaseMaybeSingleMock }),
      }),
    }),
  },
}))

describe("getCurrentUser", () => {
  beforeEach(() => {
    authMock.mockReset()
    verifySessionCookieMock.mockReset()
    cookiesGetMock.mockReset()
    supabaseMaybeSingleMock.mockReset()
  })

  it("retorna usuário de staff quando há sessão NextAuth com papel válido", async () => {
    authMock.mockResolvedValueOnce({ user: { email: "financeiro@stnbnec.com" } })
    supabaseMaybeSingleMock.mockResolvedValueOnce({
      data: { id: "id-financeiro", tipo: "financeiro", email: "financeiro@stnbnec.com" },
    })

    const { getCurrentUser } = await import("@/lib/auth/current-user")
    const usuario = await getCurrentUser()

    expect(usuario).toEqual({ usuarioId: "id-financeiro", papel: "financeiro", email: "financeiro@stnbnec.com" })
  })

  it("retorna null quando não há sessão NextAuth nem cookie de aluno", async () => {
    authMock.mockResolvedValueOnce(null)
    cookiesGetMock.mockReturnValueOnce(undefined)

    const { getCurrentUser } = await import("@/lib/auth/current-user")
    const usuario = await getCurrentUser()

    expect(usuario).toBeNull()
  })

  it("retorna usuário aluno quando o cookie de sessão é válido", async () => {
    authMock.mockResolvedValueOnce(null)
    cookiesGetMock.mockReturnValueOnce({ value: "cookie-valido" })
    verifySessionCookieMock.mockResolvedValueOnce({ uid: "uid-123" })
    supabaseMaybeSingleMock.mockResolvedValueOnce({
      data: { id: "id-aluno", tipo: "aluno", email: "aluno@example.com" },
    })

    const { getCurrentUser } = await import("@/lib/auth/current-user")
    const usuario = await getCurrentUser()

    expect(usuario).toEqual({ usuarioId: "id-aluno", papel: "aluno", email: "aluno@example.com" })
  })

  it("retorna null quando o cookie de sessão é inválido", async () => {
    authMock.mockResolvedValueOnce(null)
    cookiesGetMock.mockReturnValueOnce({ value: "cookie-invalido" })
    verifySessionCookieMock.mockRejectedValueOnce(new Error("invalid"))

    const { getCurrentUser } = await import("@/lib/auth/current-user")
    const usuario = await getCurrentUser()

    expect(usuario).toBeNull()
  })
})
