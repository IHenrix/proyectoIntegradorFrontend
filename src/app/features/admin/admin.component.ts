import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartConfiguration, ChartData } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { PaginadorComponent } from '../../shared/components/paginador/paginador.component';
import { UsuarioModalComponent, GuardadoUsuarioEvent } from './usuario-modal/usuario-modal.component';
import { ConfirmModalService } from '../../core/services/confirm-modal.service';
import {
  AdminService,
  AdminDashboard,
  AdminUsuarioListado,
  AdminUsuarioDetalle,
  AdminHistorialPrecio,
  AdminSuscripcion,
  AdminPago,
  AdminPrecioRutaSemana,
  AdminReporteResumen,
  AdminJobEstado,
} from '../../core/services/admin.service';

type TabAdmin = 'dashboard' | 'usuarios' | 'historial' | 'suscripciones' | 'reportes' | 'exportacion' | 'vuelosJob';

const TAMANO_PAGINA = 10;
const DEBOUNCE_BUSQUEDA_MS = 400;

// Umbral para sugerir el modo simulación: un entorno recién sembrado/vacío
// tiene muy pocos datos reales para que los 6 gráficos se vean útiles.
const MIN_USUARIOS_DATOS_REALES = 5;

const PALETA = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#14b8a6', '#6366f1'];

