import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AdminDashboard {
  usuariosPorRol: Record<string, number>;
  usuariosActivos: number;
  usuariosInactivos: number;
  ingresosTotales: number;
  alertasActivas: number;
  suscripcionesActivas: number;
  suscripcionesVencidas: number;
  suscripcionesCanceladas: number;
}

export interface AdminUsuarioListado {
  id: number;
  email: string;
  nombreCompleto: string;
  rol: string;
  activo: boolean;
  emailVerificado: boolean;
  fechaRegistro: string | null;
}

export interface AdminUsuarioDetalle {
  id: number;
  email: string;
  nombre: string | null;
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;
  genero: string | null;
  telefono: string | null;
  fechaNacimiento: string | null;
  tipoDocumento: string | null;
  nroDocumento: string | null;
  rol: string;
  activo: boolean;
  emailVerificado: boolean;
  fechaRegistro: string | null;
}

export interface AdminHistorialPrecio {
  idVuelo: number;
  aerolinea: string;
  origen: string;
  destino: string;
  precio: number;
  tipoTarifa: string;
  fechaCaptura: string;
}

export interface AdminHistorialFiltros {
  idVuelo?: number;
  origen?: string;
  destino?: string;
  desde?: string;
  hasta?: string;
}

export interface AdminSuscripcion {
  id: number;
  emailUsuario: string;
  nombreUsuario: string;
  planNombre: string;
  tipoPlan: string;
  monto: number;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
  metodoPago: string;
  autoRenovar: boolean;
}

export interface AdminPago {
  id: number;
  emailUsuario: string;
  nombreUsuario: string;
  monto: number;
  moneda: string;
  metodo: string;
  estado: string;
  refInterna: string;
  fechaPago: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/admin`;

  obtenerDashboard(): Observable<AdminDashboard> {
    return this.http.get<AdminDashboard>(`${this.API}/dashboard`);
  }

  listarUsuarios(): Observable<AdminUsuarioListado[]> {
    return this.http.get<AdminUsuarioListado[]>(`${this.API}/usuarios`);
  }

  obtenerUsuario(id: number): Observable<AdminUsuarioDetalle> {
    return this.http.get<AdminUsuarioDetalle>(`${this.API}/usuarios/${id}`);
  }

  cambiarRol(id: number, rol: string): Observable<AdminUsuarioListado> {
    return this.http.patch<AdminUsuarioListado>(`${this.API}/usuarios/${id}/rol`, { rol });
  }

  cambiarActivo(id: number, activo: boolean): Observable<AdminUsuarioListado> {
    return this.http.patch<AdminUsuarioListado>(`${this.API}/usuarios/${id}/activo?activo=${activo}`, {});
  }

  historialPrecios(filtros: AdminHistorialFiltros): Observable<AdminHistorialPrecio[]> {
    let params = '';
    const entries = Object.entries(filtros).filter(([, v]) => v !== undefined && v !== null && v !== '');
    if (entries.length > 0) {
      params = '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
    }
    return this.http.get<AdminHistorialPrecio[]>(`${this.API}/historial-precios${params}`);
  }

  exportarHistorialPrecios(filtros: AdminHistorialFiltros): Observable<Blob> {
    let params = '';
    const entries = Object.entries(filtros).filter(([, v]) => v !== undefined && v !== null && v !== '');
    if (entries.length > 0) {
      params = '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
    }
    return this.http.get(`${this.API}/historial-precios/exportar${params}`, { responseType: 'blob' });
  }

  listarSuscripciones(): Observable<AdminSuscripcion[]> {
    return this.http.get<AdminSuscripcion[]>(`${this.API}/suscripciones`);
  }

  listarPagos(): Observable<AdminPago[]> {
    return this.http.get<AdminPago[]>(`${this.API}/pagos`);
  }
}
