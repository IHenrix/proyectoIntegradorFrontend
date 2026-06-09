import { Component, inject, signal, computed } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl } from '@angular/forms';
import { PaymentModalService } from '../../../core/services/payment-modal.service';
import { UpgradeModalService } from '../../../core/services/upgrade-modal.service';

type Step = 'form' | 'processing' | 'success' | 'error';

@Component({
  selector: 'app-payment-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './payment-modal.component.html',
  styleUrl:    './payment-modal.component.scss',
})
export class PaymentModalComponent {
  svc     = inject(PaymentModalService);
  upgrade = inject(UpgradeModalService);
  private fb = inject(FormBuilder);

  step   = signal<Step>('form');
  refNum = signal(Math.floor(100000 + Math.random() * 900000).toString());

  readonly PLANES = {
    mensual: { label: 'Premium Mensual', precio: 'S/ 19', periodo: '/mes',  ahorro: '' },
    anual:   { label: 'Premium Anual',   precio: 'S/ 120', periodo: '/año', ahorro: 'Ahorra S/ 108' },
  };

  plan = computed(() => this.PLANES[this.svc.plan()]);

  form = this.fb.group({
    titular:     ['', [Validators.required, Validators.minLength(4)]],
    numero:      ['', [Validators.required, luhnValidator]],
    expiracion:  ['', [Validators.required, expValidator]],
    cvv:         ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]],
    email:       ['', [Validators.required, Validators.email]],
  });

  // Número formateado con espacios cada 4 dígitos
  formatNumero(e: Event): void {
    const input = e.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 16);
    input.value  = digits.replace(/(.{4})/g, '$1 ').trim();
    this.form.get('numero')!.setValue(digits, { emitEvent: false });
  }

  formatExp(e: Event): void {
    const input  = e.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 4);
    input.value  = digits.length > 2 ? digits.slice(0, 2) + '/' + digits.slice(2) : digits;
    this.form.get('expiracion')!.setValue(input.value, { emitEvent: false });
  }

  cardBrand = computed(() => {
    const n = this.form.get('numero')?.value ?? '';
    if (/^4/.test(n))          return 'visa';
    if (/^5[1-5]/.test(n))     return 'mastercard';
    if (/^3[47]/.test(n))      return 'amex';
    return 'generic';
  });

  pagar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.step.set('processing');

    // Simula latencia de pasarela (2.2 s)
    setTimeout(() => {
      // 90% éxito en demo
      this.step.set('success');
    }, 2200);
  }

  cerrar(): void {
    this.step.set('form');
    this.form.reset();
    this.svc.cerrar();
  }

  volverAPlanes(): void {
    this.step.set('form');
    this.form.reset();
    this.svc.cerrar();
    this.upgrade.abrir('pausar');
  }

  invalid(campo: string): boolean {
    const c = this.form.get(campo);
    return !!(c?.invalid && c?.touched);
  }
}

// ── Validadores ──────────────────────────────────────────────────

function luhnValidator(ctrl: AbstractControl) {
  const val = (ctrl.value ?? '').replace(/\s/g, '');
  if (!/^\d{13,16}$/.test(val)) return { luhn: true };
  let sum = 0;
  let alt = false;
  for (let i = val.length - 1; i >= 0; i--) {
    let n = parseInt(val[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0 ? null : { luhn: true };
}

function expValidator(ctrl: AbstractControl) {
  const val = ctrl.value ?? '';
  const m = val.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return { exp: true };
  const mes = parseInt(m[1], 10);
  const anio = 2000 + parseInt(m[2], 10);
  if (mes < 1 || mes > 12) return { exp: true };
  const ahora = new Date();
  if (anio < ahora.getFullYear()) return { exp: true };
  if (anio === ahora.getFullYear() && mes < ahora.getMonth() + 1) return { exp: true };
  return null;
}
