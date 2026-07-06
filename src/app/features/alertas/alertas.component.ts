import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AlertaService } from '../../core/services/alerta.service';
import { AeropuertoService } from '../../core/services/aeropuerto.service';
import { AuthService } from '../../core/services/auth.service';
import { UpgradeModalService } from '../../core/services/upgrade-modal.service';
import { ConfirmModalService } from '../../core/services/confirm-modal.service';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';

@Component({
  selector: 'app-alertas',
  standalone: true,
  imports: [ReactiveFormsModule, DecimalPipe, TitleCasePipe, RouterLink, NavbarComponent, FooterComponent],
  templateUrl: './alertas.component.html',
  styleUrl: './alertas.component.scss'
})
export class AlertasComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  alertaService = inject(AlertaService);
  aeropuertoService = inject(AeropuertoService);
  auth    = inject(AuthService);
  upgrade = inject(UpgradeModalService);
  confirm = inject(ConfirmModalService);

  readonly LIMITE_ALERTAS_FREE = 3;

  esPremium = computed(() => this.auth.rol() === 'usuario_premium');

  limiteSuperado = computed(() =>
    !this.esPremium() && this.alertaService.alertas().length >= this.LIMITE_ALERTAS_FREE
  );

  fechaMin = new Date().toISOString().split('T')[0];
  mensaje = signal<string | null>(null);
  error = signal<string | null>(null);
  listaError = signal<string | null>(null);

  mostrarFormulario = signal(false);

  alertasActivas          = computed(() => this.alertaService.alertas().filter(a => a.activa));
  alertasPausadas         = computed(() => this.alertaService.alertas().filter(a => !a.activa));
  alertasConBajaDePrecios = computed(() => this.alertaService.alertas().filter(a => this.esHit(a)));

  form = this.fb.group({
    origen: ['LIM', Validators.required],
    destino: ['CUZ', Validators.required],
    fecha: ['2026-06-20', Validators.required],
    tipoTarifa: ['basica', Validators.required],
    precioObjetivo: [120, [Validators.required, Validators.min(1)]],
    telefono: ['', [Validators.required, Validators.pattern(/^(\+?51)?9[0-9]{8}$/)]]
  });

  ngOnInit(): void {
    // El admin no es pasajero: no gestiona alertas propias, no aplica esta vista.
    if (this.auth.rol() === 'admin') {
      this.router.navigate(['/admin']);
      return;
    }
    this.cargar();
  }

  cargar(): void {
    this.listaError.set(null);
    this.alertaService.listar().subscribe({
      error: () => this.listaError.set('No se pudieron cargar tus alertas.')
    });
  }

  crear(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.value;
    this.error.set(null);
    this.mensaje.set(null);
    this.alertaService.crear({
      origen: v.origen!,
      destino: v.destino!,
      fecha: v.fecha!,
      tipoTarifa: v.tipoTarifa!,
      precioObjetivo: Number(v.precioObjetivo),
      telefono: v.telefono!
    }).subscribe({
      next: () => {
        this.mensaje.set('Alerta creada correctamente.');
        this.form.patchValue({ precioObjetivo: 120, telefono: '' });
      },
      error: err => this.error.set(err.error?.message ?? 'No se pudo crear la alerta.')
    });
  }

  async pausar(id: number): Promise<void> {
    if (!this.esPremium()) { this.upgrade.abrir('pausar'); return; }
    const ok = await this.confirm.abrir({
      tipo:        'warning',
      titulo:      '¿Pausar esta alerta?',
      mensaje:     'La alerta no se eliminará, pero dejarás de recibir notificaciones por WhatsApp mientras esté pausada.',
      labelOk:     'Sí, pausar',
      labelCancel: 'Cancelar',
    });
    if (!ok) return;
    this.alertaService.pausar(id).subscribe({
      error: () => this.error.set('No se pudo pausar la alerta.')
    });
  }

  async reactivar(id: number): Promise<void> {
    const ok = await this.confirm.abrir({
      tipo:        'info',
      titulo:      '¿Reactivar esta alerta?',
      mensaje:     'Volverás a recibir notificaciones por WhatsApp cuando el precio baje de tu objetivo.',
      labelOk:     'Sí, reactivar',
      labelCancel: 'Cancelar',
    });
    if (!ok) return;
    this.alertaService.reactivar(id).subscribe({
      next: () => this.mensaje.set('Alerta reactivada correctamente.'),
      error: () => this.error.set('No se pudo reactivar la alerta. Asegúrate de que el backend esté encendido.')
    });
  }

  async eliminar(id: number): Promise<void> {
    const ok = await this.confirm.abrir({
      tipo:        'danger',
      titulo:      '¿Eliminar alerta?',
      mensaje:     'Se eliminará esta alerta de forma permanente. No podrás recuperarla.',
      labelOk:     'Sí, eliminar',
      labelCancel: 'Cancelar',
    });
    if (!ok) return;
    this.alertaService.eliminar(id).subscribe({
      error: () => this.error.set('No se pudo eliminar la alerta.')
    });
  }

  descargando = signal<'excel' | 'pdf' | null>(null);

  descargarExcel(): void {
    if (!this.esPremium()) { this.upgrade.abrir('pausar'); return; }
    this.descargando.set('excel');
    this.alertaService.descargarExcel().subscribe({
      next: blob => { this.triggerDescarga(blob, 'alertas_pasajeyа.xlsx'); this.descargando.set(null); },
      error: () => { this.error.set('No se pudo generar el Excel.'); this.descargando.set(null); }
    });
  }

  descargarPdf(): void {
    if (!this.esPremium()) { this.upgrade.abrir('pausar'); return; }
    this.descargando.set('pdf');
    this.alertaService.descargarPdf().subscribe({
      next: blob => { this.triggerDescarga(blob, 'alertas_pasajeyа.pdf'); this.descargando.set(null); },
      error: () => { this.error.set('No se pudo generar el PDF.'); this.descargando.set(null); }
    });
  }

  private triggerDescarga(blob: Blob, nombre: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  }

  esHit(a: { precioActual?: number | null; precioObjetivo: number }): boolean {
    return !!a.precioActual && a.precioActual < a.precioObjetivo;
  }

  ciudad(code: string): string {
    return this.aeropuertoService.ciudad(code);
  }

  fmtFecha(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d)
      .toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
