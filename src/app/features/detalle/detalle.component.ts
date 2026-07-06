import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe, Location, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { VueloService } from '../../core/services/vuelo.service';
import { AlertaService } from '../../core/services/alerta.service';
import { AuthService } from '../../core/services/auth.service';
import { UpgradeModalService } from '../../core/services/upgrade-modal.service';
import { ConfirmModalService } from '../../core/services/confirm-modal.service';
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
  auth    = inject(AuthService);
  upgrade = inject(UpgradeModalService);
  confirm = inject(ConfirmModalService);

  // El admin ve el detalle como si fuera premium (historial extendido, sin banners
  // de upgrade) para poder revisar cómo luce esa experiencia, pero no gestiona
  // alertas propias: esAdmin() oculta el panel de "crear alerta" por completo.
  esAdmin   = computed(() => this.auth.rol() === 'admin');
  esPremium = computed(() => this.auth.rol() === 'usuario_premium' || this.esAdmin());

  tryRango(dias: 7 | 15 | 30 | 60 | 90): void {
    if (dias === 7 || this.esPremium()) {
      this.rango.set(dias);
    } else {
      this.upgrade.abrir('historial_30d');
    }
  }

  detalle  = signal<VueloDetalle | null>(null);
  cargando = signal(true);
  error             = signal<string | null>(null);
  mensaje           = signal<string | null>(null);
  celebracion       = signal(false);

  rango = signal<7 | 15 | 30 | 60 | 90>(7);

  telefonoGuardado = signal<string | null>(localStorage.getItem('telefono'));

  telefonoObfuscado = computed(() => {
    const t = this.telefonoGuardado();
    if (!t || t.length < 6) return null;
    // Separar prefijo internacional del número local
    const match = t.match(/^(\+\d{1,3})\s*(.+)$/);
    if (match) {
      const prefix = match[1];
      const local  = match[2].replace(/\D/g, '');
      return `${prefix} ${local.slice(0, 3)} *** ${local.slice(-3)}`;
    }
    const digits = t.replace(/\D/g, '');
    return digits.slice(0, 3) + ' *** ' + digits.slice(-3);
  });

  alertaExistente = computed(() => {
    const d = this.detalle();
    if (!d) return null;
    return this.alertaService.alertas().find(
      a => a.idVuelo === d.idVuelo && a.tipoTarifa === d.tipoTarifa
    ) ?? null;
  });

  limiteSuperado = computed(() =>
    !this.esPremium() &&
    this.auth.estaAutenticado() &&
    this.alertaService.alertas().length >= 3
  );

  form = this.fb.group({
    precioObjetivo: [0, [Validators.required, Validators.min(1)]],
    telefono: ['', [Validators.required, Validators.pattern(/^\d{9}$/)]],
  });

  historicoFiltrado = computed(() => {
    const d = this.detalle();
    if (!d) return [];
    return d.historico.slice(-this.rango());
  });

  chartMeta = computed(() => {
    const d = this.detalle();
    const hist = this.historicoFiltrado();
    const prices = [
      ...hist.map(p => p.precio),
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
    if (this.auth.estaAutenticado() && !this.esAdmin()) {
      this.alertaService.listar().subscribe();
    }
    this.vueloService.detalle(id).subscribe({
      next: detalle => {
        this.detalle.set(detalle);
        const tel = this.telefonoGuardado();
        const telSinPrefijo = tel
          ? tel.replace(/^\+?51/, '').trim()
          : '';
        this.form.patchValue({
          precioObjetivo: Math.round(detalle.precioActual * 0.9),
          ...(telSinPrefijo ? { telefono: telSinPrefijo } : {})
        });
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el detalle del vuelo.');
        this.cargando.set(false);
      }
    });
  }

  async crearAlerta(): Promise<void> {
    const d = this.detalle();
    if (!d || this.form.invalid) return;
    if (!this.auth.estaAutenticado()) {
      this.router.navigate(['/auth']);
      return;
    }
    if (!this.esPremium()) {
      const total = this.alertaService.alertas().length;
      if (total >= 3) {
        this.upgrade.abrir('pausar');
        return;
      }
    }

    const restante = this.esPremium()
      ? ''
      : `\nTe quedan ${3 - this.alertaService.alertas().length} de 3 alertas disponibles en tu plan Básico.`;

    const ok = await this.confirm.abrir({
      tipo:        'info',
      titulo:      '¿Crear alerta de precio?',
      mensaje:     `Te avisaremos por WhatsApp cuando el precio baje de S/ ${this.form.value.precioObjetivo} para este vuelo.${restante}`,
      labelOk:     'Sí, crear alerta',
      labelCancel: 'Cancelar',
    });
    if (!ok) return;

    this.mensaje.set(null);
    const telRaw = this.form.value.telefono ?? '';
    const telefono = telRaw.startsWith('+') ? telRaw : `+51${telRaw}`;
    this.alertaService.crear({
      tarifaId: d.idTarifa,
      precioObjetivo: Number(this.form.value.precioObjetivo),
      telefono,
    }).subscribe({
      next: () => {
        this.celebracion.set(true);
        setTimeout(() => this.celebracion.set(false), 4000);
      },
      error: err => {
        const msg = err.error?.message ?? '';
        if (msg === 'LIMITE_ALERTAS') {
          this.upgrade.abrir('pausar');
        } else if (msg === 'ALERTA_DUPLICADA') {
          this.error.set('Ya tienes una alerta activa para este vuelo y tarifa.');
        } else {
          this.error.set(msg || 'No se pudo crear la alerta.');
        }
      }
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
    const hist = this.historicoFiltrado();
    return this.points(hist.map(p => p.precio), 0, this.totalPoints());
  }

  prediccionPoints(d: VueloDetalle): string {
    const hist = this.historicoFiltrado();
    const values = [d.precioActual, ...d.prediccion.map(p => p.precioEstimado)];
    return this.points(values, Math.max(hist.length - 1, 0), this.totalPoints());
  }

  private totalPoints(): number {
    const d = this.detalle();
    const hist = this.historicoFiltrado();
    return Math.max(hist.length + (d?.prediccion.length ?? 0), 2);
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

  airlineCls(nombre: string): string {
    const n = nombre.toLowerCase();
    if (n.includes('latam')) return 'al-latam';
    if (n.includes('sky'))   return 'al-sky';
    if (n.includes('jet'))   return 'al-jet';
    return '';
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
    const hist  = this.historicoFiltrado();
    const start = hist.length > 0 ? this.fmtFecha(hist[0].fecha) : '';
    const end   = d.prediccion.length > 0
      ? this.fmtFecha(d.prediccion[d.prediccion.length - 1].fecha)
      : hist.length > 0
        ? this.fmtFecha(hist[hist.length - 1].fecha)
        : '';
    return { start, end };
  }

  /** Posiciones X (0-680) donde dibujar líneas verticales de grilla + su etiqueta de fecha */
  xGridLines(d: VueloDetalle): { x: number; label: string }[] {
    const hist  = this.historicoFiltrado();
    const total = this.totalPoints();
    if (total < 2) return [];

    // Elige ~4 divisiones internas (no los extremos)
    const steps = 4;
    const result: { x: number; label: string }[] = [];
    for (let s = 1; s < steps; s++) {
      const idx = Math.round((s / steps) * (hist.length - 1));
      const x   = (idx / Math.max(total - 1, 1)) * 680;
      const label = hist[idx] ? this.fmtFechaCorta(hist[idx].fecha) : '';
      result.push({ x: +x.toFixed(1), label });
    }
    return result;
  }

  private fmtFechaCorta(iso: string): string {
    if (!iso) return '';
    const [y, m, day] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, day);
    return dt.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
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
