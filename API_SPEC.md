# ConsultorioPro Reports v2 — Especificacao de API Backend

> Documento de referencia para implementacao dos endpoints que alimentam o frontend.
> Stack backend: Hono + Drizzle ORM + PostgreSQL 16 (porta 5433)
> Todas as respostas seguem o envelope: `{ success: boolean, data?: T, error?: string }`
> Revisado pelo Conselho de Tech (Dustin Moskovitz, Jan Koum, Larry Page)

---

## 0. Pre-requisitos Criticos (fazer ANTES de qualquer endpoint novo)

Estas correcoes foram identificadas pelo conselho de tech como debitos que, se ignorados, custam 10x mais em 3 meses.

### 0.1 Senhas: bcrypt em vez de SHA-256 (**FEITO**)

SHA-256 sem salt e vulneravel a rainbow tables. Migrado para `bcryptjs` com cost factor 12.
- Arquivo: `packages/api/src/routes/auth.ts` — funcoes `hashPassword()` e `verifyPassword()`
- Arquivo: `packages/api/src/db/seed.ts` — seed tambem usa bcrypt
- **IMPORTANTE:** Apos atualizar, rodar `pnpm db:push` + `pnpm --filter @cpro/api db:seed` para recriar hashes

### 0.2 Unique constraints no schema (**FEITO**)

- `report_releases`: `UNIQUE(professional_id, month)` — impede releases duplicados
- `professional_config`: `UNIQUE(professional_id, key)` — impede config duplicada
- `shifts`: `INDEX(professional_id, month)` — performance em queries filtradas

### 0.3 Convencao `dayOfWeek` = 1-6 (**FEITO**)

Definido: `1=Segunda, 2=Terca, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sabado`. Domingo nao e usado.
Schema atualizado com comentario. Frontend ja usa esta convencao.

### 0.4 Renomeacao `shifts.userId` → `shifts.professionalId` (**FEITO**)

O campo referencia o `apiProfessionalId` da API externa, NAO o `users.id` local.
Renomeado para `professional_id` com comentario explicativo no schema.

### 0.5 Cache da API externa (tabelas criadas)

- `report_snapshots`: cache de relatorios da API externa (JSON + timestamp)
- `appointment_overrides`: flags locais sobre atendimentos (isPaid, isExcluded)

### 0.6 Rate limiting no auth (A FAZER)

Adicionar contador de tentativas por email com lockout de 15min apos 5 falhas.
Implementar como middleware simples com Map in-memory (suficiente para o porte atual).

---

## 1. Status Atual

### Implementados

| Metodo | Endpoint | Auth | Descricao |
|--------|----------|------|-----------|
| GET | `/health` | Nao | Health check |
| POST | `/auth/login` | Nao | Login (retorna JWT + user, bcrypt) |
| POST | `/auth/change-password` | JWT | Troca de senha (bcrypt) |
| POST | `/auth/forgot-password` | Nao | Solicita reset (gera token) |
| POST | `/auth/reset-password` | Nao | Reseta senha com token (bcrypt) |
| GET | `/auth/me` | JWT | Retorna usuario autenticado |

### Middleware existente

- `authMiddleware` — valida Bearer token JWT, injeta `user: AuthUser` no contexto
- `requireRole(...roles)` — restringe por role (ex: `requireRole('super_admin', 'admin')`)

---

## 2. Arquitetura: Cache da API Externa

### O problema

A API cPanel leva 2-5 segundos por profissional. Com 20 profissionais, o dashboard leva 10-25s mesmo com batching. Isso e inaceitavel.

### A solucao: Snapshot + Serve

```
Fluxo normal:
  Frontend → Backend → report_snapshots (< 200ms) → Response

Fluxo de refresh (on-demand ou scheduled):
  Backend → API cPanel (2-5s) → report_snapshots → Response
```

**Tabela `report_snapshots`:**
- `professional_id` + `month` (unique index)
- `data` (JSON com appointments, operators, summary)
- `fetched_at` (timestamp do ultimo fetch)

