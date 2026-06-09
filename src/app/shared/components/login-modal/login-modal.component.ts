import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LoginModalService } from '../../../core/services/login-modal.service';

@Component({
  selector: 'app-login-modal',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './login-modal.component.html',
  styleUrl: './login-modal.component.scss'
})
export class LoginModalComponent {
  svc = inject(LoginModalService);
}
