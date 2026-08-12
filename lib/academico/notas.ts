import { supabaseAdmin } from "@/lib/supabase/admin"
import { obterConfiguracaoAcademica } from "@/lib/academico/configuracao"
import { ehPedagogicoOuFinanceiro, type Papel } from "@/lib/auth/guards"

export type ResultadoNota = { status: "aprovado" | "reprovado"; media: number }

export function calcularAprovacao(n1: number, n2: number, mediaMinima: number): ResultadoNota {
  const media = (n1 + n2) / 2
  return { status: media >= mediaMinima ? "aprovado" : "reprovado", media }
}

export type LancarNotasResult = { ok: true; resultado: ResultadoNota } | { ok: false; erro: string }

export async function lancarNotas(
  papel: Papel,
  alunoId: string,
  disciplinaId: string,
  n1: number,
  n2: number
): Promise<LancarNotasResult> {
  if (!ehPedagogicoOuFinanceiro(papel)) {
    return { ok: false, erro: "Apenas pedagógico ou financeiro podem lançar notas." }
  }

  const { mediaMinima } = await obterConfiguracaoAcademica()
  const resultado = calcularAprovacao(n1, n2, mediaMinima)

  const { error } = await supabaseAdmin
    .from("progresso_aluno")
    .upsert(
      { aluno_id: alunoId, disciplina_id: disciplinaId, n1, n2, status: resultado.status },
      { onConflict: "aluno_id,disciplina_id" }
    )

  if (error) {
    return { ok: false, erro: `Falha ao lançar notas: ${error.message}` }
  }

  return { ok: true, resultado }
}
