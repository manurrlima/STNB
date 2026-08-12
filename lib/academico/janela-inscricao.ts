export type OfertaParaJanela = {
  dataInicioAulas: string
  horarioAula: string
}

function dataHoraInicio(oferta: OfertaParaJanela): Date {
  const [hora, minuto] = oferta.horarioAula.split(":").map(Number)
  const data = new Date(`${oferta.dataInicioAulas}T00:00:00`)
  data.setHours(hora, minuto, 0, 0)
  return data
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
