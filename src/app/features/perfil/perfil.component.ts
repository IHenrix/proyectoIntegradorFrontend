import { Component, inject, OnInit, signal, computed, HostListener } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { PerfilService, PerfilData, SuscripcionData } from '../../core/services/perfil.service';
import { AuthService } from '../../core/services/auth.service';

export interface Pais {
  code: string;
  name: string;
  dial: string;
  flag: string;
}

const PAISES: Pais[] = [
  { code: 'pe', name: 'Perú',           dial: '+51',  flag: 'pe' },
  { code: 'co', name: 'Colombia',       dial: '+57',  flag: 'co' },
  { code: 'cl', name: 'Chile',          dial: '+56',  flag: 'cl' },
  { code: 'ar', name: 'Argentina',      dial: '+54',  flag: 'ar' },
  { code: 'mx', name: 'México',         dial: '+52',  flag: 'mx' },
  { code: 'ec', name: 'Ecuador',        dial: '+593', flag: 'ec' },
  { code: 'bo', name: 'Bolivia',        dial: '+591', flag: 'bo' },
  { code: 've', name: 'Venezuela',      dial: '+58',  flag: 've' },
  { code: 'py', name: 'Paraguay',       dial: '+595', flag: 'py' },
  { code: 'uy', name: 'Uruguay',        dial: '+598', flag: 'uy' },
  { code: 'br', name: 'Brasil',         dial: '+55',  flag: 'br' },
  { code: 'us', name: 'Estados Unidos', dial: '+1',   flag: 'us' },
  { code: 'es', name: 'España',         dial: '+34',  flag: 'es' },
];

export interface Suscripcion {
  refNum:        string;
  plan:          'mensual' | 'anual';
  monto:         number;
  inicio:        string;
  fin:           string;
  estado:        'activa' | 'cancelada';
  titular:       string;
  ultimosCuatro: string;
  metodo:        string;
}

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, NgTemplateOutlet, NavbarComponent, FooterComponent],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.scss'
})
export class PerfilComponent implements OnInit {
  private fb            = inject(FormBuilder);
  private perfilService = inject(PerfilService);
  private auth          = inject(AuthService);
  private router        = inject(Router);
  private route         = inject(ActivatedRoute);

  perfil    = signal<PerfilData | null>(null);
  cargando  = signal(true);
  guardando = signal(false);
  mensaje   = signal<string | null>(null);
  error     = signal<string | null>(null);

  // ── Tabs ─────────────────────────────────────────────────────
  tabActivo = signal<'info' | 'pagos'>('info');

  // ── Historial de suscripciones ───────────────────────────────
  historialSubs = signal<SuscripcionData[]>([]);

  // ── Pago simulado ────────────────────────────────────────────
  planPago       = signal<'mensual' | 'anual'>('mensual');
  metodoPago     = signal<'culqi' | 'yape' | 'plin'>('culqi');
  stepPago       = signal<'form' | 'procesando' | 'exito'>('form');
  suscripcion    = signal<Suscripcion | null>(null);
  errorPago      = signal<string | null>(null);
  mostrarCvv     = signal(false);
  cardDisplayNum = signal('');
  qrAnimado      = signal(false);   // pulso en el QR al "confirmar"

  cardBrand = computed<'visa' | 'mastercard' | 'amex' | null>(() => {
    const n = this.cardDisplayNum().replace(/\s/g, '');
    if (/^4/.test(n)) return 'visa';
    if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return 'mastercard';
    if (/^3[47]/.test(n)) return 'amex';
    return null;
  });

  montoActual = computed(() => this.planPago() === 'anual' ? 120 : 19);

