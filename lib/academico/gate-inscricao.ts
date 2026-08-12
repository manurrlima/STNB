import { supabaseAdmin } from "@/lib/supabase/admin"

export type ResultadoGate = { liberado: boolean; motivo?: string }

type RegraGate = {
  verificar: (alunoId: string) => Promise<boolean>
  motivo: string
}

async function matriculaEmDia(alunoId: string): Promise<boolean> {
  const ano = new Date().getFullYear()
  const { data } = await supabaseAdmin
    .from("matriculas")
    .select("id")
    .eq("aluno_id", alunoId)
    .eq("ano", ano)
    .maybeSingle()

  return Boolean(data)
}

// Fase 3 (Financeiro) vai substituir esta regra por uma checagem real de pendência.
async function semPendenciaFinanceira(_alunoId: string): Promise<boolean> {
  return true
}

// Fase 4 (Solicitações) vai substituir esta regra por uma checagem real dos documentos anuais.
async function documentosAnuaisAprovados(_alunoId: string): Promise<boolean> {
  return true
}

const REGRAS: RegraGate[] = [
  { verificar: matriculaEmDia, motivo: "Matrícula do ano ainda não confirmada." },
  { verificar: documentosAnuaisAprovados, motivo: "Documentos anuais obrigatórios ainda não aprovados." },
  { verificar: semPendenciaFinanceira, motivo: "Existe pendência financeira do trimestre anterior." },
]

export async function avaliarGateInscricao(alunoId: string): Promise<ResultadoGate> {
  for (const regra of REGRAS) {
    const passou = await regra.verificar(alunoId)
    if (!passou) {
      return { liberado: false, motivo: regra.motivo }
    }
  }

  return { liberado: true }
}
