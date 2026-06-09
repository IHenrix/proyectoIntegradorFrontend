import { Component, inject, OnInit, ViewChild, ElementRef, signal, computed, effect } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Location, DecimalPipe, TitleCasePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { VueloService } from '../../core/services/vuelo.service';
import { AeropuertoService, Aeropuerto } from '../../core/services/aeropuerto.service';
import { AuthService } from '../../core/services/auth.service';
import { UpgradeModalService } from '../../core/services/upgrade-modal.service';
import { LoginModalService } from '../../core/services/login-modal.service';
import { BusquedaParams } from '../../core/models/vuelo.model';
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

  esPremium = computed(() => {
    const r = this.auth.rol();
    return r === 'usuario_premium' || r === 'admin';
  });

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
  tripType    = signal<'ida' | 'idavuelta'>('idavuelta');
  showCal     = signal(false);
  filtroO     = signal('');
  filtroD     = signal('');
  showDropO   = signal(false);
  showDropD   = signal(false);

  form = this.fb.group({
    origen:      ['', Validators.required],
    destino:     ['', Validators.required],
    fecha:       ['', Validators.required],
    fechaVuelta: [''],
    pasajeros:   [1, [Validators.required, Validators.min(1)]],
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
    this.showCal.set(false);
  }

  blurO(): void {
    setTimeout(() => {
      this.showDropO.set(false);
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
    this.showCal.set(false);
  }

  blurD(): void {
    setTimeout(() => {
      this.showDropD.set(false);
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
  }

  pickD(a: Aeropuerto): void {
    this.form.patchValue({ destino: a.code });
    this.inpD.nativeElement.value = `${a.ciudad} (${a.code})`;
    this.filtroD.set('');
    this.showDropD.set(false);
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
    if (v < 9) this.form.patchValue({ pasajeros: v + 1 });
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
