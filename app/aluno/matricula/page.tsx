// app/aluno/matricula/page.tsx
"use client"

import { useState } from "react"
import { confirmarMatricula } from "./actions"

export default function MatriculaPage() {
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleConfirmar() {
    if (pending) return
    setPending(true)
    try {
      const resultado = await confirmarMatricula()
      setMensagem(resultado.ok ? `Matrícula confirmada. Seu RA: ${resultado.ra}` : resultado.erro)
    } finally {
      setPending(false)
    }
  }

  return (
    <div>
      <h1>Matrícula Anual</h1>
      <button onClick={handleConfirmar} disabled={pending}>
        {pending ? "Confirmando..." : "Confirmar matrícula"}
      </button>
      {mensagem && <p>{mensagem}</p>}
    </div>
  )
}
