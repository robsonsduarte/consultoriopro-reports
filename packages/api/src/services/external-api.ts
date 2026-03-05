import { resilientFetch } from './http-client.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { ConcurrencyLimiter } from './concurrency-limiter.js';

// --- Types ---

export interface Professional {
  id: number;
  name: string;
  specialty: string;
}

export interface ExternalAppointment {
  id: number;
  date: string;            // YYYY-MM-DD
  time: string;            // HH:MM:SS
  patientName: string;
  operatorName: string;
  value: number;
  isPaid: boolean;
  guideNumber: string | null;
}

export interface ExternalExecution {
  id: number;
  guideNumber: string | null;
  attendanceDay: string;   // YYYY-MM-DD
  patientName: string;
}

export interface ExternalOperatorSummary {
  name: string;
  appointmentCount: number;
  totalValue: number;
}

export interface ExternalReport {
  professional: { id: number; name: string; specialty: string };
  month: string;
  summary: {
    revenue: number;
    taxRate: number;
    tax: number;
    netValue: number;
    totalAppointments: number;
  };
  appointments: ExternalAppointment[];
  operators: ExternalOperatorSummary[];
}

// --- Mock Data ---

const MOCK_PROFESSIONALS: Professional[] = [
  { id: 1, name: 'Dr. Carlos Mendes', specialty: 'Cardiologia' },
  { id: 2, name: 'Dra. Ana Souza', specialty: 'Dermatologia' },
  { id: 3, name: 'Dr. Ricardo Lima', specialty: 'Ortopedia' },
  { id: 4, name: 'Dra. Fernanda Costa', specialty: 'Ginecologia' },
  { id: 5, name: 'Dr. Paulo Santos', specialty: 'Neurologia' },
  { id: 6, name: 'Dra. Julia Oliveira', specialty: 'Pediatria' },
  { id: 7, name: 'Dr. Marcos Pereira', specialty: 'Urologia' },
  { id: 8, name: 'Dra. Camila Rocha', specialty: 'Endocrinologia' },
  { id: 9, name: 'Dr. Bruno Almeida', specialty: 'Oftalmologia' },
  { id: 10, name: 'Dra. Patricia Ferreira', specialty: 'Psiquiatria' },
  { id: 11, name: 'Dr. Eduardo Barbosa', specialty: 'Gastroenterologia' },
  { id: 12, name: 'Dra. Lucia Martins', specialty: 'Pneumologia' },
];

const MOCK_OPERATORS = ['Op. Maria Silva', 'Op. Joao Pedro'];