**Regras:**
1. `GET /report/:id` e `GET /dashboard/professionals` leem do snapshot
2. Se snapshot nao existe ou `fetched_at` > TTL (default: 1 hora), faz fetch da API externa
3. `POST /report/refresh` forca re-fetch para um profissional/mes especifico
4. Botao "Atualizar dados" no frontend chama o refresh

**Fallback:** Se API externa estiver indisponivel, retorna snapshot existente com flag `{ stale: true }`.

### ExternalApiClient

Criar como servico central antes de qualquer controller:

```typescript
// packages/api/src/services/external-api.ts
class ExternalApiClient {
  // Lista profissionais (cache longo, 24h)
  async getProfessionals(): Promise<Professional[]>

  // Relatorio de um profissional (snapshot-based)
  async getReport(professionalId: number, month: string): Promise<ExternalReport>

  // Batch de relatorios (paralelo, max 4 simultaneos)
  async getReportBatch(ids: number[], month: string): Promise<Map<number, ExternalReport>>

  // Forca refresh do snapshot
  async refreshSnapshot(professionalId: number, month: string): Promise<void>
}
```

---

## 3. Convencoes

### Envelope de resposta

```typescript
// Sucesso
{ success: true, data: T }

// Sucesso com paginacao
{ success: true, data: T[], meta: { page: number, pageSize: number, total: number, totalPages: number } }

// Erro
{ success: false, error: string }
```

### Auth header

```
Authorization: Bearer <jwt_token>
```

### Query params padrao

| Param | Tipo | Descricao |
|-------|------|-----------|
| `month` | `YYYY-MM` | Filtra por mes (ex: `2026-03`) |
| `page` | number | Pagina (default: 1) |
| `pageSize` | number | Itens por pagina (default: 20, max: 100) |
| `sort` | string | Campo de ordenacao (ex: `name`, `-revenue` para desc) |
| `q` | string | Busca textual (debounce no frontend, 300ms) |

---

## 4. Endpoints a Implementar

### 4.1 Dashboard (`/dashboard`)

**Consumido por:** DashboardTablePage (`/`), DashboardCardsPage (`/dashboard/cards`), ProfessionalDashPage (`/dashboard`)

#### GET `/dashboard/professionals?month=YYYY-MM`

**Auth:** JWT + Admin
**Descricao:** Retorna lista de profissionais com resumo financeiro do mes.
**Consumido por:** `DashboardTablePage` — tabela principal do admin

```typescript
// Response.data
interface ProfessionalReport {
  id: number;            // apiProfessionalId
  name: string;
  specialty: string;
  revenue: number;       // receita bruta do mes
  tax: number;           // imposto calculado
  shifts: number;        // total de turnos
  netValue: number;      // revenue - tax - shifts_value
  status: ReleaseStatus; // status do release (ou null se nao liberado)
  releaseId: number | null;
  month: string;         // YYYY-MM
}
```

**Observacao:** Este endpoint agrega dados da API externa (atendimentos) + turnos locais + config de taxa. Equivalente ao batch load do PHP v1. Idealmente processar em paralelo (batch de 4 profissionais).

---

#### GET `/dashboard/months-summary`

**Auth:** JWT + Admin
**Descricao:** Retorna resumo de status por mes (ultimos 6 meses).
**Consumido por:** `DashboardCardsPage` — grid de cards mensais

```typescript
// Response.data[]
interface MonthSummary {
  month: string;                         // YYYY-MM
  counts: Record<ReleaseStatus, number>; // { pending: 3, approved: 4, ... }
  totalProfessionals: number;
}
```

---

#### GET `/dashboard/professional?month=YYYY-MM`

**Auth:** JWT (user ve so o seu)
**Descricao:** Retorna dados do dashboard do profissional logado.
**Consumido por:** `ProfessionalDashPage` — cards + historico

```typescript
// Response.data
interface ProfessionalDashboard {
  summary: {
    revenue: number;
    tax: number;
    shifts: number;
    netValue: number;
  };
  history: MonthHistory[]; // ultimos 6 meses
}

interface MonthHistory {
  month: string;
  status: ReleaseStatus;
  releaseId: number;
  revenue: number;
  tax: number;
  shifts: number;
  netValue: number;
}
```

