import { Component, inject, OnInit, ViewChild, ElementRef, signal, computed, effect, HostListener } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Location, DecimalPipe, TitleCasePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { VueloService } from '../../core/services/vuelo.service';
import { AeropuertoService, Aeropuerto } from '../../core/services/aeropuerto.service';
import { AuthService } from '../../core/services/auth.service';
import { UpgradeModalService } from '../../core/services/upgrade-modal.service';
import { LoginModalService } from '../../core/services/login-modal.service';
import { BusquedaParams, PrecioPunto } from '../../core/models/vuelo.model';
import { CalendarioComponent } from '../../shared/components/calendario/calendario.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';

@Component({
  selector: 'app-resultados',
  standalone: true,
  imports: [DecimalPipe, TitleCasePipe, ReactiveFormsModule, CalendarioComponent, RouterLink, FooterComponent],
  templateUrl: './resultados.component.html',
  styleUrl: './resultados.component.scss'
})
export class ResultadosComponent implements OnInit {
  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  private location  = inject(Location);
  private fb        = inject(FormBuilder);
  vueloService      = inject(VueloService);
  aeropuertoService = inject(AeropuertoService);
  auth              = inject(AuthService);
  upgrade           = inject(UpgradeModalService);
  loginModal        = inject(LoginModalService);

  // El admin ve el semáforo de precios desbloqueado, igual que un premium,
  // para poder revisar cómo luce esa vista (no gestiona alertas, pero sí
  // navega resultados como cualquier visitante).
  esAdmin   = computed(() => this.auth.rol() === 'admin');
  esPremium = computed(() => this.auth.rol() === 'usuario_premium' || this.esAdmin());

  readonly inicial  = computed(() => (this.auth.nombre() ?? 'U').trim().charAt(0).toUpperCase());
  readonly rolInfo  = computed(() => {
    const r = this.auth.rol();
    if (r === 'admin')           return { label: 'ADMIN',   css: 'badge-admin',   avatar: 'avatar-admin' };
    if (r === 'usuario_premium') return { label: '★ PRO',   css: 'badge-premium', avatar: 'avatar-premium' };
    return                              { label: 'BÁSICO',  css: 'badge-free',    avatar: 'avatar-free' };
  });

  readonly LIMITE_GUEST = 3;

  vuelosVisibles = computed(() => {
    const vs = this.vueloService.vuelos();
    return this.auth.estaAutenticado() ? vs : vs.slice(0, this.LIMITE_GUEST);
  });

  hayMasOcultos = computed(() =>
    !this.auth.estaAutenticado() && this.vueloService.vuelos().length > this.LIMITE_GUEST
  );

  paquetesVisibles = computed(() => {
    const ps = this.paquetes();
    return this.auth.estaAutenticado() ? ps : ps.slice(0, this.LIMITE_GUEST);
  });

  hayMasPaquetesOcultos = computed(() =>
    !this.auth.estaAutenticado() && this.paquetes().length > this.LIMITE_GUEST
  );

  totalOcultos = computed(() => {
    if (this.auth.estaAutenticado()) return 0;
    const soloIda = this.vueloService.vuelos().length - this.LIMITE_GUEST;
    const paq     = this.paquetes().length - this.LIMITE_GUEST;
    return Math.max(soloIda, paq, 0);
  });

  @ViewChild('inpO') inpO!: ElementRef<HTMLInputElement>;
  @ViewChild('inpD') inpD!: ElementRef<HTMLInputElement>;

  params!: BusquedaParams;
  private prevOrigenCode  = '';
  private prevDestinoCode = '';

