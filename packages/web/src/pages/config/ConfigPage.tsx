import { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Loader2, Save } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProfessionalSelect } from '@/components/domain/ProfessionalSelect';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useGlobalConfig,
  useUpdateGlobalConfig,
  useProfessionalConfig,
  useUpdateProfessionalConfig,
} from '@/hooks/useApi';

// ---------------------------------------------------------------------------
// Aba Global
// ---------------------------------------------------------------------------

function GlobalTab() {
  const { data: config, isLoading } = useGlobalConfig();
  const updateConfig = useUpdateGlobalConfig();

  const [taxRate, setTaxRate] = useState(0);
  const [shiftPresencial, setShiftPresencial] = useState(0);
  const [shiftOnline, setShiftOnline] = useState(0);

  // Sync state from API data
  useEffect(() => {
    if (config) {
      setTaxRate(config.taxRate);
      setShiftPresencial(config.shiftPresencial);
      setShiftOnline(config.shiftOnline);
    }
  }, [config]);

  function handleSave() {
    updateConfig.mutate({ taxRate, shiftPresencial, shiftOnline });
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuracao Global</CardTitle>
        <CardDescription>
          Valores padrao aplicados a todos os profissionais. Podem ser sobrescritos individualmente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-5 sm:max-w-md">
          <div className="grid gap-2">
            <Label htmlFor="taxRate">Taxa (%)</Label>
            <Input
              id="taxRate"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={taxRate}
              onChange={(e) => setTaxRate(Number(e.target.value))}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="shiftPresencial">Turno Presencial (R$)</Label>
            <Input
              id="shiftPresencial"
              type="number"
              min={0}
              step={0.01}
              value={shiftPresencial}
              onChange={(e) => setShiftPresencial(Number(e.target.value))}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="shiftOnline">Turno Online (R$)</Label>
            <Input
              id="shiftOnline"
              type="number"
              min={0}
              step={0.01}
              value={shiftOnline}
              onChange={(e) => setShiftOnline(Number(e.target.value))}
            />
          </div>

          <Button onClick={handleSave} disabled={updateConfig.isPending} className="w-fit">
            {updateConfig.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Aba Por Profissional
// ---------------------------------------------------------------------------

function ProfessionalTab() {
  const { data: globalConfig } = useGlobalConfig();
  const [selectedId, setSelectedId] = useState('');

  const { data: profConfig, isLoading: profLoading } = useProfessionalConfig(Number(selectedId));
  const updateProfConfig = useUpdateProfessionalConfig();

  const [taxRate, setTaxRate] = useState<string>('');
  const [shiftPresencial, setShiftPresencial] = useState<string>('');
  const [shiftOnline, setShiftOnline] = useState<string>('');
  const [operators, setOperators] = useState<{ id: number; name: string; value: number }[]>([]);

  // Sync from API when profConfig changes
  useEffect(() => {
    if (profConfig) {
      setTaxRate(profConfig.taxRate != null ? String(profConfig.taxRate) : '');
      setShiftPresencial(profConfig.shiftPresencial != null ? String(profConfig.shiftPresencial) : '');
      setShiftOnline(profConfig.shiftOnline != null ? String(profConfig.shiftOnline) : '');
      setOperators(profConfig.operators.map((o, i) => ({ id: Date.now() + i, name: o.name, value: o.value })));
    } else if (selectedId) {
      setTaxRate('');
      setShiftPresencial('');
      setShiftOnline('');
      setOperators([]);
    }
  }, [profConfig, selectedId]);

  function handleProfessionalChange(id: string) {
    setSelectedId(id);
  }

  function addOperator() {
    setOperators((prev) => [
      ...prev,
      { id: Date.now(), name: '', value: 0 },
    ]);
  }

  function removeOperator(id: number) {
    setOperators((prev) => prev.filter((o) => o.id !== id));
  }

  function updateOperator(id: number, field: 'name' | 'value', val: string) {
    setOperators((prev) =>
      prev.map((o) =>
        o.id === id
          ? { ...o, [field]: field === 'value' ? Number(val) : val }
          : o,
      ),
    );
  }

  function handleSave() {
    updateProfConfig.mutate({
      professionalId: Number(selectedId),
      taxRate: taxRate ? Number(taxRate) : null,
      shiftPresencial: shiftPresencial ? Number(shiftPresencial) : null,
      shiftOnline: shiftOnline ? Number(shiftOnline) : null,
      operators: operators.filter((o) => o.name.trim()).map((o) => ({ name: o.name, value: o.value })),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuracao por Profissional</CardTitle>
        <CardDescription>
          Sobrescreve os valores globais para o profissional selecionado. Campos vazios usam o valor global.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-5 sm:max-w-lg">
          {/* Profissional select */}
          <div className="grid gap-2">
            <Label>Profissional</Label>
            <ProfessionalSelect
              value={selectedId}
              onChange={handleProfessionalChange}
              className="w-full"
            />
          </div>

          {profLoading && selectedId && <Skeleton className="h-40 w-full" />}

          {/* Campos numericos */}
          {(!profLoading || !selectedId) && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="pTaxRate">Taxa (%) — sobrescreve global</Label>
                <Input
                  id="pTaxRate"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  placeholder={String(globalConfig?.taxRate ?? 15)}
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="pShiftPresencial">Turno Presencial (R$)</Label>
                <Input
                  id="pShiftPresencial"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder={String(globalConfig?.shiftPresencial ?? 850)}
                  value={shiftPresencial}
                  onChange={(e) => setShiftPresencial(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="pShiftOnline">Turno Online (R$)</Label>
                <Input
                  id="pShiftOnline"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder={String(globalConfig?.shiftOnline ?? 650)}
                  value={shiftOnline}
                  onChange={(e) => setShiftOnline(e.target.value)}
                />
              </div>

              {/* Operadores — lista dinamica */}
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <Label>Operadores</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addOperator}
                  >
                    <Plus className="size-3.5" />
                    Adicionar
                  </Button>
                </div>

                {operators.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum operador cadastrado.
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {operators.map((op) => (
                      <div
                        key={op.id}
                        className="flex items-center gap-2"
                      >
                        <Input
                          placeholder="Nome do operador"
                          value={op.name}
                          onChange={(e) =>
                            updateOperator(op.id, 'name', e.target.value)
                          }
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="Valor (R$)"
                          value={op.value || ''}
                          onChange={(e) =>
                            updateOperator(op.id, 'value', e.target.value)
                          }
                          className="w-32"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeOperator(op.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button onClick={handleSave} disabled={updateProfConfig.isPending || !selectedId} className="w-fit">
                {updateProfConfig.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Salvar
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ConfigPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Settings className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Configuracoes</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie taxas, valores de turno e operadores.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="global">
          <TabsList>
            <TabsTrigger value="global">Global</TabsTrigger>
            <TabsTrigger value="professional">Por Profissional</TabsTrigger>
          </TabsList>

          <TabsContent value="global" className="mt-4">
            <GlobalTab />
          </TabsContent>

          <TabsContent value="professional" className="mt-4">
            <ProfessionalTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
