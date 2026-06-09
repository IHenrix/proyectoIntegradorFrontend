import { Injectable, signal } from '@angular/core';

export type PlanPago = 'mensual' | 'anual';

@Injectable({ providedIn: 'root' })
export class PaymentModalService {
  abierto = signal(false);
  plan    = signal<PlanPago>('mensual');

  abrir(plan: PlanPago = 'mensual'): void {
    this.plan.set(plan);
    this.abierto.set(true);
  }

  cerrar(): void { this.abierto.set(false); }
}
