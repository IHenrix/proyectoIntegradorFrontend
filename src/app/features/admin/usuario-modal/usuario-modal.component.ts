import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminUsuarioDetalle } from '../../../core/services/admin.service';

export interface GuardadoUsuarioEvent {
  modo: 'crear' | 'editar';
  id?: number;
  dto: any;
}

@Component({
  selector: 'app-usuario-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './usuario-modal.component.html',
  styleUrl: './usuario-modal.component.scss'
})
export class UsuarioModalComponent implements OnChanges {
  private fb = inject(FormBuilder);

  @Input() abierto = false;
  @Input() usuario: AdminUsuarioDetalle | null = null;
  @Input() errorExterno: string | null = null;
  @Input() guardando = false;

  @Output() cerrar = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<GuardadoUsuarioEvent>();

  readonly TIPOS_DOC = [
    { codigo: 'DNI', nombre: 'DNI', longitud: 8 },
    { codigo: 'CE', nombre: 'Carnet de extranjería', longitud: 12 },
    { codigo: 'PAS', nombre: 'Pasaporte', longitud: null as number | null },
  ];

  readonly ROLES = ['usuario_free', 'usuario_premium', 'admin'];

  errorLocal = signal<string | null>(null);

  form = this.fb.group({
    nombre:          ['', [Validators.required, Validators.minLength(2)]],
    apellidoPaterno: ['', [Validators.required, Validators.minLength(2)]],
    apellidoMaterno: [''],
    genero:          [''],
    email:           ['', [Validators.required, Validators.email]],
    password:        [''],
    telefono:        [''],
    fechaNacimiento: [''],
    tipoDocumento:   [''],
    nroDocumento:    [''],
    rol:             ['usuario_free', Validators.required],
    activo:          [true],
  });

  constructor() {
    this.form.get('tipoDocumento')!.valueChanges.subscribe(tipo => {
      const ctrl = this.form.get('nroDocumento')!;
      ctrl.clearValidators();
      if (tipo === 'DNI') {
        ctrl.setValidators([Validators.minLength(8), Validators.maxLength(8), Validators.pattern(/^\d{8}$/)]);
      } else if (tipo === 'CE') {
        ctrl.setValidators([Validators.maxLength(12)]);
      } else if (tipo === 'PAS') {
        ctrl.setValidators([Validators.maxLength(20)]);
      }
      ctrl.updateValueAndValidity();
    });
  }

  get esEdicion(): boolean {
    return this.usuario !== null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['abierto'] && !changes['usuario']) return;
    if (!this.abierto) return;

    this.errorLocal.set(null);
    const passwordCtrl = this.form.get('password')!;

    if (this.usuario) {
      // Modo editar: password opcional, solo se valida longitud si se escribe algo.
      passwordCtrl.setValidators([Validators.minLength(8)]);
      this.form.reset({
        nombre: this.usuario.nombre ?? '',
        apellidoPaterno: this.usuario.apellidoPaterno ?? '',
        apellidoMaterno: this.usuario.apellidoMaterno ?? '',
        genero: this.usuario.genero ?? '',
        email: this.usuario.email,
        password: '',
        telefono: this.usuario.telefono ?? '',
        fechaNacimiento: this.usuario.fechaNacimiento ?? '',
        tipoDocumento: this.usuario.tipoDocumento ?? '',
        nroDocumento: this.usuario.nroDocumento ?? '',
        rol: this.usuario.rol,
        activo: this.usuario.activo,
      });
    } else {
      // Modo crear: password obligatorio.
      passwordCtrl.setValidators([Validators.required, Validators.minLength(8)]);
      this.form.reset({ rol: 'usuario_free', activo: true });
    }
    passwordCtrl.updateValueAndValidity();
  }

  guardar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const v = this.form.value;
    const dto = {
      nombre: v.nombre,
      apellidoPaterno: v.apellidoPaterno,
      apellidoMaterno: v.apellidoMaterno || undefined,
      genero: v.genero || undefined,
      email: v.email,
      password: v.password || (this.esEdicion ? undefined : ''),
      telefono: v.telefono || undefined,
      fechaNacimiento: v.fechaNacimiento || undefined,
      nroDocumento: v.nroDocumento || undefined,
      rol: v.rol,
      ...(this.esEdicion ? { activo: v.activo } : {}),
    };

    this.guardado.emit({ modo: this.esEdicion ? 'editar' : 'crear', id: this.usuario?.id, dto });
  }

  onCerrar(): void {
    this.cerrar.emit();
  }
}
