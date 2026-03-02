# ConsultorioPro Reports v2 — Briefing para Equipe UX/Frontend

> Documento de referencia para construcao das telas.
> Stack: React 19 + Vite 6 + Tailwind v4 + shadcn/ui + react-router-dom + @tanstack/react-query + zustand

---

## 1. Ambiente de Desenvolvimento

```bash
cd consultoriopro-ts
pnpm dev:web     # Frontend → http://localhost:5173 (hot-reload)
pnpm dev:api     # Backend  → http://localhost:3001
pnpm dev         # Ambos em paralelo
```

O Vite proxia `/api/*` para `localhost:3001`, entao no frontend basta chamar `/api/health`, `/api/auth/login`, etc.

### Client HTTP

Arquivo pronto em `packages/web/src/lib/api.ts`:

```typescript
import { api } from '@/lib/api';

// GET
const data = await api.get<HealthResponse>('/api/health');

// POST
const result = await api.post<LoginResponse>('/api/auth/login', { email, password });

// PUT, PATCH, DELETE tambem disponiveis
```

O token JWT e armazenado em `localStorage('cpro-token')` e enviado automaticamente como `Bearer` header.

---

## 2. Estrutura de Pastas do Frontend

```
packages/web/src/
├── main.tsx                # Entry point (React, QueryClient, BrowserRouter)
├── App.tsx                 # Router principal — DEFINIR ROTAS AQUI
├── index.css               # @import "tailwindcss"
├── vite-env.d.ts
├── lib/
│   └── api.ts              # Cliente HTTP (fetch + JWT auto)
├── stores/                 # ← CRIAR (Zustand)
│   ├── authStore.ts        # user, token, login(), logout()
│   └── uiStore.ts          # sidebarCollapsed, currentMonth
├── hooks/                  # ← CRIAR (React Query hooks)
│   ├── useAuth.ts
│   ├── useDashboard.ts
│   ├── useShifts.ts
│   └── ...
├── pages/                  # ← CRIAR (uma pasta por tela)
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   └── ChangePasswordPage.tsx
│   ├── dashboard/
│   │   ├── DashboardTablePage.tsx     # Admin — tabela
│   │   ├── DashboardCardsPage.tsx     # Admin — cards mensais
│   │   └── ProfessionalDashPage.tsx   # Profissional
│   ├── report/
│   │   └── ReportPage.tsx             # Relatorio completo
│   ├── shifts/
│   │   └── ShiftsPage.tsx
│   ├── config/
│   │   └── ConfigPage.tsx
│   ├── users/
│   │   └── UsersPage.tsx
│   ├── payment/
│   │   └── PaymentPage.tsx
│   └── btg/
│       └── BtgPanelPage.tsx
└── components/             # ← CRIAR
    ├── ui/                 # shadcn/ui (Button, Input, Select, Dialog, Table, Toast, etc.)
    ├── layout/
    │   ├── AppLayout.tsx   # Sidebar + Header + Content area
    │   ├── Sidebar.tsx
    │   ├── AppHeader.tsx
    │   └── UserMenu.tsx
    └── domain/             # Componentes especificos do dominio
        ├── MonthPicker.tsx
        ├── ProfessionalSelect.tsx
        ├── ReleaseStatusBadge.tsx
        ├── ShiftTable.tsx
        └── ...
```

---

## 3. Rotas (React Router)

| Rota | Componente | Acesso | Descricao |
|------|-----------|--------|-----------|
| `/login` | LoginPage | Publica | Formulario de login |
| `/change-password` | ChangePasswordPage | Auth | Troca de senha (primeiro acesso) |
| `/` | DashboardTablePage | Admin | Dashboard tabela detalhada |
| `/dashboard/cards` | DashboardCardsPage | Admin | Dashboard cards mensais |
| `/dashboard` | ProfessionalDashPage | User | Dashboard do profissional |
| `/report/:id` | ReportPage | Auth | Relatorio completo (query `?month=YYYY-MM`) |
| `/shifts` | ShiftsPage | Admin | Gerenciamento de turnos |
| `/shifts/:id` | ShiftsPage | Admin | Turnos de profissional especifico |
| `/config` | ConfigPage | Admin | Configuracoes globais e por profissional |
| `/users` | UsersPage | Admin | Gerenciamento de usuarios |
| `/payment` | PaymentPage | User | Metodos de pagamento do profissional |
| `/payment/:id` | PaymentPage | Admin | Ver metodos de pagamento (admin view) |
| `/btg` | BtgPanelPage | Admin | Painel de integracao BTG Pactual |