  showModal   = signal(false);
  cardAbierto = signal<number | null>(null);
  semaforoPreview = signal<number | null>(null);
  // El popover usa position:fixed + coordenadas calculadas (mismo patrón que
  // los dropdowns de origen/destino) porque .card tiene overflow:hidden y
  // recortaría un popover position:absolute anclado dentro de ella.
  semaforoPreviewPos = signal({ top: 0, left: 0 });
  // Cache simple por tarifaId: evita repetir la llamada si el usuario cierra
  // y vuelve a abrir el popover de la misma card.
  private sparklineCache = new Map<number, PrecioPunto[]>();
  semaforoSparkline = signal<PrecioPunto[] | null>(null);
  semaforoSparklineCargando = signal(false);
  tripType    = signal<'ida' | 'idavuelta'>('idavuelta');
  showCal     = signal(false);
  filtroO     = signal('');
  filtroD     = signal('');
  showDropO   = signal(false);
  showDropD   = signal(false);

  // .modal-top tiene overflow-y:auto + max-height:100vh (para poder hacer
  // scroll dentro del modal en pantallas chicas). Si .ac-drop fuera
  // position:absolute, el navegador lo contaría como contenido del modal
  // y generaría un scroll interno feo apenas la lista de sugerencias
  // creciera. Con position:fixed + coordenadas calculadas en JS (mismo
  // patrón que home.component.ts y que app-calendario), el dropdown flota
  // fuera de ese contenedor con scroll, sin afectar su altura medida.
  dropPosO   = signal({ top: 0, left: 0, width: 0 });
  dropPosD   = signal({ top: 0, left: 0, width: 0 });
  dropListoO = signal(false);
  dropListoD = signal(false);

  private calcularPosicionDrop(input: HTMLInputElement): { top: number; left: number; width: number } {
    const r = input.getBoundingClientRect();
    return { top: r.bottom + 6, left: r.left, width: Math.max(r.width, 280) };
  }

  // .modal-top puede tener su propio scroll interno en pantallas chicas
  // (max-height:100vh + overflow-y:auto) — si el usuario hace scroll ahí
  // o redimensiona la ventana con el dropdown abierto, hay que recalcular.
  @HostListener('window:scroll')
  @HostListener('window:resize')
  reposicionarDrops(): void {
    if (this.showDropO()) this.dropPosO.set(this.calcularPosicionDrop(this.inpO.nativeElement));
    if (this.showDropD()) this.dropPosD.set(this.calcularPosicionDrop(this.inpD.nativeElement));
    if (this.semaforoPreview() !== null) this.semaforoPreview.set(null);
  }

  form = this.fb.group({
    origen:      ['', Validators.required],
    destino:     ['', Validators.required],
    fecha:       ['', Validators.required],
    fechaVuelta: [''],
    pasajeros:   [1, [Validators.required, Validators.min(1), Validators.max(4)]],
  });

  filtradosO = computed(() => {
    const q = this.filtroO().toLowerCase().trim();
    if (!q) return [];
    return this.aeropuertoService.aeropuertos().filter(a =>
      a.ciudad.toLowerCase().includes(q) ||
      a.code.toLowerCase().includes(q) ||
      a.nombre.toLowerCase().includes(q)
    );
  });

  filtradosD = computed(() => {
    const q = this.filtroD().toLowerCase().trim();
    if (!q) return [];
    return this.aeropuertoService.aeropuertos().filter(a =>
      a.ciudad.toLowerCase().includes(q) ||
      a.code.toLowerCase().includes(q) ||
      a.nombre.toLowerCase().includes(q)
    );
  });

  paquetes = computed(() => {
    const vs = this.vueloService.vuelos();
    const vv = this.vueloService.vuelosVuelta();
    const len = Math.min(vs.length, vv.length);
    return Array.from({ length: len }, (_, i) => ({ ida: vs[i], vuelta: vv[i] }));
  });

  constructor() {
    effect(() => {
      const apts = this.aeropuertoService.aeropuertos();
      if (!apts.length || !this.params) return;
      const o = apts.find(a => a.code === this.params.origen);
      const d = apts.find(a => a.code === this.params.destino);
      if (this.inpO?.nativeElement && o) this.inpO.nativeElement.value = `${o.ciudad} (${o.code})`;
      if (this.inpD?.nativeElement && d) this.inpD.nativeElement.value = `${d.ciudad} (${d.code})`;
    });
  }

