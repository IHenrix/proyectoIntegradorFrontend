import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, finalize, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Alerta, CrearAlertaRequest } from '../models/alerta.model';

@Injectable({ providedIn: 'root' })
export class AlertaService {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/alertas`;

  alertas = signal<Alerta[]>([]);
  cargando = signal(false);

  listar(): Observable<Alerta[]> {
    this.cargando.set(true);
    return this.http.get<Alerta[]>(this.API).pipe(
      tap(alertas => this.alertas.set(alertas)),
      finalize(() => this.cargando.set(false))
    );
  }

  crear(request: CrearAlertaRequest): Observable<Alerta> {
    return this.http.post<Alerta>(this.API, request).pipe(
      tap(alerta => this.alertas.update(items => [alerta, ...items]))
    );
  }

  pausar(id: number): Observable<Alerta> {
    return this.http.patch<Alerta>(`${this.API}/${id}/pausar`, {}).pipe(
      tap(alerta => this.alertas.update(items => items.map(x => x.id === id ? alerta : x)))
    );
  }

  reactivar(id: number): Observable<Alerta> {
    return this.http.patch<Alerta>(`${this.API}/${id}/reactivar`, {}).pipe(
      tap(alerta => this.alertas.update(items => items.map(x => x.id === id ? alerta : x)))
    );
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`).pipe(
      tap(() => this.alertas.update(items => items.filter(x => x.id !== id)))
    );
  }

  descargarExcel(): Observable<Blob> {
    return this.http.get(`${this.API}/reporte/excel`, { responseType: 'blob' });
  }

  descargarPdf(): Observable<Blob> {
    return this.http.get(`${this.API}/reporte/pdf`, { responseType: 'blob' });
  }
}
