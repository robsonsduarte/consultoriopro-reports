import type { ReleaseStatus } from '@cpro/shared';

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
