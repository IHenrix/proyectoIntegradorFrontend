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

