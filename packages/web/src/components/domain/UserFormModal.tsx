import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type { UserRole } from '@cpro/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useProfessionals } from '@/hooks/useApi';
import type { User } from '@/hooks/useApi';

export interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  apiProfessionalId: number | null;
  isActive?: boolean;
}

interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: UserFormData) => void;
  user?: User | null;
  isLoading?: boolean;
  isSuperAdmin?: boolean;
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'Profissional' },
];

const ROLE_OPTIONS_SUPER: { value: UserRole; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'Profissional' },
];

export function UserFormModal({
  open,
  onClose,
  onSubmit,
  user,
  isLoading = false,
  isSuperAdmin = false,
}: UserFormModalProps) {
  const isEdit = !!user;
  const roles = isSuperAdmin ? ROLE_OPTIONS_SUPER : ROLE_OPTIONS;
  const { data: professionals = [] } = useProfessionals();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [professionalId, setProfessionalId] = useState<string>('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (open) {
      if (user) {
        setName(user.name);
        setEmail(user.email);
        setPassword('');
        setRole(user.role);
        setProfessionalId(user.apiProfessionalId ? String(user.apiProfessionalId) : '');
        setIsActive(user.isActive);
      } else {
        setName('');
        setEmail('');
        setPassword('');
        setRole('user');
        setProfessionalId('');
        setIsActive(true);
      }
    }
  }, [open, user]);

  function handleSubmit() {
    onSubmit({
      name,
      email,
      password,
      role,
      apiProfessionalId: professionalId ? Number(professionalId) : null,
      ...(isEdit ? { isActive } : {}),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent showCloseButton={!isLoading}>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Usuario' : 'Novo Usuario'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Altere os dados do usuario. Deixe a senha em branco para manter a atual.'
              : 'Preencha os dados para criar um novo usuario.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="userName">Nome</Label>
            <Input
              id="userName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="userEmail">Email</Label>
            <Input
              id="userEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="userPassword">
              Senha{isEdit ? ' (deixe vazio para manter)' : ''}
            </Label>
            <Input
              id="userPassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEdit ? '••••••' : 'Min. 6 caracteres'}
            />
          </div>

          <div className="grid gap-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {role === 'user' && (
            <div className="grid gap-2">
              <Label>Profissional vinculado</Label>
              <Select value={professionalId} onValueChange={setProfessionalId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um profissional" />
                </SelectTrigger>
                <SelectContent>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isEdit && (
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={isActive ? 'active' : 'inactive'} onValueChange={(v) => setIsActive(v === 'active')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
