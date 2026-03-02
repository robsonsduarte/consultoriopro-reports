import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ArrowLeft, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { api } from '@/lib/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Informe seu email');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar solicitacao';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout>
        <div className="space-y-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
            <MailCheck className="size-6 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Verifique seu email</h1>
            <p className="text-muted-foreground text-sm">
              Se o email estiver cadastrado, voce recebera um link para redefinir sua senha.
            </p>
          </div>
          <Link to="/login">
            <Button variant="outline" className="w-full">
              <ArrowLeft />
              Voltar ao login
            </Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Esqueceu a senha?</h1>
          <p className="text-muted-foreground text-sm">
            Informe seu email e enviaremos um link para redefinir sua senha
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              disabled={loading}
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
              <p className="text-sm text-destructive font-medium">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            {loading ? 'Enviando...' : 'Enviar link de recuperacao'}
          </Button>

          <div className="text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="size-3" />
              Voltar ao login
            </Link>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
