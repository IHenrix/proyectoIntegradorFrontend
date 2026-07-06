import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UpgradeModalComponent } from './shared/components/upgrade-modal/upgrade-modal.component';
import { ConfirmModalComponent } from './shared/components/confirm-modal/confirm-modal.component';
import { LoginModalComponent } from './shared/components/login-modal/login-modal.component';
import { AuthService } from './core/services/auth.service';
import { AlertaService } from './core/services/alerta.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, UpgradeModalComponent, ConfirmModalComponent, LoginModalComponent],
  template: `<router-outlet /><app-upgrade-modal /><app-confirm-modal /><app-login-modal />`
})
export class App {
  private auth = inject(AuthService);
  private alertaService = inject(AlertaService);

  constructor() {
    // El componente raíz se monta primero en cada F5, sin importar la ruta,
    // así el badge de alertas del navbar queda listo antes de que se pinte.
    // El admin no es pasajero: no tiene alertas ni badge que precargar.
    if (this.auth.estaAutenticado() && this.auth.rol() !== 'admin') {
      this.alertaService.precargar();
    }
  }
}
