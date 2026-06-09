import { Component, inject } from '@angular/core';
import { UpgradeModalService, UPGRADE_COPY } from '../../../core/services/upgrade-modal.service';
import { PaymentModalService } from '../../../core/services/payment-modal.service';

@Component({
  selector: 'app-upgrade-modal',
  standalone: true,
  imports: [],
  templateUrl: './upgrade-modal.component.html',
  styleUrl: './upgrade-modal.component.scss'
})
export class UpgradeModalComponent {
  svc     = inject(UpgradeModalService);
  payment = inject(PaymentModalService);
  copy    = UPGRADE_COPY;

  featureCopy() { return this.copy[this.svc.feature()]; }

  irAPagar(): void {
    this.svc.cerrar();
    this.payment.abrir('mensual');
  }

  readonly FREE_FEATURES = [
    { ok: true,  text: 'Resultados ilimitados' },
    { ok: true,  text: 'Ver detalle de vuelos' },
    { ok: true,  text: 'Historial de precios (7 días)' },
    { ok: true,  text: 'Máximo 3 alertas WhatsApp en total' },
    { ok: false, text: 'Pausar / reactivar alertas' },
    { ok: false, text: 'Semáforo de precios' },
    { ok: false, text: 'Historial extendido (15 y 30 días)' },
    { ok: false, text: 'Predicción IA de precios' },
  ];

  readonly PREMIUM_FEATURES = [
    { ok: true, text: 'Todo lo de Básico' },
    { ok: true, text: 'Alertas WhatsApp ilimitadas' },
    { ok: true, text: 'Pausar y reactivar alertas' },
    { ok: true, text: 'Semáforo de precios en tiempo real' },
    { ok: true, text: 'Historial completo (15 y 30 días)' },
    { ok: true, text: 'Predicción IA de precios' },
    { ok: true, text: 'Soporte prioritario' },
  ];
}
