import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AlertaService } from '../../core/services/alerta.service';
import { AeropuertoService } from '../../core/services/aeropuerto.service';
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
  alertaService = inject(AlertaService);
  aeropuertoService = inject(AeropuertoService);

  fechaMin = new Date().toISOString().split('T')[0];
  mensaje = signal<string | null>(null);
  error = signal<string | null>(null);
  listaError = signal<string | null>(null);

  alertasActivas = computed(() => this.alertaService.alertas().filter(a => a.activa));

  form = this.fb.group({
    origen: ['LIM', Validators.required],
    destino: ['CUZ', Validators.required],
    fecha: ['2026-06-20', Validators.required],
    tipoTarifa: ['basica', Validators.required],
    precioObjetivo: [120, [Validators.required, Validators.min(1)]],
    telefono: ['', [Validators.required, Validators.pattern(/^(\+?51)?9[0-9]{8}$/)]]
  });

  ngOnInit(): void {
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

  pausar(id: number): void {
    this.alertaService.pausar(id).subscribe({
      error: () => this.error.set('No se pudo pausar la alerta.')
    });
  }

  eliminar(id: number): void {
    this.alertaService.eliminar(id).subscribe({
      error: () => this.error.set('No se pudo eliminar la alerta.')
    });
  }

  ciudad(code: string): string {
    return this.aeropuertoService.ciudad(code);
  }
}