  ngOnInit(): void {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const q = this.route.snapshot.queryParams;
    this.params = {
      origen:      q['origen']      ?? 'LIM',
      destino:     q['destino']     ?? 'CUZ',
      fecha:       q['fecha']       ?? '',
      pasajeros:   +q['pasajeros']  || 1,
      fechaVuelta: q['fechaVuelta'] ?? undefined,
      tipo:        q['tipo']        ?? 'ida',
    };
    this.vueloService.buscar(this.params);
    if (this.params.tipo === 'idavuelta' && this.params.fechaVuelta) {
      this.vueloService.buscarVuelta(this.params);
    }
  }

  // ── Modal ────────────────────────────────────────────────────────

  abrirModal(): void {
    this.tripType.set(this.params.tipo === 'idavuelta' ? 'idavuelta' : 'ida');
    this.form.patchValue({
      origen:      this.params.origen,
      destino:     this.params.destino,
      fecha:       this.params.fecha,
      fechaVuelta: this.params.fechaVuelta ?? '',
      pasajeros:   this.params.pasajeros,
    });
    this.showModal.set(true);
    // Después del render, pone los labels en los inputs
    setTimeout(() => {
      const apts = this.aeropuertoService.aeropuertos();
      const o = apts.find(a => a.code === this.params.origen);
      const d = apts.find(a => a.code === this.params.destino);
      if (this.inpO?.nativeElement)
        this.inpO.nativeElement.value = o ? `${o.ciudad} (${o.code})` : this.params.origen;
      if (this.inpD?.nativeElement)
        this.inpD.nativeElement.value = d ? `${d.ciudad} (${d.code})` : this.params.destino;
    });
  }

  cerrarModal(): void {
    this.showModal.set(false);
    this.showDropO.set(false);
    this.showDropD.set(false);
    this.showCal.set(false);
    this.filtroO.set('');
    this.filtroD.set('');
  }

  // ── Autocomplete ─────────────────────────────────────────────────

  focusO(): void {
    this.prevOrigenCode = this.form.value.origen ?? '';
    this.form.patchValue({ origen: '' });
    this.inpO.nativeElement.select();
    this.showDropD.set(false);
    this.dropListoD.set(false);
    this.showCal.set(false);
  }

  onInputO(valor: string): void {
    this.filtroO.set(valor);
    const abrir = valor.length > 0;
    this.showDropO.set(abrir);
    if (abrir) {
      this.dropPosO.set(this.calcularPosicionDrop(this.inpO.nativeElement));
      this.dropListoO.set(true);
    }
  }

  blurO(): void {
    setTimeout(() => {
      this.showDropO.set(false);
      this.dropListoO.set(false);
      this.filtroO.set('');
      if (!this.form.value.origen && this.prevOrigenCode) {
        this.form.patchValue({ origen: this.prevOrigenCode });
        const a = this.aeropuertoService.aeropuertos().find(x => x.code === this.prevOrigenCode);
        if (this.inpO?.nativeElement)
          this.inpO.nativeElement.value = a ? `${a.ciudad} (${a.code})` : this.prevOrigenCode;
      }
    }, 150);
  }

  focusD(): void {
    this.prevDestinoCode = this.form.value.destino ?? '';
    this.form.patchValue({ destino: '' });
    this.inpD.nativeElement.select();
    this.showDropO.set(false);
    this.dropListoO.set(false);
    this.showCal.set(false);
  }

  onInputD(valor: string): void {
    this.filtroD.set(valor);
    const abrir = valor.length > 0;
    this.showDropD.set(abrir);
    if (abrir) {
      this.dropPosD.set(this.calcularPosicionDrop(this.inpD.nativeElement));
      this.dropListoD.set(true);
    }
  }

