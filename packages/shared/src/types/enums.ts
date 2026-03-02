export const RELEASE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  CONTESTED: 'contested',
  IN_REVIEW: 'in_review',
  RESOLVED: 'resolved',
} as const;

export type ReleaseStatus = (typeof RELEASE_STATUS)[keyof typeof RELEASE_STATUS];

export const SHIFT_PERIOD = {
  MORNING: 'morning',
  AFTERNOON: 'afternoon',
  EVENING: 'evening',
} as const;

export type ShiftPeriod = (typeof SHIFT_PERIOD)[keyof typeof SHIFT_PERIOD];

export const SHIFT_MODALITY = {
  PRESENCIAL: 'presencial',
  ONLINE: 'online',
} as const;

export type ShiftModality = (typeof SHIFT_MODALITY)[keyof typeof SHIFT_MODALITY];

export const PAYMENT_METHOD_TYPE = {
  PIX: 'pix',
  TED: 'ted',
} as const;

export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPE)[keyof typeof PAYMENT_METHOD_TYPE];

export const PIX_KEY_TYPE = {
  CPF: 'cpf',
  CNPJ: 'cnpj',
  EMAIL: 'email',
  PHONE: 'phone',
  RANDOM: 'random',
} as const;

export type PixKeyType = (typeof PIX_KEY_TYPE)[keyof typeof PIX_KEY_TYPE];
