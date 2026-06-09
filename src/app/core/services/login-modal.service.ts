import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoginModalService {
  abierto = signal(false);
  abrir():  void { this.abierto.set(true);  }
  cerrar(): void { this.abierto.set(false); }
}
