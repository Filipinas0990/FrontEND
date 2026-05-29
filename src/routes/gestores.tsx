import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Building2, ShieldCheck, User } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { getGestores, createGestor, updateGestor, deleteGestor, type Gestor } from "@/lib/api";
import { isAdmin, getUser } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/gestores")({
  component: GestoresPage,
  head: () => ({ meta: [{ title: "Gestores — GrupoSymbol" }] }),
});

// ── Form dialog ────────────────────────────────────────────────────────────

function GestorDialog({
  open,
  onOpenChange,
  editing,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Gestor | null;
  onSave: (data: { nome: string; email: string; senha: string }) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({ nome: editing?.nome ?? "", email: editing?.email ?? "", senha: "" });

  useEffect(() => {
    setForm({ nome: editing?.nome ?? "", email: editing?.email ?? "", senha: "" });
  }, [editing, open]);

  const set = (f: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Gestor" : "Novo Gestor"}</DialogTitle>
        </DialogHeader>
        <form
          id="gestor-form"
          onSubmit={(e) => { e.preventDefault(); onSave(form); }}
          className="space-y-3 py-2"
        >
          <div>
            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Nome</label>
            <input required value={form.nome} onChange={set("nome")} className="form-input mt-1" placeholder="Carlos Pereira" />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">E-mail</label>
            <input required type="email" value={form.email} onChange={set("email")} className="form-input mt-1" placeholder="carlos@agencia.com" />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">
              Senha {editing && <span className="normal-case font-normal text-zinc-400">(deixe em branco para não alterar)</span>}
            </label>
            <input
              type="password"
              required={!editing}
              value={form.senha}
              onChange={set("senha")}
              className="form-input mt-1"
              placeholder={editing ? "••••••••" : "Mínimo 8 caracteres"}
              minLength={editing ? undefined : 8}
            />
          </div>
        </form>
        <DialogFooter>
          <button type="button" onClick={() => onOpenChange(false)} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">
            Cancelar
          </button>
          <button type="submit" form="gestor-form" disabled={saving} className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-md hover:opacity-90 disabled:opacity-60">
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

function GestoresPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const admin = isAdmin();
  const currentUser = getUser();

  useEffect(() => {
    if (!admin) {
      toast.error("Acesso negado");
      navigate({ to: "/" });
    }
  }, [admin, navigate]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Gestor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Gestor | null>(null);

  const { data: gestores = [], isLoading } = useQuery({
    queryKey: ["gestores"],
    queryFn: getGestores,
  });

  const createMut = useMutation({
    mutationFn: createGestor,
    onSuccess: () => {
      toast.success("Gestor criado com sucesso!");
      qc.invalidateQueries({ queryKey: ["gestores"] });
      setDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { nome?: string; email?: string; senha?: string } }) =>
      updateGestor(id, data),
    onSuccess: () => {
      toast.success("Gestor atualizado!");
      qc.invalidateQueries({ queryKey: ["gestores"] });
      setDialogOpen(false);
      setEditTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteGestor,
    onSuccess: () => {
      toast.success("Gestor desativado.");
      qc.invalidateQueries({ queryKey: ["gestores"] });
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSave = (form: { nome: string; email: string; senha: string }) => {
    if (editTarget) {
      const patch: { nome?: string; email?: string; senha?: string } = {
        nome: form.nome,
        email: form.email,
      };
      if (form.senha) patch.senha = form.senha;
      updateMut.mutate({ id: editTarget.id, data: patch });
    } else {
      createMut.mutate(form);
    }
  };

  const saving = createMut.isPending || updateMut.isPending;

  if (!admin) return null;

  return (
    <AppShell
      title="Gestores de Tráfego"
      headerRight={
        <button
          onClick={() => { setEditTarget(null); setDialogOpen(true); }}
          className="flex items-center gap-2 py-2 px-3 text-sm font-medium bg-brand text-white rounded-md hover:opacity-90"
        >
          <Plus className="size-3.5" /> Novo Gestor
        </button>
      }
    >
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard
          label="Total de Gestores"
          value={String(gestores.filter((g) => !g.is_admin).length)}
          sub="Gestores ativos"
        />
        <SummaryCard
          label="Farmácias Gerenciadas"
          value={String(gestores.filter((g) => !g.is_admin).reduce((s, g) => s + g.farmacias, 0))}
          sub="Total vinculadas"
        />
        <SummaryCard
          label="Sem Gestor"
          value={String(Math.max(0, (gestores.find((g) => g.is_admin)?.farmacias ?? 0)))}
          sub="Farmácias sem vínculo"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100">
          <h3 className="text-sm font-semibold text-zinc-900">Equipe</h3>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-zinc-500">Carregando...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 border-b border-zinc-100">
                {["Gestor", "E-mail", "Tipo", "Farmácias", "Desde"].map((h) => (
                  <th key={h} className="px-6 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
                <th className="px-6 py-3 text-right text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {gestores.map((g) => {
                const isSelf = g.id === currentUser?.id;
                return (
                  <tr key={g.id} className="hover:bg-zinc-50/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-brand/10 grid place-items-center text-brand text-xs font-semibold">
                          {g.nome.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-zinc-900">{g.nome}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600">{g.email}</td>
                    <td className="px-6 py-4">
                      {g.is_admin ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-brand/10 text-brand ring-1 ring-brand/20">
                          <ShieldCheck className="size-3" /> Super Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200">
                          <User className="size-3" /> Gestor
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1 text-sm text-zinc-700">
                        <Building2 className="size-3.5 text-zinc-400" />
                        {g.farmacias}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-500">
                      {new Date(g.criado_em).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => { setEditTarget(g); setDialogOpen(true); }}
                          className="flex items-center gap-1 text-[10px] font-medium text-zinc-500 hover:text-zinc-900"
                        >
                          <Pencil className="size-3" /> Editar
                        </button>
                        {!isSelf && !g.is_admin && (
                          <button
                            onClick={() => setDeleteTarget(g)}
                            className="flex items-center gap-1 text-[10px] font-medium text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="size-3" /> Desativar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <GestorDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditTarget(null); }}
        editing={editTarget}
        onSave={handleSave}
        saving={saving}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar gestor?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.nome}" perderá o acesso à plataforma.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white p-6 rounded-xl ring-1 ring-black/5 shadow-sm">
      <span className="text-xs text-zinc-500 font-medium">{label}</span>
      <div className="text-2xl font-semibold tracking-tight mt-1">{value}</div>
      <div className="text-[10px] text-zinc-400 font-medium mt-1">{sub}</div>
    </div>
  );
}
