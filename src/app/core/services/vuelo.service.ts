import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BusquedaParams, Vuelo } from '../models/vuelo.model';

@Injectable({ providedIn: 'root' })
export class VueloService {
  private http = inject(HttpClient);
  private readonly API = 'http://localhost:8080/api';

  vuelos  = signal<Vuelo[]>([]);
  cargando = signal(false);
  error    = signal<string | null>(null);

  buscar(params: BusquedaParams): void {
    this.cargando.set(true);
    this.error.set(null);

    this.http.get<Vuelo[]>(`${this.API}/vuelos`, { params: { ...params } as any })
      .subscribe({
        next: data => {
          this.vuelos.set(data);
          this.cargando.set(false);
        },
        error: () => {
          this.error.set('Error al conectar con el servidor');
          this.cargando.set(false);
        }
      });
  }

  exportarExcel(params: BusquedaParams): void {
    this.http.get(`${this.API}/vuelos/exportar`, {
      params: { ...params } as any,
      responseType: 'blob'
    }).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = 'vuelos-pasajeya.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    });
  }
}
