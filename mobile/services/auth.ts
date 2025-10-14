import { api } from "../lib/api";

export type User = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  settings: {
    currency: string;
    language: string;
    week_starts_on: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type LoginRequest = {
  identifier: string;
  password: string;
};

export type SignupRequest = {
  name: string;
  email: string;
  phone: string;
  password: string;
};

export type UpdateProfileRequest = {
  name?: string;
  email?: string;
  phone?: string;
  settings?: {
    currency?: string;
    language?: string;
    week_starts_on?: number;
  };
};

export type AuthResponse = {
  token: string;
  admin: User;
};

export const login = async (data: LoginRequest): Promise<AuthResponse> => {
  const response = await api.post("/auth/login", data);
  return response.data;
};

export const signup = async (data: SignupRequest): Promise<AuthResponse> => {
  const response = await api.post("/auth/signup", data);
  return response.data;
};

export const getProfile = async (): Promise<{ admin: User }> => {
  const response = await api.get("/auth/me");
  return response.data;
};

export const updateProfile = async (
  data: UpdateProfileRequest
): Promise<{ message: string; admin: User }> => {
  const response = await api.put("/auth/me", data);
  return response.data;
};
