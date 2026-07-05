import { Component, inject, OnInit, signal, computed, HostListener } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { forkJoin, timer } from 'rxjs';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { PerfilService, PerfilData, SuscripcionData, PagoRequest } from '../../core/services/perfil.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmModalService } from '../../core/services/confirm-modal.service';

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

export type EstadoSuscripcion = 'activa' | 'vencida' | 'cancelada';

export interface Suscripcion {
  refNum:        string;
  plan:          'mensual' | 'anual';
  monto:         number;
  inicio:        string;
  fin:           string;
  estado:        EstadoSuscripcion;
  titular:       string;
  ultimosCuatro: string;
  metodo:        string;
  autoRenovar:   boolean;
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
  private confirm       = inject(ConfirmModalService);

  perfil    = signal<PerfilData | null>(null);
  cargando  = signal(true);
  guardando = signal(false);
  mensaje   = signal<string | null>(null);
  error     = signal<string | null>(null);

  // ── Tabs ─────────────────────────────────────────────────────
  tabActivo = signal<'info' | 'pagos'>('info');

  // mensaje()/error() son compartidos entre "Mi información" y "Suscripción";
  // al cambiar de tab hay que limpiarlos para que un mensaje de una sección
  // no aparezca fuera de contexto en la otra.
  cambiarTab(tab: 'info' | 'pagos'): void {
    this.tabActivo.set(tab);
    this.mensaje.set(null);
    this.error.set(null);
  }

  // Sub-tabs dentro de "Suscripción": plan actual (estado + pasarela) vs historial.
  subTabPagos = signal<'plan' | 'historial'>('plan');

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

  // "Renovar ahora" con un plan Yape/Plin todavía activo: fuerza mostrar el
  // formulario de pago aunque estado === 'activa' (normalmente el formulario
  // solo aparece cuando NO hay plan activo).
  renovandoManual = signal(false);

  // Paso activo de "Verificando tu pago..." (0, 1 o 2). Avanza con el tiempo
  // real, no es decorativo — sincronizado con los ~10s de la animación.
  pasoProcesando = signal(0);
  mostrarModalExito = signal(false);
  // Yape: código de aprobación de 6 dígitos (así funciona hoy su compra por
  // internet — no hay QR, el usuario lo copia de su app y lo pega aquí).
  codigoYape = signal('');

  // Plin: número de celular → "esperando confirmación" simula la notificación
  // push que Plin envía a la app del comprador para aprobar el pago.
  celularPlin      = signal('');
  plinEsperando    = signal(false);

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

  // ── Solo para pruebas manuales: Alt+R rellena el formulario de pago
  // activo con datos válidos, sin depender de escribir todo cada vez. ──
  @HostListener('window:keydown', ['$event'])
  rellenarDatosPrueba(event: KeyboardEvent): void {
    if (!event.altKey || event.key.toLowerCase() !== 'r') return;
    if (this.tabActivo() !== 'pagos' || this.stepPago() !== 'form') return;
    event.preventDefault();

    if (this.metodoPago() === 'culqi') {
      const numero = '4532015112830366'; // Visa real, válida por Luhn
      this.pagoForm.patchValue({
        titular: 'Enrique Prada',
        numero,
        expira: '12/29',
        cvv: '123',
        email: 'enrique.pdg@gmail.com',
      });
      const fmt = numero.match(/.{1,4}/g)!.join(' ');
      this.cardDisplayNum.set(fmt);
    } else if (this.metodoPago() === 'yape') {
      this.codigoYape.set('482915');
    } else if (this.metodoPago() === 'plin') {
      this.celularPlin.set('987654321');
    }
  }

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
        this.cargarSuscripcion();
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

