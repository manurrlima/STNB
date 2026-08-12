// app/aluno/matricula/page.tsx
"use client"

import { useState } from "react"
import { confirmarMatricula } from "./actions"

export default function MatriculaPage() {
  const [mensagem, setMensagem] = useState<string | null>(null)

  async function handleConfirmar() {
    const resultado = await confirmarMatricula()
    setMensagem(resultado.ok ? `Matrícula confirmada. Seu RA: ${resultado.ra}` : resultado.erro)
  }

  return (
    <div>
      <h1>Matrícula Anual</h1>
      <button onClick={handleConfirmar}>Confirmar matrícula</button>
      {mensagem && <p>{mensagem}</p>}
    </div>
  )
}