---

### 4.2 Relatorio (`/report`)

**Consumido por:** ReportPage (`/report/:id`)

#### GET `/report/:professionalId?month=YYYY-MM`

**Auth:** JWT (admin ve qualquer, user ve so o seu)
**Descricao:** Retorna relatorio completo do profissional no mes.

```typescript
// Response.data
interface Report {
  professional: {
    id: number;
    name: string;
    specialty: string;
  };
  month: string;
  release: {
    id: number;
    status: ReleaseStatus;
    isPaid: boolean;
  } | null; // null = nao liberado
  summary: {
    revenue: number;
    tax: number;
    shiftsValue: number;
    netValue: number;
    totalAppointments: number;
  };
  appointments: Appointment[];
  operators: OperatorSummary[];
  shifts: Shift[];
  thread: ThreadMessage[];
}
```

**Sub-types:**

```typescript
interface Appointment {
  id: number;
  date: string;            // YYYY-MM-DD
  patientName: string;
  operatorName: string;    // vazio se nao tem operador
  value: number;
  isPaid: boolean;
}

interface OperatorSummary {
  name: string;
  appointmentCount: number;
  totalValue: number;
}

interface Shift {
  id: number;
  dayOfWeek: number;       // 1=Seg ... 6=Sab
  period: ShiftPeriod;     // 'morning' | 'afternoon' | 'evening'
  modality: ShiftModality; // 'presencial' | 'online'
  shiftValue: number;
  origin: string;          // 'manual' | 'inferred'
}

interface ThreadMessage {
  id: number;
  releaseId: number;
  senderName: string;
  senderRole: 'admin' | 'user';
  message: string;
  createdAt: string;       // ISO 8601
}
```

**Origem dos dados:**
- `appointments` e `operators` → API externa cPanel (proxy)
- `shifts` → tabela local `shifts`
- `release` e `thread` → tabelas `report_releases` e `contestation_messages`
- `summary` → agregacao dos anteriores

---

### 4.3 Release Flow (`/release`)

**Consumido por:** ReportPage (barra de release), DashboardTablePage (liberar todos)

#### POST `/release/toggle`

**Auth:** JWT + Admin
**Descricao:** Libera ou revoga relatorio para aprovacao do profissional.

```typescript
// Request body
{ professionalId: number, month: string, action: 'release' | 'revoke' }

// Response.data
{ releaseId: number, status: ReleaseStatus }
```

**Regras:**
- `release`: cria registro em `report_releases` com status `pending`
- `revoke`: deleta o registro (ou marca como revogado)
- Apenas admin pode executar

---

#### POST `/release/respond`

**Auth:** JWT (user — dono do release)
**Descricao:** Profissional aprova ou contesta o relatorio.

```typescript
// Request body
{ releaseId: number, action: 'approved' | 'contested', note?: string }

// Response.data
{ releaseId: number, status: ReleaseStatus }
```

**Regras:**
- `approved`: atualiza status para `approved`, grava `respondedAt`
- `contested`: atualiza status para `contested`, cria mensagem em `contestation_messages` com o `note`
- So pode responder se status atual for `pending`

---

#### POST `/release/resolve`

**Auth:** JWT + Admin
**Descricao:** Admin resolve contestacao. Volta status para `resolved`.

```typescript
// Request body
{ releaseId: number }

// Response.data
{ releaseId: number, status: 'resolved' }
```

---

#### POST `/release/mark-paid`

**Auth:** JWT + Admin
**Descricao:** Marca relatorio como pago.

```typescript
// Request body
{ releaseId: number }

// Response.data
{ releaseId: number, isPaid: true }
```

---

#### POST `/release/bulk-release`

**Auth:** JWT + Admin
**Descricao:** Libera todos os profissionais pendentes do mes.

```typescript
// Request body
{ month: string }

// Response.data
{ released: number } // quantidade liberada
```

---

### 4.4 Contestacao Thread (`/release/thread`)

**Consumido por:** ReportPage — aba Contestacao

#### POST `/release/thread/reply`

**Auth:** JWT (admin ou user dono do release)
**Descricao:** Envia mensagem na thread de contestacao.