  pagoForm = this.fb.group({
    titular:  ['', [Validators.required, Validators.minLength(3)]],
    numero:   ['', [Validators.required]],
    expira:   ['', [Validators.required, Validators.pattern(/^\d{2}\/\d{2}$/)]],
    cvv:      ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]],
    email:    ['', [Validators.required, Validators.email]],
  });

  // ── Selector de país ──────────────────────────────────────────
  mostrarPaises    = signal(false);
  filtroPaises     = signal('');
  paisSeleccionado = signal<Pais>(PAISES[0]);

  paisesFiltrados = computed(() => {
    const q = this.filtroPaises().toLowerCase().trim();
    if (!q) return PAISES;
    return PAISES.filter(p =>
      p.name.toLowerCase().includes(q) || p.dial.includes(q)
    );
  });

  private skipNextClose = false;

  @HostListener('document:click')
  cerrarPaises(): void {
    if (this.skipNextClose) { this.skipNextClose = false; return; }
    this.mostrarPaises.set(false);
    this.filtroPaises.set('');
  }

  togglePaises(): void {
    this.skipNextClose = true;
    this.mostrarPaises.update(v => !v);
  }

  seleccionarPais(p: Pais): void {
    this.paisSeleccionado.set(p);
    this.mostrarPaises.set(false);
    this.filtroPaises.set('');
  }

  // ── Formulario ────────────────────────────────────────────────
  readonly TIPOS_DOC = [
    { codigo: 'DNI', nombre: 'DNI',       longitud: 8  },
    { codigo: 'CE',  nombre: 'Carnet de extranjería', longitud: 12 },
    { codigo: 'PAS', nombre: 'Pasaporte', longitud: null },
  ];

  form = this.fb.group({
    nombre:          ['', [Validators.required, Validators.minLength(2)]],
    apellidoPaterno: ['', [Validators.required, Validators.minLength(2)]],
    apellidoMaterno: [''],
    genero:          [''],
    telefono:        [''],
    fechaNacimiento: [''],
    tipoDocumento:   [''],
    nroDocumento:    [''],
  });

  ngOnInit(): void {
    if (!this.auth.estaAutenticado()) {
      this.router.navigate(['/auth']);
      return;
    }

    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'pagos') this.tabActivo.set('pagos');

    // Cargar historial de suscripciones
    this.perfilService.obtenerHistorialSuscripciones().subscribe({
      next: lista => this.historialSubs.set(lista),
      error: () => {}
    });

    // Cargar suscripción vigente desde backend; localStorage como fallback
    this.perfilService.obtenerSuscripcion().subscribe({
      next: data => {
        if (data) {
          const sub: Suscripcion = {
            refNum:        data.refInterna ?? '—',
            plan:          data.tipoPlan,
            monto:         Number(data.monto),
            inicio:        data.fechaInicio,
            fin:           data.fechaFin,
            estado:        data.estado as 'activa' | 'cancelada',
            titular:       '—',
            ultimosCuatro: '—',
            metodo:        data.metodoPago ?? 'culqi',
          };
          this.suscripcion.set(sub);
          localStorage.setItem('py_suscripcion', JSON.stringify(sub));
        } else {
          // Sin suscripción en backend → revisar localStorage (pago local simulado)
          const stored = localStorage.getItem('py_suscripcion');
          if (stored) {
            try { this.suscripcion.set(JSON.parse(stored)); } catch {}
          }
        }
      },
      error: () => {
        // Backend no disponible → usar localStorage
        const stored = localStorage.getItem('py_suscripcion');
        if (stored) {
          try { this.suscripcion.set(JSON.parse(stored)); } catch {}
        }
      }
    });

    // Actualiza validadores del nroDocumento al cambiar tipo
    this.form.get('tipoDocumento')!.valueChanges.subscribe(tipo => {
      const ctrl = this.form.get('nroDocumento')!;
      ctrl.clearValidators();
      if (tipo === 'DNI') {
        ctrl.setValidators([
          Validators.minLength(8),
          Validators.maxLength(8),
          Validators.pattern(/^\d{8}$/)
        ]);
      } else if (tipo === 'CE') {
        ctrl.setValidators([Validators.maxLength(12)]);
      } else if (tipo === 'PAS') {
        ctrl.setValidators([Validators.maxLength(20)]);
      }
      ctrl.updateValueAndValidity();
    });
    this.perfilService.obtener().subscribe({
      next: p => {
        this.perfil.set(p);
        // Si el teléfono guardado ya incluye el código de país, separarlo
        let telNum = p.telefono ?? '';
        if (telNum) {
          const pais = PAISES.find(x => telNum.startsWith(x.dial));
          if (pais) {
            this.paisSeleccionado.set(pais);
            telNum = telNum.slice(pais.dial.length);
          }
        }
        this.form.patchValue({
          nombre:          p.nombre,
          apellidoPaterno: p.apellidoPaterno,
          apellidoMaterno: p.apellidoMaterno ?? '',
          genero:          p.genero ?? '',
          telefono:        telNum,
          fechaNacimiento: p.fechaNacimiento ?? '',
          tipoDocumento:   p.tipoDocumento ?? '',
          nroDocumento:    p.nroDocumento ?? '',
        });
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el perfil.');
        this.cargando.set(false);
      }
    });
  }

  guardar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.guardando.set(true);
    this.mensaje.set(null);
    this.error.set(null);
    const v = this.form.value;
    const telCompleto = v.telefono
      ? `${this.paisSeleccionado().dial}${v.telefono}`
      : undefined;

    this.perfilService.actualizar({
      nombre:          v.nombre!,
      apellidoPaterno: v.apellidoPaterno!,
      apellidoMaterno: v.apellidoMaterno || undefined,
      genero:          v.genero || undefined,
      telefono:        telCompleto,
      fechaNacimiento: v.fechaNacimiento || undefined,
      tipoDocumento:   v.tipoDocumento || undefined,
      nroDocumento:    v.nroDocumento || undefined,
    }).subscribe({
      next: p => {
        this.perfil.set(p);
        if (p.telefono) localStorage.setItem('telefono', p.telefono);
        else localStorage.removeItem('telefono');
        localStorage.setItem('nombre', p.nombre);
        this.auth.nombre.set(p.nombre);
        this.mensaje.set('Perfil actualizado correctamente.');
        this.guardando.set(false);
      },
      error: err => {
        this.error.set(err.error?.message ?? 'No se pudo guardar los cambios.');
        this.guardando.set(false);
      }
    });
  }

  placeholderDoc(): string {
    const tipo = this.form.get('tipoDocumento')?.value;
    if (tipo === 'DNI') return '8 dígitos';
    if (tipo === 'CE')  return 'Hasta 12 caracteres';
    if (tipo === 'PAS') return 'Número de pasaporte';
    return 'Número de documento';
  }

  maxLengthDoc(): number {
    const tipo = this.form.get('tipoDocumento')?.value;
    if (tipo === 'DNI') return 8;
    if (tipo === 'CE')  return 12;
    return 20;
  }

  mensajeErrorDoc(): string {
    const ctrl = this.form.get('nroDocumento');
    const tipo = this.form.get('tipoDocumento')?.value;
    if (tipo === 'DNI') {
      if (ctrl?.hasError('pattern') || ctrl?.hasError('minlength') || ctrl?.hasError('maxlength'))
        return 'El DNI debe tener exactamente 8 dígitos numéricos';
    }
    if (tipo === 'CE' && ctrl?.hasError('maxlength'))
      return 'El CE debe tener máximo 12 caracteres';
    return 'Número de documento inválido';
  }

  tieneError(campo: string): boolean {
    const ctrl = this.form.get(campo);
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  rolLabel(rol: string): string {
    if (rol === 'admin') return 'Administrador';
    if (rol === 'usuario_premium') return 'Premium';
    return 'BÁSICO';
  }

  rolCss(rol: string): string {
    if (rol === 'admin') return 'badge-admin';
    if (rol === 'usuario_premium') return 'badge-premium';
    return 'badge-free';
  }

  // ── Pago simulado ────────────────────────────────────────────
  formatCardNum(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 16);
    const groups = digits.match(/.{1,4}/g) ?? [];
    const fmt    = groups.join(' ');
    input.value  = fmt;
    this.cardDisplayNum.set(fmt);
    this.pagoForm.get('numero')!.setValue(digits, { emitEvent: false });
  }

  formatExpiry(event: Event): void {
    const input = event.target as HTMLInputElement;
    let raw = input.value.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) raw = raw.slice(0, 2) + '/' + raw.slice(2);
    input.value = raw;
    this.pagoForm.get('expira')!.setValue(raw, { emitEvent: false });
  }

  tienePagoError(campo: string): boolean {
    const ctrl = this.pagoForm.get(campo);
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  pagar(): void {
    this.pagoForm.markAllAsTouched();
    if (this.pagoForm.invalid) return;
    if (!this.luhn(this.pagoForm.value.numero ?? '')) {
      this.errorPago.set('El número de tarjeta no es válido.');
      return;
    }
    this.errorPago.set(null);
    this.stepPago.set('procesando');
    this.finalizarPago(
      this.pagoForm.value.titular ?? '',
      (this.pagoForm.value.numero ?? '').slice(-4),
      'culqi'
    );
  }

  confirmarQr(): void {
    this.qrAnimado.set(true);
    this.stepPago.set('procesando');
    const metodo = this.metodoPago() as 'yape' | 'plin';
    this.finalizarPago('—', '—', metodo);
  }

  private finalizarPago(titular: string, ultimos: string, metodo: string): void {
    setTimeout(() => {
      const hoy = new Date();
      const fin = new Date(hoy);
      if (this.planPago() === 'anual') fin.setFullYear(fin.getFullYear() + 1);
      else fin.setMonth(fin.getMonth() + 1);

      const sub: Suscripcion = {
        refNum:        Math.floor(100000 + Math.random() * 900000).toString(),
        plan:          this.planPago(),
        monto:         this.montoActual(),
        inicio:        hoy.toISOString().split('T')[0],
        fin:           fin.toISOString().split('T')[0],
        estado:        'activa',
        titular,
        ultimosCuatro: ultimos,
        metodo,
      };

      localStorage.setItem('py_suscripcion', JSON.stringify(sub));
      this.suscripcion.set(sub);
      this.stepPago.set('exito');
      this.qrAnimado.set(false);
    }, 2200);
  }

  cancelarSuscripcion(): void {
    const sub = this.suscripcion();
    if (!sub) return;
    const updated: Suscripcion = { ...sub, estado: 'cancelada' };
    localStorage.setItem('py_suscripcion', JSON.stringify(updated));
    this.suscripcion.set(updated);
  }

  nuevoPago(): void {
    this.stepPago.set('form');
    this.pagoForm.reset();
    this.cardDisplayNum.set('');
    this.errorPago.set(null);
    this.qrAnimado.set(false);
  }

  labelMetodo(m: string): string {
    if (m === 'yape') return 'Yape';
    if (m === 'plin') return 'Plin';
    return 'Tarjeta';
  }

  private luhn(num: string): boolean {
    let sum = 0;
    let alt = false;
    for (let i = num.length - 1; i >= 0; i--) {
      let n = parseInt(num[i], 10);
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n;
      alt = !alt;
    }
    return sum % 10 === 0;
  }

  formatDate(d: string): string {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }
}
