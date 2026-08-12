import { cookies } from "next/headers"
import { auth } from "@/auth"
import { firebaseAuth } from "@/lib/firebase/admin"
import { supabaseAdmin } from "@/lib/supabase/admin"

export type CurrentUser = {
  usuarioId: string
  papel: "aluno" | "pedagogico" | "financeiro"
  email: string
}

const ALUNO_SESSION_COOKIE = "aluno_session"

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const staffSession = await auth()
  if (staffSession?.user?.email) {
    const { data } = await supabaseAdmin
      .from("usuarios")
      .select("id, tipo, email")
      .eq("email", staffSession.user.email)
      .maybeSingle()

    if (data && (data.tipo === "pedagogico" || data.tipo === "financeiro")) {
      return { usuarioId: data.id, papel: data.tipo, email: data.email }
    }
    return null
  }

  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(ALUNO_SESSION_COOKIE)?.value
  if (!sessionCookie) return null

  try {
    const decoded = await firebaseAuth.verifySessionCookie(sessionCookie)
    const { data } = await supabaseAdmin
      .from("usuarios")
      .select("id, tipo, email")
      .eq("external_id", decoded.uid)
      .maybeSingle()

    if (data && data.tipo === "aluno") {
      return { usuarioId: data.id, papel: "aluno", email: data.email }
    }
    return null
  } catch {
    return null
  }
}
