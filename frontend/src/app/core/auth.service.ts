import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';

export interface User { username: string; role: 'ADMIN' | 'USER'; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = 'http://localhost:8081/api/auth';
  private readonly KEY = 'yallatn_session';

  currentUser = signal<User | null>(this._load());

  constructor(private http: HttpClient, private router: Router) {}

  private _load(): User | null {
    try { return JSON.parse(sessionStorage.getItem(this.KEY) || 'null'); }
    catch { return null; }
  }

  login(username: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.API}/login`, { username, password }).pipe(
      tap(res => {
        if (res.success) {
          const u: User = { username: res.username, role: res.role };
          sessionStorage.setItem(this.KEY, JSON.stringify(u));
          this.currentUser.set(u);
        }
      })
    );
  }

  logout() {
    sessionStorage.removeItem(this.KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  isLoggedIn() { return !!this.currentUser(); }
  isAdmin()    { return this.currentUser()?.role === 'ADMIN'; }
}
