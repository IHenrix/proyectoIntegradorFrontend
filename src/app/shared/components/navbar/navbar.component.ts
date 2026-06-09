import { Component, inject, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  readonly auth = inject(AuthService);

  readonly rolInfo = computed(() => {
    const r = this.auth.rol();
    if (r === 'admin')           return { label: 'ADMIN',     css: 'badge-admin',   avatar: 'avatar-admin',   badge: true };
    if (r === 'usuario_premium') return { label: '★ PREMIUM', css: 'badge-premium', avatar: 'avatar-premium', badge: true };
    return { label: '', css: '', avatar: 'avatar-free', badge: false };
  });

  readonly inicial = computed(() =>
    (this.auth.nombre() ?? 'U').trim().charAt(0).toUpperCase()
  );
}
