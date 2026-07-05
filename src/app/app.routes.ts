import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'auth',
    loadComponent: () =>
      import('./features/auth/auth.component').then(m => m.AuthComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'resultados',
    loadComponent: () =>
      import('./features/resultados/resultados.component').then(m => m.ResultadosComponent)
  },
  {
    path: 'detalle/:id',
    loadComponent: () =>
      import('./features/detalle/detalle.component').then(m => m.DetalleComponent)
  },
  {
    path: 'alertas',
    loadComponent: () =>
      import('./features/alertas/alertas.component').then(m => m.AlertasComponent),
    canActivate: [authGuard]
  },
  {
    path: 'perfil',
    loadComponent: () =>
      import('./features/perfil/perfil.component').then(m => m.PerfilComponent),
    canActivate: [authGuard]
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./features/admin/admin.component').then(m => m.AdminComponent),
    canActivate: [authGuard]
  },
  { path: '**', redirectTo: '' }
];
