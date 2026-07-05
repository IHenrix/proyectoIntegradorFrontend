import { Injectable, signal } from '@angular/core';

export type UpgradeFeature =
  | 'historial_15d'
  | 'historial_30d'
  | 'prediccion'
  | 'semaforo'
  | 'pausar'
  | 'resumen';

export const UPGRADE_COPY: Record<UpgradeFeature, { titulo: string; desc: string; icono: string }> = {
  historial_15d: { titulo: 'Historial de 15 días',    desc: 'Con Premium accede al historial de los últimos 15 días para detectar tendencias de precio.',            icono: 'fa-solid fa-chart-line' },
  historial_30d: { titulo: 'Historial de 30 días',    desc: 'Con Premium accede al historial completo de 30 días y toma mejores decisiones de compra.',               icono: 'fa-solid fa-chart-line' },
  prediccion:    { titulo: 'Predicción IA',            desc: 'Con Premium obtén predicciones de precio con inteligencia artificial para los próximos días.',           icono: 'fa-solid fa-robot' },
  semaforo:      { titulo: 'Semáforo de precios',      desc: 'Con Premium ve si el precio está bajo, medio o alto respecto al histórico de cada ruta.',                icono: 'fa-solid fa-traffic-light' },
  pausar:        { titulo: 'Pausar alertas',           desc: 'Con Premium pausa y reactiva tus alertas cuando quieras, sin perder tu configuración.',                  icono: 'fa-solid fa-pause' },
  resumen:       { titulo: 'Tu plan',                  desc: 'Esto es lo que incluye cada plan en PasajeYa.',                                                          icono: 'fa-solid fa-crown' },
};

@Injectable({ providedIn: 'root' })
export class UpgradeModalService {
  abierto  = signal(false);
  feature  = signal<UpgradeFeature>('pausar');

  abrir(f: UpgradeFeature): void {
    this.feature.set(f);
    this.abierto.set(true);
  }

  cerrar(): void { this.abierto.set(false); }
}
