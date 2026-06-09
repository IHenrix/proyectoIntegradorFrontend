export interface Vuelo {
  id:                   number;
  aerolinea:            string;
  origen:               string;
  destino:              string;
  fecha:                string;
  horaSalida:           string;
  horaLlegada:          string;
  duracion:             string;
  precio:               number;
  tipoTarifa:           string;
  incluyeEquipaje:      boolean;
  equipajeBodegaKg:     number;
  equipajeManoKg:       number;
  permiteReembolso:     boolean;
  asientoSeleccionable: boolean;
  semaforo:             'verde' | 'amarillo' | 'rojo';
  urlAerolinea:         string;
}

export interface BusquedaParams {
  origen:       string;
  destino:      string;
  fecha:        string;
  pasajeros:    number;
  fechaVuelta?: string;
  tipo?:        'ida' | 'idavuelta';
}

export interface PrecioPunto {
  fecha: string;
  precio: number;
}

export interface PrediccionPunto {
  fecha: string;
  precioEstimado: number;
}

export interface VueloDetalle {
  idTarifa: number;
  idVuelo: number;
  aerolinea: string;
  origen: string;
  destino: string;
  fecha: string;
  horaSalida: string;
  horaLlegada: string;
  duracion: string;
  precioActual: number;
  tipoTarifa: string;
  incluyeEquipaje: boolean;
  equipajeBodegaKg: number;
  equipajeManoKg: number;
  permiteReembolso: boolean;
  asientoSeleccionable: boolean;
  semaforo: 'verde' | 'amarillo' | 'rojo';
  urlAerolinea: string;
  historico: PrecioPunto[];
  prediccion: PrediccionPunto[];
  recomendacion: string;
}
