import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ActivityReservationListItem, PageResponse, ReservationStatus } from '../admin-api.models';

@Injectable({ providedIn: 'root' })
export class ActivityReservationAdminService {
  private readonly base = '/api/admin/activity-reservations';

  constructor(private readonly http: HttpClient) {}

  list(params: {
    q?: string;
    status?: ReservationStatus | '';
    reservationDate?: string | null;
    page: number;
    size: number;
    sort: string;
  }): Observable<PageResponse<ActivityReservationListItem>> {
    let httpParams = new HttpParams()
      .set('page', params.page)
      .set('size', params.size)
      .set('sort', params.sort);

    if (params.q?.trim()) {
      httpParams = httpParams.set('q', params.q.trim());
    }
    if (params.status) {
      httpParams = httpParams.set('status', params.status);
    }
    if (params.reservationDate) {
      httpParams = httpParams.set('reservationDate', params.reservationDate);
    }

    return this.http.get<PageResponse<ActivityReservationListItem>>(this.base, { params: httpParams });
  }
}
