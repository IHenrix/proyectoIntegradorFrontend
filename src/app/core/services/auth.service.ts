import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

export interface RegistroData {
  nombre:          string;
  apellido:        string;
  email:           string;
  password:        string;
  telefono?:       string;
  fechaNacimiento?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http   = inject(HttpClient);
  private router = inject(Router);
  private readonly API = 'http://localhost:8080/api/auth';

  token = signal<string | null>(localStorage.getItem('token'));

  registro(data: RegistroData): Observable<string> {
    return this.http.post(`${this.API}/registro`, data, { responseType: 'text' });
  }

  login(email: string, password: string): Observable<{ token: string; nombre: string; rol: string }> {
    return this.http.post<{ token: string; nombre: string; rol: string }>(
      `${this.API}/login`, { email, password }
    );
  }

  guardarToken(t: string): void {
    localStorage.setItem('token', t);
    this.token.set(t);
  }

  cerrarSesion(): void {
    localStorage.removeItem('token');
    this.token.set(null);
    this.router.navigate(['/auth']);
  }

  estaAutenticado(): boolean {
    return !!this.token();
  }
}