const MOCK_PATIENTS = [
  'Maria da Silva', 'Joao Oliveira', 'Ana Santos', 'Pedro Costa',
  'Lucia Ferreira', 'Carlos Souza', 'Fernanda Lima', 'Roberto Almeida',
  'Patricia Rocha', 'Marcos Pereira', 'Julia Barbosa', 'Bruno Martins',
  'Camila Torres', 'Ricardo Nunes', 'Amanda Gomes',
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function generateMockReport(professionalId: number, month: string): ExternalReport {
  const prof = MOCK_PROFESSIONALS.find((p) => p.id === professionalId);
  if (!prof) {
    return {
      professional: { id: professionalId, name: `Profissional ${professionalId}`, specialty: 'Geral' },
      month,
      summary: { revenue: 0, taxRate: 15, tax: 0, netValue: 0, totalAppointments: 0 },
      appointments: [],
      operators: [],
    };
  }

  const seed = professionalId * 1000 + parseInt(month.replace('-', ''), 10);
  const rand = seededRandom(seed);

  const numAppointments = 8 + Math.floor(rand() * 15);
  const parts = month.split('-').map(Number);
  const year = parts[0]!;
  const monthNum = parts[1]!;
  const daysInMonth = new Date(year, monthNum, 0).getDate();

  const appointments: ExternalAppointment[] = [];
  const operatorTotals = new Map<string, { count: number; total: number }>();

  for (let i = 0; i < numAppointments; i++) {
    const day = 1 + Math.floor(rand() * daysInMonth);
    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(monthNum).padStart(2, '0');
    const value = Math.round((200 + rand() * 2800) * 100) / 100;
    const hasOperator = rand() > 0.4;
    const operatorName = hasOperator ? (MOCK_OPERATORS[Math.floor(rand() * MOCK_OPERATORS.length)] ?? '') : '';

    const hour = 7 + Math.floor(rand() * 12);
    const minute = Math.floor(rand() * 4) * 15;
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;

    appointments.push({
      id: professionalId * 10000 + i + 1,
      date: `${year}-${monthStr}-${dayStr}`,
      time: timeStr,
      patientName: MOCK_PATIENTS[Math.floor(rand() * MOCK_PATIENTS.length)] ?? 'Paciente',
      operatorName,
      value,
      isPaid: rand() > 0.3,
      guideNumber: null,
    });

    if (operatorName) {
      const existing = operatorTotals.get(operatorName) ?? { count: 0, total: 0 };
      existing.count++;
      existing.total += value;
      operatorTotals.set(operatorName, existing);
    }
  }

  appointments.sort((a, b) => a.date.localeCompare(b.date));

  const revenue = appointments.reduce((sum, a) => sum + a.value, 0);
  const taxRate = 15;
  const tax = Math.round(revenue * (taxRate / 100) * 100) / 100;

  const operators: ExternalOperatorSummary[] = [];
  for (const [name, data] of operatorTotals) {
    operators.push({
      name,
      appointmentCount: data.count,
      totalValue: Math.round(data.total * 100) / 100,
    });
  }

  return {
    professional: { id: prof.id, name: prof.name, specialty: prof.specialty },
    month,
    summary: {
      revenue: Math.round(revenue * 100) / 100,
      taxRate,
      tax,
      netValue: Math.round((revenue - tax) * 100) / 100,
      totalAppointments: numAppointments,
    },
    appointments,
    operators,
  };
}

// --- Client ---

// Raw response types from cPanel API
interface RawProfessional {
  id: string | number;
  name: string;
  specialty: string;
}

interface RawExecution {
  id: number | string;
  guide_number: string | null;
  appointment_day: string | null;
  attendance: {
    date: string;
    start: string;
    end: string;
  };
  patient: {
    id: number;
    name: string;
    document: string | null;
    mobile: string | null;
  };
}

interface RawExecutionsResponse {
  success: boolean;
  data: {
    executions: RawExecution[];
    total: number;
    has_more: boolean;
  };
}

interface RawReportResponse {
  success: boolean;
  data: {
    report: {
      professional: { id: number; name: string; specialty: string };
      period: { year_month: string; label: string };
      summary: {
        revenue: { total: number; by_operator: Array<{
          operator_name: string;
          appointments: number;
          subtotal: number;
        }> };
        tax: { rate: number; amount: number };
        shifts: { total_value: number };
        net_value: number;
        total_appointments: number;
      };
      appointments: Array<{
        id: number;
        date: string;
        time?: string;
        patient_name: string;
        operator_name: string;
        value: number;
        appointment_type?: string;
      }>;
    };
  };
}

class ExternalApiClient {
  private baseUrl: string;
  private apiKey: string;
  private hostHeader: string;
  private companyId: number;
  private isMockMode: boolean;
  private breaker: CircuitBreaker;
  private limiter: ConcurrencyLimiter;

  constructor() {
    this.baseUrl = process.env.EXTERNAL_API_BASE ?? '';
    this.apiKey = process.env.EXTERNAL_API_KEY ?? '';
    this.hostHeader = process.env.EXTERNAL_API_HOST ?? 'consultoriopro.com.br';
    this.companyId = Number(process.env.EXTERNAL_API_COMPANY_ID ?? '0');
    this.isMockMode = !this.apiKey || this.apiKey === '__CONFIGURE_LATER__';
    this.breaker = new CircuitBreaker({ threshold: 3, resetTimeoutMs: 5 * 60 * 1000 });
    this.limiter = new ConcurrencyLimiter(2);

    if (this.isMockMode) {
      console.log('[ExternalApiClient] Modo MOCK ativo (EXTERNAL_API_KEY nao configurada)');
    } else {
      console.log(`[ExternalApiClient] Modo REAL — ${this.baseUrl} (Host: ${this.hostHeader})`);
    }
  }

  private async apiFetch(path: string, options?: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const fetchOptions: RequestInit = {
      ...options,
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
    };
    return this.limiter.run(() =>
      this.breaker.execute(() => resilientFetch(url, fetchOptions)),
    );
  }

  /**
   * Cancela um atendimento na API PHP externa.
   * Retorna true se cancelado com sucesso.
   * Retorna false se o atendimento nao foi encontrado (soft-fail: override local ainda e aplicado).
   * Lanca erro para falhas de autenticacao ou erros inesperados.
   */
  async cancelAppointment(appointmentId: number): Promise<boolean> {
    if (this.isMockMode) {
      console.log(`[ExternalApiClient] MOCK — cancelAppointment(${appointmentId}) simulado`);
      return true;
    }

    if (!this.companyId) {
      throw new Error('EXTERNAL_API_COMPANY_ID nao configurado');
    }

    const res = await this.apiFetch(
      `/appointments/${appointmentId}?company=${this.companyId}`,
      { method: 'DELETE' },
    );

    // A API PHP usa status 200 para sucesso e varios outros para erro.
    // Lemos o corpo para distinguir "not found" (soft-fail) de erros reais.
    const bodyText = await res.text().catch(() => '');

    interface PhpApiResponse {
      success: boolean;
      error?: { code?: string; message?: string };
    }

    let bodyJson: PhpApiResponse | null = null;
    try { bodyJson = JSON.parse(bodyText) as PhpApiResponse; } catch { /* nao e json */ }

    if (res.ok && bodyJson?.success) {
      return true;
    }

    const errorCode = bodyJson?.error?.code ?? '';
    const isNotFound = errorCode === 'Appointment not found' || res.status === 404;

    if (isNotFound) {
      console.warn(`[ExternalApiClient] cancelAppointment(${appointmentId}) — atendimento nao encontrado na API PHP, prosseguindo com override local`);
      return false;
    }

    // UNAUTHORIZED significa company errado ou API key invalida — erro critico
    if (errorCode === 'UNAUTHORIZED' || res.status === 401 || res.status === 403) {
      throw new Error(`External API cancelAppointment: autenticacao falhou (${res.status}) — verifique EXTERNAL_API_COMPANY_ID e EXTERNAL_API_KEY`);
    }

    throw new Error(`External API DELETE /appointments/${appointmentId}: status=${res.status} body=${bodyText.slice(0, 200)}`);
  }

  async fetchExecutions(professionalId: number, month: string): Promise<ExternalExecution[]> {
    if (this.isMockMode) {
      return [];
    }

    if (!this.companyId) {
      throw new Error('EXTERNAL_API_COMPANY_ID nao configurado');
    }

    const [year, mon] = month.split('-');
    const firstDay = `${year}-${mon}-01`;
    const daysInMonth = new Date(Number(year), Number(mon), 0).getDate();
    const lastDay = `${year}-${mon}-${String(daysInMonth).padStart(2, '0')}`;

    const path = `/executions?company=${this.companyId}&user=${professionalId}&appointment_date_start=${firstDay}&appointment_date_end=${lastDay}&limit=1000`;
    const res = await this.apiFetch(path);
    if (!res.ok) {
      console.warn(`[ExternalApiClient] fetchExecutions: status=${res.status}, retornando vazio`);
      return [];
    }

    const json = await res.json() as RawExecutionsResponse;
    if (!json.success || !json.data?.executions || !Array.isArray(json.data.executions)) {
      return [];
    }

    const all: ExternalExecution[] = json.data.executions.map((e) => ({
      id: Number(e.id),
      guideNumber: e.guide_number ?? null,
      attendanceDay: e.appointment_day ?? e.attendance?.date ?? '',
      patientName: e.patient?.name?.trim() ?? '',
    }));

    return all;
  }

  async getProfessionals(): Promise<Professional[]> {
    if (this.isMockMode) {
      return MOCK_PROFESSIONALS;
    }

    const res = await this.apiFetch('/reports/professionals');
    if (!res.ok) throw new Error(`External API /reports/professionals: ${res.status}`);

    const json = await res.json() as { success: boolean; data: RawProfessional[] };
    return json.data.map((p) => ({
      id: Number(p.id),
      name: p.name.trim(),
      specialty: p.specialty ?? 'Geral',
    }));
  }

  async getReport(professionalId: number, month: string): Promise<ExternalReport> {
    if (this.isMockMode) {
      return generateMockReport(professionalId, month);
    }
    return this.fetchReportFromApi(professionalId, month);
  }

  async getReportBatch(ids: number[], month: string): Promise<Map<number, ExternalReport>> {
    const results = new Map<number, ExternalReport>();
    const BATCH_SIZE = 2;

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      // Delay between batches to avoid rate limiting (skip before first batch)
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      const batch = ids.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (id) => {
        try {
          const report = await this.getReport(id, month);
          results.set(id, report);
        } catch (err) {
          console.error(`[ExternalApiClient] Erro ao buscar report prof=${id} month=${month}:`, err);
        }
      });
      await Promise.all(promises);
    }

    return results;
  }

  private async fetchReportFromApi(professionalId: number, month: string): Promise<ExternalReport> {
    const res = await this.apiFetch(`/reports/generate?user_id=${professionalId}&month=${month}`);
    if (!res.ok) throw new Error(`External API /reports/generate: ${res.status}`);

    const json = await res.json() as RawReportResponse;
    const r = json.data.report;

    // Map appointments (fields: date, time, patient_name, operator_name, value)
    // guideNumber e enriquecido depois via fetchExecutions na rota
    const appointments: ExternalAppointment[] = (r.appointments ?? []).map((a) => ({
      id: a.id,
      date: a.date,
      time: a.time ?? '',
      patientName: (a.patient_name ?? '').trim(),
      operatorName: (a.operator_name ?? '').trim(),
      value: Number(a.value) || 0,
      isPaid: false, // managed locally via appointment_overrides
      guideNumber: null,
    }));

    // Operator summaries from revenue.by_operator (pre-aggregated by API)
    const operators: ExternalOperatorSummary[] = (r.summary.revenue.by_operator ?? []).map((op) => ({
      name: op.operator_name,
      appointmentCount: op.appointments,
      totalValue: op.subtotal,
    }));

    return {
      professional: {
        id: professionalId,
        name: (r.professional?.name ?? '').trim(),
        specialty: r.professional?.specialty ?? 'Geral',
      },
      month,
      summary: {
        revenue: r.summary.revenue.total,
        taxRate: r.summary.tax.rate,
        tax: r.summary.tax.amount,
        netValue: r.summary.net_value,
        totalAppointments: r.summary.total_appointments,
      },
      appointments,
      operators,
    };
  }
}

// Singleton
export const externalApi = new ExternalApiClient();
