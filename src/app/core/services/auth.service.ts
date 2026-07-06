import { Injectable, signal, inject, Injector } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AlertaService } from './alerta.service';

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
  private http     = inject(HttpClient);
  private router   = inject(Router);
  private injector = inject(Injector);
  private readonly API = `${environment.apiUrl}/auth`;

  token  = signal<string | null>(localStorage.getItem('token'));
  nombre = signal<string | null>(localStorage.getItem('nombre'));
  rol    = signal<string | null>(localStorage.getItem('rol'));

  registro(data: RegistroData): Observable<string> {
    return this.http.post(`${this.API}/registro`, data, { responseType: 'text' });
  }

  login(email: string, password: string, captchaToken: string): Observable<{ token: string; nombre: string; rol: string; telefono?: string }> {
    return this.http.post<{ token: string; nombre: string; rol: string; telefono?: string }>(
      `${this.API}/login`, { email, password, captchaToken }
    );
  }

  iniciarSesion(res: { token: string; nombre: string; rol: string; telefono?: string }): void {
    localStorage.setItem('token', res.token);
    localStorage.setItem('nombre', res.nombre);
    localStorage.setItem('rol', res.rol);
    if (res.telefono) localStorage.setItem('telefono', res.telefono);
    this.token.set(res.token);
    this.nombre.set(res.nombre);
    this.rol.set(res.rol);
    // Cargamos las alertas al iniciar sesión para que el badge del navbar
    // se muestre de inmediato, sin esperar a entrar a la sección de alertas.
    // El admin no es pasajero: no tiene alertas ni badge que precargar.
    if (res.rol !== 'admin') {
      this.injector.get(AlertaService).precargar();
    }
  }

  cerrarSesion(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('nombre');
    localStorage.removeItem('rol');
    this.token.set(null);
    this.nombre.set(null);
    this.rol.set(null);
    this.injector.get(AlertaService).limpiar();
    this.router.navigate(['/auth']);
  }

  estaAutenticado(): boolean {
    return !!this.token();
  }
}