### Controle de Acesso (Roles)

```typescript
type UserRole = 'super_admin' | 'admin' | 'user';

const isAdmin = (role: UserRole) => role === 'super_admin' || role === 'admin';
const isSuperAdmin = (role: UserRole) => role === 'super_admin';
const isProfessional = (role: UserRole) => role === 'user';
```

- **Admin routes** (`/`, `/dashboard/cards`, `/shifts`, `/config`, `/users`, `/btg`): super_admin + admin
- **User routes** (`/dashboard`, `/payment`): user (profissional)
- **Shared routes** (`/report/:id`): todos (admin ve qualquer, user ve so o seu)

---

## 4. State Management (Zustand)

### authStore

```typescript
interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
}
```

- Persistir em `localStorage` (key: `cpro-auth`)
- `logout()` limpa store + `localStorage('cpro-token')` + navega para `/login`

### uiStore

```typescript
interface UiState {
  sidebarCollapsed: boolean;
  currentMonth: string; // YYYY-MM (default: mes atual)
  toggleSidebar: () => void;
  setCurrentMonth: (month: string) => void;
}
```

- `currentMonth` e global — usado por Dashboard, Report, Shifts
- NAO persistir (reseta ao recarregar)

---

## 5. Especificacao por Tela

### 5.1 Login (`/login`)

**Layout:** Standalone (sem sidebar/header)

| Elemento | Tipo | Comportamento |
|----------|------|---------------|
| Input email | email | Obrigatorio, validacao format |
| Input senha | password | Min 6 chars |
| Botao "Entrar" | submit | `POST /api/auth/login` |
| Loading state | spinner no botao | Enquanto request |
| Erro | toast ou inline | "Credenciais invalidas" |

**Fluxo pos-login:**
- Se `mustChangePassword === true` → navegar para `/change-password`
- Se admin → navegar para `/`
- Se user → navegar para `/dashboard`

---

### 5.2 Troca de Senha (`/change-password`)

**Layout:** Standalone

| Elemento | Tipo | Validacao |
|----------|------|-----------|
| Senha atual | password | Obrigatoria |
| Nova senha | password | Min 6 chars |
| Confirmar senha | password | Deve coincidir |
| Botao "Alterar" | submit | `POST /api/auth/change-password` |

---

### 5.3 Dashboard Admin — Tabela (`/`)

**Layout:** AppLayout (sidebar + header com MonthPicker)

| Elemento | Tipo | Comportamento |
|----------|------|---------------|
| MonthPicker | componente | Altera `uiStore.currentMonth` |
| Link "Ver Cards" | navegacao | → `/dashboard/cards` |
| Tabela de profissionais | DataTable | Colunas abaixo |
| Botao "Exportar CSV" | button | Gera download CSV dos dados em tela |
| Botao "Liberar Todos" | button (admin) | Libera todos os pendentes do mes |

**Colunas da tabela:**

| Coluna | Tipo | Sortable |
|--------|------|----------|
| Nome | string | Sim |
| Receita (R$) | currency | Sim |
| Imposto (R$) | currency | Sim |
| Turnos | count | Sim |
| Liquido (R$) | currency | Sim |
| Status | ReleaseStatusBadge | Sim |

**Linha clicavel:** navega para `/report/{id}?month={currentMonth}`

**Dados:** Batch load — busca lista de profissionais, depois gera relatorio de cada um em paralelo (batch de 4).

---

### 5.4 Dashboard Admin — Cards (`/dashboard/cards`)

**Layout:** AppLayout