  // El backend es la única fuente de verdad: la suscripción vigente (o, si no
  // hay, la más reciente del historial) decide qué se muestra. Ya no hay
  // fallback a localStorage — pagar/cancelar persisten directo en BD.
  private cargarSuscripcion(): void {
    forkJoin({
      vigente: this.perfilService.obtenerSuscripcion(),
      historial: this.perfilService.obtenerHistorialSuscripciones(),
    }).subscribe({
      next: ({ vigente, historial }) => {
        this.historialSubs.set(historial);
        const origen = vigente ?? historial[0] ?? null;
        this.suscripcion.set(origen ? this.mapSuscripcion(origen) : null);
      },
      error: () => {
        this.error.set('No se pudo cargar tu suscripción.');
      }
    });
  }

  private mapSuscripcion(data: SuscripcionData): Suscripcion {
    return {
      refNum:        data.refInterna ?? '—',
      plan:          data.tipoPlan,
      monto:         Number(data.monto),
      inicio:        data.fechaInicio,
      fin:           data.fechaFin,
      estado:        data.estado as EstadoSuscripcion,
      titular:       '—',
      ultimosCuatro: '—',
      metodo:        data.metodoPago ?? 'culqi',
      autoRenovar:   data.autoRenovar ?? false,
    };
  }

  // ── Estado de suscripción: fuente única de verdad para label/color/icono ──
  // Recibe `string` (no solo EstadoSuscripcion) porque SuscripcionData.estado
  // llega tal cual del backend sin garantía de tipo estricto.
  estadoLabel(estado: string): string {
    if (estado === 'activa')  return 'Activa';
    if (estado === 'vencida') return 'Vencida';
    return 'Cancelada';
  }

  estadoCss(estado: string): string {
    if (estado === 'activa')  return 'estado-activa';
    if (estado === 'vencida') return 'estado-vencida';
    return 'estado-cancelada';
  }

  estadoIcono(estado: string): string {
    if (estado === 'activa')  return 'fa-circle';
    if (estado === 'vencida') return 'fa-clock';
    return 'fa-xmark';
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
    this.finalizarPago({
      plan:          this.planPago(),
      metodo:        'tarjeta_credito',
      titular:       this.pagoForm.value.titular ?? '',
      numeroTarjeta: this.pagoForm.value.numero ?? '',
      expira:        this.pagoForm.value.expira ?? '',
      emailRecibo:   this.pagoForm.value.email ?? '',
    });
  }

