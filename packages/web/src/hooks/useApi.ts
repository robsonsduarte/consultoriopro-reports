import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ReleaseStatus, ShiftPeriod, ShiftModality, UserRole } from '@cpro/shared';

// ---------------------------------------------------------------------------
// Response envelope
// ---------------------------------------------------------------------------

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

// ---------------------------------------------------------------------------
// Domain types (espelham o backend)
// ---------------------------------------------------------------------------

export interface Professional {
  id: number;
  name: string;
  specialty: string;
}

export interface ProfessionalReport {
  id: number;
  name: string;
  specialty: string;
  revenue: number;
  tax: number;
  shifts: number;
  netValue: number;
  status: ReleaseStatus | null;
  releaseId: number | null;
  isPaid: boolean;
  month: string;
}

export interface Shift {
  id: number;
  professionalId: number;
  month: string;
  dayOfWeek: number;
  period: ShiftPeriod;
  modality: ShiftModality;
  shiftValue: number;
  origin: string;
  createdAt: string;
}

export interface Appointment {
  id: number;
  date: string;
  time: string;
  patientName: string;
  operatorName: string;
  value: number;
  isPaid: boolean;
  guideNumber: string | null;
}

export interface OperatorSummary {
  name: string;
  appointmentCount: number;
  totalValue: number;
}

export interface ThreadMessage {
  id: number;
  releaseId: number;
  senderName: string;
  senderRole: 'admin' | 'user';
  message: string;
  createdAt: string;
}

export interface Report {
  professional: { id: number; name: string; specialty: string };
  month: string;
  release: { id: number; status: ReleaseStatus; isPaid: boolean } | null;
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

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  apiProfessionalId: number | null;
  isActive: boolean;
  createdAt: string;
}

export interface GlobalConfig {
  taxRate: number;
  shiftPresencial: number;
  shiftOnline: number;
}

export interface OperatorEntry {
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

export interface Release {
  id: number;
  professionalId: number;
  month: string;
  status: ReleaseStatus;
  isPaid: boolean;
  releasedBy: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Hooks de leitura
// ---------------------------------------------------------------------------

/** Lista todos os profissionais (sem dados financeiros) */
export function useProfessionals() {
  return useQuery({
    queryKey: ['professionals'],
    queryFn: () =>
      api
        .get<ApiResponse<Professional[]>>('/professionals')
        .then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

/** Dashboard: profissionais com dados financeiros do mes */
export function useDashboardProfessionals(month: string) {
  return useQuery({
    queryKey: ['dashboard', 'professionals', month],
    queryFn: () =>
      api
        .get<ApiResponse<ProfessionalReport[]>>(
          `/dashboard/professionals?month=${month}`,
        )
        .then((r) => r.data),
    staleTime: 2 * 60 * 1000,
    enabled: !!month,
  });
}

/** Relatorio completo de um profissional no mes */
export function useReport(professionalId: number, month: string) {
  return useQuery({
    queryKey: ['report', professionalId, month],
    queryFn: () =>
      api
        .get<ApiResponse<Report>>(`/report/${professionalId}?month=${month}`)
        .then((r) => r.data),
    staleTime: 2 * 60 * 1000,
    enabled: !!professionalId && !!month,
  });
}

/** Historico de releases do profissional logado */
export interface MyRelease {
  month: string;
  status: ReleaseStatus;
  releaseId: number;
  isPaid: boolean;
  revenue: number;
  tax: number;
  shifts: number;
  netValue: number;
}

export function useMyReleases() {
  return useQuery({
    queryKey: ['dashboard', 'my-releases'],
    queryFn: () =>
      api
        .get<ApiResponse<MyRelease[]>>('/dashboard/my-releases')
        .then((r) => r.data),
    staleTime: 2 * 60 * 1000,
  });
}

/** Turnos de um profissional no mes */
export function useShifts(professionalId: number, month: string) {
  return useQuery({
    queryKey: ['shifts', professionalId, month],
    queryFn: () =>
      api
        .get<ApiResponse<Shift[]>>(`/shifts/${professionalId}?month=${month}`)
        .then((r) => r.data),
    staleTime: 2 * 60 * 1000,
    enabled: !!professionalId && !!month,
  });
}

// ---------------------------------------------------------------------------
// Mutations de turnos
// ---------------------------------------------------------------------------

interface CreateShiftInput {
  professionalId: number;
  month: string;
  dayOfWeek: number;
  period: ShiftPeriod;
  modality: ShiftModality;
  shiftValue: number;
}

/** Cria um novo turno manual */
export function useCreateShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateShiftInput) =>
      api
        .post<ApiResponse<Shift>>('/shifts', input)
        .then((r) => r.data),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ['shifts', variables.professionalId, variables.month],
      });
      void queryClient.invalidateQueries({
        queryKey: ['report', variables.professionalId, variables.month],
      });
    },
  });
}

