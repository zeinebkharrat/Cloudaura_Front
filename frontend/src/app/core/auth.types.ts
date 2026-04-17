export interface UserProfile {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  nationality?: string | null;
  gender?: 'MALE' | 'FEMALE' | null;
  dateOfBirth?: string | null;
  cityId?: number | null;
  cityName?: string | null;
  roles: string[];
  status: string;
  artisanRequestPending: boolean;
  profileImageUrl?: string | null;
  /** Gamification points (also returned by GET /api/profile and /api/auth/me). */
  points?: number | null;
  monthlyScore?: number | null;
  lifetimeScore?: number | null;
}

export interface AuthResponse {
  token: string;
  expiresIn: number;
  user: UserProfile;
}

export interface AuthMessageResponse {
  message: string;
}

export interface SignInPayload {
  identifier: string;
  password: string;
}

export interface SignUpPayload {
  username: string;
  email: string;
  phone?: string | null;
  password: string;
  firstName: string;
  lastName: string;
  becomeArtisan: boolean;
  nationality?: string | null;
  gender?: 'MALE' | 'FEMALE' | null;
  dateOfBirth?: string | null;
  cityId?: number | null;
  profileImageUrl?: string | null;
  captchaToken?: string | null;
}

export interface CaptchaConfig {
  enabled: boolean;
  siteKey: string;
  /** Backend has a secret but no site key — widget cannot load; signup will still fail server-side. */
  secretConfiguredButMissingSiteKey?: boolean;
  /** `v2` = checkbox · `v3` = score (execute) — must match key type in Google Admin. */
  version?: 'v2' | 'v3';
  /** Set when GET /captcha-config failed (e.g. backend down) — do not submit without retry. */
  configUnavailable?: boolean;
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
  facebook: boolean;
  instagram: boolean;
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

export interface UserDeviceSession {
  sessionId: string;
  deviceName: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  issuedAt?: string | null;
  lastSeenAt?: string | null;
  expiresAt?: string | null;
  current: boolean;
  active: boolean;
}

export interface RevokeOtherSessionsResponse {
  revokedCount: number;
}

export interface ForgotPasswordPayload {
  email: string;
  captchaToken?: string | null;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}

export interface ResendVerificationPayload {
  identifier: string;
}

export interface CityOption {
  id: number;
  cityId?: number;
  name: string;
  region: string;
}

export interface AuditLogEntry {
  id: number;
  action: string;
  actor: string;
  targetUserId: number | null;
  targetUserEmail: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: string;
  createdAt: string;
}

export interface AuditLogPage {
  content: AuditLogEntry[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}
