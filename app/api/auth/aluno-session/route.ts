import { NextResponse } from "next/server"
import { firebaseAuth } from "@/lib/firebase/admin"

const SESSION_COOKIE_NAME = "aluno_session"
const EXPIRES_IN_MS = 60 * 60 * 24 * 5 * 1000 // 5 dias

export async function POST(request: Request) {
  const body = await request.json()
  const idToken = body?.idToken

  if (typeof idToken !== "string" || !idToken) {
    return NextResponse.json({ error: "idToken obrigatório" }, { status: 400 })
  }

  try {
    await firebaseAuth.verifyIdToken(idToken)
    const sessionCookie = await firebaseAuth.createSessionCookie(idToken, { expiresIn: EXPIRES_IN_MS })

    const response = NextResponse.json({ ok: true })
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: EXPIRES_IN_MS / 1000,
      path: "/",
    })
    return response
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 })
  }
}
