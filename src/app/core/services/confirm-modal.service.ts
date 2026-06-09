import { Injectable, signal } from '@angular/core';

export type ConfirmModalType = 'danger' | 'warning' | 'info';

export interface ConfirmModalConfig {
  tipo:    ConfirmModalType;
  titulo:  string;
  mensaje: string;
  labelOk:     string;
  labelCancel: string;
}

@Injectable({ providedIn: 'root' })
export class ConfirmModalService {
  abierto = signal(false);
  config  = signal<ConfirmModalConfig>({
    tipo: 'danger', titulo: '', mensaje: '', labelOk: 'Confirmar', labelCancel: 'Cancelar'
  });

  private resolveFn?: (ok: boolean) => void;

  abrir(cfg: Partial<ConfirmModalConfig> & { titulo: string; mensaje: string }): Promise<boolean> {
    this.config.set({
      tipo:        cfg.tipo        ?? 'danger',
      titulo:      cfg.titulo,
      mensaje:     cfg.mensaje,
      labelOk:     cfg.labelOk     ?? 'Confirmar',
      labelCancel: cfg.labelCancel ?? 'Cancelar',
    });
    this.abierto.set(true);
    return new Promise(resolve => { this.resolveFn = resolve; });
  }

  responder(ok: boolean): void {
    this.abierto.set(false);
    this.resolveFn?.(ok);
    this.resolveFn = undefined;
  }
}
