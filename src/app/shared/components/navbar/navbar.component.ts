import { Component, inject, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AlertaService } from '../../../core/services/alerta.service';
import { UpgradeModalService } from '../../../core/services/upgrade-modal.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  readonly auth          = inject(AuthService);
  readonly alertaService = inject(AlertaService);
  readonly upgradeModal  = inject(UpgradeModalService);

  verMiPlan(): void {
    this.upgradeModal.abrir('resumen');
  }

  readonly alertaBadge = computed(() => {
    const n = this.alertaService.alertas().length;
    if (n === 0) return null;
    return n >= 10 ? '9+' : String(n);
  });

  readonly rolInfo = computed(() => {
    const r = this.auth.rol();
    if (r === 'admin')           return { label: 'ADMIN',     css: 'badge-admin',   avatar: 'avatar-admin',   badge: true };
    if (r === 'usuario_premium') return { label: '★ PREMIUM', css: 'badge-premium', avatar: 'avatar-premium', badge: true };
    return { label: 'BÁSICO', css: 'badge-free', avatar: 'avatar-free', badge: true };
  });

  readonly inicial = computed(() =>
    (this.auth.nombre() ?? 'U').trim().charAt(0).toUpperCase()
  );
}