| Elemento | Tipo | Comportamento |
|----------|------|---------------|
| Grid de cards mensais | cards | 1 card por mes com dados existentes |
| Card click | navegacao | → `/?month={YYYY-MM}` (tabela do mes) |

**Conteudo de cada card:**
- Mes/Ano
- Contadores por status: pendente (amarelo), aprovado (verde), contestado (vermelho), em revisao (azul), resolvido (cinza)
- Total de profissionais

---

### 5.5 Dashboard Profissional (`/dashboard`)

**Layout:** AppLayout (sidebar reduzida — sem links admin)

| Elemento | Tipo | Comportamento |
|----------|------|---------------|
| Cards resumo | 4 cards | Receita, Imposto, Turnos, Liquido |
| Lista de meses liberados | lista | Status por mes |
| Botao "Aprovar" | button (por mes) | `POST /api/release/respond {action:'approved'}` |
| Botao "Contestar" | button (por mes) | Abre textarea + `POST /api/release/respond {action:'contested', note}` |
| Link "Ver Relatorio" | link (por mes) | → `/report/{id}?month={mes}` |

---

### 5.6 Relatorio (`/report/:id`)

**Tela mais complexa — 4 abas**

**Layout:** AppLayout

**Header do relatorio:**

| Elemento | Tipo | Comportamento |
|----------|------|---------------|
| ProfessionalSelect | select (admin) | Muda profissional ativo |
| MonthPicker | componente | Muda mes |
| Barra de status (release) | condicional | Botoes dependem do role e status |

**Barra de Release (Admin):**

| Status atual | Botoes disponiveis |
|-------------|-------------------|
| Nenhum | "Liberar" |
| Pending | "Revogar" |
| Approved | "Marcar Pago", "Revogar" |
| Contested | "Resolver" |
| In Review | "Resolver" |
| Resolved | "Marcar Pago" |

**Barra de Release (Profissional):**

| Status atual | Botoes disponiveis |
|-------------|-------------------|
| Pending | "Aprovar", "Contestar" |
| Outros | Somente leitura |

**Se profissional e relatorio NAO liberado:** mostrar tela de bloqueio ("Relatorio nao liberado ainda").

#### Aba 1: Atendimentos

| Coluna | Tipo | Sortable |
|--------|------|----------|
| Data | date (DD/MM/YYYY) | Sim |
| Paciente | string | Sim |
| Operador | string | Nao |
| Valor (R$) | currency | Sim |
| Pago | icone toggle (admin) | Nao |
| Excluir | icone lixeira (admin) | Nao |

#### Aba 2: Operadores

| Coluna | Tipo | Sortable |
|--------|------|----------|
| Nome | string | Sim |
| Qtd Atendimentos | number | Sim |
| Valor Total (R$) | currency | Sim |

#### Aba 3: Turnos

| Coluna | Tipo | Editavel (inline) |
|--------|------|-------------------|
| Dia | select (Seg-Sab) | Sim (click → select) |
| Periodo | select (Manha/Tarde/Noite) | Sim |
| Tipo | badge (Presencial/Online) | Sim (click → select) |
| Valor (R$) | number | Sim (click → input) |
| Origem | badge (manual/inferido) | Nao |
| Acoes | icone + (salvar) / lixeira (deletar) | — |

**Botao "Adicionar Turno":** Abre modal (FormModal) com: dia, periodo, tipo, valor pre-preenchido da config.

#### Aba 4: Contestacao

| Elemento | Tipo | Comportamento |
|----------|------|---------------|
| Thread de mensagens | chat-like | Lista mensagens em ordem cronologica |
| Campo de resposta | textarea | Input de nova mensagem |
| Botao "Enviar" | button | `POST /api/release/thread/reply` |
| Botao "Resolver" (admin) | button | `POST /api/release/thread/status {status:'resolved'}` |

---

### 5.7 Turnos (`/shifts`)

**Layout:** AppLayout
**Acesso:** Admin

