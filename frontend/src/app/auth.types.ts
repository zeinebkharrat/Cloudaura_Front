export interface UserProfile {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  status: string;
  artisanRequestPending: boolean;
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
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: string;
  artisanRequestPending: boolean;
  roles: string[];
}

export interface AdminUserUpdatePayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string;
}

export interface SocialProviders {
  google: boolean;
  github: boolean;
}
