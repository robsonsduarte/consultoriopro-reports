import type { ReleaseStatus, ShiftPeriod, ShiftModality, UserRole } from '@cpro/shared';

// ---------------------------------------------------------------------------
// Types locais do dominio de relatorios
// ---------------------------------------------------------------------------

export interface ProfessionalReport {
  id: number;
  name: string;
  specialty: string;
  revenue: number;
  tax: number;
  shifts: number;
  netValue: number;
  status: ReleaseStatus;
  releaseId: number | null;
  month: string;
}

export interface MonthSummary {
  month: string;
  counts: Record<ReleaseStatus, number>;
  totalProfessionals: number;
}

export interface MonthHistory {
  month: string;
  status: ReleaseStatus;
  releaseId: number;
  revenue: number;
  tax: number;
  shifts: number;
  netValue: number;
}

// ---------------------------------------------------------------------------
// Profissionais mockados — mes corrente (2026-03)
// ---------------------------------------------------------------------------

export const mockProfessionals: ProfessionalReport[] = [
  {
    id: 1,
    name: 'Dra. Ana Paula Ferreira',
    specialty: 'Cardiologia',
    revenue: 28500.0,
    tax: 4275.0,
    shifts: 22,
    netValue: 24225.0,
    status: 'approved',
    releaseId: 101,
    month: '2026-03',
  },
  {
    id: 2,
    name: 'Dr. Carlos Eduardo Mendes',
    specialty: 'Ortopedia',
    revenue: 19800.0,
    tax: 2970.0,
    shifts: 18,
    netValue: 16830.0,
    status: 'pending',
    releaseId: 102,
    month: '2026-03',
  },
  {
    id: 3,
    name: 'Dra. Beatriz Oliveira Santos',
    specialty: 'Pediatria',
    revenue: 15600.0,
    tax: 2340.0,
    shifts: 20,
    netValue: 13260.0,
    status: 'contested',
    releaseId: 103,
    month: '2026-03',
  },
  {
    id: 4,
    name: 'Dr. Marcelo Augusto Lima',
    specialty: 'Neurologia',
    revenue: 32100.0,
    tax: 4815.0,
    shifts: 24,
    netValue: 27285.0,
    status: 'approved',
    releaseId: 104,
    month: '2026-03',
  },
  {
    id: 5,
    name: 'Dra. Patricia Helena Costa',
    specialty: 'Ginecologia',
    revenue: 22400.0,
    tax: 3360.0,
    shifts: 19,
    netValue: 19040.0,
    status: 'in_review',
    releaseId: 105,
    month: '2026-03',
  },
  {
    id: 6,
    name: 'Dr. Ricardo Souza Neves',
    specialty: 'Dermatologia',
    revenue: 18900.0,
    tax: 2835.0,
    shifts: 16,
    netValue: 16065.0,
    status: 'resolved',
    releaseId: 106,
    month: '2026-03',
  },
  {
    id: 7,
    name: 'Dra. Fernanda Cristina Alves',
    specialty: 'Endocrinologia',
    revenue: 12300.0,
    tax: 1845.0,
    shifts: 14,
    netValue: 10455.0,
    status: 'pending',
    releaseId: 107,
    month: '2026-03',
  },
  {
    id: 8,
    name: 'Dr. Gustavo Henrique Rocha',
    specialty: 'Oftalmologia',
    revenue: 25700.0,
    tax: 3855.0,
    shifts: 21,
    netValue: 21845.0,
    status: 'approved',
    releaseId: 108,
    month: '2026-03',
  },
  {
    id: 9,
    name: 'Dra. Juliana Martins Braga',
    specialty: 'Psiquiatria',
    revenue: 17200.0,
    tax: 2580.0,
    shifts: 17,
    netValue: 14620.0,
    status: 'pending',
    releaseId: 109,
    month: '2026-03',
  },
  {
    id: 10,
    name: 'Dr. Andre Luis Pereira',
    specialty: 'Reumatologia',
    revenue: 20600.0,
    tax: 3090.0,
    shifts: 15,
    netValue: 17510.0,
    status: 'approved',
    releaseId: 110,
    month: '2026-03',
  },
];