```typescript
// Request body
{ releaseId: number, message: string }

// Response.data
{ id: number, releaseId: number, senderName: string, senderRole: 'admin' | 'user', message: string, createdAt: string }
```

**Regras:**
- Se profissional envia e status era `contested`, muda para `in_review`
- Se admin envia, status permanece (admin resolve via `/release/resolve`)

---

### 4.5 Turnos (`/shifts`)

**Consumido por:** ShiftsPage (`/shifts`), ReportPage — aba Turnos

#### GET `/shifts/:professionalId?month=YYYY-MM`

**Auth:** JWT + Admin
**Descricao:** Lista turnos do profissional no mes.

```typescript
// Response.data[]
interface Shift {
  id: number;
  professionalId: number;  // apiProfessionalId (API externa)
  month: string;
  dayOfWeek: number;       // 1=Seg ... 6=Sab
  period: ShiftPeriod;
  modality: ShiftModality;
  shiftValue: number;
  origin: string;          // 'manual' | 'inferred'
  createdAt: string;
}
```

---

#### POST `/shifts`

**Auth:** JWT + Admin
**Descricao:** Cria turno manual.

```typescript
// Request body
{
  professionalId: number,
  month: string,           // YYYY-MM
  dayOfWeek: number,       // 1-6
  period: ShiftPeriod,
  modality: ShiftModality,
  shiftValue: number
}

// Response.data
Shift // objeto criado
```

---

#### PUT `/shifts/:id`

**Auth:** JWT + Admin
**Descricao:** Atualiza turno existente (inline edit da ReportPage).

```typescript
// Request body (parcial — so campos alterados)
{
  dayOfWeek?: number,
  period?: ShiftPeriod,
  modality?: ShiftModality,
  shiftValue?: number
}

// Response.data
Shift // objeto atualizado
```

---

#### DELETE `/shifts/:id`

**Auth:** JWT + Admin
**Descricao:** Remove turno.

```typescript
// Response.data
{ deleted: true }
```

---

#### POST `/shifts/infer`

**Auth:** JWT + Admin
**Descricao:** Infere turnos a partir dos atendimentos do mes (API externa).

```typescript
// Request body
{ professionalId: number, month: string }

// Response.data
{ created: number, shifts: Shift[] } // turnos criados com origin='inferred'
```

**Regras:**
- Analisa atendimentos do mes da API externa
- Identifica dias/periodos trabalhados
- Cria turnos com `origin: 'inferred'`
- NAO remove turnos existentes (adiciona apenas novos)
- Valor do turno vem da config (global ou profissional)

---

### 4.6 Configuracao (`/config`)

**Consumido por:** ConfigPage (`/config`), ShiftFormModal (pre-preenche valor)

#### GET `/config`

**Auth:** JWT + Admin
**Descricao:** Retorna configuracao global.

```typescript
// Response.data
interface GlobalConfig {
  taxRate: number;          // ex: 15 (percentual)
  shiftPresencial: number;  // ex: 850.00
  shiftOnline: number;      // ex: 650.00
}
```

**Storage:** tabela `professional_config` com `professionalId = 0` (ou null) para global,
ou tabela separada `global_config`. Keys: `tax_rate`, `shift_presencial`, `shift_online`.

---

#### PUT `/config`

**Auth:** JWT + Admin
**Descricao:** Atualiza configuracao global.

```typescript
// Request body
{ taxRate: number, shiftPresencial: number, shiftOnline: number }

// Response.data
GlobalConfig
```

---

#### GET `/config/professional/:professionalId`

**Auth:** JWT + Admin
**Descricao:** Retorna configuracao especifica do profissional (overrides).

```typescript
// Response.data
interface ProfessionalConfig {
  professionalId: number;
  taxRate: number | null;          // null = usa global
  shiftPresencial: number | null;
  shiftOnline: number | null;
  operators: OperatorEntry[];
}

interface OperatorEntry {
  id: number;
  name: string;
  value: number;
}
```

---

#### POST `/config/professional`

**Auth:** JWT + Admin
**Descricao:** Cria ou atualiza configuracao do profissional.

