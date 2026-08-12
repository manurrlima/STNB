export type OfertaParaJanela = {
  dataInicioAulas: string
  horarioAula: string
}

function dataHoraInicio(oferta: OfertaParaJanela): Date {
  const horarioHHMM = oferta.horarioAula.slice(0, 5) // tolerate "HH:MM:SS" (e.g. from Postgres time columns) by taking just "HH:MM"
  return new Date(`${oferta.dataInicioAulas}T${horarioHHMM}:00-03:00`)
}

export function calcularJanela(oferta: OfertaParaJanela, janelaInscricaoDias: number): { abreEm: Date; fechaEm: Date } {
  const inicio = dataHoraInicio(oferta)

  const abreEm = new Date(inicio)
  abreEm.setDate(abreEm.getDate() - janelaInscricaoDias)

  const fechaEm = new Date(inicio)
  fechaEm.setDate(fechaEm.getDate() + 7)
  fechaEm.setHours(fechaEm.getHours() + 1)

  return { abreEm, fechaEm }
}

export function ofertaEstaAberta(oferta: OfertaParaJanela, janelaInscricaoDias: number, agora: Date): boolean {
  const { abreEm, fechaEm } = calcularJanela(oferta, janelaInscricaoDias)
  return agora.getTime() >= abreEm.getTime() && agora.getTime() < fechaEm.getTime()
}
