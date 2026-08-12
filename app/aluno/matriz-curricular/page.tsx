import { getCurrentUser } from "@/lib/auth/current-user"
import { obterMatrizCurricularDoAluno } from "@/lib/academico/matriz-curricular"

export default async function MatrizCurricularPage() {
  const usuario = await getCurrentUser()
  if (!usuario || usuario.papel !== "aluno") {
    return <p>Não autenticado como aluno.</p>
  }

  const matriz = await obterMatrizCurricularDoAluno(usuario.usuarioId)

  return (
    <div>
      <h1>Matriz Curricular</h1>
      <table>
        <thead>
          <tr>
            <th>Disciplina</th>
            <th>Status</th>
            <th>N1</th>
            <th>N2</th>
          </tr>
        </thead>
        <tbody>
          {matriz.map((item) => (
            <tr key={item.disciplinaId}>
              <td>{item.nome}</td>
              <td>{item.status}</td>
              <td>{item.n1 ?? "-"}</td>
              <td>{item.n2 ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
