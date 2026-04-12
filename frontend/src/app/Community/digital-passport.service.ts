import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/api-url';
import {
  DigitalPassport,
  PassportPhotoCreateRequest,
  PassportProfileUpdateRequest,
  PassportStampUpsertRequest,
} from './digital-passport.types';

@Injectable({ providedIn: 'root' })
export class DigitalPassportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/api/passport`;

  getMyPassport(): Observable<DigitalPassport> {
    return this.http.get<DigitalPassport>(`${this.baseUrl}/me`);
  }

  getPassportByUserId(userId: number): Observable<DigitalPassport> {
    return this.http.get<DigitalPassport>(`${this.baseUrl}/user/${userId}`);
  }

  updateMyProfile(payload: PassportProfileUpdateRequest): Observable<DigitalPassport> {
    return this.http.put<DigitalPassport>(`${this.baseUrl}/me/profile`, payload);
  }

  addOrUpdateStamp(payload: PassportStampUpsertRequest): Observable<DigitalPassport> {
    return this.http.post<DigitalPassport>(`${this.baseUrl}/me/stamps`, payload);
  }

  deleteStamp(stampId: number): Observable<DigitalPassport> {
    return this.http.delete<DigitalPassport>(`${this.baseUrl}/me/stamps/${stampId}`);
  }

  addPhoto(payload: PassportPhotoCreateRequest): Observable<DigitalPassport> {
    return this.http.post<DigitalPassport>(`${this.baseUrl}/me/photos`, payload);
  }

  deletePhoto(photoId: number): Observable<DigitalPassport> {
    return this.http.delete<DigitalPassport>(`${this.baseUrl}/me/photos/${photoId}`);
  }
}
