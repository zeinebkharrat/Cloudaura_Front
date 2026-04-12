export interface PassportStampView {
  stampId: number;
  cityId: number | null;
  cityName: string | null;
  region: string | null;
  visitCount: number | null;
  firstVisitedAt: string | null;
  lastVisitedAt: string | null;
  emblemKey: string | null;
  memoryNote: string | null;
  photoUrl: string | null;
}

export interface PassportAchievementView {
  achievementId: number;
  achievementCode: string;
  title: string;
  description: string | null;
  badgeTone: string | null;
  unlockedAt: string | null;
}

export interface PassportPhotoView {
  photoId: number;
  cityId: number | null;
  cityName: string | null;
  photoUrl: string;
  caption: string | null;
  uploadedAt: string | null;
}

export interface PassportCityProgressView {
  cityId: number;
  cityName: string;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  visited: boolean;
  visitCount: number;
}

export interface DigitalPassport {
  passportId: number;
  userId: number;
  displayName: string;
  username: string;
  nationality: string | null;
  profileImageUrl: string | null;
  passportNumber: string;
  travelStyleBadge: string | null;
  bioNote: string | null;
  joinDate: string | null;
  createdAt: string | null;
  uniqueCitiesVisited: number;
  totalVisits: number;
  stamps: PassportStampView[];
  achievements: PassportAchievementView[];
  photos: PassportPhotoView[];
  cityProgress: PassportCityProgressView[];
}

export interface PassportProfileUpdateRequest {
  travelStyleBadge: string | null;
  bioNote: string | null;
}

export interface PassportStampUpsertRequest {
  cityId: number;
  visitedAt?: string | null;
  emblemKey?: string | null;
  memoryNote?: string | null;
  photoUrl?: string | null;
}

export interface PassportPhotoCreateRequest {
  cityId?: number | null;
  photoUrl: string;
  caption?: string | null;
}
