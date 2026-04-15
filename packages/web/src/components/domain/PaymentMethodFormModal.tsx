import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBanks } from '@/hooks/useApi';
import type { PaymentMethod } from '@/hooks/useApi';

const PIX_KEY_TYPES = [
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Telefone' },
  { value: 'random', label: 'Chave aleatoria' },
] as const;

const PIX_KEY_PLACEHOLDERS: Record<string, string> = {
  cpf: '000.000.000-00',
  cnpj: '00.000.000/0000-00',
  email: 'email@exemplo.com',
  phone: '+5511999999999',
  random: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
};

interface PaymentMethodFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FormData) => void;
  paymentMethod: PaymentMethod | null;
  isLoading: boolean;
}

interface FormData {
  methodType: 'pix' | 'ted';
  pixKeyType?: string;
  pixKey?: string;
  holderName: string;
  holderDocType?: string;
  holderDocument?: string;
  bankCode?: string;
  bankName?: string;
  agency?: string;
  accountNumber?: string;
  accountType?: string;
}

const EMPTY_FORM: FormData = {
  methodType: 'pix',
  pixKeyType: 'cpf',
  pixKey: '',
  holderName: '',
  holderDocType: 'cpf',
  holderDocument: '',
  bankCode: '',
  bankName: '',
  agency: '',
  accountNumber: '',
  accountType: 'corrente',
};

export function PaymentMethodFormModal({
  open,
  onClose,
  onSubmit,
  paymentMethod,
  isLoading,
}: PaymentMethodFormModalProps) {
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const { data: banksList = [] } = useBanks();

  const isEditing = !!paymentMethod;

  useEffect(() => {
    if (open) {
      if (paymentMethod) {
        setForm({
          methodType: paymentMethod.methodType,
          pixKeyType: paymentMethod.pixKeyType ?? 'cpf',
          pixKey: paymentMethod.pixKey ?? '',
          holderName: paymentMethod.holderName ?? '',
          holderDocType: paymentMethod.holderDocType ?? 'cpf',
          holderDocument: paymentMethod.holderDocument ?? '',
          bankCode: paymentMethod.bankCode ?? '',
          bankName: paymentMethod.bankName ?? '',
          agency: paymentMethod.agency ?? '',
          accountNumber: paymentMethod.accountNumber ?? '',
          accountType: paymentMethod.accountType ?? 'corrente',
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [open, paymentMethod]);

  function handleChange(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleBankChange(code: string) {
    const bank = banksList.find((b) => b.code === code);
    setForm((prev) => ({
      ...prev,
      bankCode: code,
      bankName: bank?.name ?? '',
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" showCloseButton={!isLoading}>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar metodo de pagamento' : 'Novo metodo de pagamento'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize os dados do metodo de pagamento.'
              : 'Cadastre uma chave PIX ou conta bancaria para recebimento.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo do metodo — so no cadastro */}
          {!isEditing && (
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.methodType}
                onValueChange={(v) => handleChange('methodType', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="ted">Transferencia bancaria (TED)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Nome do titular — comum a ambos */}
          <div className="space-y-2">
            <Label>Nome do titular</Label>
            <Input
              value={form.holderName}
              onChange={(e) => handleChange('holderName', e.target.value)}
              placeholder="Nome completo do titular"
              required
            />
          </div>

          {/* ===== Campos PIX ===== */}
          {form.methodType === 'pix' && (
            <>
              <div className="space-y-2">
                <Label>Tipo da chave PIX</Label>
                <Select
                  value={form.pixKeyType}
                  onValueChange={(v) => handleChange('pixKeyType', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PIX_KEY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Chave PIX</Label>
                <Input
                  value={form.pixKey}
                  onChange={(e) => handleChange('pixKey', e.target.value)}
                  placeholder={PIX_KEY_PLACEHOLDERS[form.pixKeyType ?? 'cpf']}
                  required
                />
              </div>
            </>
          )}

          {/* ===== Campos TED ===== */}
          {form.methodType === 'ted' && (
            <>
              <div className="space-y-2">
                <Label>Banco</Label>
                {banksList.length > 0 ? (
                  <Select
                    value={form.bankCode}
                    onValueChange={handleBankChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o banco" />
                    </SelectTrigger>
                    <SelectContent>
                      {banksList.map((b) => (
                        <SelectItem key={b.code} value={b.code}>
                          {b.code} - {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      value={form.bankCode}
                      onChange={(e) => handleChange('bankCode', e.target.value)}
                      placeholder="Codigo"
                      className="col-span-1"
                      required
                    />
                    <Input
                      value={form.bankName}
                      onChange={(e) => handleChange('bankName', e.target.value)}
                      placeholder="Nome do banco"
                      className="col-span-2"
                      required
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Agencia</Label>
                  <Input
                    value={form.agency}
                    onChange={(e) => handleChange('agency', e.target.value)}
                    placeholder="0001"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Numero da conta</Label>
                  <Input
                    value={form.accountNumber}
                    onChange={(e) => handleChange('accountNumber', e.target.value)}
                    placeholder="12345-6"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tipo da conta</Label>
                <Select
                  value={form.accountType}
                  onValueChange={(v) => handleChange('accountType', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Conta Corrente</SelectItem>
                    <SelectItem value="poupanca">Conta Poupanca</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo de documento</Label>
                  <Select
                    value={form.holderDocType}
                    onValueChange={(v) => handleChange('holderDocType', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="cnpj">CNPJ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Documento</Label>
                  <Input
                    value={form.holderDocument}
                    onChange={(e) => handleChange('holderDocument', e.target.value)}
                    placeholder={form.holderDocType === 'cnpj' ? '00.000.000/0000-00' : '000.000.000-00'}
                    required
                  />
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="size-4 animate-spin" />}
              {isEditing ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