```typescript
// Request body
{
  professionalId: number,
  taxRate: number | null,
  shiftPresencial: number | null,
  shiftOnline: number | null,
  operators: { name: string, value: number }[]
}

// Response.data
ProfessionalConfig
```

**Nota sobre operadores:** Os operadores sao key-value pairs armazenados em `professional_config`
como JSON (key: `operators`, value: JSON string). Alternativa: tabela separada `professional_operators`.

---

### 4.7 Usuarios (`/users`)

**Consumido por:** UsersPage (`/users`)

#### GET `/users?q=&page=&pageSize=&sort=`

**Auth:** JWT + Admin
**Descricao:** Lista usuarios com busca, paginacao e sort.

```typescript
// Response.data[]
interface UserListItem {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  apiProfessionalId: number | null;
  professionalName: string | null; // nome do profissional vinculado (via API ou cache)
  isActive: boolean;
  createdAt: string;
}

// Response.meta
{ page: number, pageSize: number, total: number, totalPages: number }
```

**Busca (`q`):** filtrar por `name ILIKE %q%` OR `email ILIKE %q%`

---

#### POST `/users`

**Auth:** JWT + Admin (super_admin pode criar admins)
**Descricao:** Cria novo usuario.

```typescript
// Request body
{
  name: string,
  email: string,          // unico
  password: string,       // min 6 chars
  role: UserRole,         // admin pode criar 'admin' e 'user'; super_admin pode criar qualquer
  apiProfessionalId?: number // obrigatorio se role='user'
}

// Response.data
UserListItem
```

**Regras:**
- `password` armazenado como bcrypt hash (cost factor 12)
- `mustChangePassword: true` por default
- `isActive: true` por default

---

#### PUT `/users/:id`

**Auth:** JWT + Admin
**Descricao:** Atualiza usuario.

```typescript
// Request body (parcial)
{
  name?: string,
  email?: string,
  password?: string,       // se vazio, nao altera
  role?: UserRole,
  apiProfessionalId?: number | null,
  isActive?: boolean
}

// Response.data
UserListItem
```

---

#### DELETE `/users/:id`

**Auth:** JWT + Admin
**Descricao:** Desativa usuario (soft delete — seta `isActive: false`).

```typescript
// Response.data
{ deleted: true }
```

**Nota:** Nao deletar fisicamente. Marcar como `isActive: false`.

---

#### POST `/users/:id/reset-password`

**Auth:** JWT + Admin
**Descricao:** Admin reseta senha do usuario para temporaria.

```typescript
// Request body (vazio ou com nova senha)
{ newPassword?: string } // se vazio, gera aleatoria

// Response.data
{ temporaryPassword: string, mustChangePassword: true }
```

---

#### POST `/users/sync-professionals`

**Auth:** JWT + Admin
**Descricao:** Sincroniza profissionais da API externa com usuarios locais.

```typescript
// Response.data
{ created: number, updated: number, total: number }
```

**Regras:**
- Busca profissionais da API externa
- Para cada profissional sem usuario local: cria user com `role: 'user'`, `isActive: false`, senha temporaria
- Para cada profissional com usuario local: atualiza `apiProfessionalId` se necessario
- Vincular por email (match `sublocation_users.email` ↔ `users.email`)

---

### 4.8 Atendimentos (`/appointments`)

**Consumido por:** ReportPage — aba Atendimentos

#### PATCH `/appointments/:id/toggle-paid`

**Auth:** JWT + Admin
**Descricao:** Alterna status pago/nao-pago de um atendimento.

```typescript
// Response.data
{ id: number, isPaid: boolean }
```

**Nota:** Atendimentos vem da API externa. O status `isPaid` pode ser armazenado localmente
em tabela `appointment_overrides` (id, appointmentExternalId, isPaid) ou enviado de volta para a API.

---

#### DELETE `/appointments/:id`

**Auth:** JWT + Admin
**Descricao:** Exclui atendimento do relatorio (soft delete local ou flag na API externa).

```typescript
// Response.data
{ deleted: true }
```

---

### 4.9 Profissionais (`/professionals`)

**Consumido por:** ProfessionalSelect (todas as paginas que usam select de profissional)

