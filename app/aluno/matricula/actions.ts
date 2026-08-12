// app/aluno/matricula/actions.ts
"use server"

import { supabaseAdmin } from "@/lib/supabase/admin"
import { gerarRA } from "@/lib/ra/generate"
import { getCurrentUser } from "@/lib/auth/current-user"

export type ConfirmarMatriculaResult = { ok: true; ra: string } | { ok: false; erro: string }

export async function confirmarMatricula(): Promise<ConfirmarMatriculaResult> {
  const usuario = await getCurrentUser()
  if (!usuario || usuario.papel !== "aluno") {
    return { ok: false, erro: "Não autenticado como aluno." }
  }

  const ano = new Date().getFullYear()

  const { data: existente } = await supabaseAdmin
    .from("matriculas")
    .select("id")
    .eq("aluno_id", usuario.usuarioId)
    .eq("ano", ano)
    .maybeSingle()

  if (existente) {
    return { ok: false, erro: `Matrícula de ${ano} já confirmada.` }
  }

  const { data: aluno, error: alunoError } = await supabaseAdmin
    .from("alunos")
    .select("ra, nome")
    .eq("usuario_id", usuario.usuarioId)
    .single()

  if (alunoError) console.error("confirmarMatricula: falha ao consultar alunos", alunoError)

  if (!aluno) {
    return { ok: false, erro: "Cadastro de aluno não encontrado." }
  }

  let ra = aluno.ra as string | null
  if (!ra) {
    const resultado = await gerarRA(usuario.usuarioId, aluno.nome as string)
    ra = resultado.ra
  }

  const { error: insertError } = await supabaseAdmin
    .from("matriculas")
    .insert({ aluno_id: usuario.usuarioId, ano })

  if (insertError) {
    return { ok: false, erro: `Falha ao registrar matrícula: ${insertError.message}` }
  }

  return { ok: true, ra }
}
