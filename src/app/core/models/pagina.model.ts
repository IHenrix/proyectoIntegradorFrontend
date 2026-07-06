export interface PaginaDTO<T> {
  contenido: T[];
  paginaActual: number;
  totalPaginas: number;
  totalElementos: number;
  tamanoPagina: number;
}
