import { useState } from 'react';
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  Star,
  Landmark,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { ConfirmDialog } from '@/components/domain/ConfirmDialog';
import { PaymentMethodFormModal } from '@/components/domain/PaymentMethodFormModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  usePaymentMethods,
  useCreatePaymentMethod,
  useUpdatePaymentMethod,
  useDeletePaymentMethod,
  useSetPrimaryPaymentMethod,
} from '@/hooks/useApi';
import type { PaymentMethod, PaymentMethodInput } from '@/hooks/useApi';

const PIX_KEY_TYPE_LABELS: Record<string, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'Email',
  phone: 'Telefone',
  random: 'Chave aleatoria',
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  corrente: 'Conta Corrente',
  poupanca: 'Conta Poupanca',
};

function PaymentMethodCard({
  method,
  onEdit,
  onDelete,
  onSetPrimary,
}: {
  method: PaymentMethod;
  onEdit: () => void;
  onDelete: () => void;
  onSetPrimary: () => void;
}) {
  return (
    <Card className="gap-0 py-0 overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Info */}
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-md bg-muted p-2 shrink-0">
              {method.methodType === 'pix' ? (
                <CreditCard className="size-5 text-muted-foreground" />
              ) : (
                <Landmark className="size-5 text-muted-foreground" />
              )}
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={method.methodType === 'pix' ? 'default' : 'secondary'}>
                  {method.methodType === 'pix' ? 'PIX' : 'TED'}
                </Badge>
                {method.isPrimary && (
                  <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:text-yellow-400">
                    <Star className="size-3 mr-1 fill-current" />
                    Padrao
                  </Badge>
                )}
              </div>

              {method.methodType === 'pix' ? (
                <>
                  <p className="text-sm">
                    <span className="text-muted-foreground">
                      {PIX_KEY_TYPE_LABELS[method.pixKeyType ?? ''] ?? method.pixKeyType}:
                    </span>{' '}
                    <span className="font-medium">{method.pixKey}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Titular: {method.holderName}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Banco:</span>{' '}
                    <span className="font-medium">
                      {method.bankCode} - {method.bankName}
                    </span>
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Ag:</span> {method.agency}
                    {' | '}
                    <span className="text-muted-foreground">Conta:</span> {method.accountNumber}
                    {' | '}
                    {ACCOUNT_TYPE_LABELS[method.accountType ?? ''] ?? method.accountType}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Titular: {method.holderName}
                    {method.holderDocument && ` (${method.holderDocType?.toUpperCase()}: ${method.holderDocument})`}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Acoes */}
          <div className="flex items-center gap-1 shrink-0">
            {!method.isPrimary && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onSetPrimary}
                title="Definir como padrao"
              >
                <Star className="size-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onEdit} title="Editar">
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              title="Excluir"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PaymentPage() {
  const { data: methods = [], isLoading } = usePaymentMethods();

  const createMethod = useCreatePaymentMethod();
  const updateMethod = useUpdatePaymentMethod();
  const deleteMethod = useDeletePaymentMethod();
  const setPrimary = useSetPrimaryPaymentMethod();

  const [formOpen, setFormOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentMethod | null>(null);

  function handleCreate() {
    setEditingMethod(null);
    setFormOpen(true);
  }

  function handleEdit(method: PaymentMethod) {
    setEditingMethod(method);
    setFormOpen(true);
  }

  function handleFormSubmit(data: PaymentMethodInput) {
    if (editingMethod) {
      updateMethod.mutate(
        { id: editingMethod.id, ...data },
        {
          onSuccess: () => {
            toast.success('Metodo de pagamento atualizado');
            setFormOpen(false);
          },
          onError: (err) => toast.error(err.message),
        },
      );
    } else {
      createMethod.mutate(data, {
        onSuccess: () => {
          toast.success('Metodo de pagamento cadastrado');
          setFormOpen(false);
        },
        onError: (err) => toast.error(err.message),
      });
    }
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteMethod.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Metodo de pagamento removido');
        setDeleteTarget(null);
      },
      onError: (err) => toast.error(err.message),
    });
  }

  function handleSetPrimary(method: PaymentMethod) {
    setPrimary.mutate(method.id, {
      onSuccess: () => toast.success('Metodo definido como padrao'),
      onError: (err) => toast.error(err.message),
    });
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-muted p-2">
              <CreditCard className="size-6 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Dados para pagamento</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie suas chaves PIX e contas bancarias
              </p>
            </div>
          </div>

          <Button onClick={handleCreate}>
            <Plus className="size-4" />
            Novo metodo
          </Button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
        )}

        {/* Lista */}
        {!isLoading && methods.length === 0 && (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <CreditCard className="mx-auto size-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhum metodo de pagamento cadastrado.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Cadastre uma chave PIX ou conta bancaria para receber seus pagamentos.
            </p>
          </div>
        )}

        {!isLoading && methods.length > 0 && (
          <div className="space-y-3">
            {methods.map((m) => (
              <PaymentMethodCard
                key={m.id}
                method={m}
                onEdit={() => handleEdit(m)}
                onDelete={() => setDeleteTarget(m)}
                onSetPrimary={() => handleSetPrimary(m)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal de formulario */}
      <PaymentMethodFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        paymentMethod={editingMethod}
        isLoading={createMethod.isPending || updateMethod.isPending}
      />

      {/* Confirmacao de exclusao */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir metodo de pagamento?"
        description={
          deleteTarget?.isPrimary
            ? 'Este e seu metodo padrao. Ao excluir, o proximo metodo mais antigo sera definido como padrao automaticamente.'
            : 'Tem certeza que deseja excluir este metodo de pagamento?'
        }
        confirmLabel="Excluir"
        variant="destructive"
        isLoading={deleteMethod.isPending}
      />
    </AppLayout>
  );
}
