export interface Vuelo {
  id:              number;
  aerolinea:       'LATAM' | 'Sky' | 'JetSmart';
  origen:          string;
  destino:         string;
  fecha:           string;
  horaSalida:      string;
  horaLlegada:     string;
  duracion:        string;
  precio:          number;
  tipoTarifa:      string;
  incluyeEquipaje: boolean;
  semaforo:        'verde' | 'amarillo' | 'rojo';
}

export interface BusquedaParams {
  origen:    string;
  destino:   string;
  fecha:     string;
  pasajeros: number;
}

export const AEROPUERTOS = [
  { code: 'LIM', ciudad: 'Lima',     nombre: 'Jorge Chávez' },
  { code: 'CUZ', ciudad: 'Cusco',    nombre: 'Velasco Astete' },
  { code: 'AQP', ciudad: 'Arequipa', nombre: 'Rodríguez Ballón' },
  { code: 'PIU', ciudad: 'Piura',    nombre: 'Guillermo Concha' },
];
