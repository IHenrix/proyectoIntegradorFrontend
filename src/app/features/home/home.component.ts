import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AEROPUERTOS } from '../../core/models/vuelo.model';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [ReactiveFormsModule, NavbarComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  private fb     = inject(FormBuilder);
  private router = inject(Router);

  aeropuertos = AEROPUERTOS;
  fechaMin    = new Date().toISOString().split('T')[0];

  form = this.fb.group({
    origen:    ['LIM', Validators.required],
    destino:   ['CUZ', Validators.required],
    fecha:     ['', Validators.required],
    pasajeros: [1, [Validators.required, Validators.min(1)]]
  });

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
}
