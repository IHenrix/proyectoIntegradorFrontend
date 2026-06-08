import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface RegistroData {
  nombre:            string;
  apellidoPaterno:   string;
  apellidoMaterno?:  string;
  genero?:           string;
  email:             string;
  password:          string;
  telefono?:         string;
  fechaNacimiento?:  string;
  tipoDocumentoId?:  number | null;
  nroDocumento?:     string;
  captchaToken:      string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http   = inject(HttpClient);
  private router = inject(Router);
  private readonly API = `${environment.apiUrl}/auth`;

  token  = signal<string | null>(localStorage.getItem('token'));
  nombre = signal<string | null>(localStorage.getItem('nombre'));
  rol    = signal<string | null>(localStorage.getItem('rol'));

  registro(data: RegistroData): Observable<string> {
    return this.http.post(`${this.API}/registro`, data, { responseType: 'text' });
  }

  login(email: string, password: string, captchaToken: string): Observable<{ token: string; nombre: string; rol: string }> {
    return this.http.post<{ token: string; nombre: string; rol: string }>(
      `${this.API}/login`, { email, password, captchaToken }
    );
  }

  iniciarSesion(res: { token: string; nombre: string; rol: string }): void {
    localStorage.setItem('token', res.token);
    localStorage.setItem('nombre', res.nombre);
    localStorage.setItem('rol', res.rol);
    this.token.set(res.token);
    this.nombre.set(res.nombre);
    this.rol.set(res.rol);
  }

  cerrarSesion(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('nombre');
    localStorage.removeItem('rol');
    this.token.set(null);
    this.nombre.set(null);
    this.rol.set(null);
    this.router.navigate(['/auth']);
  }

  estaAutenticado(): boolean {
    return !!this.token();
  }
}
