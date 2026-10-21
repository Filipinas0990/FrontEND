/**
 * Prepara a foto que o dono da farmácia tira no celular para o envio do
 * produto pelo link de ofertas: reduz para no máximo `LADO_MAX` px e regrava
 * em JPEG até caber em `MAX_B64` (o servidor recusa acima de ~900 KB).
 *
 * Mora aqui, e não em exportarCriativo, porque a página pública não deve
 * carregar o gerador de criativos inteiro só para isto.
 */
const LADO_MAX = 1200;
const MAX_B64 = 700_000;

function carregar(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível abrir esta foto.")); };
    img.src = url;
  });
}

/** Devolve um data URL JPEG pronto para enviar. */
export async function prepararFotoProduto(arquivo: File): Promise<string> {
  if (!arquivo.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
  const img = await carregar(arquivo);

  let escala = Math.min(1, LADO_MAX / Math.max(img.naturalWidth, img.naturalHeight));
  let ultimo = "";
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * escala));
    const ctx = canvas.getContext("2d")!;
    // JPEG não tem transparência — fundo branco evita PNG recortado virar preto.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    for (const q of [0.85, 0.75, 0.65]) {
      ultimo = canvas.toDataURL("image/jpeg", q);
      if (ultimo.length <= MAX_B64) return ultimo;
    }
    escala *= 0.8;
  }
  return ultimo;
}
