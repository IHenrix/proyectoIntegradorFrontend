import { Component, signal, inject, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import {
  ReactiveFormsModule, FormBuilder, Validators,
  AbstractControl, ValidationErrors, ValidatorFn
} from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

function passwordFuerte(ctrl: AbstractControl): ValidationErrors | null {
  const v: string = ctrl.value ?? '';
  const ok = v.length >= 8 && /[A-Z]/.test(v) && /[a-z]/.test(v) && /[0-9]/.test(v) && /[^a-zA-Z0-9]/.test(v);
  return ok ? null : { passwordDebil: true };
}

const REGLAS_DOC: Record<number, { pattern: RegExp; msg: string; placeholder: string }> = {
  1: { pattern: /^[0-9]{8}$/,        msg: 'Debe tener exactamente 8 dígitos',               placeholder: 'Ej: 74405646' },
  2: { pattern: /^[A-Z0-9]{12}$/,    msg: 'Debe tener exactamente 12 caracteres',           placeholder: 'Ej: 000123456789' },
  3: { pattern: /^[A-Z0-9]{6,12}$/,  msg: 'Entre 6 y 12 caracteres alfanuméricos',          placeholder: 'Ej: AB123456' },
  4: { pattern: /^[0-9]{11}$/,       msg: 'Debe tener exactamente 11 dígitos',              placeholder: 'Ej: 20123456789' },
};

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss'
})
export class AuthComponent implements OnInit, AfterViewInit, OnDestroy {
  private fb           = inject(FormBuilder);
  private router       = inject(Router);
  private route        = inject(ActivatedRoute);
  readonly authService = inject(AuthService);

  modo         = signal<'login' | 'registro'>('login');
  cargando     = signal(false);
  mensaje      = signal<string | null>(null);
  error        = signal<string | null>(null);
  mostrarPass  = signal(false);
  mostrarPassR = signal(false);
  mostrarPassC = signal(false);

  private docSub?: Subscription;
  private captchaLoginId:    number | null = null;
  private captchaRegistroId: number | null = null;

  readonly recaptchaSiteKey = environment.recaptchaSiteKey;

  // Fecha máxima nacimiento: hoy (sin restricción de edad para demo)
  readonly fechaMaxNac = new Date().toISOString().split('T')[0];
  readonly fechaMinNac = new Date(
    new Date().setFullYear(new Date().getFullYear() - 120)
  ).toISOString().split('T')[0];

  loginForm = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  registroForm = this.fb.group({
    nombre:            ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    apellidoPaterno:   ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    apellidoMaterno:   ['', [Validators.maxLength(60)]],
    genero:            [''],
    email:             ['', [Validators.required, Validators.email]],
    password:          ['', [Validators.required, passwordFuerte]],
    confirmarPassword: ['', [Validators.required]],
    tipoDocumentoId:   [null as number | null],
    nroDocumento:      [''],
    telefono:          ['', [Validators.pattern(/^(\+?51)?9[0-9]{8}$/)]],
    fechaNacimiento:   ['']
  });

  readonly tiposDoc = [
    { id: 1, codigo: 'DNI', nombre: 'DNI — Documento Nacional de Identidad' },
    { id: 2, codigo: 'CE',  nombre: 'CE — Carnet de Extranjería' },
    { id: 3, codigo: 'PAS', nombre: 'Pasaporte' },
    { id: 4, codigo: 'RUC', nombre: 'RUC — Reg. Único de Contribuyentes' }
  ];

  ngOnInit(): void {
    this.docSub = this.registroForm.get('tipoDocumentoId')!.valueChanges
      .subscribe(val => {
        this.actualizarValidadoresDoc(val);
        this.registroForm.get('nroDocumento')!.setValue('', { emitEvent: false });
        this.registroForm.get('nroDocumento')!.markAsUntouched();
      });

    const params = this.route.snapshot.queryParamMap;
    const verificado = params.get('verificado');
    if (verificado === 'ok') {
      this.mensaje.set('¡Correo verificado correctamente! Ya puedes iniciar sesión.');
    } else if (verificado === 'error') {
      const msg = params.get('msg');
      this.error.set(msg ?? 'El enlace de verificación no es válido o ya fue utilizado.');
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.renderWidget('recaptcha-login', 'login'), 200);
  }

  ngOnDestroy(): void {
    this.docSub?.unsubscribe();
  }

  private actualizarValidadoresDoc(tipoId: number | null): void {
    const ctrl = this.registroForm.get('nroDocumento')!;
    ctrl.clearValidators();
    if (!tipoId) {
      ctrl.updateValueAndValidity();
      return;
    }
    const regla = REGLAS_DOC[tipoId];
    const validators: ValidatorFn[] = [Validators.required, Validators.pattern(regla.pattern)];
    ctrl.setValidators(validators);
    ctrl.updateValueAndValidity();
  }

  get nroDocInfo(): { placeholder: string; hint: string; errorMsg: string } {
    const tipo = this.registroForm.get('tipoDocumentoId')?.value as number | null;
    if (!tipo || !REGLAS_DOC[tipo]) {
      return { placeholder: 'Número de documento', hint: '', errorMsg: '' };
    }
    const r = REGLAS_DOC[tipo];
    return { placeholder: r.placeholder, hint: r.msg, errorMsg: r.msg };
  }

