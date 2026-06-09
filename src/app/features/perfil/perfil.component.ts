import { Component, inject, OnInit, signal, computed, HostListener } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { PerfilService, PerfilData } from '../../core/services/perfil.service';
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

  perfil    = signal<PerfilData | null>(null);
  cargando  = signal(true);
  guardando = signal(false);
  mensaje   = signal<string | null>(null);
  error     = signal<string | null>(null);

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
}
