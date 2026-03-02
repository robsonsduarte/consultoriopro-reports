export type UserRole = 'super_admin' | 'admin' | 'user';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  apiProfessionalId: number | null;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  apiProfessionalId: number | null;
}

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
}