#### GET `/professionals`

**Auth:** JWT + Admin
**Descricao:** Lista profissionais disponives (da API externa, cache local opcional).

```typescript
// Response.data[]
interface Professional {
  id: number;
  name: string;
  specialty?: string;
}
```

**Nota:** O frontend usa `mockProfessionals` hoje. Este endpoint deve retornar a lista completa
de profissionais da API externa. Pode cachear localmente por sessao.

---

## 5. Tabelas do Banco (Drizzle Schema)

Ja definidas em `packages/api/src/db/schema.ts`:

| Tabela | Status | Descricao |
|--------|--------|-----------|
| `users` | Pronta | Usuarios do sistema (com resetToken) |
| `report_releases` | Pronta | Liberacoes de relatorio por mes |
| `contestation_messages` | Pronta | Thread de contestacao |
| `shifts` | Pronta | Turnos (manual + inferido) |
| `payment_methods` | Pronta | Metodos de pagamento (PIX/TED) |
| `professional_config` | Pronta | Config por profissional (key-value) |
| `banks` | Pronta | Tabela de bancos (referencia) |
| `audit_log` | Pronta | Log de auditoria |
| `report_snapshots` | Pronta | Cache de relatorios da API externa (JSON + timestamp) |
| `appointment_overrides` | Pronta | Flags locais sobre atendimentos (isPaid, isExcluded) |

### Sugestoes de tabelas adicionais

| Tabela | Motivo |
|--------|--------|
| `global_config` | Config global (tax_rate, shift_presencial, shift_online). Alternativa: usar `professional_config` com `professionalId = 0` |
| `professional_operators` | Operadores por profissional com valor. Alternativa: JSON em `professional_config` |

---

## 6. Proxy para API Externa cPanel

Varios endpoints dependem de dados da API externa (`consultoriopro.com.br/service/api/v1/`).

### Endpoints da API externa que o backend precisa consumir

| Endpoint externo | Uso no backend | Consumido por |
|-----------------|----------------|---------------|
| `GET /professionals` | Listar profissionais | `/professionals`, `/users/sync-professionals` |
| `POST /reports/generate` | Gerar relatorio de atendimentos | `/report/:id`, `/dashboard/professionals` |
| `GET /operator-value` | Valores dos operadores | `/report/:id` (aba operadores) |

**Configuracao necessaria no `.env`:**

```bash
EXTERNAL_API_URL=https://consultoriopro.com.br/service/api/v1
EXTERNAL_API_TOKEN=<token_de_acesso>
```

---

## 7. Prioridade de Implementacao

### P0 — Criticos (desbloqueiam o frontend inteiro)

| # | Endpoint | Telas que desbloqueia |
|---|----------|-----------------------|
| 1 | `GET /professionals` | ProfessionalSelect (todas as telas admin) |
| 2 | `GET /dashboard/professionals` | DashboardTablePage (tela principal) |
| 3 | `GET /report/:id` | ReportPage (4 abas) |
| 4 | CRUD `/shifts` | ShiftsPage + ReportPage aba Turnos |
| 5 | `POST /shifts/infer` | ShiftsPage + ReportPage |

### P1 — Importantes

| # | Endpoint | Tela |
|---|----------|------|
| 6 | Release flow (`/release/*`) | ReportPage barra de release |
| 7 | Thread (`/release/thread/reply`) | ReportPage aba Contestacao |
| 8 | CRUD `/users` | UsersPage |
| 9 | `POST /users/sync-professionals` | UsersPage |
| 10 | GET/PUT `/config` | ConfigPage aba Global |
| 11 | GET/POST `/config/professional` | ConfigPage aba Por Profissional |

### P2 — Podem esperar

| # | Endpoint | Tela |
|---|----------|------|
| 12 | `GET /dashboard/months-summary` | DashboardCardsPage |
| 13 | `GET /dashboard/professional` | ProfessionalDashPage |
| 14 | `PATCH /appointments/:id/toggle-paid` | ReportPage aba Atendimentos |
| 15 | `POST /release/bulk-release` | DashboardTablePage "Liberar Todos" |

