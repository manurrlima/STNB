import { signIn } from "@/auth"

export default function StaffLoginPage() {
  return (
    <form
      action={async () => {
        "use server"
        await signIn("google", { redirectTo: "/" })
      }}
    >
      <button type="submit">Entrar com conta do Google Workspace</button>
    </form>
  )
}
