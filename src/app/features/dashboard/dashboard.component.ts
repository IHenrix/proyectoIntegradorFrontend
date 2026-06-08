import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { AEROPUERTOS } from '../../core/models/vuelo.model';

const DEMO_FECHA = '2026-06-20';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl:    './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private auth      = inject(AuthService);
  private fb        = inject(FormBuilder);
  private router    = inject(Router);
  private intervalo!: ReturnType<typeof setInterval>;

  nombreUsuario = signal<string>('');
  aeropuertos   = AEROPUERTOS;
  fechaMin      = new Date().toISOString().split('T')[0];
  hora          = signal<string>('');

  form = this.fb.group({
    origen:    ['LIM', Validators.required],
    destino:   ['CUZ', Validators.required],
    fecha:     ['',    Validators.required],
    pasajeros: [1,    [Validators.required, Validators.min(1)]]
  });

  ngOnInit(): void {
    const nombre = localStorage.getItem('nombre') ?? 'Viajero';
    this.nombreUsuario.set(nombre);
    this.actualizarHora();
    this.intervalo = setInterval(() => this.actualizarHora(), 60000);
  }

  ngOnDestroy(): void {
    clearInterval(this.intervalo);
  }

  private actualizarHora(): void {
    const ahora = new Date();
    this.hora.set(ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }));
  }

  intercambiar(): void {
    const { origen, destino } = this.form.value;
    this.form.patchValue({ origen: destino ?? '', destino: origen ?? '' });
  }

  incrementar(): void { this.form.patchValue({ pasajeros: (this.form.value.pasajeros ?? 1) + 1 }); }
  decrementar(): void {
    const v = this.form.value.pasajeros ?? 1;
    if (v > 1) this.form.patchValue({ pasajeros: v - 1 });
  }

  buscar(): void {
    if (this.form.valid) {
      const { origen, destino, fecha, pasajeros } = this.form.value;
      this.router.navigate(['/resultados'], {
        queryParams: { origen, destino, fecha, pasajeros }
      });
    }
  }

  irRuta(origen: string, destino: string): void {
    const pasajeros = this.form.value.pasajeros ?? 1;
    this.router.navigate(['/resultados'], {
      queryParams: { origen, destino, fecha: DEMO_FECHA, pasajeros }
    });
  }

  salir(): void {
    this.auth.cerrarSesion();
  }
}