// ---------------------------------------------------------------------------
// Resumo por mes (Jan-Mar 2026 + meses anteriores)
// ---------------------------------------------------------------------------

export const mockMonthSummary: MonthSummary[] = [
  {
    month: '2026-03',
    counts: { pending: 3, approved: 4, contested: 1, in_review: 1, resolved: 1 },
    totalProfessionals: 10,
  },
  {
    month: '2026-02',
    counts: { pending: 0, approved: 8, contested: 0, in_review: 0, resolved: 2 },
    totalProfessionals: 10,
  },
  {
    month: '2026-01',
    counts: { pending: 0, approved: 9, contested: 0, in_review: 0, resolved: 1 },
    totalProfessionals: 10,
  },
  {
    month: '2025-12',
    counts: { pending: 0, approved: 10, contested: 0, in_review: 0, resolved: 0 },
    totalProfessionals: 10,
  },
  {
    month: '2025-11',
    counts: { pending: 0, approved: 9, contested: 1, in_review: 0, resolved: 0 },
    totalProfessionals: 10,
  },
  {
    month: '2025-10',
    counts: { pending: 0, approved: 10, contested: 0, in_review: 0, resolved: 0 },
    totalProfessionals: 10,
  },
];

// ---------------------------------------------------------------------------
// Historico do profissional (Dr. Carlos — id=2) para ProfessionalDashPage
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Shift (turno) de um profissional
// ---------------------------------------------------------------------------

export interface MockShift {
  id: number;
  userId: number;
  month: string;
  dayOfWeek: number; // 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
  period: ShiftPeriod;
  modality: ShiftModality;
  shiftValue: number;
  origin: 'manual' | 'inferred';
}

// ---------------------------------------------------------------------------
// Config global mock (valores default de turno)
// ---------------------------------------------------------------------------

export const mockShiftConfig = {
  shiftPresencial: 850,
  shiftOnline: 650,
};

// ---------------------------------------------------------------------------
// Config global (inclui taxa)
// ---------------------------------------------------------------------------

export interface GlobalConfig {
  taxRate: number;
  shiftPresencial: number;
  shiftOnline: number;
}

export const mockGlobalConfig: GlobalConfig = {
  taxRate: 15,
  shiftPresencial: 850,
  shiftOnline: 650,
};

// ---------------------------------------------------------------------------
// Config por profissional (sobrescreve global)
// ---------------------------------------------------------------------------

export interface OperatorEntry {
  id: number;
  name: string;
  value: number;
}

export interface ProfessionalConfig {
  professionalId: number;
  taxRate: number | null;
  shiftPresencial: number | null;
  shiftOnline: number | null;
  operators: OperatorEntry[];
}

