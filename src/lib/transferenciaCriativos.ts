/**
 * Transporte dos criativos entre a tela de Anúncios e o wizard de Campanha.
 *
 * Era `sessionStorage`, e estourava: o navegador corta esse armazenamento em
 * ~5 MB, enquanto cada PNG de 1080×1350 em base64 pesa de 1 a 2,5 MB. Com três
 * ou quatro criativos o `setItem` já lançava QuotaExceededError e o gestor via
 * "Erro ao preparar os criativos" sem saber por quê.
 *
 * IndexedDB não tem esse teto — o limite é uma fração do disco, na casa das
 * centenas de MB. Continua sendo armazenamento local do navegador: nada disso
 * sai da máquina até o wizard publicar.
 */

const BANCO = "pharmaflow";
const LOJA = "transferencia";
const CHAVE = "campanha_criativos";

export interface CriativoTransferido {
  id: string;
  nome: string;
  preco: string;
  imagem?: string | null;
  localizacao: string;
  layout?: string;
  enquadramento?: string;
  titulo?: string;
  subtitulo?: string;
  /** PNG achatado (data URI), pronto para o Meta. */
  png?: string;
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(LOJA)) req.result.createObjectStore(LOJA);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Não foi possível abrir o banco local."));
  });
}

/** Roda a operação na loja e fecha a conexão, dando certo ou não. */
function naLoja<T>(modo: IDBTransactionMode, fn: (loja: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return abrir().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(LOJA, modo);
        const req = fn(tx.objectStore(LOJA));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("Falha ao gravar no banco local."));
        tx.oncomplete = () => db.close();
        tx.onabort = () => { db.close(); reject(tx.error ?? new Error("Gravação cancelada.")); };
      }),
  );
}

/** Guarda os criativos que o wizard vai ler na próxima tela. */
export async function salvarCriativos(criativos: CriativoTransferido[]): Promise<void> {
  await naLoja("readwrite", (loja) => loja.put(criativos, CHAVE));
}

/**
 * Lê os criativos vindos do fluxo de Anúncios. Lista vazia quando não há nada —
 * o wizard também é aberto direto, sem passar por lá.
 */
export async function carregarCriativos(): Promise<CriativoTransferido[]> {
  try {
    const dados = await naLoja<CriativoTransferido[] | undefined>("readonly", (loja) => loja.get(CHAVE));
    return Array.isArray(dados) ? dados : [];
  } catch {
    // Navegador sem IndexedDB (janela privada em alguns casos) não impede o
    // gestor de montar a campanha do zero.
    return [];
  }
}