### P3 — Futuro (telas nao construidas ainda)

| # | Endpoint | Tela |
|---|----------|------|
| 16 | CRUD `/payment/methods` | PaymentPage |
| 17 | `GET /payment/banks?q=` | PaymentPage (autocomplete banco) |
| 18 | BTG OAuth + pagamentos | BtgPanelPage |

---

## 8. Mapeamento Pagina → Endpoints

| Pagina | Rota | Endpoints consumidos |
|--------|------|---------------------|
| DashboardTablePage | `/` | `GET /dashboard/professionals`, `POST /release/bulk-release` |
| DashboardCardsPage | `/dashboard/cards` | `GET /dashboard/months-summary` |
| ProfessionalDashPage | `/dashboard` | `GET /dashboard/professional`, `POST /release/respond` |
| ReportPage | `/report/:id` | `GET /report/:id`, `POST /release/toggle`, `POST /release/respond`, `POST /release/resolve`, `POST /release/mark-paid`, `POST /release/thread/reply`, CRUD `/shifts`, `POST /shifts/infer`, `PATCH /appointments/:id/toggle-paid`, `DELETE /appointments/:id` |
| ShiftsPage | `/shifts`, `/shifts/:id` | `GET /shifts/:id`, `POST /shifts`, `DELETE /shifts/:id`, `POST /shifts/infer`, `GET /professionals` |
| ConfigPage | `/config` | `GET /config`, `PUT /config`, `GET /config/professional/:id`, `POST /config/professional` |
| UsersPage | `/users` | `GET /users`, `POST /users`, `PUT /users/:id`, `DELETE /users/:id`, `POST /users/:id/reset-password`, `POST /users/sync-professionals` |
| PaymentPage | `/payment` | CRUD `/payment/methods`, `GET /payment/banks?q=` |
| BtgPanelPage | `/btg` | BTG OAuth + endpoints |

---

## 9. Types compartilhados (`@cpro/shared`)

Tipos ja definidos que o backend deve usar nas respostas:

```typescript
// packages/shared/src/types/user.ts
type UserRole = 'super_admin' | 'admin' | 'user';

// packages/shared/src/types/enums.ts
type ReleaseStatus = 'pending' | 'approved' | 'contested' | 'in_review' | 'resolved';
type ShiftPeriod = 'morning' | 'afternoon' | 'evening';
type ShiftModality = 'presencial' | 'online';
type PaymentMethodType = 'pix' | 'ted';
type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
```

---

## 10. Notas para o Desenvolvedor Backend

1. **Envelope padrao**: Toda resposta DEVE usar `{ success, data, error }`. O frontend `api.ts` ja faz unwrap automatico.

2. **Auth middleware**: Ja existe `authMiddleware` e `requireRole()` em `packages/api/src/middleware/auth.ts`. Usar em todas as rotas protegidas.

3. **dayOfWeek**: Convencao definida: `1=Segunda ... 6=Sabado`. Domingo nao e usado. Schema e frontend ja alinhados.

4. **Valores monetarios**: Frontend exibe com `formatCurrency()` (Intl.NumberFormat pt-BR). Backend deve retornar `number` (nao string). Armazenar como `numeric(10,2)` no PG.

5. **Meses**: Formato `YYYY-MM` (ex: `2026-03`). Nunca usar Date completo para filtros mensais.

6. **API externa**: Respostas demoram 2-5s por profissional. Usar `Promise.all` com batch de 4 para processamento paralelo (ver PHP v1 como referencia com `curl_multi`).

7. **Config storage**: Recomendo usar `professional_config` com `professionalId = 0` para global e `professionalId > 0` para overrides. Keys: `tax_rate`, `shift_presencial`, `shift_online`, `operators` (JSON).

8. **Thread ordering**: Mensagens de contestacao devem retornar em ordem cronologica (`ORDER BY created_at ASC`).

9. **Release status machine**: `null → pending → (approved | contested) → (contested → in_review → resolved)`. Validar transicoes no backend.

10. **Soft delete em users**: Nunca deletar fisicamente. Setar `isActive: false`. Login ja rejeita usuarios inativos.
