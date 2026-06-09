import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe, Location, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { VueloService } from '../../core/services/vuelo.service';
import { AlertaService } from '../../core/services/alerta.service';
import { AuthService } from '../../core/services/auth.service';
import { VueloDetalle } from '../../core/models/vuelo.model';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';

@Component({
  selector: 'app-detalle',
  standalone: true,
  imports: [ReactiveFormsModule, DecimalPipe, TitleCasePipe, RouterLink, NavbarComponent, FooterComponent],
  templateUrl: './detalle.component.html',
  styleUrl: './detalle.component.scss'
})
export class DetalleComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private fb = inject(FormBuilder);
  private vueloService = inject(VueloService);
  private alertaService = inject(AlertaService);
  auth = inject(AuthService);

  detalle = signal<VueloDetalle | null>(null);
  cargando = signal(true);
  error = signal<string | null>(null);
  mensaje = signal<string | null>(null);

  form = this.fb.group({
    precioObjetivo: [0, [Validators.required, Validators.min(1)]],
    telefono: ['', [Validators.required, Validators.pattern(/^(\+?51)?9[0-9]{8}$/)]]
  });

  chartMeta = computed(() => {
    const d = this.detalle();
    const prices = [
      ...(d?.historico.map(p => p.precio) ?? []),
      d?.precioActual ?? 0,
      ...(d?.prediccion.map(p => p.precioEstimado) ?? [])
    ].filter(v => v > 0);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const pad = Math.max((max - min) * 0.18, 8);
    return { min: min - pad, max: max + pad, width: 680, height: 230 };
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.router.navigate(['/resultados']);
      return;
    }
    this.vueloService.detalle(id).subscribe({
      next: detalle => {
        this.detalle.set(detalle);
        this.form.patchValue({ precioObjetivo: Math.round(detalle.precioActual * 0.9) });
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el detalle del vuelo.');
        this.cargando.set(false);
      }
    });
  }

  crearAlerta(): void {
    const d = this.detalle();
    if (!d || this.form.invalid) return;
    if (!this.auth.estaAutenticado()) {
      this.router.navigate(['/auth']);
      return;
    }
    this.mensaje.set(null);
    this.alertaService.crear({
      tarifaId: d.idTarifa,
      precioObjetivo: Number(this.form.value.precioObjetivo),
      telefono: this.form.value.telefono!
    }).subscribe({
      next: () => this.mensaje.set('Alerta creada. La veras en tu dashboard.'),
      error: err => this.error.set(err.error?.message ?? 'No se pudo crear la alerta.')
    });
  }

  volver(): void {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }
    this.router.navigate(['/resultados']);
  }

  actualPoints(d: VueloDetalle): string {
    return this.points(d.historico.map(p => p.precio), 0, this.totalPoints(d));
  }

  prediccionPoints(d: VueloDetalle): string {
    const values = [d.precioActual, ...d.prediccion.map(p => p.precioEstimado)];
    return this.points(values, Math.max(d.historico.length - 1, 0), this.totalPoints(d));
  }

  private totalPoints(d: VueloDetalle): number {
    return Math.max(d.historico.length + d.prediccion.length, 2);
  }

  private points(values: number[], offset: number, total: number): string {
    const { min, max, width, height } = this.chartMeta();
    const range = max - min || 1;
    return values.map((price, i) => {
      const x = ((offset + i) / Math.max(total - 1, 1)) * width;
      const y = height - ((price - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  airlineLogo(nombre: string): string {
    const n = nombre.toLowerCase();
    if (n.includes('latam')) return 'assets/logos/latam.svg';
    if (n.includes('sky'))   return 'assets/logos/sky.svg';
    if (n.includes('jet'))   return 'assets/logos/jetsmart.svg';
    return '';
  }

  fmtFecha(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-PE', {
      weekday: 'short', day: 'numeric', month: 'short'
    });
  }

  fmtFechaLarga(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-PE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  /** Precio que corresponde a una Y en el SVG (viewBox height=230) */
  priceAtY(y: number): string {
    const { min, max } = this.chartMeta();
    const range = (max - min) || 1;
    const price = min + range * (1 - y / 230);
    return 'S/' + Math.round(price);
  }

  /** Rango de fechas para el eje X del gráfico */
  chartXRange(d: VueloDetalle): { start: string; end: string } {
    const start = d.historico.length > 0 ? this.fmtFecha(d.historico[0].fecha) : '';
    const end   = d.prediccion.length > 0
      ? this.fmtFecha(d.prediccion[d.prediccion.length - 1].fecha)
      : d.historico.length > 0
        ? this.fmtFecha(d.historico[d.historico.length - 1].fecha)
        : '';
    return { start, end };
  }

  recomIcono(rec: string): string {
    if (rec.startsWith('Comprar')) return 'fa-solid fa-circle-check';
    if (rec.startsWith('Esperar')) return 'fa-solid fa-clock';
    return 'fa-solid fa-magnifying-glass-chart';
  }

  recomClase(rec: string): string {
    if (rec.startsWith('Comprar')) return 'rec-verde';
    if (rec.startsWith('Esperar')) return 'rec-azul';
    return 'rec-gris';
  }
}
