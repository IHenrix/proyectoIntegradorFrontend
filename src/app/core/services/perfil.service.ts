import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
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
  tipoDocumento?:   string;
  nroDocumento?:    string;
}

export interface SuscripcionData {
  id:          number;
  planNombre:  string;
  tipoPlan:    'mensual' | 'anual';
  monto:       number;
  fechaInicio: string;
  fechaFin:    string;
  estado:      string;
  metodoPago:  string;
  refInterna:  string;
  autoRenovar: boolean;
}

export interface PagoRequest {
  plan:           'mensual' | 'anual';
  metodo:         'tarjeta_credito' | 'tarjeta_debito' | 'yape' | 'plin';
  titular?:       string;
  numeroTarjeta?: string;
  expira?:        string;
  emailRecibo?:   string;
}

export interface ActualizarPerfilRequest {
  nombre:           string;
  apellidoPaterno:  string;
  apellidoMaterno?: string;
  genero?:          string;
  telefono?:        string;
  fechaNacimiento?: string;
  tipoDocumento?:   string;
  nroDocumento?:    string;
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

  obtenerHistorialSuscripciones(): Observable<SuscripcionData[]> {
    return this.http.get<SuscripcionData[]>(`${this.API}/suscripciones`);
  }

  obtenerSuscripcion(): Observable<SuscripcionData | null> {
    return this.http.get<SuscripcionData>(`${this.API}/suscripcion`, { observe: 'response' }).pipe(
      map(res => res.status === 204 ? null : res.body)
    );
  }

  actualizar(data: ActualizarPerfilRequest): Observable<PerfilData> {
    return this.http.put<PerfilData>(this.API, data);
  }

  pagar(data: PagoRequest): Observable<SuscripcionData> {
    return this.http.post<SuscripcionData>(`${this.API}/suscripcion`, data);
  }

  cancelarSuscripcion(): Observable<void> {
    return this.http.patch<void>(`${this.API}/suscripcion/cancelar`, {});
  }
}
