import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import {
  AdminService,
  AdminDashboard,
  AdminUsuarioListado,
  AdminHistorialPrecio,
  AdminSuscripcion,
  AdminPago,
} from '../../core/services/admin.service';

type TabAdmin = 'dashboard' | 'usuarios' | 'historial' | 'suscripciones';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterLink, NavbarComponent, FooterComponent],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit {
  private adminService = inject(AdminService);

  tabActivo = signal<TabAdmin>('dashboard');
  cargando  = signal(true);
  error     = signal<string | null>(null);
  sinPermiso = signal(false);

  dashboard      = signal<AdminDashboard | null>(null);
  usuarios       = signal<AdminUsuarioListado[]>([]);
  historial      = signal<AdminHistorialPrecio[]>([]);
  suscripciones  = signal<AdminSuscripcion[]>([]);
  pagos          = signal<AdminPago[]>([]);

  // Filtros del historial de precios
  filtroOrigen  = signal('');
  filtroDestino = signal('');
  filtroDesde   = signal('');
  filtroHasta   = signal('');

  subTabSuscripciones = signal<'suscripciones' | 'pagos'>('suscripciones');

  mensaje = signal<string | null>(null);

  ngOnInit(): void {
    this.cambiarTab('dashboard');
  }

  cambiarTab(tab: TabAdmin): void {
    this.tabActivo.set(tab);
    this.error.set(null);
    this.mensaje.set(null);
    this.cargarTab(tab);
  }

  private cargarTab(tab: TabAdmin): void {
    this.cargando.set(true);
    switch (tab) {
      case 'dashboard':
        this.adminService.obtenerDashboard().subscribe({
          next: d => { this.dashboard.set(d); this.cargando.set(false); },
          error: err => this.manejarError(err),
        });
        break;
      case 'usuarios':
        this.adminService.listarUsuarios().subscribe({
          next: u => { this.usuarios.set(u); this.cargando.set(false); },
          error: err => this.manejarError(err),
        });
        break;
      case 'historial':
        this.buscarHistorial();
        break;
      case 'suscripciones':
        this.adminService.listarSuscripciones().subscribe({
          next: s => {
            this.suscripciones.set(s);
            this.adminService.listarPagos().subscribe({
              next: p => { this.pagos.set(p); this.cargando.set(false); },
              error: err => this.manejarError(err),
            });
          },
          error: err => this.manejarError(err),
        });
        break;
    }
  }

  buscarHistorial(): void {
    this.cargando.set(true);
    this.adminService.historialPrecios({
      origen: this.filtroOrigen() || undefined,
      destino: this.filtroDestino() || undefined,
      desde: this.filtroDesde() || undefined,
      hasta: this.filtroHasta() || undefined,
    }).subscribe({
      next: h => { this.historial.set(h); this.cargando.set(false); },
      error: err => this.manejarError(err),
    });
  }

  exportarHistorial(): void {
    this.adminService.exportarHistorialPrecios({
      origen: this.filtroOrigen() || undefined,
      destino: this.filtroDestino() || undefined,
      desde: this.filtroDesde() || undefined,
      hasta: this.filtroHasta() || undefined,
    }).subscribe({
      next: blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'historial-precios.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.error.set('No se pudo exportar el historial de precios.'),
    });
  }

  cambiarRolUsuario(usuario: AdminUsuarioListado, nuevoRol: string): void {
    if (nuevoRol === usuario.rol) return;
    this.adminService.cambiarRol(usuario.id, nuevoRol).subscribe({
      next: actualizado => {
        this.usuarios.update(lista => lista.map(u => u.id === actualizado.id ? actualizado : u));
        this.mensaje.set(`Rol de ${actualizado.email} actualizado a ${actualizado.rol}.`);
      },
      error: err => { this.error.set(err.error?.message ?? 'No se pudo cambiar el rol.'); },
    });
  }

  cambiarActivoUsuario(usuario: AdminUsuarioListado): void {
    const nuevoEstado = !usuario.activo;
    this.adminService.cambiarActivo(usuario.id, nuevoEstado).subscribe({
      next: actualizado => {
        this.usuarios.update(lista => lista.map(u => u.id === actualizado.id ? actualizado : u));
        this.mensaje.set(`Cuenta de ${actualizado.email} ${nuevoEstado ? 'activada' : 'desactivada'}.`);
      },
      error: err => { this.error.set(err.error?.message ?? 'No se pudo cambiar el estado de la cuenta.'); },
    });
  }

  private manejarError(err: any): void {
    this.cargando.set(false);
    if (err.status === 403) {
      this.sinPermiso.set(true);
      this.error.set('No tienes permisos de administrador para ver esta sección.');
    } else {
      this.error.set(err.error?.message ?? 'Ocurrió un error al cargar los datos.');
    }
  }

  formatFecha(iso: string | null): string {
    if (!iso) return '—';
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
}
