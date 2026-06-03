import { Component, signal, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss'
})
export class AuthComponent {
  private fb     = inject(FormBuilder);
  private router = inject(Router);

  modo = signal<'login' | 'registro'>('login');

  loginForm = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  registroForm = this.fb.group({
    nombre:   ['', [Validators.required, Validators.minLength(2)]],
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  entrar(): void {
    if (this.loginForm.valid) {
      this.router.navigate(['/']);
    }
  }

  registrarse(): void {
    if (this.registroForm.valid) {
      this.router.navigate(['/']);
    }
  }

  tieneError(form: 'login' | 'registro', campo: string): boolean {
    const c = form === 'login'
      ? this.loginForm.get(campo)
      : this.registroForm.get(campo);
    return !!(c?.invalid && c?.touched);
  }
}
