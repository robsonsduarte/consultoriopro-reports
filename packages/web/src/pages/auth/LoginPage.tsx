import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import type { AuthUser } from '@cpro/shared';

interface LoginApiResponse {
  success: boolean;
  data: {
    user: AuthUser;
    accessToken: string;
    mustChangePassword: boolean;
  };
}

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Preencha todos os campos');
      return;
    }

    if (password.length < 6) {
      setError('Senha deve ter no minimo 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post<LoginApiResponse>('/auth/login', { email, password });
      const { user, accessToken, mustChangePassword } = res.data;

      login(user, accessToken);

      if (mustChangePassword) {
        navigate('/change-password', { replace: true });
      } else if (user.role === 'super_admin' || user.role === 'admin') {
        navigate('/', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao fazer login';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Bem-vindo de volta</h1>
          <p className="text-muted-foreground text-sm">
            Entre com suas credenciais para acessar o sistema
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              <Link
                to="/forgot-password"
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Esqueceu a senha?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
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
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
