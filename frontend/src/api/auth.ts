import api from './client';
import type {
  SignUpPayload,
  SignInPayload,
  VerifyOtpPayload,
  GoogleAuthPayload,
  AuthResponse,
  User,
} from '../types';

export const authApi = {
  signUp: (data: SignUpPayload) =>
    api.post<AuthResponse>('/auth/signup', data),

  verifyOtp: (data: VerifyOtpPayload) =>
    api.post<AuthResponse>('/auth/verify-otp', data),

  signIn: (data: SignInPayload) =>
    api.post<AuthResponse>('/auth/signin', data),

  googleAuth: (data: GoogleAuthPayload) =>
    api.post<AuthResponse>('/auth/google', data),

  getMe: () =>
    api.get<User>('/users/me'),
};
