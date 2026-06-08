import { Component, Input, Output, EventEmitter, OnInit, signal, computed } from '@angular/core';

const MESES    = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_SEM = ['Lu','Ma','Mi','Ju','Vi','Sa','Do'];

@Component({
  selector: 'app-calendario',
  standalone: true,
  templateUrl: './calendario.component.html',
  styleUrl: './calendario.component.scss'
})
export class CalendarioComponent implements OnInit {
  @Input() modo: 'simple' | 'rango' = 'simple';
  @Input() fechaIda    = '';
  @Input() fechaVuelta = '';
  @Output() seleccionIda    = new EventEmitter<string>();
  @Output() seleccionVuelta = new EventEmitter<string>();
  @Output() cerrar          = new EventEmitter<void>();

  readonly DIAS  = DIAS_SEM;
  readonly MESES = MESES;

  readonly hoy = (() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  })();

  anio     = signal(this.hoy.getFullYear());
  mes      = signal(this.hoy.getMonth());
  fase     = signal<'ida' | 'vuelta'>('ida');
  hovFecha = signal<Date | null>(null);

  get anio2(): number { return this.mes() === 11 ? this.anio() + 1 : this.anio(); }
  get mes2():  number { return (this.mes() + 1) % 12; }

  diasMes1 = computed(() => this.genDias(this.anio(), this.mes()));
  diasMes2 = computed(() => this.genDias(this.anio2, this.mes2));

  ngOnInit(): void {
    if (this.modo === 'rango' && this.fechaIda && !this.fechaVuelta) {
      this.fase.set('vuelta');
    }
    const d = this.parse(this.fechaIda);
    if (d) { this.anio.set(d.getFullYear()); this.mes.set(d.getMonth()); }
  }

  navPrev(): void {
    if (this.mes() === 0) { this.mes.set(11); this.anio.update(a => a - 1); }
    else { this.mes.update(m => m - 1); }
  }

  navNext(): void {
    if (this.mes() === 11) { this.mes.set(0); this.anio.update(a => a + 1); }
    else { this.mes.update(m => m + 1); }
  }

  click(d: Date): void {
    if (this.pasado(d)) return;
    if (this.modo === 'simple') {
      this.seleccionIda.emit(this.str(d));
      this.cerrar.emit();
      return;
    }
    if (this.fase() === 'ida') {
      this.seleccionIda.emit(this.str(d));
      this.seleccionVuelta.emit('');
      this.fase.set('vuelta');
    } else {
      const ida = this.parse(this.fechaIda);
      if (ida && d < ida) {
        this.seleccionIda.emit(this.str(d));
        this.seleccionVuelta.emit('');
      } else {
        this.seleccionVuelta.emit(this.str(d));
        this.fase.set('ida');
        this.cerrar.emit();
      }
    }
  }

  pasado(d: Date): boolean { return d < this.hoy; }
  esHoy(d: Date): boolean  { return this.eq(d, this.hoy); }
  esIda(d: Date): boolean  { return !!this.fechaIda    && this.eq(d, this.parse(this.fechaIda)); }
  esVuelta(d: Date): boolean {
    return this.modo === 'rango' && !!this.fechaVuelta && this.eq(d, this.parse(this.fechaVuelta));
  }
  esIdaConRango(d: Date): boolean {
    if (!this.esIda(d) || this.modo === 'simple') return false;
    if (this.fechaVuelta) return true;
    const h = this.hovFecha();
    if (!h) return false;
    const ida = this.parse(this.fechaIda)!;
    return h > ida;
  }
  esVueltaConRango(d: Date): boolean {
    return this.esVuelta(d) && !!this.fechaIda;
  }
  enRango(d: Date): boolean {
    if (this.modo === 'simple' || !this.fechaIda) return false;
    const ini = this.parse(this.fechaIda)!;
    const fin = this.fechaVuelta ? this.parse(this.fechaVuelta)! : this.hovFecha();
    if (!fin) return false;
    return d > ini && d < fin;
  }
  enHover(d: Date): boolean {
    if (this.modo === 'simple' || !this.fechaIda || this.fase() !== 'vuelta') return false;
    const h = this.hovFecha();
    if (!h) return false;
    const ini = this.parse(this.fechaIda)!;
    if (h <= ini) return false;
    return d > ini && d <= h;
  }

  labelFase(): string {
    if (this.modo === 'simple') return 'Selecciona la fecha de ida';
    return this.fase() === 'ida' ? 'Selecciona la fecha de ida' : 'Ahora selecciona la fecha de vuelta';
  }

  nombreMes(anio: number, mes: number): string { return `${MESES[mes]} ${anio}`; }

  private eq(a: Date, b: Date | null): boolean {
    return !!b && a.getTime() === b.getTime();
  }
  private parse(s: string): Date | null {
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  private str(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  genDias(anio: number, mes: number): (Date | null)[] {
    const p = new Date(anio, mes, 1);
    const n = new Date(anio, mes + 1, 0).getDate();
    let off = p.getDay() - 1;
    if (off < 0) off = 6;
    const g: (Date | null)[] = Array(off).fill(null);
    for (let i = 1; i <= n; i++) g.push(new Date(anio, mes, i));
    while (g.length % 7) g.push(null);
    return g;
  }
}
