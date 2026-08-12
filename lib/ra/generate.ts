import "server-only"

import { google } from "googleapis"
import { supabaseAdmin } from "@/lib/supabase/admin"

export type GerarRAResult = { ra: string; driveFolderId: string }

export function formatarRA(ano: number, sequencia: number): string {
  return `RA-${ano}-${String(sequencia).padStart(4, "0")}`
}

async function criarPastaNoDrive(nomeAluno: string, ra: string): Promise<string> {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    subject: process.env.GOOGLE_WORKSPACE_IMPERSONATE_EMAIL,
    scopes: ["https://www.googleapis.com/auth/drive"],
  })
  const drive = google.drive({ version: "v3", auth })

  const response = await drive.files.create({
    requestBody: {
      name: `${ra} - ${nomeAluno}`,
      mimeType: "application/vnd.google-apps.folder",
      parents: [process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID as string],
    },
    fields: "id",
  })

  if (!response.data.id) throw new Error("Google Drive não retornou o id da pasta criada")
  return response.data.id
}

export async function gerarRA(alunoId: string, nomeAluno: string): Promise<GerarRAResult> {
  const ano = new Date().getFullYear()
  const { data: sequencia, error } = await supabaseAdmin.rpc("proximo_valor_ra_seq")
  if (error || typeof sequencia !== "number") {
    throw new Error(`Falha ao gerar sequência de RA: ${error?.message ?? "resultado inválido"}`)
  }

  const ra = formatarRA(ano, sequencia)
  const driveFolderId = await criarPastaNoDrive(nomeAluno, ra)

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("alunos")
    .update({ ra, drive_folder_id: driveFolderId })
    .eq("usuario_id", alunoId)
    .is("ra", null)
    .select("ra")
    .maybeSingle()

  if (updateError) {
    throw new Error(`Falha ao salvar RA gerado: ${updateError.message}`)
  }

  if (!updated) {
    // Outra chamada concorrente já gerou e salvou o RA primeiro.
    // Buscamos o RA que de fato venceu, para que ambas as chamadas convirjam no mesmo valor.
    const { data: aluno, error: fetchError } = await supabaseAdmin
      .from("alunos")
      .select("ra, drive_folder_id")
      .eq("usuario_id", alunoId)
      .single()

    if (fetchError || !aluno?.ra || !aluno?.drive_folder_id) {
      throw new Error("Falha ao gerar RA: condição de corrida detectada, mas não foi possível recuperar o RA já salvo.")
    }

    return { ra: aluno.ra, driveFolderId: aluno.drive_folder_id }
  }

  return { ra, driveFolderId }
}
