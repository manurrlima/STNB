"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { signInWithEmailAndPassword } from "firebase/auth"
import { firebaseClientAuth } from "@/lib/firebase/client"

export default function AlunoLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    try {
      const credencial = await signInWithEmailAndPassword(firebaseClientAuth, email, senha)
      const idToken = await credencial.user.getIdToken()
      const response = await fetch("/api/auth/aluno-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      })
      if (!response.ok) throw new Error("Falha ao criar sessão")
      router.push("/aluno")
    } catch {
      setErro("E-mail ou senha inválidos.")
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" required />
      <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha" required />
      {erro && <p role="alert">{erro}</p>}
      <button type="submit">Entrar</button>
    </form>
  )
}
