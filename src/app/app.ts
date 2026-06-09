import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UpgradeModalComponent } from './shared/components/upgrade-modal/upgrade-modal.component';
import { ConfirmModalComponent } from './shared/components/confirm-modal/confirm-modal.component';
import { LoginModalComponent } from './shared/components/login-modal/login-modal.component';
import { PaymentModalComponent } from './shared/components/payment-modal/payment-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, UpgradeModalComponent, ConfirmModalComponent, LoginModalComponent, PaymentModalComponent],
  template: `<router-outlet /><app-upgrade-modal /><app-confirm-modal /><app-login-modal /><app-payment-modal />`
})
export class App {}
