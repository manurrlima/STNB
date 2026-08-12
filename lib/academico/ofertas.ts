import { supabaseAdmin } from "@/lib/supabase/admin"
import { ehFinanceiro, ehPedagogicoOuFinanceiro, type Papel } from "@/lib/auth/guards"

export type Oferta = {
  id: string
  disciplinaId: string
  ano: number
  trimestre: string
  dataInicioAulas: string
  horarioAula: string
  fechado: boolean
}

type OfertaRow = {
  id: string
  disciplina_id: string
  ano: number
  trimestre: string
  data_inicio_aulas: string
  horario_aula: string
  fechado: boolean
}

function converterOferta(linha: OfertaRow): Oferta {
  return {
    id: linha.id,
    disciplinaId: linha.disciplina_id,
    ano: linha.ano,
    trimestre: linha.trimestre,
    dataInicioAulas: linha.data_inicio_aulas,
    horarioAula: linha.horario_aula,
    fechado: linha.fechado,
  }
}

export type OfertaResult = { ok: true; oferta: Oferta } | { ok: false; erro: string }
export type OfertaAcaoResult = { ok: true } | { ok: false; erro: string }

export async function criarOferta(
  papel: Papel,
  dados: { disciplinaId: string; ano: number; trimestre: string; dataInicioAulas: string; horarioAula: string }
): Promise<OfertaResult> {
  if (!ehPedagogicoOuFinanceiro(papel)) {
    return { ok: false, erro: "Apenas pedagógico ou financeiro podem criar ofertas." }
  }

  const { data: ofertaFechada } = await supabaseAdmin
    .from("ofertas")
    .select("fechado")
    .eq("ano", dados.ano)
    .eq("trimestre", dados.trimestre)
    .eq("fechado", true)
    .limit(1)
    .maybeSingle()

  if (ofertaFechada && !ehFinanceiro(papel)) {
    return { ok: false, erro: "Este planejamento já está fechado — apenas o financeiro pode adicionar novas ofertas." }
  }

  const { data, error } = await supabaseAdmin
    .from("ofertas")
    .insert({
      disciplina_id: dados.disciplinaId,
      ano: dados.ano,
      trimestre: dados.trimestre,
      data_inicio_aulas: dados.dataInicioAulas,
      horario_aula: dados.horarioAula,
    })
    .select("id, disciplina_id, ano, trimestre, data_inicio_aulas, horario_aula, fechado")
    .single()

  if (error || !data) {
    return { ok: false, erro: `Falha ao criar oferta: ${error?.message ?? "erro desconhecido"}` }
  }

  return { ok: true, oferta: converterOferta(data) }
}

export async function listarOfertas(ano: number, trimestre: string): Promise<Oferta[]> {
  const { data, error } = await supabaseAdmin
    .from("ofertas")
    .select("id, disciplina_id, ano, trimestre, data_inicio_aulas, horario_aula, fechado")
    .eq("ano", ano)
    .eq("trimestre", trimestre)

  if (error || !data) {
    throw new Error(`Falha ao listar ofertas: ${error?.message ?? "erro desconhecido"}`)
  }

  return data.map(converterOferta)
}

export async function editarOferta(
  papel: Papel,
  ofertaId: string,
  dados: Partial<{ dataInicioAulas: string; horarioAula: string }>
): Promise<OfertaAcaoResult> {
  if (!ehPedagogicoOuFinanceiro(papel)) {
    return { ok: false, erro: "Apenas pedagógico ou financeiro podem editar ofertas." }
  }

  const { data: ofertaAtual, error: buscaError } = await supabaseAdmin
    .from("ofertas")
    .select("fechado")
    .eq("id", ofertaId)
    .single()

  if (buscaError || !ofertaAtual) {
    return { ok: false, erro: `Oferta não encontrada: ${buscaError?.message ?? ofertaId}` }
  }

  if (ofertaAtual.fechado && !ehFinanceiro(papel)) {
    return { ok: false, erro: "Este planejamento já está fechado — apenas o financeiro pode alterá-lo." }
  }

  const camposBanco: Record<string, string> = {}
  if (dados.dataInicioAulas !== undefined) camposBanco.data_inicio_aulas = dados.dataInicioAulas
  if (dados.horarioAula !== undefined) camposBanco.horario_aula = dados.horarioAula

  const { error } = await supabaseAdmin.from("ofertas").update(camposBanco).eq("id", ofertaId)

  if (error) {
    return { ok: false, erro: `Falha ao editar oferta: ${error.message}` }
  }

  return { ok: true }
}

export async function fecharPlanejamento(papel: Papel, ano: number, trimestre: string): Promise<OfertaAcaoResult> {
  if (!ehPedagogicoOuFinanceiro(papel)) {
    return { ok: false, erro: "Apenas pedagógico ou financeiro podem fechar o planejamento." }
  }

  const { error } = await supabaseAdmin
    .from("ofertas")
    .update({ fechado: true })
    .eq("ano", ano)
    .eq("trimestre", trimestre)

  if (error) {
    return { ok: false, erro: `Falha ao fechar planejamento: ${error.message}` }
  }

  return { ok: true }
}
