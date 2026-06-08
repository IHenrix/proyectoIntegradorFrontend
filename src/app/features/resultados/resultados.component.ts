import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { VueloService } from '../../core/services/vuelo.service';
import { BusquedaParams, AEROPUERTOS } from '../../core/models/vuelo.model';
import { DecimalPipe, TitleCasePipe } from '@angular/common';

const AIRLINE_URLS: Record<string, string> = {
  LATAM:    'https://www.latam.com/es_pe/',
  Sky:      'https://www.skyairline.com/peru',
  JetSmart: 'https://jetsmart.com/pe/es/'
};

@Component({
  selector: 'app-resultados',
  standalone: true,
  imports: [RouterLink, DecimalPipe, TitleCasePipe],
  templateUrl: './resultados.component.html',
  styleUrl: './resultados.component.scss'
})
export class ResultadosComponent implements OnInit {
  private route = inject(ActivatedRoute);
  vueloService  = inject(VueloService);

  params!: BusquedaParams;

  ngOnInit(): void {
    const q = this.route.snapshot.queryParams;
    this.params = {
      origen:    q['origen']    ?? 'LIM',
      destino:   q['destino']   ?? 'CUZ',
      fecha:     q['fecha']     ?? '',
      pasajeros: +q['pasajeros'] || 1
    };
    this.vueloService.buscar(this.params);
  }

  ciudadDe(code: string): string {
    return AEROPUERTOS.find(a => a.code === code)?.ciudad ?? code;
  }

  urlAerolinea(aerolinea: string): string {
    return AIRLINE_URLS[aerolinea] ?? '#';
  }

  exportar(): void {
    this.vueloService.exportarExcel(this.params);
  }
}
