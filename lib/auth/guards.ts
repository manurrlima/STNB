export type Papel = "aluno" | "pedagogico" | "financeiro"

export function ehFinanceiro(papel: Papel): boolean {
  return papel === "financeiro"
}

export function ehPedagogicoOuFinanceiro(papel: Papel): boolean {
  return papel === "pedagogico" || papel === "financeiro"
}
