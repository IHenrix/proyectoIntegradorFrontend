import { Component, signal, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss'
})
export class AuthComponent {
  private fb          = inject(FormBuilder);
  private router      = inject(Router);
  readonly authService = inject(AuthService);

  modo         = signal<'login' | 'registro'>('login');
  cargando     = signal(false);
  mensaje      = signal<string | null>(null);
  error        = signal<string | null>(null);
  mostrarPass  = signal(false);
  mostrarPassR = signal(false);

  loginForm = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  registroForm = this.fb.group({
    nombre:          ['', [Validators.required, Validators.minLength(2)]],
    apellido:        ['', [Validators.required, Validators.minLength(2)]],
    email:           ['', [Validators.required, Validators.email]],
    password:        ['', [Validators.required, Validators.minLength(6)]],
    telefono:        [''],
    fechaNacimiento: ['']
  });

  cambiarModo(m: 'login' | 'registro'): void {
    this.modo.set(m);
    this.error.set(null);
    this.mensaje.set(null);
  }

  entrar(): void {
    this.loginForm.markAllAsTouched();
    if (this.loginForm.invalid) return;
    this.cargando.set(true);
    this.error.set(null);
    const { email, password } = this.loginForm.value;
    this.authService.login(email!, password!).subscribe({
      next: res => {
        this.authService.guardarToken(res.token);
        localStorage.setItem('nombre', res.nombre);
        localStorage.setItem('rol', res.rol);
        this.router.navigate(['/dashboard']);
      },
      error: err => {
        const raw = err.error;
        const msg = raw?.message ?? (typeof raw === 'string' ? raw : 'Credenciales incorrectas');
        this.error.set(msg);
        this.cargando.set(false);
      }
    });
  }

  registrarse(): void {
    this.registroForm.markAllAsTouched();
    if (this.registroForm.invalid) return;
    this.cargando.set(true);
    this.error.set(null);
    this.mensaje.set(null);
    const v = this.registroForm.value;
    this.authService.registro({
      nombre:          v.nombre!,
      apellido:        v.apellido!,
      email:           v.email!,
      password:        v.password!,
      telefono:        v.telefono ?? '',
      fechaNacimiento: v.fechaNacimiento ?? ''
    }).subscribe({
      next: () => {
        const emailUsado = v.email!;
        this.cargando.set(false);
        this.registroForm.reset();
        this.modo.set('login');
        this.loginForm.patchValue({ email: emailUsado });
        this.mensaje.set('Cuenta creada con éxito. Ya puedes iniciar sesión.');
      },
      error: err => {
        const raw = err.error;
        const msg = raw?.message ?? (typeof raw === 'string' ? raw : 'Error al registrarse');
        this.error.set(msg);
        this.cargando.set(false);
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
