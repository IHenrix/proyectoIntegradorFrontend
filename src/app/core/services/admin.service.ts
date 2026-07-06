import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PaginaDTO } from '../models/pagina.model';

export interface AdminDashboard {
  usuariosPorRol: Record<string, number>;
  usuariosActivos: number;
  usuariosInactivos: number;
  ingresosTotales: number;
  alertasActivas: number;
  suscripcionesActivas: number;
  suscripcionesVencidas: number;
  suscripcionesCanceladas: number;
  ingresosPorMes: Record<string, number>;
  alertasPorAerolinea: Record<string, number>;
}

export interface AdminPrecioRutaSemana {
  ruta: string;
  semana: string;
  precioPromedio: number;
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

export interface CrearUsuarioRequest {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;
  genero?: string;
  email: string;
  password: string;
  telefono?: string;
  fechaNacimiento?: string;
  tipoDocumentoId?: number | null;
  nroDocumento?: string;
  rol: string;
}

export interface EditarUsuarioRequest {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;
  genero?: string;
  email: string;
  password?: string;
  telefono?: string;
  fechaNacimiento?: string;
  tipoDocumentoId?: number | null;
  nroDocumento?: string;
  rol: string;
  activo?: boolean;
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

export interface AdminReporteResumen {
  tasaConversionPremium: number;
  ingresoPromedioPorSuscripcion: number;
  rutaMasConsultada: string;
  usuariosNuevosMesActual: number;
  usuariosNuevosMesAnterior: number;
  ingresosMesActual: number;
  ingresosMesAnterior: number;
  suscripcionesNuevasMesActual: number;
  suscripcionesNuevasMesAnterior: number;
}

export interface AdminJobEstado {
  ultimaEjecucion: string | null;
  proximaEjecucionEstimada: string | null;
  totalTarifas: number;
  totalVuelos: number;
  totalHistorial: number;
  tasaCapturaMs: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/admin`;

  private buildParams(obj: Record<string, unknown>): string {
    const entries = Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '');
    return entries.length > 0
      ? '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
      : '';
  }

  obtenerDashboard(): Observable<AdminDashboard> {
    return this.http.get<AdminDashboard>(`${this.API}/dashboard`);
  }

  obtenerPreciosPorRuta(): Observable<AdminPrecioRutaSemana[]> {
    return this.http.get<AdminPrecioRutaSemana[]>(`${this.API}/dashboard/precios-ruta`);
  }

  listarUsuarios(pagina: number, tamano: number, q?: string): Observable<PaginaDTO<AdminUsuarioListado>> {
    const params = this.buildParams({ pagina, tamano, q });
    return this.http.get<PaginaDTO<AdminUsuarioListado>>(`${this.API}/usuarios${params}`);
  }

  obtenerUsuario(id: number): Observable<AdminUsuarioDetalle> {
    return this.http.get<AdminUsuarioDetalle>(`${this.API}/usuarios/${id}`);
  }

  crearUsuario(dto: CrearUsuarioRequest): Observable<AdminUsuarioListado> {
    return this.http.post<AdminUsuarioListado>(`${this.API}/usuarios`, dto);
  }

  editarUsuario(id: number, dto: EditarUsuarioRequest): Observable<AdminUsuarioListado> {
    return this.http.put<AdminUsuarioListado>(`${this.API}/usuarios/${id}`, dto);
  }

  cambiarRol(id: number, rol: string): Observable<AdminUsuarioListado> {
    return this.http.patch<AdminUsuarioListado>(`${this.API}/usuarios/${id}/rol`, { rol });
  }

  cambiarActivo(id: number, activo: boolean): Observable<AdminUsuarioListado> {
    return this.http.patch<AdminUsuarioListado>(`${this.API}/usuarios/${id}/activo?activo=${activo}`, {});
  }

  historialPrecios(
    filtros: AdminHistorialFiltros, pagina: number, tamano: number, q?: string
  ): Observable<PaginaDTO<AdminHistorialPrecio>> {
    const params = this.buildParams({ ...filtros, q, pagina, tamano });
    return this.http.get<PaginaDTO<AdminHistorialPrecio>>(`${this.API}/historial-precios${params}`);
  }

  exportarHistorialPrecios(filtros: AdminHistorialFiltros): Observable<Blob> {
    const params = this.buildParams({ ...filtros });
    return this.http.get(`${this.API}/historial-precios/exportar${params}`, { responseType: 'blob' });
  }

  listarSuscripciones(pagina: number, tamano: number, q?: string): Observable<PaginaDTO<AdminSuscripcion>> {
    const params = this.buildParams({ q, pagina, tamano });
    return this.http.get<PaginaDTO<AdminSuscripcion>>(`${this.API}/suscripciones${params}`);
  }

  listarPagos(): Observable<AdminPago[]> {
    return this.http.get<AdminPago[]>(`${this.API}/pagos`);
  }

  obtenerReporteResumen(): Observable<AdminReporteResumen> {
    return this.http.get<AdminReporteResumen>(`${this.API}/reportes/resumen`);
  }

  exportarReportePdf(): Observable<Blob> {
    return this.http.get(`${this.API}/reportes/exportar-pdf`, { responseType: 'blob' });
  }

  exportarUsuarios(): Observable<Blob> {
    return this.http.get(`${this.API}/usuarios/exportar`, { responseType: 'blob' });
  }

  exportarSuscripciones(): Observable<Blob> {
    return this.http.get(`${this.API}/suscripciones/exportar`, { responseType: 'blob' });
  }

  obtenerEstadoVuelosJob(): Observable<AdminJobEstado> {
    return this.http.get<AdminJobEstado>(`${this.API}/vuelos-job/estado`);
  }
}