| Elemento | Tipo | Comportamento |
|----------|------|---------------|
| ProfessionalSelect | select | Muda profissional → navega `/shifts/{id}` |
| MonthPicker | componente | Muda mes |
| Tabela de turnos | DataTable | Colunas: Dia, Periodo, Tipo, Valor (R$), Origem, Acoes |
| Botao "Turno Manual" | button | Abre modal de criacao |
| Botao "Inferir Turnos" | button | ConfirmDialog → `POST /api/shifts/infer` |
| Icone lixeira | button (por linha) | ConfirmDialog → `DELETE /api/shifts/{id}` |

**Modal Criar Turno:**

| Campo | Tipo | Opcoes |
|-------|------|--------|
| Dia da semana | select | Segunda, Terca, ..., Sabado |
| Periodo | select | Manha, Tarde, Noite |
| Tipo | select | Presencial, Online (pre-preenche valor da config) |
| Valor (R$) | number input | Pre-preenchido: config `shift_presencial` ou `shift_online` |

---

### 5.8 Configuracoes (`/config`)

**Layout:** AppLayout
**Acesso:** Admin

**2 abas: Global | Por Profissional**

#### Aba Global

| Campo | Tipo | Descricao |
|-------|------|-----------|
| Taxa (%) | number | `tax_rate` |
| Turno Presencial (R$) | number | `shift_presencial` (default) |
| Turno Online (R$) | number | `shift_online` (default) |
| Botao "Salvar" | submit | `PUT /api/config` |

#### Aba Por Profissional

| Campo | Tipo | Descricao |
|-------|------|-----------|
| ProfessionalSelect | select | Seleciona profissional |
| Taxa (%) | number | Sobrescreve global |
| Turno Presencial (R$) | number | Sobrescreve global |
| Turno Online (R$) | number | Sobrescreve global |
| Operadores (lista dinamica) | key-value pairs | Adicionar/remover operadores com valores customizados |
| Botao "Salvar" | submit | `POST /api/config/professional` |

---

### 5.9 Usuarios (`/users`)

**Layout:** AppLayout
**Acesso:** Admin (gerencia users) / Super Admin (gerencia admins + users)

| Elemento | Tipo | Comportamento |
|----------|------|---------------|
| Busca | search input | Filtra por nome/email |
| Botao "Sincronizar" | button | ConfirmDialog → `POST /api/users/sync-professionals` |
| Botao "Novo Usuario" | button | Abre FormModal |
| Tabela | DataTable | Colunas abaixo |
| Pagination | componente | Paginas de 10-20 usuarios |

**Colunas:**

| Coluna | Tipo |
|--------|------|
| Nome | string |
| Email | string |
| Role | badge (super_admin/admin/user) |
| Profissional | string (nome vinculado) |
| Status | badge (Ativo/Inativo) |
| Acoes | Editar, Reset senha, Deletar |

**Modal Criar/Editar Usuario:**

| Campo | Tipo | Opcoes |
|-------|------|--------|
| Nome | text | Obrigatorio |
| Email | email | Obrigatorio, unico |
| Senha | password | Min 6 (obrigatorio na criacao, opcional na edicao) |
| Role | select | admin, user (super_admin so aparece para super_admin) |
| Profissional | select | Lista de profissionais (obrigatorio se role=user) |

---

### 5.10 Metodos de Pagamento (`/payment`)

**Layout:** AppLayout
**Acesso:** User (profissional ve/edita seus proprios)

| Elemento | Tipo | Comportamento |
|----------|------|---------------|
| Botao voltar | button | `navigate(-1)` |
| Botao "Novo Metodo" | button | Abre FormModal |
| Lista de metodos | cards | PIX e/ou TED cadastrados |
| Badge "Principal" | badge verde | Indica metodo primario |
| Botao "Definir Principal" | button (por card) | `POST /api/payment/methods/{id}/primary` |
| Botao "Remover" | button (por card) | ConfirmDialog → `DELETE /api/payment/methods/{id}` |

**Modal Criar/Editar Metodo:**

Tabs: PIX | Transferencia Bancaria (TED)

**Tab PIX:**

