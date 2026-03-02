import type { ReactNode } from 'react';
import { Logo } from '@/components/domain/Logo';
import { ThemeToggle } from '@/components/domain/ThemeToggle';

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex">
      {/* Branding panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[50%] relative overflow-hidden flex-col justify-between bg-gradient-to-br from-primary via-primary/90 to-primary/70 p-10">
        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-16 size-80 rounded-full bg-white/5" />
        <div className="absolute top-1/2 right-1/4 size-48 rounded-full bg-white/5" />

        <Logo variant="light" size="lg" />

        <div className="relative z-10 space-y-6">
          <blockquote className="space-y-3">
            <p className="text-lg text-white/90 leading-relaxed font-light max-w-md">
              "Gestao financeira simplificada para quem cuida da saude das pessoas."
            </p>
          </blockquote>
          <div className="flex items-center gap-3 text-white/60 text-sm">
            <div className="h-px flex-1 bg-white/20 max-w-16" />
            <span>Relatorios, turnos e pagamentos em um so lugar</span>
          </div>
        </div>

        <p className="text-xs text-white/40 relative z-10">
          ConsultorioPro Reports v2
        </p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col">
        {/* Top bar with theme toggle */}
        <div className="flex items-center justify-between p-4 lg:p-6">
          <div className="lg:hidden">
            <Logo size="sm" />
          </div>
          <div className="lg:ml-auto">
            <ThemeToggle />
          </div>
        </div>

        {/* Centered form area */}
        <div className="flex-1 flex items-center justify-center px-4 pb-8">
          <div className="w-full max-w-sm">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
