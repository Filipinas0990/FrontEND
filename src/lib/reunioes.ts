// ── Tipos ──────────────────────────────────────────────────────────────────

export type ReuniaoStatus = "agendada" | "realizada" | "cancelada";

export interface Reuniao {
  id: string;
  farmaciaId: number;
  farmaciaNome: string;
  data: string;       // "YYYY-MM-DD"
  hora: string;       // "HH:MM"
  observacao: string;
  status: ReuniaoStatus;
  criadaEm: string;   // ISO timestamp
}

// ── Chave do localStorage ──────────────────────────────────────────────────

const KEY = "pharma_reunioes";

// ── CRUD ───────────────────────────────────────────────────────────────────

export function listarReunioes(): Reuniao[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Reuniao[];
  } catch {
    return [];
  }
}

export function salvarReunioes(lista: Reuniao[]): void {
  localStorage.setItem(KEY, JSON.stringify(lista));
}

export function criarReuniao(
  farmaciaId: number,
  farmaciaNome: string,
  data: string,
  hora: string,
  observacao: string,
): Reuniao {
  const nova: Reuniao = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    farmaciaId,
    farmaciaNome,
    data,
    hora,
    observacao,
    status: "agendada",
    criadaEm: new Date().toISOString(),
  };
  const lista = listarReunioes();
  lista.push(nova);
  salvarReunioes(lista);
  return nova;
}

export function atualizarReuniao(id: string, patch: Partial<Omit<Reuniao, "id" | "criadaEm">>): void {
  const lista = listarReunioes().map((r) => (r.id === id ? { ...r, ...patch } : r));
  salvarReunioes(lista);
}

export function excluirReuniao(id: string): void {
  salvarReunioes(listarReunioes().filter((r) => r.id !== id));
}

// ── Helpers de consulta ────────────────────────────────────────────────────

export function reunioesDaFarmacia(farmaciaId: number): Reuniao[] {
  return listarReunioes()
    .filter((r) => r.farmaciaId === farmaciaId)
    .sort((a, b) => `${b.data}T${b.hora}`.localeCompare(`${a.data}T${a.hora}`));
}

export function totalReunioesMes(farmaciaId: number, ano: number, mes: number): number {
  // mes: 1-12
  const prefix = `${ano}-${String(mes).padStart(2, "0")}`;
  return listarReunioes().filter(
    (r) => r.farmaciaId === farmaciaId && r.data.startsWith(prefix) && r.status !== "cancelada",
  ).length;
}

export function totalReunioesGeral(farmaciaId: number): number {
  return listarReunioes().filter(
    (r) => r.farmaciaId === farmaciaId && r.status !== "cancelada",
  ).length;
}

export function proximaReuniao(farmaciaId: number): Reuniao | null {
  const hoje = new Date().toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
  const futuras = listarReunioes()
    .filter(
      (r) =>
        r.farmaciaId === farmaciaId &&
        r.status === "agendada" &&
        `${r.data}T${r.hora}` >= hoje,
    )
    .sort((a, b) => `${a.data}T${a.hora}`.localeCompare(`${b.data}T${b.hora}`));
  return futuras[0] ?? null;
}

// ── Formatação ─────────────────────────────────────────────────────────────

export function fmtDataHora(data: string, hora: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano} às ${hora}`;
}

export function fmtDataCurta(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export function nomeMesAno(ano: number, mes: number): string {
  return `${MESES[mes - 1]}/${ano}`;
}
