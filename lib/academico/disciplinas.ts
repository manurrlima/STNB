import { supabaseAdmin } from "@/lib/supabase/admin"
import { ehPedagogicoOuFinanceiro, type Papel } from "@/lib/auth/guards"

export type Disciplina = {
  id: string
  nome: string
  valorMensal: number
  preRequisitoId: string | null
}

type DisciplinaRow = {
  id: string
  nome: string
  valor_mensal: string | number
  pre_requisito_id: string | null
}

function converterDisciplina(linha: DisciplinaRow): Disciplina {
  return {
    id: linha.id,
    nome: linha.nome,
    valorMensal: Number(linha.valor_mensal),
    preRequisitoId: linha.pre_requisito_id,
  }
}

export type CriarDisciplinaResult = { ok: true; disciplina: Disciplina } | { ok: false; erro: string }

export async function criarDisciplina(
  papel: Papel,
  dados: { nome: string; valorMensal: number; preRequisitoId?: string | null }
): Promise<CriarDisciplinaResult> {
  if (!ehPedagogicoOuFinanceiro(papel)) {
    return { ok: false, erro: "Apenas pedagógico ou financeiro podem criar disciplinas." }
  }

  const { data, error } = await supabaseAdmin
    .from("disciplinas")
    .insert({
      nome: dados.nome,
      valor_mensal: dados.valorMensal,
      pre_requisito_id: dados.preRequisitoId ?? null,
    })
    .select("id, nome, valor_mensal, pre_requisito_id")
    .single()

  if (error || !data) {
    return { ok: false, erro: `Falha ao criar disciplina: ${error?.message ?? "erro desconhecido"}` }
  }

  return { ok: true, disciplina: converterDisciplina(data) }
}

export async function listarDisciplinas(): Promise<Disciplina[]> {
  const { data, error } = await supabaseAdmin.from("disciplinas").select("id, nome, valor_mensal, pre_requisito_id")

  if (error || !data) {
    throw new Error(`Falha ao listar disciplinas: ${error?.message ?? "erro desconhecido"}`)
  }

  return data.map(converterDisciplina)
}