| Campo | Tipo | Opcoes |
|-------|------|--------|
| Tipo de chave | select | CPF, CNPJ, Email, Telefone, Aleatoria |
| Chave PIX | text | Formato depende do tipo |
| Nome do titular | text | Obrigatorio |

**Tab TED:**

| Campo | Tipo | Opcoes |
|-------|------|--------|
| Tipo documento | select | CPF, CNPJ |
| Documento | text (masked) | CPF ou CNPJ |
| Banco | autocomplete | Busca via API (`GET /api/payment/banks?q=...`, debounce 300ms) |
| Agencia | text | Numero |
| Conta | text | Numero |
| Tipo conta | select | Corrente, Poupanca |

---

### 5.11 Painel BTG Pactual (`/btg`)

**Layout:** AppLayout
**Acesso:** Admin
**Prioridade:** BAIXA (ultima tela a implementar)

| Elemento | Tipo | Comportamento |
|----------|------|---------------|
| Status conexao | badge | Conectado/Desconectado/Sandbox |
| Botao "Autorizar" | link externo | Redireciona OAuth2 BTG |
| Botao "Desconectar" | button | ConfirmDialog → `POST /api/btg/disconnect` |
| Tabela de pagamentos | DataTable | Status: CREATED, PENDING, APPROVED, REJECTED, ERROR |

---

## 6. Componentes Obrigatorios (shadcn/ui)

Instalar via `npx shadcn@latest add <componente>`:

### Prioridade 1 (precisa para todas as telas)
- `button` — botoes primarios, secundarios, ghost, destructive
- `input` — campos de texto, email, senha, numero
- `select` — dropdowns
- `dialog` — modais (FormModal, ConfirmDialog)
- `table` — tabelas de dados
- `badge` — status, roles, tipos
- `toast` / `sonner` — notificacoes (sucesso, erro, info)
- `card` — cards de dashboard e pagamento
- `tabs` — abas (Relatorio, Config)

### Prioridade 2 (telas especificas)
- `pagination` — tabelas com muitos registros
- `skeleton` — loading states
- `textarea` — contestacao, thread
- `dropdown-menu` — UserMenu
- `separator` — divisores visuais
- `avatar` — UserMenu

### Prioridade 3 (nice to have)
- `command` — autocomplete de bancos
- `popover` — MonthPicker
- `tooltip` — icones de acao

---

## 7. Paleta de Cores por Status

| Status | Cor | Tailwind |
|--------|-----|----------|
| Pending | Amarelo | `bg-yellow-100 text-yellow-800` |
| Approved | Verde | `bg-green-100 text-green-800` |
| Contested | Vermelho | `bg-red-100 text-red-800` |
| In Review | Azul | `bg-blue-100 text-blue-800` |
| Resolved | Cinza | `bg-gray-100 text-gray-800` |
| Paid | Verde escuro | `bg-emerald-100 text-emerald-800` |
| Active | Verde | `bg-green-100 text-green-800` |
| Inactive | Vermelho | `bg-red-100 text-red-800` |
| Presencial | Azul | `bg-blue-100 text-blue-800` |
| Online | Roxo | `bg-purple-100 text-purple-800` |

---

## 8. Tipos Compartilhados (@cpro/shared)

### Ja existentes em `packages/shared/src/`

```typescript
// types/user.ts
type UserRole = 'super_admin' | 'admin' | 'user';
interface User { id, name, email, role, apiProfessionalId, isActive, mustChangePassword, ... }
interface AuthUser { id, name, email, role, apiProfessionalId }
interface LoginResponse { user: AuthUser; accessToken: string }

// types/enums.ts
ReleaseStatus: 'pending' | 'approved' | 'contested' | 'in_review' | 'resolved'
ShiftPeriod: 'morning' | 'afternoon' | 'evening'
ShiftModality: 'presencial' | 'online'
PaymentMethodType: 'pix' | 'ted'
PixKeyType: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random'

// validation/auth.ts
loginSchema: z.object({ email, password })
changePasswordSchema: z.object({ currentPassword, newPassword, confirmPassword })
```

