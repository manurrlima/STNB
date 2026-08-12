import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { isWorkspaceEmail } from "@/lib/auth/workspace"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  callbacks: {
    async signIn({ profile }) {
      const domain = process.env.WORKSPACE_DOMAIN
      if (!domain) return false
      return isWorkspaceEmail(profile?.email, domain)
    },
  },
})
