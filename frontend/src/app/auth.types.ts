export interface UserProfile {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  nationality?: string | null;
  cityId?: number | null;
  cityName?: string | null;
  roles: string[];
  status: string;
  artisanRequestPending: boolean;
  profileImageUrl?: string | null;
}

export interface AuthResponse {
  token: string;
  expiresIn: number;
  user: UserProfile;
}

export interface SignInPayload {
  identifier: string;
  password: string;
}

export interface SignUpPayload {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  becomeArtisant: boolean;
  nationality?: string | null;
  cityId?: number | null;
  profileImageUrl?: string | null;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  nationality: string | null;
  cityId: number | null;
  cityName: string | null;
  status: string;
  artisanRequestPending: boolean;
  roles: string[];
  profileImageUrl: string | null;
  banned: boolean;
  banReason: string | null;
  banExpiresAt: string | null;
}

export interface AdminUserUpdatePayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  nationality: string | null;
  cityId: number | null;
  profileImageUrl: string | null;
  status: string;
}

export interface SocialProviders {
  google: boolean;
  github: boolean;
}

export interface ProfileUpdatePayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  nationality: string | null;
  cityId: number | null;
  profileImageUrl: string | null;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface CityOption {
  id: number;
  name: string;
  region: string;
}