  blurD(): void {
    setTimeout(() => {
      this.showDropD.set(false);
      this.dropListoD.set(false);
      this.filtroD.set('');
      if (!this.form.value.destino && this.prevDestinoCode) {
        this.form.patchValue({ destino: this.prevDestinoCode });
        const a = this.aeropuertoService.aeropuertos().find(x => x.code === this.prevDestinoCode);
        if (this.inpD?.nativeElement)
          this.inpD.nativeElement.value = a ? `${a.ciudad} (${a.code})` : this.prevDestinoCode;
      }
    }, 150);
  }

  pickO(a: Aeropuerto): void {
    this.form.patchValue({ origen: a.code });
    this.inpO.nativeElement.value = `${a.ciudad} (${a.code})`;
    this.filtroO.set('');
    this.showDropO.set(false);
    this.dropListoO.set(false);
  }

  pickD(a: Aeropuerto): void {
    this.form.patchValue({ destino: a.code });
    this.inpD.nativeElement.value = `${a.ciudad} (${a.code})`;
    this.filtroD.set('');
    this.showDropD.set(false);
    this.dropListoD.set(false);
  }

  intercambiar(): void {
    const o = this.form.value.origen ?? '';
    const d = this.form.value.destino ?? '';
    this.form.patchValue({ origen: d, destino: o });
    const txtO = this.inpO.nativeElement.value;
    const txtD = this.inpD.nativeElement.value;
    this.inpO.nativeElement.value = txtD;
    this.inpD.nativeElement.value = txtO;
  }

  setTripType(t: 'ida' | 'idavuelta'): void {
    this.tripType.set(t);
    this.showCal.set(false);
    if (t === 'ida') this.form.patchValue({ fechaVuelta: '' });
  }

  onFechaIda(iso: string):    void { this.form.patchValue({ fecha: iso }); }
  onFechaVuelta(iso: string): void { this.form.patchValue({ fechaVuelta: iso }); }

  incrementar(): void {
    const v = this.form.value.pasajeros ?? 1;
    if (v < 4) this.form.patchValue({ pasajeros: v + 1 });
  }

  decrementar(): void {
    const v = this.form.value.pasajeros ?? 1;
    if (v > 1) this.form.patchValue({ pasajeros: v - 1 });
  }

  buscarNuevo(): void {
    if (this.form.invalid) return;
    const v = this.form.value;
    const newParams: BusquedaParams = {
      origen:      v.origen!,
      destino:     v.destino!,
      fecha:       v.fecha!,
      pasajeros:   v.pasajeros!,
      fechaVuelta: this.tripType() === 'idavuelta' && v.fechaVuelta ? v.fechaVuelta : undefined,
      tipo:        this.tripType(),
    };
    this.router.navigate([], {
      queryParams: {
        origen:    newParams.origen,
        destino:   newParams.destino,
        fecha:     newParams.fecha,
        pasajeros: newParams.pasajeros,
        ...(newParams.fechaVuelta ? { fechaVuelta: newParams.fechaVuelta } : {}),
        tipo:      newParams.tipo,
      },
      replaceUrl: true,
    });
    this.params = newParams;
    this.cardAbierto.set(null);
    window.scrollTo({ top: 0, behavior: 'instant' });
    this.cerrarModal();
    this.vueloService.buscar(newParams);
    if (newParams.tipo === 'idavuelta' && newParams.fechaVuelta) {
      this.vueloService.buscarVuelta(newParams);
    }
  }

