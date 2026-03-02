import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(6, 'Senha deve ter no minimo 6 caracteres'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual obrigatoria'),
  newPassword: z.string().min(6, 'Nova senha deve ter no minimo 6 caracteres'),
  confirmPassword: z.string().min(1, 'Confirmacao obrigatoria'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Senhas nao coincidem',
  path: ['confirmPassword'],
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