interface UpdateShiftInput {
  id: number;
  professionalId: number;
  month: string;
  dayOfWeek: number;
  period: ShiftPeriod;
  modality: ShiftModality;
  shiftValue: number;
}

/** Atualiza um turno existente */
export function useUpdateShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateShiftInput) =>
      api
        .put<ApiResponse<Shift>>(`/shifts/${id}`, body)
        .then((r) => r.data),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ['shifts', variables.professionalId, variables.month],
      });
      void queryClient.invalidateQueries({
        queryKey: ['report', variables.professionalId, variables.month],
      });
    },
  });
}

interface DeleteShiftInput {
  id: number;
  professionalId: number;
  month: string;
}

/** Remove um turno */
export function useDeleteShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: DeleteShiftInput) =>
      api
        .delete<ApiResponse<{ deleted: boolean }>>(`/shifts/${id}`)
        .then((r) => r.data),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ['shifts', variables.professionalId, variables.month],
      });
      void queryClient.invalidateQueries({
        queryKey: ['report', variables.professionalId, variables.month],
      });
    },
  });
}

interface InferShiftsInput {
  professionalId: number;
  month: string;
}

/** Infere turnos a partir dos atendimentos */
export function useInferShifts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: InferShiftsInput) =>
      api
        .post<ApiResponse<{ created: number; shifts: Shift[] }>>('/shifts/infer', input)
        .then((r) => r.data),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ['shifts', variables.professionalId, variables.month],
      });
      void queryClient.invalidateQueries({
        queryKey: ['report', variables.professionalId, variables.month],
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Hooks de usuarios
// ---------------------------------------------------------------------------

/** Lista todos os usuarios */
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () =>
      api.get<ApiResponse<User[]>>('/users').then((r) => r.data),
    staleTime: 2 * 60 * 1000,
  });
}

/** Criar usuario */
export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; email: string; password: string; role: string; apiProfessionalId?: number | null }) =>
      api.post<ApiResponse<User>>('/users', input).then((r) => r.data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['users'] }); },
  });
}

/** Atualizar usuario */
export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; name?: string; email?: string; password?: string; role?: string; apiProfessionalId?: number | null; isActive?: boolean }) =>
      api.put<ApiResponse<User>>(`/users/${id}`, body).then((r) => r.data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['users'] }); },
  });
}

/** Deletar usuario (soft) */
export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.delete<ApiResponse<{ deactivated: boolean }>>(`/users/${id}`).then((r) => r.data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['users'] }); },
  });
}

/** Resetar senha */
export function useResetPassword() {
  return useMutation({
    mutationFn: (id: number) =>
      api.post<ApiResponse<{ tempPassword: string }>>(`/users/${id}/reset-password`, {}).then((r) => r.data),
  });
}

/** Sincronizar profissionais */
export function useSyncProfessionals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<ApiResponse<{ created: number; total: number }>>('/users/sync-professionals', {}).then((r) => r.data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['users'] }); },
  });
}

// ---------------------------------------------------------------------------
// Hooks de configuracao
// ---------------------------------------------------------------------------

/** Config global */
export function useGlobalConfig() {
  return useQuery({
    queryKey: ['config', 'global'],
    queryFn: () =>
      api.get<ApiResponse<GlobalConfig>>('/config/global').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

/** Config de um profissional */
export function useProfessionalConfig(professionalId: number) {
  return useQuery({
    queryKey: ['config', 'professional', professionalId],
    queryFn: () =>
      api.get<ApiResponse<ProfessionalConfig>>(`/config/professional/${professionalId}`).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    enabled: !!professionalId,
  });
}

/** Salvar config global */
export function useUpdateGlobalConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { taxRate?: number; shiftPresencial?: number; shiftOnline?: number }) =>
      api.put<ApiResponse<GlobalConfig>>('/config/global', input).then((r) => r.data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['config', 'global'] }); },
  });
}

