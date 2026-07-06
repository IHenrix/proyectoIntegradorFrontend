import { Component, input, output, computed } from '@angular/core';

@Component({
  selector: 'app-paginador',
  standalone: true,
  templateUrl: './paginador.component.html',
  styleUrl: './paginador.component.scss'
})
export class PaginadorComponent {
  // paginaActual/totalPaginas son 0-based, tal como los devuelve PaginaDTO del backend.
  paginaActual = input.required<number>();
  totalPaginas = input.required<number>();
  totalElementos = input<number>(0);

  cambio = output<number>();

  private readonly VENTANA = 5;

  paginasVisibles = computed(() => {
    const total = this.totalPaginas();
    const actual = this.paginaActual();
    if (total <= 0) return [];
    let inicio = Math.max(0, actual - Math.floor(this.VENTANA / 2));
    let fin = Math.min(total, inicio + this.VENTANA);
    inicio = Math.max(0, fin - this.VENTANA);
    return Array.from({ length: fin - inicio }, (_, i) => inicio + i);
  });

  ir(pagina: number): void {
    if (pagina < 0 || pagina >= this.totalPaginas() || pagina === this.paginaActual()) return;
    this.cambio.emit(pagina);
  }
}