  toggleCard(id: number): void {
    const opening = this.cardAbierto() !== id;
    this.cardAbierto.set(opening ? id : null);
    if (opening) {
      setTimeout(() => {
        const el = document.querySelector(`[data-card-id="${id}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  }

  verDetalle(id: number, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/detalle', id]);
  }

  toggleSemaforoPreview(id: number, event: Event): void {
    event.stopPropagation();
    if (this.semaforoPreview() === id) {
      this.semaforoPreview.set(null);
      return;
    }
    const strip = (event.currentTarget as HTMLElement);
    const r = strip.getBoundingClientRect();
    this.semaforoPreviewPos.set({ top: r.bottom + 6, left: r.left });
    this.semaforoPreview.set(id);

    const cacheado = this.sparklineCache.get(id);
    if (cacheado) {
      this.semaforoSparkline.set(cacheado);
      return;
    }
    this.semaforoSparkline.set(null);
    this.semaforoSparklineCargando.set(true);
    this.vueloService.detalle(id).subscribe({
      next: detalle => {
        const puntos = detalle.historico.slice(-10);
        this.sparklineCache.set(id, puntos);
        if (this.semaforoPreview() === id) {
          this.semaforoSparkline.set(puntos);
          this.semaforoSparklineCargando.set(false);
        }
      },
      error: () => {
        if (this.semaforoPreview() === id) this.semaforoSparklineCargando.set(false);
      }
    });
  }

  @HostListener('document:click', ['$event'])
  cerrarSemaforoPreview(event: MouseEvent): void {
    if (this.semaforoPreview() === null) return;
    const target = event.target as HTMLElement;
    if (target.closest('.sema-strip-wrap')) return;
    this.semaforoPreview.set(null);
  }

  /** Puntos "x,y" para el <polyline> del sparkline (viewBox 220x60). */
  sparklinePoints(): string {
    const datos = this.semaforoSparkline();
    if (!datos || datos.length < 2) return '';
    const precios = datos.map(p => p.precio);
    const min = Math.min(...precios);
    const max = Math.max(...precios);
    const rango = (max - min) || 1;
    const w = 220, h = 60, pad = 6;
    return datos.map((p, i) => {
      const x = (i / (datos.length - 1)) * w;
      const y = (h - pad) - ((p.precio - min) / rango) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  sparklineTendencia(): 'sube' | 'baja' | 'estable' {
    const datos = this.semaforoSparkline();
    if (!datos || datos.length < 2) return 'estable';
    const primero = datos[0].precio;
    const ultimo = datos[datos.length - 1].precio;
    const cambio = (ultimo - primero) / primero;
    if (cambio > 0.03) return 'sube';
    if (cambio < -0.03) return 'baja';
    return 'estable';
  }

  verPlanesPro(): void {
    this.semaforoPreview.set(null);
    this.upgrade.abrir('semaforo');
  }

  airlineCls(nombre: string): string {
    const n = nombre.toLowerCase();
    if (n.includes('latam')) return 'al-latam';
    if (n.includes('sky'))   return 'al-sky';
    if (n.includes('jet'))   return 'al-jet';
    return 'al-other';
  }

  airlineInitials(nombre: string): string {
    const n = nombre.toLowerCase();
    if (n.includes('latam')) return 'LA';
    if (n.includes('sky'))   return 'SK';
    if (n.includes('jet'))   return 'JS';
    return nombre.slice(0, 2).toUpperCase();
  }

  airlineLogo(nombre: string): string {
    const n = nombre.toLowerCase();
    if (n.includes('latam')) return 'assets/logos/latam.svg';
    if (n.includes('sky'))   return 'assets/logos/sky.svg';
    if (n.includes('jet'))   return 'assets/logos/jetsmart.svg';
    return '';
  }

  aptLabel(code: string): string {
    const a = this.aeropuertoService.aeropuertos().find(x => x.code === code);
    return a ? `${a.ciudad} · ${a.nombre} (${code})` : code;
  }

  volver(): void { this.location.back(); }

  ciudadDe(code: string): string { return this.aeropuertoService.ciudad(code); }

  fmtFecha(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d)
      .toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  fmtFechaCorta(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return `${dt.toLocaleDateString('es-PE', { weekday: 'short' })} ${d}/${m}`;
  }

  exportar(): void { this.vueloService.exportarExcel(this.params); }
}
