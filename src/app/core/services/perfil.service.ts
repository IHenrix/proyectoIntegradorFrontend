import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PerfilData {
  nombre:           string;
  apellidoPaterno:  string;
  apellidoMaterno?: string;
  genero?:          string;
  telefono?:        string;
  fechaNacimiento?: string;
  email:            string;
  rol:              string;
}

export interface ActualizarPerfilRequest {
  nombre:           string;
  apellidoPaterno:  string;
  apellidoMaterno?: string;
  genero?:          string;
  telefono?:        string;
  fechaNacimiento?: string;
  passwordActual?:  string;
  passwordNuevo?:   string;
}

@Injectable({ providedIn: 'root' })
export class PerfilService {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/perfil`;

  obtener(): Observable<PerfilData> {
    return this.http.get<PerfilData>(this.API);
  }

  actualizar(data: ActualizarPerfilRequest): Observable<PerfilData> {
    return this.http.put<PerfilData>(this.API, data);
  }
}
