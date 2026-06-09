import { Component, inject } from '@angular/core';
import { ConfirmModalService } from '../../../core/services/confirm-modal.service';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  templateUrl: './confirm-modal.component.html',
  styleUrl: './confirm-modal.component.scss'
})
export class ConfirmModalComponent {
  svc = inject(ConfirmModalService);
}