### Types a criar no frontend (sugestao)

```typescript
// Profissional (vem da API externa)
interface Professional { id: number; name: string; specialty?: string }

// Relatorio
interface ReportSummary { revenue: number; tax: number; shifts: number; netValue: number }
interface Appointment { id: number; date: string; patientName: string; operatorName: string; value: number; isPaid: boolean }

// Turno
interface Shift { id: number; dayOfWeek: number; period: ShiftPeriod; modality: ShiftModality; value: number; origin: string }

// Release
interface Release { id: number; professionalId: number; month: string; status: ReleaseStatus; isPaid: boolean }

// Metodo de Pagamento
interface PaymentMethod { id: number; methodType: PaymentMethodType; isPrimary: boolean; ... }
```

---

## 9. API Endpoints (Backend Hono)

### Ja implementados

| Metodo | Endpoint | Status |
|--------|----------|--------|
| GET | `/health` | Funcionando |
| POST | `/auth/login` | Funcionando |
| GET | `/auth/me` | Funcionando |

### A implementar (pelo conselho de tech, nao pela equipe de UX)

Os endpoints abaixo serao implementados numa proxima etapa. **A equipe de front pode usar dados mockados** enquanto isso.

| Grupo | Endpoints | Prioridade |
|-------|-----------|------------|
| Users | CRUD `/users`, `/users/sync-professionals` | Alta |
| Shifts | CRUD `/shifts`, `/shifts/infer`, `/shifts/bulk` | Alta |
| Config | GET/PUT `/config`, GET/POST `/config/professional` | Media |
| Release | toggle, check, respond, thread, mark-paid | Media |
| Payment | CRUD `/payment/methods`, banks search | Media |
| Dashboard | `/dashboard/months-summary`, aggregacoes | Media |
| External | Proxy para API cPanel (professionals, generate, operator-value) | Alta |
| BTG | OAuth, status, payments | Baixa |

---

## 10. Ordem de Implementacao Sugerida

```
Fase 1 — Esqueleto + Auth
  1. AppLayout (Sidebar + Header + content area)
  2. LoginPage
  3. ChangePasswordPage
  4. Roteamento protegido (redirect /login se nao auth)

Fase 2 — Telas CRUD (mais simples)
  5. UsersPage (tabela, criar, editar, ativar/desativar)
  6. ShiftsPage (tabela, modal criar, inferir, deletar)
  7. ConfigPage (2 abas: global + profissional)

Fase 3 — Dashboards
  8. DashboardTablePage (tabela admin com batch load)
  9. DashboardCardsPage (cards mensais)
  10. ProfessionalDashPage (dashboard do profissional)

Fase 4 — Telas Complexas
  11. ReportPage (4 abas, inline edit, release flow, thread)
  12. PaymentPage (PIX + TED, autocomplete banco)

Fase 5 — Integracao
  13. BtgPanelPage (OAuth + pagamentos)
```

---

## 11. Convencoes de Codigo

- **TypeScript strict** (zero `any`)
- **Imports com alias**: `@/` mapeia para `packages/web/src/`
- **Shared types**: `import { User, ReleaseStatus } from '@cpro/shared'`
- **Naming**: PascalCase para componentes, camelCase para funcoes/variaveis
- **Arquivos**: `PascalCase.tsx` para componentes, `camelCase.ts` para utils/hooks
- **CSS**: Tailwind utility classes (nao criar CSS customizado)
- **State local**: `useState` para UI efemera (modais, forms)
- **State global**: Zustand (auth, month, sidebar)
- **Server state**: React Query (`useQuery`, `useMutation`)
- **Validacao**: Zod schemas (definir em `@cpro/shared`, usar no form e no backend)

---

## 12. Usuarios de Teste

| Email | Senha | Role | Navega para |
|-------|-------|------|-------------|
| admin@consultoriopro.com | admin123 | super_admin | `/` (Dashboard admin) |
| dr.teste@consultoriopro.com | teste123 | user | `/dashboard` (Dashboard profissional) |
