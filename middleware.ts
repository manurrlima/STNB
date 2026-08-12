import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const STAFF_PREFIXES = ["/pedagogico", "/financeiro"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith("/aluno") && pathname !== "/aluno/login") {
    const hasSession = request.cookies.has("aluno_session")
    if (!hasSession) {
      return NextResponse.redirect(new URL("/aluno/login", request.url))
    }
  }

  if (STAFF_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const hasSession =
      request.cookies.has("authjs.session-token") || request.cookies.has("__Secure-authjs.session-token")
    if (!hasSession) {
      return NextResponse.redirect(new URL("/staff/login", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/aluno/:path*", "/pedagogico/:path*", "/financeiro/:path*"],
}
