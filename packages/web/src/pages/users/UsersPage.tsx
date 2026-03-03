import { useState, useMemo } from 'react';
import {
  Users,
  Plus,
  RefreshCw,
  Search,
  Pencil,
  KeyRound,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { UserFormModal } from '@/components/domain/UserFormModal';
import { ConfirmDialog } from '@/components/domain/ConfirmDialog';
import { SortableHeader } from '@/components/domain/SortableHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSortableTable } from '@/hooks/useSortableTable';
import { useAuthStore } from '@/stores/authStore';
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useResetPassword,
  useSyncProfessionals,
} from '@/hooks/useApi';
import type { User } from '@/hooks/useApi';
import { Skeleton } from '@/components/ui/skeleton';
import type { UserRole } from '@cpro/shared';

// ---------------------------------------------------------------------------
// Role badge
// ---------------------------------------------------------------------------

const ROLE_STYLES: Record<UserRole, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  super_admin: { label: 'Super Admin', variant: 'default' },
  admin: { label: 'Admin', variant: 'secondary' },
  user: { label: 'Profissional', variant: 'outline' },
};

function RoleBadge({ role }: { role: UserRole }) {
  const style = ROLE_STYLES[role];
  return <Badge variant={style.variant}>{style.label}</Badge>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function UsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'super_admin';

  // API hooks
  const { data: users = [], isLoading } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const resetPassword = useResetPassword();
  const syncProfessionals = useSyncProfessionals();

  // Search
  const [search, setSearch] = useState('');

  // Pagination
  const [page, setPage] = useState(1);

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }, [search, users]);

  // Sort
  const { sorted, sortKey, sortDir, toggleSort } = useSortableTable(
    filtered,
    'name' as keyof User,
  );

  // Pagination computed
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = useMemo(
    () => sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [sorted, page],
  );

  // Reset page on search change
  useMemo(() => setPage(1), [search]);

  // Handlers
  function handleSync() {
    syncProfessionals.mutate(undefined, {
      onSuccess: () => setSyncOpen(false),
    });
  }

  function handleResetPassword() {
    if (!resetTarget) return;
    resetPassword.mutate(resetTarget.id, {
      onSuccess: (data) => {
        setResetTarget(null);
        alert(`Senha temporaria: ${data.tempPassword}`);
      },
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteUser.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  }

  function handleFormSubmit(formData: { name: string; email: string; password: string; role: UserRole; apiProfessionalId: number | null; isActive?: boolean }) {
    if (editingUser) {
      updateUser.mutate(
        { id: editingUser.id, ...formData },
        { onSuccess: () => { setFormOpen(false); setEditingUser(null); } },
      );
    } else {
      createUser.mutate(formData, {
        onSuccess: () => { setFormOpen(false); setEditingUser(null); },
      });
    }
  }

  function openEdit(user: User) {
    setEditingUser(user);
    setFormOpen(true);
  }

  function openCreate() {
    setEditingUser(null);
    setFormOpen(true);
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Usuarios</h1>
              <p className="text-sm text-muted-foreground">
                {users.length} usuario{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setSyncOpen(true)}>
              <RefreshCw className="size-4" />
              Sincronizar
            </Button>
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Novo Usuario
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ) : paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
            <Users className="mb-3 size-10 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">
              Nenhum usuario encontrado
            </p>
            {search && (
              <p className="mt-1 text-xs text-muted-foreground/70">
                Tente um termo de busca diferente.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortableHeader
                      label="Nome"
                      sortKey="name"
                      currentKey={String(sortKey)}
                      currentDir={sortDir}
                      onSort={(k) => toggleSort(k as keyof User)}
                    />
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">
                    <SortableHeader
                      label="Email"
                      sortKey="email"
                      currentKey={String(sortKey)}
                      currentDir={sortDir}
                      onSort={(k) => toggleSort(k as keyof User)}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      label="Role"
                      sortKey="role"
                      currentKey={String(sortKey)}
                      currentDir={sortDir}
                      onSort={(k) => toggleSort(k as keyof User)}
                    />
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Profissional</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {u.email}
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={u.role} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {u.apiProfessionalId ? `ID: ${u.apiProfessionalId}` : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? 'default' : 'destructive'}>
                        {u.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          onClick={() => openEdit(u)}
                          title="Editar"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          onClick={() => setResetTarget(u)}
                          title="Resetar senha"
                        >
                          <KeyRound className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget(u)}
                          title="Excluir"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Pagina {page} de {totalPages}
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Criar/Editar */}
      <UserFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingUser(null); }}
        onSubmit={handleFormSubmit}
        user={editingUser}
        isLoading={createUser.isPending || updateUser.isPending}
        isSuperAdmin={isSuperAdmin}
      />

      {/* Dialog Sincronizar */}
      <ConfirmDialog
        open={syncOpen}
        onClose={() => setSyncOpen(false)}
        onConfirm={handleSync}
        title="Sincronizar Profissionais"
        description="Deseja sincronizar a lista de profissionais com a API externa? Novos profissionais serao criados como usuarios inativos."
        confirmLabel="Sincronizar"
        isLoading={syncProfessionals.isPending}
      />

      {/* Dialog Resetar Senha */}
      <ConfirmDialog
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        onConfirm={handleResetPassword}
        title="Resetar Senha"
        description={
          resetTarget
            ? `Deseja resetar a senha de "${resetTarget.name}"? O usuario precisara criar uma nova senha no proximo login.`
            : ''
        }
        confirmLabel="Resetar"
        isLoading={resetPassword.isPending}
      />

      {/* Dialog Excluir */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir Usuario"
        description={
          deleteTarget
            ? `Deseja excluir o usuario "${deleteTarget.name}" (${deleteTarget.email})? Esta acao nao pode ser desfeita.`
            : ''
        }
        confirmLabel="Excluir"
        variant="destructive"
        isLoading={deleteUser.isPending}
      />
    </AppLayout>
  );
}