  get passwordsNoCoinciden(): boolean {
    const p = this.registroForm.get('password')?.value;
    const c = this.registroForm.get('confirmarPassword')?.value;
    return !!(c && p !== c);
  }

  get passReq() {
    const v: string = this.registroForm.get('password')?.value ?? '';
    return {
      longitud:  v.length >= 8,
      mayuscula: /[A-Z]/.test(v),
      minuscula: /[a-z]/.test(v),
      numero:    /[0-9]/.test(v),
      especial:  /[^a-zA-Z0-9]/.test(v)
    };
  }

  toMayusculas(campo: string): void {
    const ctrl = this.registroForm.get(campo);
    if (!ctrl?.value) return;
    ctrl.setValue((ctrl.value as string).toUpperCase(), { emitEvent: false });
  }

  soloNumeros(campo: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const soloNum = input.value.replace(/[^0-9]/g, '');
    this.registroForm.get(campo)!.setValue(soloNum, { emitEvent: false });
    input.value = soloNum;
  }

  soloAlfanum(campo: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/[^A-Z0-9]/g, '').toUpperCase();
    this.registroForm.get(campo)!.setValue(val, { emitEvent: false });
    input.value = val;
  }

  cambiarModo(m: 'login' | 'registro'): void {
    this.modo.set(m);
    this.error.set(null);
    this.mensaje.set(null);
    if (m === 'registro') {
      setTimeout(() => this.renderWidget('recaptcha-registro', 'registro'), 80);
    } else {
      setTimeout(() => this.renderWidget('recaptcha-login', 'login'), 80);
    }
  }

  private renderWidget(elementId: string, tipo: 'login' | 'registro'): void {
    const g = (window as any).grecaptcha;
    if (!g) return;
    const el = document.getElementById(elementId);
    if (!el || el.childElementCount > 0) return;
    const id = g.render(el, { sitekey: this.recaptchaSiteKey, theme: 'dark' });
    if (tipo === 'login') this.captchaLoginId = id;
    else this.captchaRegistroId = id;
  }

  private resetWidget(tipo: 'login' | 'registro'): void {
    const g = (window as any).grecaptcha;
    const widgetId = tipo === 'login' ? this.captchaLoginId : this.captchaRegistroId;
    if (g && widgetId !== null) g.reset(widgetId);
  }

  private getCaptchaToken(tipo: 'login' | 'registro'): string {
    const g = (window as any).grecaptcha;
    const widgetId = tipo === 'login' ? this.captchaLoginId : this.captchaRegistroId;
    return g?.getResponse(widgetId ?? undefined) ?? '';
  }

  entrar(): void {
    if (this.cargando()) return;
    this.loginForm.markAllAsTouched();
    if (this.loginForm.invalid) return;

    const captchaToken = this.getCaptchaToken('login');
    if (!captchaToken) {
      this.error.set('Por favor completa el captcha antes de continuar.');
      return;
    }

    this.cargando.set(true);
    this.error.set(null);
    const { email, password } = this.loginForm.value;
    this.authService.login(email!, password!, captchaToken).subscribe({
      next: res => {
        this.authService.iniciarSesion(res);
        this.router.navigate(['/dashboard']);
      },
      error: err => {
        const raw = err.error;
        const msg = raw?.message ?? (typeof raw === 'string' ? raw : 'Credenciales incorrectas');
        this.error.set(msg);
        this.cargando.set(false);
        this.resetWidget('login');
      }
    });
  }

  registrarse(): void {
    if (this.cargando()) return;
    this.registroForm.markAllAsTouched();
    if (this.registroForm.invalid || this.passwordsNoCoinciden) return;

    const captchaToken = this.getCaptchaToken('registro');
    if (!captchaToken) {
      this.error.set('Por favor completa el captcha antes de continuar.');
      return;
    }

    this.cargando.set(true);
    this.error.set(null);
    this.mensaje.set(null);
    const v = this.registroForm.value;
    this.authService.registro({
      nombre:          v.nombre!,
      apellidoPaterno: v.apellidoPaterno!,
      apellidoMaterno: v.apellidoMaterno ?? '',
      genero:          v.genero ?? '',
      email:           v.email!,
      password:        v.password!,
      telefono:        v.telefono ?? '',
      fechaNacimiento: v.fechaNacimiento ?? '',
      tipoDocumentoId: v.tipoDocumentoId ?? null,
      nroDocumento:    v.nroDocumento ?? '',
      captchaToken
    }).subscribe({
      next: () => {
        const emailUsado = v.email!;
        this.cargando.set(false);
        this.registroForm.reset();
        this.modo.set('login');
        this.loginForm.patchValue({ email: emailUsado });
        this.mensaje.set('Cuenta creada. Revisa tu correo y haz clic en "Validar correo" para activar tu cuenta.');
      },
      error: err => {
        const raw = err.error;
        const msg = raw?.message ?? (typeof raw === 'string' ? raw : 'Error al registrarse');
        this.error.set(msg);
        this.cargando.set(false);
        this.resetWidget('registro');
      }
    });
  }

  tieneError(form: 'login' | 'registro', campo: string): boolean {
    const ctrl = form === 'login'
      ? this.loginForm.get(campo)
      : this.registroForm.get(campo);
    return !!(ctrl?.invalid && ctrl?.touched);
  }
}
