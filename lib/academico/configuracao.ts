import { supabaseAdmin } from "@/lib/supabase/admin"
import { ehFinanceiro, type Papel } from "@/lib/auth/guards"

export type ConfiguracaoAcademica = {
  mediaMinima: number
  janelaInscricaoDias: number
}

export async function obterConfiguracaoAcademica(): Promise<ConfiguracaoAcademica> {
  const { data, error } = await supabaseAdmin
    .from("configuracao_academica")
    .select("media_minima, janela_inscricao_dias")
    .single()

  if (error || !data) {
    throw new Error(`Falha ao carregar configuração acadêmica: ${error?.message ?? "não encontrada"}`)
  }

  return {
    mediaMinima: Number(data.media_minima),
    janelaInscricaoDias: Number(data.janela_inscricao_dias),
  }
}

export type ConfiguracaoAcademicaResult = { ok: true } | { ok: false; erro: string }

export async function atualizarConfiguracaoAcademica(
  papel: Papel,
  campos: Partial<{ mediaMinima: number; janelaInscricaoDias: number }>
): Promise<ConfiguracaoAcademicaResult> {
  if (!ehFinanceiro(papel)) {
    return { ok: false, erro: "Apenas o financeiro pode alterar a configuração acadêmica." }
  }

  const camposBanco: Record<string, number> = {}
  if (campos.mediaMinima !== undefined) camposBanco.media_minima = campos.mediaMinima
  if (campos.janelaInscricaoDias !== undefined) camposBanco.janela_inscricao_dias = campos.janelaInscricaoDias

  const { error } = await supabaseAdmin.from("configuracao_academica").update(camposBanco).eq("id", 1)

  if (error) {
    return { ok: false, erro: `Falha ao atualizar configuração acadêmica: ${error.message}` }
  }

  return { ok: true }
}