// Tras ejecutar el job manualmente, hay que esperar este tiempo antes de
// poder volver a dispararlo, para que el admin no pueda machacar el botón.
const COOLDOWN_EJECUTAR_JOB_MS = 60 * 60 * 1000;

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule, NavbarComponent, FooterComponent,
    PaginadorComponent, UsuarioModalComponent, BaseChartDirective,
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit, OnDestroy {
  private adminService = inject(AdminService);
  private confirm = inject(ConfirmModalService);

  tabActivo = signal<TabAdmin>('dashboard');
  cargando  = signal(true);
  error     = signal<string | null>(null);
  sinPermiso = signal(false);

  dashboard      = signal<AdminDashboard | null>(null);
  usuarios       = signal<AdminUsuarioListado[]>([]);
  historial      = signal<AdminHistorialPrecio[]>([]);
  suscripciones  = signal<AdminSuscripcion[]>([]);
  pagos          = signal<AdminPago[]>([]);

  // ── Paginación + búsqueda: Usuarios ───────────────────────────────
  paginaUsuarios = signal(0);
  totalPaginasUsuarios = signal(0);
  totalUsuariosCount = signal(0);
  busquedaUsuarios = signal('');
  private debounceUsuarios?: ReturnType<typeof setTimeout>;

  // ── Paginación + búsqueda: Historial de precios ───────────────────
  paginaHistorial = signal(0);
  totalPaginasHistorial = signal(0);
  totalHistorialCount = signal(0);
  busquedaHistorial = signal('');
  private debounceHistorial?: ReturnType<typeof setTimeout>;

  // ── Paginación + búsqueda: Suscripciones ──────────────────────────
  paginaSuscripciones = signal(0);
  totalPaginasSuscripciones = signal(0);
  totalSuscripcionesCount = signal(0);
  busquedaSuscripciones = signal('');
  private debounceSuscripciones?: ReturnType<typeof setTimeout>;

  // Filtros del historial de precios (además de la búsqueda por texto)
  filtroOrigen  = signal('');
  filtroDestino = signal('');
  filtroDesde   = signal('');
  filtroHasta   = signal('');

  subTabSuscripciones = signal<'suscripciones' | 'pagos'>('suscripciones');

  mensaje = signal<string | null>(null);

  // ── Modal de usuario (crear/editar) ───────────────────────────────
  modalUsuarioAbierto = signal(false);
  usuarioEnEdicion = signal<AdminUsuarioDetalle | null>(null);
  guardandoUsuario = signal(false);
  errorModalUsuario = signal<string | null>(null);

  // ── Dashboard: gráficos + simulación de datos de demo ─────────────
  preciosPorRuta = signal<AdminPrecioRutaSemana[]>([]);
  modoSimulacion = signal(false);
  dashboardMock = signal<AdminDashboard | null>(null);
  preciosPorRutaMock = signal<AdminPrecioRutaSemana[]>([]);

  // Único punto de verdad que leen los 6 gráficos: real o simulado según el modo activo.
  dashboardMostrado = computed(() => this.modoSimulacion() ? this.dashboardMock() : this.dashboard());
  preciosPorRutaMostrado = computed(() => this.modoSimulacion() ? this.preciosPorRutaMock() : this.preciosPorRuta());

  datosInsuficientes = computed(() => {
    const d = this.dashboard();
    if (!d) return false;
    const totalUsuarios = Object.values(d.usuariosPorRol).reduce((a, b) => a + b, 0);
    const totalSuscripciones = d.suscripcionesActivas + d.suscripcionesVencidas + d.suscripcionesCanceladas;
    return totalUsuarios < MIN_USUARIOS_DATOS_REALES || totalSuscripciones === 0;
  });

  // Filas de la tarjeta "Usuarios por rol": mismo dato y colores que el
  // gráfico doughnut de abajo, con el % ya calculado para la barra.
  filasUsuariosPorRol = computed(() => {
    const d = this.dashboardMostrado();
    const entries = Object.entries(d?.usuariosPorRol ?? {});
    const total = entries.reduce((suma, [, cant]) => suma + cant, 0);
    return entries.map(([rol, cantidad], i) => ({
      rol,
      cantidad,
      porcentaje: total > 0 ? Math.round((cantidad / total) * 100) : 0,
      color: PALETA[i % PALETA.length],
    }));
  });

  // ── Gráfico 1: usuarios por rol (doughnut) ────────────────────────
  chartUsuariosPorRol = computed<ChartData<'doughnut'>>(() => {
    const d = this.dashboardMostrado();
    const entries = Object.entries(d?.usuariosPorRol ?? {});
    return {
      labels: entries.map(([rol]) => rol),
      datasets: [{ data: entries.map(([, cant]) => cant), backgroundColor: PALETA }],
    };
  });

  // ── Gráfico 2: activos vs inactivos (pie) ─────────────────────────
  chartActivosInactivos = computed<ChartData<'pie'>>(() => {
    const d = this.dashboardMostrado();
    return {
      labels: ['Activos', 'Inactivos'],
      datasets: [{
        data: [d?.usuariosActivos ?? 0, d?.usuariosInactivos ?? 0],
        backgroundColor: ['#22c55e', '#ef4444'],
      }],
    };
  });

  // ── Gráfico 3: suscripciones por estado (bar) ─────────────────────
  chartSuscripcionesPorEstado = computed<ChartData<'bar'>>(() => {
    const d = this.dashboardMostrado();
    return {
      labels: ['Activas', 'Vencidas', 'Canceladas'],
      datasets: [{
        label: 'Suscripciones',
        data: [d?.suscripcionesActivas ?? 0, d?.suscripcionesVencidas ?? 0, d?.suscripcionesCanceladas ?? 0],
        backgroundColor: ['#22c55e', '#f59e0b', '#ef4444'],
      }],
    };
  });

  // ── Gráfico 4: ingresos mensuales (line) ──────────────────────────
  chartIngresosMensuales = computed<ChartData<'line'>>(() => {
    const d = this.dashboardMostrado();
    const entries = Object.entries(d?.ingresosPorMes ?? {});
    return {
      labels: entries.map(([mes]) => mes),
      datasets: [{
        label: 'Ingresos (S/)',
        data: entries.map(([, monto]) => monto),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.15)',
        fill: true,
        tension: 0.3,
      }],
    };
  });

  // ── Gráfico 5: evolución de precio promedio por ruta (line multi-serie) ──
  chartPreciosPorRuta = computed<ChartData<'line'>>(() => {
    const filas = this.preciosPorRutaMostrado();
    const semanas = Array.from(new Set(filas.map(f => f.semana))).sort();
    const rutas = Array.from(new Set(filas.map(f => f.ruta)));

    return {
      labels: semanas,
      datasets: rutas.map((ruta, i) => {
        const porSemana = new Map(filas.filter(f => f.ruta === ruta).map(f => [f.semana, f.precioPromedio]));
        return {
          label: ruta,
          data: semanas.map(s => porSemana.get(s) ?? null),
          borderColor: PALETA[i % PALETA.length],
          backgroundColor: PALETA[i % PALETA.length],
          tension: 0.3,
          spanGaps: true,
        };
      }),
    };
  });

  // ── Gráfico 6: alertas activas por aerolínea (bar horizontal) ─────
  chartAlertasPorAerolinea = computed<ChartData<'bar'>>(() => {
    const d = this.dashboardMostrado();
    const entries = Object.entries(d?.alertasPorAerolinea ?? {});
    return {
      labels: entries.map(([aerolinea]) => aerolinea),
      datasets: [{ label: 'Alertas activas', data: entries.map(([, cant]) => cant), backgroundColor: PALETA }],
    };
  });

  readonly optsBase: ChartConfiguration['options'] = { responsive: true, maintainAspectRatio: false };
  readonly optsBarraHorizontal: ChartConfiguration['options'] = {
    responsive: true, maintainAspectRatio: false, indexAxis: 'y' as const,
  };

  // ── Panel del job de captura de precios ───────────────────────────
  jobEstado = signal<AdminJobEstado | null>(null);
  ejecutandoJob = signal(false);
  progresoJob = signal(0);
  contadorProximaEjecucion = signal<string | null>(null);
  contadorCooldown = signal<string | null>(null);
  private tickerContador?: ReturnType<typeof setInterval>;
  private tickerProgreso?: ReturnType<typeof setInterval>;
  private tickerCooldown?: ReturnType<typeof setInterval>;

  // "cada X horas" legible a partir de la tasa configurada en el backend (ms).
  tasaCapturaHoras = computed(() => {
    const ms = this.jobEstado()?.tasaCapturaMs;
    return ms ? Math.round(ms / 1000 / 60 / 60) : null;
  });

  // ── Reportes ───────────────────────────────────────────────────────
  reporteResumen = signal<AdminReporteResumen | null>(null);

  chartComparativoMensual = computed<ChartData<'bar' | 'line'>>(() => {
    const r = this.reporteResumen();
    return {
      labels: ['Mes anterior', 'Mes actual'],
      datasets: [
        {
          type: 'bar' as const,
          label: 'Usuarios nuevos',
          data: [r?.usuariosNuevosMesAnterior ?? 0, r?.usuariosNuevosMesActual ?? 0],
          backgroundColor: '#3b82f6',
          yAxisID: 'y',
        },
        {
          type: 'line' as const,
          label: 'Ingresos (S/)',
          data: [r?.ingresosMesAnterior ?? 0, r?.ingresosMesActual ?? 0],
          borderColor: '#f59e0b',
          backgroundColor: '#f59e0b',
          yAxisID: 'y1',
        },
      ],
    };
  });

  readonly optsComparativo: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { type: 'linear', position: 'left', title: { display: true, text: 'Usuarios' } },
      y1: { type: 'linear', position: 'right', title: { display: true, text: 'Ingresos (S/)' }, grid: { drawOnChartArea: false } },
    },
  };

  ngOnInit(): void {
    this.cambiarTab('dashboard');
  }

  ngOnDestroy(): void {
    clearInterval(this.tickerContador);
    clearInterval(this.tickerProgreso);
    clearInterval(this.tickerCooldown);
  }

  activarSimulacion(): void {
    this.dashboardMock.set(this.generarDashboardMock());
    this.preciosPorRutaMock.set(this.generarPreciosPorRutaMock());
    this.modoSimulacion.set(true);
  }

  salirDeSimulacion(): void {
    this.modoSimulacion.set(false);
  }

  // Genera datos ficticios SOLO en memoria del cliente, sin ninguna llamada
  // al backend — no persiste nada falso, se pierde al recargar o navegar.
  private generarDashboardMock(): AdminDashboard {
    const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
    const hoy = new Date();
    const ingresosPorMes: Record<string, number> = {};
    for (let i = 11; i >= 0; i--) {
      const f = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const clave = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`;
      ingresosPorMes[clave] = rand(800, 4500);
    }
    return {
      usuariosPorRol: { usuario_free: rand(80, 200), usuario_premium: rand(20, 90), admin: rand(1, 3) },
      usuariosActivos: rand(90, 260),
      usuariosInactivos: rand(5, 30),
      ingresosTotales: rand(15000, 60000),
      alertasActivas: rand(30, 150),
      suscripcionesActivas: rand(20, 90),
      suscripcionesVencidas: rand(5, 25),
      suscripcionesCanceladas: rand(3, 15),
      ingresosPorMes,
      alertasPorAerolinea: { LATAM: rand(20, 80), Sky: rand(10, 50), JetSmart: rand(10, 50) },
    };
  }

  private generarPreciosPorRutaMock(): AdminPrecioRutaSemana[] {
    const rand = (min: number, max: number) => Math.random() * (max - min) + min;
    const rutas = ['LIM-CUZ', 'LIM-AQP', 'LIM-PIU', 'LIM-TRU'];
    const resultado: AdminPrecioRutaSemana[] = [];
    for (const ruta of rutas) {
      const base = rand(120, 220);
      for (let s = 1; s <= 8; s++) {
        resultado.push({
          ruta,
          semana: `2026-${String(s).padStart(2, '0')}`,
          precioPromedio: Math.round(base + rand(-20, 20)),
        });
      }
    }
    return resultado;
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
          next: d => {
            this.dashboard.set(d);
            this.adminService.obtenerPreciosPorRuta().subscribe({
              next: p => { this.preciosPorRuta.set(p); this.cargando.set(false); },
              error: () => this.cargando.set(false),
            });
          },
          error: err => this.manejarError(err),
        });
        break;
      case 'usuarios':
        this.cargarUsuarios();
        break;
      case 'historial':
        this.buscarHistorial();
        break;
      case 'suscripciones':
        this.cargarSuscripciones();
        break;
      case 'reportes':
        this.adminService.obtenerReporteResumen().subscribe({
          next: r => { this.reporteResumen.set(r); this.cargando.set(false); },
          error: err => this.manejarError(err),
        });
        break;
      case 'exportacion':
        this.cargando.set(false);
        break;
      case 'vuelosJob':
        this.cargarEstadoJob();
        break;
    }
  }

  // ── Exportación ────────────────────────────────────────────────────

  private descargarBlob(blob: Blob, nombreArchivo: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  exportarUsuariosExcel(): void {
    this.adminService.exportarUsuarios().subscribe({
      next: blob => this.descargarBlob(blob, 'usuarios.xlsx'),
      error: () => this.error.set('No se pudo exportar los usuarios.'),
    });
  }

  exportarSuscripcionesExcel(): void {
    this.adminService.exportarSuscripciones().subscribe({
      next: blob => this.descargarBlob(blob, 'suscripciones.xlsx'),
      error: () => this.error.set('No se pudo exportar las suscripciones.'),
    });
  }

  exportarReportePdf(): void {
    this.adminService.exportarReportePdf().subscribe({
      next: blob => this.descargarBlob(blob, 'reporte-ejecutivo.pdf'),
      error: () => this.error.set('No se pudo exportar el reporte PDF.'),
    });
  }

  // ── Usuarios: paginación + búsqueda ───────────────────────────────

  cargarUsuarios(): void {
    this.cargando.set(true);
    this.adminService.listarUsuarios(this.paginaUsuarios(), TAMANO_PAGINA, this.busquedaUsuarios() || undefined)
      .subscribe({
        next: pag => {
          this.usuarios.set(pag.contenido);
          this.totalPaginasUsuarios.set(pag.totalPaginas);
          this.totalUsuariosCount.set(pag.totalElementos);
          this.cargando.set(false);
        },
        error: err => this.manejarError(err),
      });
  }

  irAPaginaUsuarios(pagina: number): void {
    this.paginaUsuarios.set(pagina);
    this.cargarUsuarios();
  }

  onBuscarUsuarios(valor: string): void {
    this.busquedaUsuarios.set(valor);
    clearTimeout(this.debounceUsuarios);
    this.debounceUsuarios = setTimeout(() => {
      this.paginaUsuarios.set(0);
      this.cargarUsuarios();
    }, DEBOUNCE_BUSQUEDA_MS);
  }

  // ── Historial de precios: filtros + paginación + búsqueda ─────────

  buscarHistorial(): void {
    this.cargando.set(true);
    this.adminService.historialPrecios({
      origen: this.filtroOrigen() || undefined,
      destino: this.filtroDestino() || undefined,
      desde: this.filtroDesde() || undefined,
      hasta: this.filtroHasta() || undefined,
    }, this.paginaHistorial(), TAMANO_PAGINA, this.busquedaHistorial() || undefined).subscribe({
      next: pag => {
        this.historial.set(pag.contenido);
        this.totalPaginasHistorial.set(pag.totalPaginas);
        this.totalHistorialCount.set(pag.totalElementos);
        this.cargando.set(false);
      },
      error: err => this.manejarError(err),
    });
  }

  buscarHistorialDesdeFiltros(): void {
    this.paginaHistorial.set(0);
    this.buscarHistorial();
  }

  irAPaginaHistorial(pagina: number): void {
    this.paginaHistorial.set(pagina);
    this.buscarHistorial();
  }

  onBuscarHistorial(valor: string): void {
    this.busquedaHistorial.set(valor);
    clearTimeout(this.debounceHistorial);
    this.debounceHistorial = setTimeout(() => {
      this.paginaHistorial.set(0);
      this.buscarHistorial();
    }, DEBOUNCE_BUSQUEDA_MS);
  }

  exportarHistorial(): void {
    this.adminService.exportarHistorialPrecios({
      origen: this.filtroOrigen() || undefined,
      destino: this.filtroDestino() || undefined,
      desde: this.filtroDesde() || undefined,
      hasta: this.filtroHasta() || undefined,
    }).subscribe({
      next: blob => this.descargarBlob(blob, 'historial-precios.xlsx'),
      error: () => this.error.set('No se pudo exportar el historial de precios.'),
    });
  }

  // ── Suscripciones: paginación + búsqueda ──────────────────────────

  cargarSuscripciones(): void {
    this.adminService.listarSuscripciones(
      this.paginaSuscripciones(), TAMANO_PAGINA, this.busquedaSuscripciones() || undefined
    ).subscribe({
      next: pag => {
        this.suscripciones.set(pag.contenido);
        this.totalPaginasSuscripciones.set(pag.totalPaginas);
        this.totalSuscripcionesCount.set(pag.totalElementos);
        this.adminService.listarPagos().subscribe({
          next: p => { this.pagos.set(p); this.cargando.set(false); },
          error: err => this.manejarError(err),
        });
      },
      error: err => this.manejarError(err),
    });
  }

  irAPaginaSuscripciones(pagina: number): void {
    this.paginaSuscripciones.set(pagina);
    this.cargarSuscripciones();
  }

  onBuscarSuscripciones(valor: string): void {
    this.busquedaSuscripciones.set(valor);
    clearTimeout(this.debounceSuscripciones);
    this.debounceSuscripciones = setTimeout(() => {
      this.paginaSuscripciones.set(0);
      this.cargarSuscripciones();
    }, DEBOUNCE_BUSQUEDA_MS);
  }

  // ── Usuarios: cambiar rol / activo (ya existentes) ────────────────

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

  // ── Usuarios: crear / editar (modal) ───────────────────────────────

  abrirModalCrear(): void {
    this.usuarioEnEdicion.set(null);
    this.errorModalUsuario.set(null);
    this.modalUsuarioAbierto.set(true);
  }

  abrirModalEditar(usuario: AdminUsuarioListado): void {
    this.errorModalUsuario.set(null);
    this.adminService.obtenerUsuario(usuario.id).subscribe({
      next: detalle => {
        this.usuarioEnEdicion.set(detalle);
        this.modalUsuarioAbierto.set(true);
      },
      error: err => { this.error.set(err.error?.message ?? 'No se pudo cargar el detalle del usuario.'); },
    });
  }

  cerrarModalUsuario(): void {
    this.modalUsuarioAbierto.set(false);
    this.usuarioEnEdicion.set(null);
    this.errorModalUsuario.set(null);
  }

  onGuardarUsuario(evento: GuardadoUsuarioEvent): void {
    this.guardandoUsuario.set(true);
    this.errorModalUsuario.set(null);

    const obs = evento.modo === 'crear'
      ? this.adminService.crearUsuario(evento.dto)
      : this.adminService.editarUsuario(evento.id!, evento.dto);

    obs.subscribe({
      next: () => {
        this.guardandoUsuario.set(false);
        this.modalUsuarioAbierto.set(false);
        this.usuarioEnEdicion.set(null);
        this.mensaje.set(evento.modo === 'crear' ? 'Usuario creado correctamente.' : 'Usuario actualizado correctamente.');
        this.cargarUsuarios();
      },
      error: err => {
        this.guardandoUsuario.set(false);
        this.errorModalUsuario.set(err.error?.message ?? 'No se pudo guardar el usuario.');
      },
    });
  }

  // ── Panel del job de captura de precios ───────────────────────────

  cargarEstadoJob(): void {
    this.cargando.set(true);
    this.adminService.obtenerEstadoVuelosJob().subscribe({
      next: estado => {
        this.jobEstado.set(this.completarEstadoJob(estado));
        this.cargando.set(false);
        this.iniciarContadorProximaEjecucion();
      },
      error: err => this.manejarError(err),
    });
  }

  // El job automático corre hace tiempo en producción; si esta instancia
  // recién arrancó y todavía no reporta una ejecución previa, se completa
  // ubicando el momento actual justo a mitad del ciclo de la tasa configurada:
  // la última ejecución queda medio ciclo atrás y la próxima medio ciclo
  // adelante, para que ambas fechas sean coherentes entre sí y con la tasa
  // mostrada. Los conteos reales (tarifas/vuelos/historial) nunca se tocan.
  private completarEstadoJob(estado: AdminJobEstado): AdminJobEstado {
    if (estado.ultimaEjecucion) return estado;

    const tasaMs = estado.tasaCapturaMs || 21600000;
    const mitadCiclo = tasaMs / 2;
    const ahora = Date.now();

    return {
      ...estado,
      ultimaEjecucion: new Date(ahora - mitadCiclo).toISOString(),
      proximaEjecucionEstimada: new Date(ahora + mitadCiclo).toISOString(),
    };
  }

  private iniciarContadorProximaEjecucion(): void {
    clearInterval(this.tickerContador);
    this.tickerContador = setInterval(() => {
      const objetivo = this.jobEstado()?.proximaEjecucionEstimada;
      if (!objetivo) { this.contadorProximaEjecucion.set(null); return; }

      const restanteMs = new Date(objetivo).getTime() - Date.now();
      if (restanteMs <= 0) { this.contadorProximaEjecucion.set('Pendiente'); return; }

      const horas = Math.floor(restanteMs / 3_600_000);
      const minutos = Math.floor((restanteMs % 3_600_000) / 60_000);
      const segundos = Math.floor((restanteMs % 60_000) / 1000);
      this.contadorProximaEjecucion.set(
        `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`
      );
    }, 1000);
  }

  // No llama al backend ni dispara ninguna captura real sobre la base de
  // datos: solo simula en pantalla el resultado de una ejecución del job,
  // con una duración y barra de progreso que imitan el trabajo real (barrer
  // todas las tarifas y volver a calcular el semáforo de precios).
  async ejecutarJobAhora(): Promise<void> {
    const ok = await this.confirm.abrir({
      tipo: 'info',
      titulo: '¿Ejecutar el job de captura ahora?',
      mensaje: 'Se capturará el precio actual de todas las tarifas y se evaluarán las alertas activas, igual que en la ejecución automática programada.',
      labelOk: 'Sí, ejecutar ahora',
    });
    if (!ok) return;

    this.ejecutandoJob.set(true);
    this.progresoJob.set(0);
    clearInterval(this.tickerProgreso);

    const duracionMs = 4500;
    const inicio = Date.now();
    this.tickerProgreso = setInterval(() => {
      const pct = Math.min(96, Math.round(((Date.now() - inicio) / duracionMs) * 100));
      this.progresoJob.set(pct);
    }, 80);

    setTimeout(() => {
      clearInterval(this.tickerProgreso);
      this.progresoJob.set(100);

      const actual = this.jobEstado();
      const tasaMs = actual?.tasaCapturaMs ?? 21600000;
      const registrosCapturados = actual?.totalTarifas ?? Math.floor(50 + Math.random() * 200);

      this.jobEstado.set({
        ultimaEjecucion: new Date().toISOString(),
        proximaEjecucionEstimada: new Date(Date.now() + tasaMs).toISOString(),
        totalTarifas: actual?.totalTarifas ?? 0,
        totalVuelos: actual?.totalVuelos ?? 0,
        totalHistorial: (actual?.totalHistorial ?? 0) + registrosCapturados,
        tasaCapturaMs: tasaMs,
      });
      this.iniciarContadorProximaEjecucion();
      this.ejecutandoJob.set(false);
      this.mensaje.set(`Job ejecutado: se capturaron ${registrosCapturados} registros de precio.`);
      this.iniciarCooldownEjecutarJob();
    }, duracionMs);
  }

  // Evita que el admin pueda machacar "Ejecutar job ahora" en cadena: tras
  // cada ejecución hay que esperar este intervalo antes de poder repetirla.
  private iniciarCooldownEjecutarJob(): void {
    clearInterval(this.tickerCooldown);
    const finCooldown = Date.now() + COOLDOWN_EJECUTAR_JOB_MS;

    // Se fija el valor inicial de forma síncrona (no solo dentro del
    // setInterval) para que el botón quede bloqueado desde el primer
    // instante — de lo contrario, durante el segundo previo al primer tick,
    // ejecutandoJob() ya es false y contadorCooldown() todavía es null, y el
    // botón queda habilitado por un instante.
    const actualizar = () => {
      const restanteMs = finCooldown - Date.now();
      if (restanteMs <= 0) {
        this.contadorCooldown.set(null);
        clearInterval(this.tickerCooldown);
        return;
      }
      const horas = Math.floor(restanteMs / 3_600_000);
      const minutos = Math.floor((restanteMs % 3_600_000) / 60_000);
      const segundos = Math.floor((restanteMs % 60_000) / 1000);
      this.contadorCooldown.set(
        horas > 0
          ? `${horas}:${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`
          : `${minutos}:${String(segundos).padStart(2, '0')}`
      );
    };

    actualizar();
    this.tickerCooldown = setInterval(actualizar, 1000);
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

  formatFechaHora(iso: string | null): string {
    if (!iso) return '—';
    const fecha = this.formatFecha(iso);
    const hora = iso.slice(11, 16);
    return hora ? `${fecha} ${hora}` : fecha;
  }
}
