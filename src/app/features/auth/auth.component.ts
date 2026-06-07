import { Component, signal, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss'
})
export class AuthComponent {
  private fb          = inject(FormBuilder);
  private router      = inject(Router);
  private authService = inject(AuthService);

  modo     = signal<'login' | 'registro'>('login');
  cargando = signal(false);
  mensaje  = signal<string | null>(null);
  error    = signal<string | null>(null);

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

  entrar(): void {
    if (this.loginForm.invalid) return;
    this.cargando.set(true);
    this.error.set(null);
    const { email, password } = this.loginForm.value;
    this.authService.login(email!, password!).subscribe({
      next: res => {
        this.authService.guardarToken(res.token);
        localStorage.setItem('nombre', res.nombre);
        this.router.navigate(['/dashboard']);
      },
      error: err => {
        this.error.set(err.error?.message ?? 'Credenciales incorrectas');
        this.cargando.set(false);
      }
    });
  }

  registrarse(): void {
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
        this.mensaje.set('Registro exitoso. Revisa tu correo para verificar tu cuenta.');
        this.cargando.set(false);
        this.registroForm.reset();
      },
      error: err => {
        this.error.set(err.error ?? 'Error al registrarse');
        this.cargando.set(false);
      }
    });
  }

  tieneError(form: 'login' | 'registro', campo: string): boolean {
    const c = form === 'login'
      ? this.loginForm.get(campo)
      : this.registroForm.get(campo);
    return !!(c?.invalid && c?.touched);
  }
}
