import { Component, inject, signal, computed, ViewChild, ElementRef, HostListener } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AeropuertoService } from '../../core/services/aeropuerto.service';
import { CalendarioComponent } from '../../shared/components/calendario/calendario.component';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';

const DEMO_FECHA = '2026-06-20';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [ReactiveFormsModule, NavbarComponent, FooterComponent, CalendarioComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  private fb        = inject(FormBuilder);
  private router    = inject(Router);
  aeropuertoService = inject(AeropuertoService);

  @ViewChild('inpO') private inpO!: ElementRef<HTMLInputElement>;
  @ViewChild('inpD') private inpD!: ElementRef<HTMLInputElement>;

  fechaMin  = new Date().toISOString().split('T')[0];
  tripType  = signal<'ida' | 'idavuelta'>('idavuelta');
  filtroO   = signal('');
  filtroD   = signal('');
  showDropO  = signal(false);
  showDropD  = signal(false);
  mismoCodigo = signal(false);
  showCal   = signal(false);

  // Posición calculada del input (position: fixed en vez de absolute), para
  // que el dropdown de sugerencias nunca quede atrapado por un ancestro con
  // overflow/scroll propio — flota siempre sobre el viewport, sin afectar
  // la altura de ningún contenedor padre.
  dropPosO = signal({ top: 0, left: 0, width: 0 });
  dropPosD = signal({ top: 0, left: 0, width: 0 });

  private calcularPosicion(input: HTMLInputElement): { top: number; left: number; width: number } {
    const r = input.getBoundingClientRect();
    return { top: r.bottom + 4, left: r.left, width: r.width };
  }

  // Mantiene el dropdown "fixed" pegado al input si el usuario hace scroll
  // o redimensiona la ventana mientras está abierto.
  @HostListener('window:scroll')
  @HostListener('window:resize')
  reposicionarDrops(): void {
    if (this.showDropO()) this.dropPosO.set(this.calcularPosicion(this.inpO.nativeElement));
    if (this.showDropD()) this.dropPosD.set(this.calcularPosicion(this.inpD.nativeElement));
  }

  private filtrar(q: string) {
    const t    = q.toLowerCase().trim();
    const list = this.aeropuertoService.aeropuertos();
    if (!t) return list;
    return list.filter(a =>
      a.code.toLowerCase().startsWith(t)  ||
      a.ciudad.toLowerCase().includes(t)  ||
      a.nombre.toLowerCase().includes(t)
    );
  }

  filtradosO = computed(() => this.filtrar(this.filtroO()));
  filtradosD = computed(() => this.filtrar(this.filtroD()));

  form = this.fb.group({
    origen:      ['', Validators.required],
    destino:     ['', Validators.required],
    fecha:       ['', Validators.required],
    fechaVuelta: ['', Validators.required],
    pasajeros:   [1, [Validators.required, Validators.min(1), Validators.max(4)]]
  });

  setTripType(t: 'ida' | 'idavuelta'): void {
    this.tripType.set(t);
    const ctrl = this.form.get('fechaVuelta')!;
    if (t === 'idavuelta') {
      ctrl.setValidators(Validators.required);
    } else {
      ctrl.clearValidators();
      ctrl.setValue('');
    }
    ctrl.updateValueAndValidity();
    this.showCal.set(false);
  }

  // ── Aeropuerto autocomplete ────────────────────────────────────
  focusO(): void {
    this.filtroO.set('');
    this.inpO.nativeElement.value = '';
    this.showDropO.set(false);
    this.dropPosO.set(this.calcularPosicion(this.inpO.nativeElement));
  }
  blurO():  void {
    setTimeout(() => {
      this.showDropO.set(false);
      this.filtroO.set('');
      const code = this.form.get('origen')?.value;
      this.inpO.nativeElement.value = code ? this.aeropuertoService.label(code) : '';
    }, 150);
  }
  pickO(a: { code: string }): void {
    this.form.patchValue({ origen: a.code });
    this.inpO.nativeElement.value = this.aeropuertoService.label(a.code);
    this.showDropO.set(false);
    this.filtroO.set('');
    setTimeout(() => this.inpD.nativeElement.focus(), 50);
  }

  focusD(): void {
    this.filtroD.set('');
    this.inpD.nativeElement.value = '';
    this.showDropD.set(false);
    this.dropPosD.set(this.calcularPosicion(this.inpD.nativeElement));
  }
  blurD():  void {
    setTimeout(() => {
      this.showDropD.set(false);
      this.filtroD.set('');
      const code = this.form.get('destino')?.value;
      this.inpD.nativeElement.value = code ? this.aeropuertoService.label(code) : '';
    }, 150);
  }
  pickD(a: { code: string }): void {
    if (a.code === this.form.get('origen')?.value) {
      this.inpD.nativeElement.value = '';
      this.form.patchValue({ destino: '' });
      this.showDropD.set(false);
      this.filtroD.set('');
      this.mismoCodigo.set(true);
      setTimeout(() => this.mismoCodigo.set(false), 2500);
      return;
    }
    this.mismoCodigo.set(false);
    this.form.patchValue({ destino: a.code });
    this.inpD.nativeElement.value = this.aeropuertoService.label(a.code);
    this.showDropD.set(false);
    this.filtroD.set('');
  }

  intercambiar(): void {
    const { origen, destino } = this.form.value;
    this.form.patchValue({ origen: destino ?? '', destino: origen ?? '' });
    this.inpO.nativeElement.value = destino ? this.aeropuertoService.label(destino) : '';
    this.inpD.nativeElement.value = origen  ? this.aeropuertoService.label(origen)  : '';
  }

  // ── Calendario ────────────────────────────────────────────────
  onFechaIda(iso: string): void    { this.form.patchValue({ fecha: iso }); }
  onFechaVuelta(iso: string): void { this.form.patchValue({ fechaVuelta: iso }); }

  fmtFecha(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
  }

  // ── Pasajeros ─────────────────────────────────────────────────
  incrementar(): void {
    const v = this.form.value.pasajeros ?? 1;
    if (v < 4) this.form.patchValue({ pasajeros: v + 1 });
  }
  decrementar(): void {
    const v = this.form.value.pasajeros ?? 1;
    if (v > 1) this.form.patchValue({ pasajeros: v - 1 });
  }

  buscar(): void {
    if (this.form.valid) {
      const { origen, destino, fecha, fechaVuelta, pasajeros } = this.form.value;
      const qp: Record<string, any> = { origen, destino, fecha, pasajeros };
      if (this.tripType() === 'idavuelta' && fechaVuelta) {
        qp['fechaVuelta'] = fechaVuelta;
        qp['tipo'] = 'idavuelta';
      }
      this.router.navigate(['/resultados'], { queryParams: qp });
    }
  }

  irRuta(origen: string, destino: string): void {
    this.router.navigate(['/resultados'], {
      queryParams: { origen, destino, fecha: DEMO_FECHA, pasajeros: this.form.value.pasajeros ?? 1 }
    });
  }
}
