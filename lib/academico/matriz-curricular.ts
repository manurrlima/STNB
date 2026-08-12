import { supabaseAdmin } from "@/lib/supabase/admin"
import { listarDisciplinas } from "@/lib/academico/disciplinas"

export type ItemMatriz = {
  disciplinaId: string
  nome: string
  valorMensal: number
  status: "cursando" | "aprovado" | "reprovado" | "pendente"
  n1: number | null
  n2: number | null
}

type ProgressoRow = {
  disciplina_id: string
  status: ItemMatriz["status"]
  n1: string | number | null
  n2: string | number | null
}

export async function obterMatrizCurricularDoAluno(alunoId: string): Promise<ItemMatriz[]> {
  const disciplinas = await listarDisciplinas()

  const { data: progressos, error } = await supabaseAdmin
    .from("progresso_aluno")
    .select("disciplina_id, status, n1, n2")
    .eq("aluno_id", alunoId)

  if (error) {
    throw new Error(`Falha ao carregar progresso do aluno: ${error.message}`)
  }

  const progressoPorDisciplina = new Map((progressos as ProgressoRow[] | null ?? []).map((p) => [p.disciplina_id, p]))

  return disciplinas.map((disciplina) => {
    const progresso = progressoPorDisciplina.get(disciplina.id)
    return {
      disciplinaId: disciplina.id,
      nome: disciplina.nome,
      valorMensal: disciplina.valorMensal,
      status: progresso?.status ?? "pendente",
      n1: progresso?.n1 != null ? Number(progresso.n1) : null,
      n2: progresso?.n2 != null ? Number(progresso.n2) : null,
    }
  })
}
