import { Component, inject, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { PerfilService, PerfilData } from '../../core/services/perfil.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, NavbarComponent, FooterComponent],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.scss'
})
export class PerfilComponent implements OnInit {
  private fb            = inject(FormBuilder);
  private perfilService = inject(PerfilService);
  private auth          = inject(AuthService);
  private router        = inject(Router);

  perfil   = signal<PerfilData | null>(null);
  cargando = signal(true);
  guardando = signal(false);
  mensaje  = signal<string | null>(null);
  error    = signal<string | null>(null);
  mostrarPass = signal(false);

  form = this.fb.group({
    nombre:          ['', [Validators.required, Validators.minLength(2)]],
    apellidoPaterno: ['', [Validators.required, Validators.minLength(2)]],
    apellidoMaterno: [''],
    genero:          [''],
    telefono:        ['', [Validators.pattern(/^(\+?51)?9[0-9]{8}$/)]],
    fechaNacimiento: [''],
    passwordActual:  [''],
    passwordNuevo:   ['', [Validators.minLength(8)]],
  }, { validators: this.passValidator });

  ngOnInit(): void {
    if (!this.auth.estaAutenticado()) {
      this.router.navigate(['/auth']);
      return;
    }
    this.perfilService.obtener().subscribe({
      next: p => {
        this.perfil.set(p);
        this.form.patchValue({
          nombre:          p.nombre,
          apellidoPaterno: p.apellidoPaterno,
          apellidoMaterno: p.apellidoMaterno ?? '',
          genero:          p.genero ?? '',
          telefono:        p.telefono ?? '',
          fechaNacimiento: p.fechaNacimiento ?? '',
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
    if (this.form.invalid) return;
    this.guardando.set(true);
    this.mensaje.set(null);
    this.error.set(null);
    const v = this.form.value;
    this.perfilService.actualizar({
      nombre:           v.nombre!,
      apellidoPaterno:  v.apellidoPaterno!,
      apellidoMaterno:  v.apellidoMaterno || undefined,
      genero:           v.genero || undefined,
      telefono:         v.telefono || undefined,
      fechaNacimiento:  v.fechaNacimiento || undefined,
      passwordActual:   v.passwordActual || undefined,
      passwordNuevo:    v.passwordNuevo || undefined,
    }).subscribe({
      next: p => {
        this.perfil.set(p);
        // Actualizar teléfono en localStorage para panel de alertas
        if (p.telefono) localStorage.setItem('telefono', p.telefono);
        else localStorage.removeItem('telefono');
        // Actualizar nombre en auth
        localStorage.setItem('nombre', p.nombre);
        this.auth.nombre.set(p.nombre);
        this.form.patchValue({ passwordActual: '', passwordNuevo: '' });
        this.mensaje.set('Perfil actualizado correctamente.');
        this.guardando.set(false);
      },
      error: err => {
        this.error.set(err.error?.message ?? 'No se pudo guardar los cambios.');
        this.guardando.set(false);
      }
    });
  }

  private passValidator(g: AbstractControl): ValidationErrors | null {
    const actual = g.get('passwordActual')?.value;
    const nuevo  = g.get('passwordNuevo')?.value;
    if ((actual && !nuevo) || (!actual && nuevo))
      return { passIncompleto: true };
    return null;
  }

  rolLabel(rol: string): string {
    if (rol === 'admin') return 'Administrador';
    if (rol === 'usuario_premium') return 'Premium';
    return 'Free';
  }

  rolCss(rol: string): string {
    if (rol === 'admin') return 'badge-admin';
    if (rol === 'usuario_premium') return 'badge-premium';
    return 'badge-free';
  }
}
