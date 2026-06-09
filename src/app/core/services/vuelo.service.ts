import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BusquedaParams, Vuelo, VueloDetalle } from '../models/vuelo.model';

@Injectable({ providedIn: 'root' })
export class VueloService {
  private http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  vuelos         = signal<Vuelo[]>([]);
  cargando       = signal(false);
  error          = signal<string | null>(null);
  vuelosVuelta   = signal<Vuelo[]>([]);
  cargandoVuelta = signal(false);

  buscar(params: BusquedaParams): void {
    this.cargando.set(true);
    this.error.set(null);
    this.vuelosVuelta.set([]);

    this.http.get<Vuelo[]>(`${this.API}/vuelos`, { params: { ...params } as any })
      .subscribe({
        next:  data => { this.vuelos.set(data);               this.cargando.set(false); },
        error: ()   => { this.error.set('Error al conectar'); this.cargando.set(false); }
      });
  }

  buscarVuelta(params: BusquedaParams): void {
    this.cargandoVuelta.set(true);
    this.http.get<Vuelo[]>(`${this.API}/vuelos`, {
      params: {
        origen:    params.destino,
        destino:   params.origen,
        fecha:     params.fechaVuelta!,
        pasajeros: params.pasajeros
      } as any
    }).subscribe({
      next:  data => { this.vuelosVuelta.set(data); this.cargandoVuelta.set(false); },
      error: ()   => { this.vuelosVuelta.set([]);   this.cargandoVuelta.set(false); }
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

  detalle(tarifaId: number): Observable<VueloDetalle> {
    return this.http.get<VueloDetalle>(`${this.API}/vuelos/tarifas/${tarifaId}`);
  }
}