  // ── Yape: código de aprobación de 6 dígitos ──────────────────
  formatCodigoYape(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 6);
    input.value = digits;
    this.codigoYape.set(digits);
  }

  confirmarYape(): void {
    if (this.codigoYape().length !== 6) {
      this.errorPago.set('Ingresa el código de aprobación de 6 dígitos de tu app Yape.');
      return;
    }
    this.errorPago.set(null);
    this.stepPago.set('procesando');
    this.finalizarPago({ plan: this.planPago(), metodo: 'yape' });
  }

  // ── Plin: celular → notificación push → confirmar ────────────
  formatCelularPlin(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 9);
    input.value = digits;
    this.celularPlin.set(digits);
  }

  enviarSolicitudPlin(): void {
    if (!/^9\d{8}$/.test(this.celularPlin())) {
      this.errorPago.set('Ingresa un celular Plin válido (9 dígitos).');
      return;
    }
    this.errorPago.set(null);
    this.plinEsperando.set(true);
  }

  confirmarPlin(): void {
    this.stepPago.set('procesando');
    this.finalizarPago({ plan: this.planPago(), metodo: 'plin' });
  }

  // Duración total de la animación "Verificando tu pago..." — 3 pasos de
  // ~3.3s cada uno. El HTTP real corre en paralelo; si responde antes, la
  // transición a "éxito" igual espera a que termine la animación completa.
  private static readonly DURACION_PASO_MS = 3300;

  private finalizarPago(request: PagoRequest): void {
    this.pasoProcesando.set(0);
    const avanzarPaso1 = setTimeout(() => this.pasoProcesando.set(1), PerfilComponent.DURACION_PASO_MS);
    const avanzarPaso2 = setTimeout(() => this.pasoProcesando.set(2), PerfilComponent.DURACION_PASO_MS * 2);

    forkJoin({
      resultado: this.perfilService.pagar(request),
      // Tiempo mínimo antes de mostrar "éxito", para que la animación de
      // los 3 pasos siempre se vea completa (aunque el servidor responda ya).
      _delay: timer(PerfilComponent.DURACION_PASO_MS * 3),
    }).subscribe({
      next: ({ resultado }) => {
        const sub = this.mapSuscripcion(resultado);
        this.suscripcion.set(sub);
        // El backend ya subió Usuario.rol a premium en BD; reflejamos ese
        // cambio en el signal local para que navbar/límites reaccionen sin F5.
        this.auth.rol.set('usuario_premium');
        localStorage.setItem('rol', 'usuario_premium');
        this.stepPago.set('exito');
        this.mostrarModalExito.set(true);
      },
      error: err => {
        clearTimeout(avanzarPaso1);
        clearTimeout(avanzarPaso2);
        this.errorPago.set(err.error?.message ?? 'No se pudo procesar el pago.');
        this.stepPago.set('form');
        this.plinEsperando.set(false);
      }
    });
  }

  cerrarModalExito(): void {
    this.mostrarModalExito.set(false);
    // suscripcion() ya quedó 'activa' tras el pago, así que al volver a
    // 'form' se muestra la tarjeta dorada normal, no el recibo estático.
    this.nuevoPago();
  }

  async cancelarSuscripcion(): Promise<void> {
    const sub = this.suscripcion();
    if (!sub) return;

    const fechaFin = this.formatDate(sub.fin);
    const ok = await this.confirm.abrir({
      tipo:    'warning',
      titulo:  '¿Cancelar tu suscripción PRO?',
      mensaje: `Dejarás de renovar automáticamente, pero conservarás todas las funciones premium hasta el ${fechaFin}. Después de esa fecha, tu cuenta pasará a plan Básico.`,
      labelOk:     'Sí, cancelar',
      labelCancel: 'Mantener mi plan',
    });
    if (!ok) return;

    this.perfilService.cancelarSuscripcion().subscribe({
      next: () => {
        // Conserva premium hasta fechaFin (igual que Netflix/Spotify) — solo
        // cambia el estado mostrado, el rol se degrada más adelante en BD.
        this.suscripcion.update(s => s ? { ...s, estado: 'cancelada' } : s);
        this.mensaje.set(`Suscripción cancelada. Conservarás el acceso PRO hasta el ${fechaFin}.`);
      },
      error: err => {
        this.error.set(err.error?.message ?? 'No se pudo cancelar la suscripción.');
      }
    });
  }

  nuevoPago(): void {
    this.stepPago.set('form');
    this.pagoForm.reset();
    this.cardDisplayNum.set('');
    this.codigoYape.set('');
    this.celularPlin.set('');
    this.plinEsperando.set(false);
    this.pasoProcesando.set(0);
    this.mostrarModalExito.set(false);
    this.errorPago.set(null);
    this.renovandoManual.set(false);
  }

  // "Renovar ahora" con un plan Yape/Plin todavía activo (aún no vencido):
  // fuerza mostrar el formulario de pago que normalmente solo aparece cuando
  // no hay ningún plan activo. El backend extiende el MISMO plan que ya
  // tenías (no admite cambiarlo aquí), así que se fija planPago() al plan
  // real para que el monto mostrado sea el que realmente se va a cobrar.
  renovarManualmente(): void {
    const sub = this.suscripcion();
    this.nuevoPago();
    if (sub) this.planPago.set(sub.plan);
    this.renovandoManual.set(true);
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

  diasParaVencer(fechaFin: string): number {
    if (!fechaFin) return Infinity;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fin = new Date(fechaFin + 'T00:00:00');
    return Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  }
}