/** Salvar config de profissional */
export function useUpdateProfessionalConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ professionalId, ...body }: { professionalId: number; taxRate?: number | null; shiftPresencial?: number | null; shiftOnline?: number | null; operators?: OperatorEntry[] }) =>
      api.put<ApiResponse<ProfessionalConfig>>(`/config/professional/${professionalId}`, body).then((r) => r.data),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['config', 'professional', vars.professionalId] });
    },
  });
}

// ---------------------------------------------------------------------------
// Hooks de release
// ---------------------------------------------------------------------------

/** Release actions */
export function useReleaseReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { professionalId: number; month: string }) =>
      api.post<ApiResponse<Release>>('/releases', input).then((r) => r.data),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['report', vars.professionalId, vars.month] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useReleaseAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (month: string) =>
      api.post<ApiResponse<{ created: number }>>('/releases/batch', { month }).then((r) => r.data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['dashboard'] }); },
  });
}

interface ReleaseMutationInput {
  releaseId: number;
  professionalId: number;
  month: string;
}

export function useRevokeRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReleaseMutationInput) =>
      api.patch<ApiResponse<{ revoked: boolean }>>(`/releases/${input.releaseId}/revoke`, {}).then((r) => r.data),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['report', vars.professionalId, vars.month] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useApproveRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReleaseMutationInput) =>
      api.patch<ApiResponse<Release>>(`/releases/${input.releaseId}/approve`, {}).then((r) => r.data),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['report', vars.professionalId, vars.month] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useContestRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReleaseMutationInput & { message: string }) =>
      api.patch<ApiResponse<Release>>(`/releases/${input.releaseId}/contest`, { message: input.message }).then((r) => r.data),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['report', vars.professionalId, vars.month] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useResolveRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReleaseMutationInput) =>
      api.patch<ApiResponse<Release>>(`/releases/${input.releaseId}/resolve`, {}).then((r) => r.data),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['report', vars.professionalId, vars.month] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useMarkPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReleaseMutationInput) =>
      api.patch<ApiResponse<Release>>(`/releases/${input.releaseId}/pay`, {}).then((r) => r.data),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['report', vars.professionalId, vars.month] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useSendThreadMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReleaseMutationInput & { message: string }) =>
      api.post<ApiResponse<ThreadMessage>>(`/releases/${input.releaseId}/messages`, { message: input.message }).then((r) => r.data),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['report', vars.professionalId, vars.month] });
    },
  });
}

// ---------------------------------------------------------------------------
// Hooks de overrides (appointment-level)
// ---------------------------------------------------------------------------

export function useToggleAppointmentPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { externalAppointmentId: number; professionalId: number; month: string; isPaid: boolean }) =>
      api.patch<ApiResponse<unknown>>('/overrides/toggle-paid', input).then((r) => r.data),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['report', vars.professionalId, vars.month] });
    },
  });
}

// ---------------------------------------------------------------------------
// Hooks de notificacoes
// ---------------------------------------------------------------------------

interface UnreadRelease {
  releaseId: number;
  professionalId: number;
  senderName: string;
  month: string;
  unreadCount: number;
  lastMessage: string;
  lastMessageAt: string;
}

interface UnreadNotifications {
  totalUnread: number;
  releases: UnreadRelease[];
}

/** Notificacoes nao lidas (polling 60s) */
export function useUnreadNotifications() {
  return useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () =>
      api.get<ApiResponse<UnreadNotifications>>('/notifications/unread').then((r) => r.data),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

/** Marcar mensagens de um release como lidas */
export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (releaseId: number) =>
      api.patch<ApiResponse<{ marked: number }>>('/notifications/mark-read', { releaseId }).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications', 'unread'] });
    },
  });
}

export function useExcludeAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { externalAppointmentId: number; professionalId: number; month: string; isExcluded: boolean }) =>
      api.patch<ApiResponse<unknown>>('/overrides/exclude', input).then((r) => r.data),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['report', vars.professionalId, vars.month] });
    },
  });
}