export const mockProfessionalConfigs: ProfessionalConfig[] = [
  {
    professionalId: 1,
    taxRate: 12,
    shiftPresencial: 900,
    shiftOnline: null,
    operators: [
      { id: 1, name: 'Dr. Silva (Anestesista)', value: 350 },
      { id: 2, name: 'Dra. Lima (Aux. Cirurgica)', value: 200 },
    ],
  },
  {
    professionalId: 4,
    taxRate: null,
    shiftPresencial: null,
    shiftOnline: 700,
    operators: [
      { id: 3, name: 'Dr. Ribeiro (Neurofisio)', value: 450 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Turnos mockados — Dr. Carlos (id=2), mes 2026-03
// ---------------------------------------------------------------------------

export const mockShifts: MockShift[] = [
  { id: 1, userId: 2, month: '2026-03', dayOfWeek: 1, period: 'morning', modality: 'presencial', shiftValue: 850, origin: 'inferred' },
  { id: 2, userId: 2, month: '2026-03', dayOfWeek: 1, period: 'afternoon', modality: 'presencial', shiftValue: 850, origin: 'inferred' },
  { id: 3, userId: 2, month: '2026-03', dayOfWeek: 2, period: 'morning', modality: 'online', shiftValue: 650, origin: 'inferred' },
  { id: 4, userId: 2, month: '2026-03', dayOfWeek: 3, period: 'morning', modality: 'presencial', shiftValue: 850, origin: 'manual' },
  { id: 5, userId: 2, month: '2026-03', dayOfWeek: 3, period: 'afternoon', modality: 'presencial', shiftValue: 850, origin: 'inferred' },
  { id: 6, userId: 2, month: '2026-03', dayOfWeek: 4, period: 'morning', modality: 'online', shiftValue: 650, origin: 'manual' },
  { id: 7, userId: 2, month: '2026-03', dayOfWeek: 4, period: 'afternoon', modality: 'presencial', shiftValue: 900, origin: 'manual' },
  { id: 8, userId: 2, month: '2026-03', dayOfWeek: 5, period: 'morning', modality: 'presencial', shiftValue: 850, origin: 'inferred' },
  { id: 9, userId: 2, month: '2026-03', dayOfWeek: 5, period: 'afternoon', modality: 'online', shiftValue: 650, origin: 'inferred' },
  { id: 10, userId: 2, month: '2026-03', dayOfWeek: 6, period: 'morning', modality: 'presencial', shiftValue: 850, origin: 'manual' },
  // Dra. Ana Paula (id=1) — turnos para demonstrar ProfessionalSelect
  { id: 11, userId: 1, month: '2026-03', dayOfWeek: 1, period: 'morning', modality: 'presencial', shiftValue: 850, origin: 'inferred' },
  { id: 12, userId: 1, month: '2026-03', dayOfWeek: 2, period: 'afternoon', modality: 'online', shiftValue: 650, origin: 'inferred' },
  { id: 13, userId: 1, month: '2026-03', dayOfWeek: 3, period: 'morning', modality: 'presencial', shiftValue: 850, origin: 'manual' },
  { id: 14, userId: 1, month: '2026-03', dayOfWeek: 4, period: 'morning', modality: 'presencial', shiftValue: 850, origin: 'inferred' },
  { id: 15, userId: 1, month: '2026-03', dayOfWeek: 5, period: 'afternoon', modality: 'online', shiftValue: 700, origin: 'manual' },
];

// ---------------------------------------------------------------------------
// Historico do profissional (Dr. Carlos — id=2) para ProfessionalDashPage
// ---------------------------------------------------------------------------

export const mockProfessionalHistory: MonthHistory[] = [
  {
    month: '2026-03',
    status: 'pending',
    releaseId: 102,
    revenue: 19800.0,
    tax: 2970.0,
    shifts: 18,
    netValue: 16830.0,
  },
  {
    month: '2026-02',
    status: 'approved',
    releaseId: 92,
    revenue: 18500.0,
    tax: 2775.0,
    shifts: 17,
    netValue: 15725.0,
  },
  {
    month: '2026-01',
    status: 'approved',
    releaseId: 82,
    revenue: 21000.0,
    tax: 3150.0,
    shifts: 20,
    netValue: 17850.0,
  },
  {
    month: '2025-12',
    status: 'resolved',
    releaseId: 72,
    revenue: 24300.0,
    tax: 3645.0,
    shifts: 22,
    netValue: 20655.0,
  },
  {
    month: '2025-11',
    status: 'approved',
    releaseId: 62,
    revenue: 17800.0,
    tax: 2670.0,
    shifts: 16,
    netValue: 15130.0,
  },
];

// ---------------------------------------------------------------------------
// Usuarios do sistema
// ---------------------------------------------------------------------------

export interface MockUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  apiProfessionalId: number | null;
  professionalName: string | null;
  isActive: boolean;
  createdAt: string;
}

export const mockUsers: MockUser[] = [
  { id: 1, name: 'Robson Duarte', email: 'admin@consultoriopro.com', role: 'super_admin', apiProfessionalId: null, professionalName: null, isActive: true, createdAt: '2025-06-01' },
  { id: 2, name: 'Mariana Silva', email: 'mariana@consultoriopro.com', role: 'admin', apiProfessionalId: null, professionalName: null, isActive: true, createdAt: '2025-07-15' },
  { id: 3, name: 'Dra. Ana Paula Ferreira', email: 'ana.paula@consultoriopro.com', role: 'user', apiProfessionalId: 1, professionalName: 'Dra. Ana Paula Ferreira', isActive: true, createdAt: '2025-08-01' },
  { id: 4, name: 'Dr. Carlos Eduardo Mendes', email: 'carlos@consultoriopro.com', role: 'user', apiProfessionalId: 2, professionalName: 'Dr. Carlos Eduardo Mendes', isActive: true, createdAt: '2025-08-01' },
  { id: 5, name: 'Dra. Beatriz Oliveira Santos', email: 'beatriz@consultoriopro.com', role: 'user', apiProfessionalId: 3, professionalName: 'Dra. Beatriz Oliveira Santos', isActive: true, createdAt: '2025-08-10' },
  { id: 6, name: 'Dr. Marcelo Augusto Lima', email: 'marcelo@consultoriopro.com', role: 'user', apiProfessionalId: 4, professionalName: 'Dr. Marcelo Augusto Lima', isActive: true, createdAt: '2025-08-10' },
  { id: 7, name: 'Dra. Patricia Helena Costa', email: 'patricia@consultoriopro.com', role: 'user', apiProfessionalId: 5, professionalName: 'Dra. Patricia Helena Costa', isActive: true, createdAt: '2025-09-01' },
  { id: 8, name: 'Dr. Ricardo Souza Neves', email: 'ricardo@consultoriopro.com', role: 'user', apiProfessionalId: 6, professionalName: 'Dr. Ricardo Souza Neves', isActive: false, createdAt: '2025-09-01' },
  { id: 9, name: 'Dra. Fernanda Cristina Alves', email: 'fernanda@consultoriopro.com', role: 'user', apiProfessionalId: 7, professionalName: 'Dra. Fernanda Cristina Alves', isActive: true, createdAt: '2025-09-15' },
  { id: 10, name: 'Dr. Gustavo Henrique Rocha', email: 'gustavo@consultoriopro.com', role: 'user', apiProfessionalId: 8, professionalName: 'Dr. Gustavo Henrique Rocha', isActive: true, createdAt: '2025-10-01' },
  { id: 11, name: 'Dra. Juliana Martins Braga', email: 'juliana@consultoriopro.com', role: 'user', apiProfessionalId: 9, professionalName: 'Dra. Juliana Martins Braga', isActive: true, createdAt: '2025-10-01' },
  { id: 12, name: 'Dr. Andre Luis Pereira', email: 'andre@consultoriopro.com', role: 'user', apiProfessionalId: 10, professionalName: 'Dr. Andre Luis Pereira', isActive: true, createdAt: '2025-10-15' },
];

// ---------------------------------------------------------------------------
// Relatorio — Atendimentos
// ---------------------------------------------------------------------------

export interface MockAppointment {
  id: number;
  date: string; // YYYY-MM-DD
  patientName: string;
  operatorName: string;
  value: number;
  isPaid: boolean;
}

export const mockAppointments: MockAppointment[] = [
  { id: 1, date: '2026-03-03', patientName: 'Maria Silva Santos', operatorName: 'Dr. Ribeiro', value: 450, isPaid: false },
  { id: 2, date: '2026-03-04', patientName: 'Joao Pedro Almeida', operatorName: 'Dr. Ribeiro', value: 380, isPaid: true },
  { id: 3, date: '2026-03-05', patientName: 'Ana Lucia Ferreira', operatorName: '', value: 520, isPaid: false },
  { id: 4, date: '2026-03-06', patientName: 'Carlos Alberto Costa', operatorName: 'Dra. Lima', value: 350, isPaid: false },
  { id: 5, date: '2026-03-07', patientName: 'Patricia Mendes', operatorName: '', value: 480, isPaid: true },
  { id: 6, date: '2026-03-10', patientName: 'Roberto Souza Neto', operatorName: 'Dr. Ribeiro', value: 420, isPaid: false },
  { id: 7, date: '2026-03-11', patientName: 'Fernanda Cristina Braga', operatorName: '', value: 390, isPaid: false },
  { id: 8, date: '2026-03-12', patientName: 'Marcelo Augusto Reis', operatorName: 'Dra. Lima', value: 550, isPaid: true },
  { id: 9, date: '2026-03-13', patientName: 'Juliana Martins Rocha', operatorName: '', value: 470, isPaid: false },
  { id: 10, date: '2026-03-14', patientName: 'Andre Luis Pereira Jr.', operatorName: 'Dr. Ribeiro', value: 410, isPaid: false },
  { id: 11, date: '2026-03-17', patientName: 'Beatriz Oliveira Lima', operatorName: '', value: 500, isPaid: true },
  { id: 12, date: '2026-03-18', patientName: 'Gustavo Henrique Alves', operatorName: '', value: 360, isPaid: false },
  { id: 13, date: '2026-03-19', patientName: 'Raquel Souza Santos', operatorName: 'Dr. Ribeiro', value: 440, isPaid: false },
  { id: 14, date: '2026-03-20', patientName: 'Lucas Ferreira Costa', operatorName: 'Dra. Lima', value: 380, isPaid: false },
  { id: 15, date: '2026-03-21', patientName: 'Camila Porto Neves', operatorName: '', value: 510, isPaid: true },
];

// ---------------------------------------------------------------------------
// Relatorio — Operadores (resumo agregado)
// ---------------------------------------------------------------------------

export interface MockOperatorSummary {
  name: string;
  appointmentCount: number;
  totalValue: number;
}

export const mockOperatorSummaries: MockOperatorSummary[] = [
  { name: 'Dr. Ribeiro', appointmentCount: 5, totalValue: 2100 },
  { name: 'Dra. Lima', appointmentCount: 3, totalValue: 1280 },
];

// ---------------------------------------------------------------------------
// Relatorio — Thread de contestacao
// ---------------------------------------------------------------------------

export interface MockThreadMessage {
  id: number;
  releaseId: number;
  senderName: string;
  senderRole: 'admin' | 'user';
  message: string;
  createdAt: string; // ISO datetime
}

export const mockThread: MockThreadMessage[] = [
  {
    id: 1,
    releaseId: 103,
    senderName: 'Dra. Beatriz Oliveira Santos',
    senderRole: 'user',
    message: 'Boa tarde! Gostaria de contestar o valor do turno de quarta-feira dia 05/03. O valor deveria ser R$ 900,00 (presencial especial) e nao R$ 850,00.',
    createdAt: '2026-03-08T14:30:00Z',
  },
  {
    id: 2,
    releaseId: 103,
    senderName: 'Mariana Silva',
    senderRole: 'admin',
    message: 'Ola Dra. Beatriz, vou verificar com a coordenacao. O turno presencial especial deveria ter sido cadastrado com valor diferenciado. Volto com uma resposta ate amanha.',
    createdAt: '2026-03-08T16:45:00Z',
  },
  {
    id: 3,
    releaseId: 103,
    senderName: 'Mariana Silva',
    senderRole: 'admin',
    message: 'Confirmado! O valor foi corrigido para R$ 900,00. O relatorio sera atualizado e liberado novamente para sua aprovacao.',
    createdAt: '2026-03-09T10:15:00Z',
  },
];
