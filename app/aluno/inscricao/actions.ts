// app/aluno/inscricao/actions.ts
"use server"

import { supabaseAdmin } from "@/lib/supabase/admin"
import { getCurrentUser } from "@/lib/auth/current-user"
import { avaliarGateInscricao } from "@/lib/academico/gate-inscricao"
import { obterConfiguracaoAcademica } from "@/lib/academico/configuracao"
import { ofertaEstaAberta } from "@/lib/academico/janela-inscricao"

export type ConfirmarInscricaoResult = { ok: true; valorMensalidade: number } | { ok: false; erro: string }

type OfertaComDisciplina = {
  id: string
  disciplina_id: string
  ano: number
  trimestre: string
  data_inicio_aulas: string
  horario_aula: string
  disciplinas: { valor_mensal: string | number; pre_requisito_id: string | null }
}

export async function confirmarInscricao(ofertaIds: string[]): Promise<ConfirmarInscricaoResult> {
  const usuario = await getCurrentUser()
  if (!usuario || usuario.papel !== "aluno") {
    return { ok: false, erro: "Não autenticado como aluno." }
  }

  const gate = await avaliarGateInscricao(usuario.usuarioId)
  if (!gate.liberado) {
    return { ok: false, erro: gate.motivo ?? "Inscrição bloqueada." }
  }

  const { janelaInscricaoDias } = await obterConfiguracaoAcademica()

  const { data: ofertas, error: ofertasError } = await supabaseAdmin
    .from("ofertas")
    .select("id, disciplina_id, ano, trimestre, data_inicio_aulas, horario_aula, disciplinas(valor_mensal, pre_requisito_id)")
    .in("id", ofertaIds)

  if (ofertasError || !ofertas || ofertas.length !== ofertaIds.length) {
    return { ok: false, erro: "Uma ou mais disciplinas selecionadas não foram encontradas." }
  }

  const agora = new Date()
  for (const oferta of ofertas as unknown as OfertaComDisciplina[]) {
    if (!ofertaEstaAberta({ dataInicioAulas: oferta.data_inicio_aulas, horarioAula: oferta.horario_aula }, janelaInscricaoDias, agora)) {
      return { ok: false, erro: "A janela de inscrição de uma das disciplinas selecionadas não está aberta." }
    }

    const preRequisitoId = oferta.disciplinas.pre_requisito_id
    if (preRequisitoId) {
      const { data: progresso } = await supabaseAdmin
        .from("progresso_aluno")
        .select("status")
        .eq("aluno_id", usuario.usuarioId)
        .eq("disciplina_id", preRequisitoId)
        .maybeSingle()

      if (!progresso || progresso.status !== "aprovado") {
        return { ok: false, erro: "Pré-requisito não cumprido para uma das disciplinas selecionadas." }
      }
    }
  }

  const valorMensalidade = (ofertas as unknown as OfertaComDisciplina[]).reduce(
    (soma, oferta) => soma + Number(oferta.disciplinas.valor_mensal),
    0
  )

  const primeiraOferta = ofertas[0] as unknown as OfertaComDisciplina
  const { data: inscricao, error: inscricaoError } = await supabaseAdmin
    .from("inscricoes")
    .insert({
      aluno_id: usuario.usuarioId,
      ano: primeiraOferta.ano,
      trimestre: primeiraOferta.trimestre,
      valor_mensalidade: valorMensalidade,
    })
    .select("id")
    .single()

  if (inscricaoError || !inscricao) {
    return { ok: false, erro: `Falha ao confirmar inscrição: ${inscricaoError?.message ?? "erro desconhecido"}` }
  }

  const { error: itensError } = await supabaseAdmin
    .from("inscricao_ofertas")
    .insert(ofertaIds.map((ofertaId) => ({ inscricao_id: inscricao.id, oferta_id: ofertaId })))

  if (itensError) {
    return { ok: false, erro: `Falha ao registrar disciplinas da inscrição: ${itensError.message}` }
  }

  await supabaseAdmin
    .from("progresso_aluno")
    .upsert(
      (ofertas as unknown as OfertaComDisciplina[]).map((oferta) => ({
        aluno_id: usuario.usuarioId,
        disciplina_id: oferta.disciplina_id,
        status: "cursando",
      })),
      { onConflict: "aluno_id,disciplina_id", ignoreDuplicates: true }
    )

  return { ok: true, valorMensalidade }
}
