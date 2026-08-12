import Link from "next/link"

export default function AlunoPage() {
  return (
    <div>
      <h1>Área do Aluno</h1>
      <p>
        <Link href="/aluno/matricula">Matrícula</Link>
      </p>
    </div>
  )
}
