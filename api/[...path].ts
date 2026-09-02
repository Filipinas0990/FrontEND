/**
 * Proxy da API — roda na Vercel, na mesma origem do front.
 *
 * O navegador só enxerga `https://<seu-app>.vercel.app/api/...`. Quem responde
 * de verdade é o backend em API_BASE_URL, cujo endereço nunca chega ao bundle
 * nem ao DevTools. Com isso o backend pode ficar fechado para a internet
 * (firewall liberando só os IPs da Vercel, ou um segredo em PROXY_SHARED_SECRET).
 *
 * Runtime edge: repassa o corpo da resposta como stream, o que mantém o SSE de
 * /api/pipeline/logs/stream e os downloads binários (xlsx, csv, imagens) funcionando.
 *
 * Variáveis de ambiente (Vercel → Settings → Environment Variables):
 *   API_BASE_URL        obrigatória. Ex.: https://api.seudominio.com.br  (sem barra no fim)
 *   PROXY_SHARED_SECRET opcional. Se definida, vai como header X-Proxy-Secret
 *                       para o backend recusar quem bater nele direto.
 *
 * ATENÇÃO: nada de prefixo VITE_ nessas variáveis. VITE_* é embutido no bundle
 * e voltaria a expor o backend — que é exatamente o que este arquivo evita.
 */

export const config = { runtime: "edge" };

const UPSTREAM = (process.env.API_BASE_URL ?? "").replace(/\/+$/, "");
const SHARED_SECRET = process.env.PROXY_SHARED_SECRET ?? "";

/** Headers que descrevem a conexão/rota atual e não podem ser repassados adiante. */
const HEADERS_BLOQUEADOS_NA_IDA = new Set([
  "host",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "x-proxy-secret",
]);

/**
 * `fetch` já descomprime o corpo, então repassar content-encoding/length do
 * upstream entregaria ao navegador um tamanho e uma codificação que não batem
 * com os bytes enviados.
 */
const HEADERS_BLOQUEADOS_NA_VOLTA = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
]);

function headersDaIda(request: Request): Headers {
  const headers = new Headers();
  request.headers.forEach((valor, nome) => {
    const chave = nome.toLowerCase();
    // x-vercel-* / x-forwarded-* são ruído da plataforma; o backend não usa.
    if (HEADERS_BLOQUEADOS_NA_IDA.has(chave)) return;
    if (chave.startsWith("x-vercel-") || chave.startsWith("x-forwarded-")) return;
    headers.set(nome, valor);
  });
  if (SHARED_SECRET) headers.set("X-Proxy-Secret", SHARED_SECRET);
  return headers;
}

function headersDaVolta(upstream: Response, streaming: boolean): Headers {
  const headers = new Headers();
  upstream.headers.forEach((valor, nome) => {
    if (HEADERS_BLOQUEADOS_NA_VOLTA.has(nome.toLowerCase())) return;
    headers.set(nome, valor);
  });
  if (streaming) {
    // Sem isso proxies intermediários seguram os eventos e o terminal de logs
    // só aparece no fim, de uma vez.
    headers.set("cache-control", "no-cache, no-transform");
    headers.set("x-accel-buffering", "no");
  }
  return headers;
}

export default async function handler(request: Request): Promise<Response> {
  if (!UPSTREAM) {
    return Response.json({ detail: "Proxy sem API_BASE_URL configurada." }, { status: 500 });
  }

  const url = new URL(request.url);
  const alvo = `${UPSTREAM}${url.pathname}${url.search}`;

  // Corpo lido inteiro de propósito: repassar o stream do request exigiria
  // `duplex: "half"`, que nem todo runtime da Vercel aceita. As requisições
  // aqui são JSON e imagens em base64 — cabem em memória sem problema.
  const temCorpo = request.method !== "GET" && request.method !== "HEAD";
  const corpo = temCorpo ? await request.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(alvo, {
      method: request.method,
      headers: headersDaIda(request),
      body: corpo,
      redirect: "manual",
    });
  } catch {
    // A mensagem não cita o endereço do backend: erro de rede não é motivo
    // para vazar no console justamente o que o proxy esconde.
    return Response.json({ detail: "Não foi possível falar com a API." }, { status: 502 });
  }

  const streaming = (upstream.headers.get("content-type") ?? "").includes("text/event-stream");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: headersDaVolta(upstream, streaming),
  });
}
