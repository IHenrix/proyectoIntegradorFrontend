export interface Alerta {
  id: number;
  tarifaId: number | null;
  idVuelo: number;
  aerolinea: string;
  origen: string;
  destino: string;
  fecha: string;
  horaSalida: string;
  tipoTarifa: string;
  precioObjetivo: number;
  precioActual: number | null;
  telefono: string;
  activa: boolean;
  fechaCreacion: string;
  estado: string;
}

export interface CrearAlertaRequest {
  tarifaId?: number;
  origen?: string;
  destino?: string;
  fecha?: string;
  tipoTarifa?: string;
  precioObjetivo: number;
  telefono: string;
}
