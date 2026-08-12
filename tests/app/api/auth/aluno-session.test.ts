import { describe, expect, it, vi, beforeEach } from "vitest"

const verifyIdTokenMock = vi.fn()
const createSessionCookieMock = vi.fn()

vi.mock("@/lib/firebase/admin", () => ({
  firebaseAuth: {
    verifyIdToken: verifyIdTokenMock,
    createSessionCookie: createSessionCookieMock,
  },
}))

describe("POST /api/auth/aluno-session", () => {
  beforeEach(() => {
    verifyIdTokenMock.mockReset()
    createSessionCookieMock.mockReset()
  })

  it("retorna 400 quando idToken não é enviado", async () => {
    const { POST } = await import("@/app/api/auth/aluno-session/route")
    const request = new Request("http://localhost/api/auth/aluno-session", {
      method: "POST",
      body: JSON.stringify({}),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it("retorna 401 quando o token é inválido", async () => {
    verifyIdTokenMock.mockRejectedValueOnce(new Error("invalid"))
    const { POST } = await import("@/app/api/auth/aluno-session/route")
    const request = new Request("http://localhost/api/auth/aluno-session", {
      method: "POST",
      body: JSON.stringify({ idToken: "token-invalido" }),
    })

    const response = await POST(request)

    expect(response.status).toBe(401)
  })

  it("cria o cookie de sessão quando o token é válido", async () => {
    verifyIdTokenMock.mockResolvedValueOnce({ uid: "uid-123" })
    createSessionCookieMock.mockResolvedValueOnce("cookie-assinado")
    const { POST } = await import("@/app/api/auth/aluno-session/route")
    const request = new Request("http://localhost/api/auth/aluno-session", {
      method: "POST",
      body: JSON.stringify({ idToken: "token-valido" }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(response.headers.get("set-cookie")).toContain("aluno_session=cookie-assinado")
  })
})
