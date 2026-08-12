// app/aluno/inscricao/page.tsx
"use client"

import { useState } from "react"
import { confirmarInscricao } from "./actions"

export default function InscricaoPage() {
  const [ofertaIds, setOfertaIds] = useState("")
  const [mensagem, setMensagem] = useState<string | null>(null)

  async function handleConfirmar() {
    const ids = ofertaIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
    const resultado = await confirmarInscricao(ids)
    setMensagem(resultado.ok ? `Inscrição confirmada. Mensalidade: R$ ${resultado.valorMensalidade.toFixed(2)}` : resultado.erro)
  }

  return (
    <div>
      <h1>Inscrição</h1>
      <input
        value={ofertaIds}
        onChange={(e) => setOfertaIds(e.target.value)}
        placeholder="IDs das disciplinas, separados por vírgula"
      />
      <button onClick={handleConfirmar}>Confirmar inscrição</button>
      {mensagem && <p>{mensagem}</p>}
    </div>
  )
}
