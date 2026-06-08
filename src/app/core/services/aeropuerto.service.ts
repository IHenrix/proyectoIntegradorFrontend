import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface Aeropuerto {
  code:   string;
  ciudad: string;
  nombre: string;
  pais:   string;
}

@Injectable({ providedIn: 'root' })
export class AeropuertoService {
  private http = inject(HttpClient);
  private readonly API = 'http://localhost:8080/api';

  aeropuertos = signal<Aeropuerto[]>([]);
  cargando    = signal(true);

  constructor() {
    this.http.get<Aeropuerto[]>(`${this.API}/aeropuertos`).subscribe({
      next:  data => { this.aeropuertos.set(data); this.cargando.set(false); },
      error: ()   => { this.cargando.set(false); }
    });
  }

  ciudad(code: string): string {
    return this.aeropuertos().find(a => a.code === code)?.ciudad ?? code;
  }

  /** "Lima, Perú (LIM)" — formato chip como Kayak */
  label(code: string): string {
    const a = this.aeropuertos().find(x => x.code === code);
    return a ? `${a.ciudad}, ${a.pais} (${a.code})` : code;
  }
}
