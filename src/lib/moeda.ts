/**
 * Formata o que o usuário digita como dinheiro, contando da direita para a
 * esquerda (os 2 últimos dígitos são os centavos): "990" → "9,90".
 *
 * Usada nos campos de preço do disparo em grupos — o valor formatado vai
 * direto para o criativo, então sai sem o "R$" (a arte já desenha o símbolo).
 */
export function formatarMoeda(bruto: string): string {
  // Teto de 9 dígitos (até 9.999.999,99) — segura digitação acidental
  const digitos = bruto.replace(/\D/g, "").replace(/^0+/, "").slice(0, 9)
  if (!digitos) return ""
  return (Number(digitos) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
