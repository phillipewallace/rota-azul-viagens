/**
 * Lista curada de fusos horários (IANA).
 * Inclui todos os fusos oficiais do Brasil + principais do mundo.
 */
export interface TimezoneOption {
  value: string;   // IANA
  label: string;   // Cidade / região
  offset: string;  // UTC offset resumido
  group: 'Brasil' | 'Américas' | 'Europa' | 'África' | 'Ásia' | 'Oceania' | 'UTC';
}

export const TIMEZONES: TimezoneOption[] = [
  // ============ BRASIL (Portaria MTP 671/2021) ============
  { value: 'America/Noronha',       label: 'Fernando de Noronha',                offset: 'UTC−02:00', group: 'Brasil' },
  { value: 'America/Sao_Paulo',     label: 'Brasília, São Paulo, Rio, Sul/SE',   offset: 'UTC−03:00', group: 'Brasil' },
  { value: 'America/Bahia',         label: 'Salvador (BA)',                      offset: 'UTC−03:00', group: 'Brasil' },
  { value: 'America/Fortaleza',     label: 'Fortaleza (CE, PI, MA, RN, PB, PE, AL, SE)', offset: 'UTC−03:00', group: 'Brasil' },
  { value: 'America/Belem',         label: 'Belém (PA leste, AP)',               offset: 'UTC−03:00', group: 'Brasil' },
  { value: 'America/Araguaina',     label: 'Araguaína (TO)',                     offset: 'UTC−03:00', group: 'Brasil' },
  { value: 'America/Maceio',        label: 'Maceió (AL)',                        offset: 'UTC−03:00', group: 'Brasil' },
  { value: 'America/Recife',        label: 'Recife (PE)',                        offset: 'UTC−03:00', group: 'Brasil' },
  { value: 'America/Santarem',      label: 'Santarém (PA oeste)',                offset: 'UTC−03:00', group: 'Brasil' },
  { value: 'America/Manaus',        label: 'Manaus (AM leste, RR, RO, MT, MS)',  offset: 'UTC−04:00', group: 'Brasil' },
  { value: 'America/Cuiaba',        label: 'Cuiabá (MT)',                        offset: 'UTC−04:00', group: 'Brasil' },
  { value: 'America/Campo_Grande',  label: 'Campo Grande (MS)',                  offset: 'UTC−04:00', group: 'Brasil' },
  { value: 'America/Porto_Velho',   label: 'Porto Velho (RO)',                   offset: 'UTC−04:00', group: 'Brasil' },
  { value: 'America/Boa_Vista',     label: 'Boa Vista (RR)',                     offset: 'UTC−04:00', group: 'Brasil' },
  { value: 'America/Rio_Branco',    label: 'Rio Branco (AC, AM oeste)',          offset: 'UTC−05:00', group: 'Brasil' },
  { value: 'America/Eirunepe',      label: 'Eirunepé (AM oeste)',                offset: 'UTC−05:00', group: 'Brasil' },

  // ============ UTC ============
  { value: 'UTC', label: 'UTC (Coordenado)', offset: 'UTC±00:00', group: 'UTC' },

  // ============ AMÉRICAS ============
  { value: 'America/New_York',     label: 'Nova York',            offset: 'UTC−05:00', group: 'Américas' },
  { value: 'America/Chicago',      label: 'Chicago',              offset: 'UTC−06:00', group: 'Américas' },
  { value: 'America/Denver',       label: 'Denver',               offset: 'UTC−07:00', group: 'Américas' },
  { value: 'America/Los_Angeles',  label: 'Los Angeles',          offset: 'UTC−08:00', group: 'Américas' },
  { value: 'America/Toronto',      label: 'Toronto',              offset: 'UTC−05:00', group: 'Américas' },
  { value: 'America/Mexico_City',  label: 'Cidade do México',     offset: 'UTC−06:00', group: 'Américas' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires',         offset: 'UTC−03:00', group: 'Américas' },
  { value: 'America/Santiago',     label: 'Santiago',             offset: 'UTC−04:00', group: 'Américas' },
  { value: 'America/Lima',         label: 'Lima',                 offset: 'UTC−05:00', group: 'Américas' },
  { value: 'America/Bogota',       label: 'Bogotá',               offset: 'UTC−05:00', group: 'Américas' },
  { value: 'America/Caracas',      label: 'Caracas',              offset: 'UTC−04:00', group: 'Américas' },
  { value: 'America/Montevideo',   label: 'Montevidéu',           offset: 'UTC−03:00', group: 'Américas' },
  { value: 'America/Asuncion',     label: 'Assunção',             offset: 'UTC−04:00', group: 'Américas' },

  // ============ EUROPA ============
  { value: 'Europe/Lisbon',    label: 'Lisboa',      offset: 'UTC±00:00', group: 'Europa' },
  { value: 'Europe/London',    label: 'Londres',     offset: 'UTC±00:00', group: 'Europa' },
  { value: 'Europe/Madrid',    label: 'Madrid',      offset: 'UTC+01:00', group: 'Europa' },
  { value: 'Europe/Paris',     label: 'Paris',       offset: 'UTC+01:00', group: 'Europa' },
  { value: 'Europe/Berlin',    label: 'Berlim',      offset: 'UTC+01:00', group: 'Europa' },
  { value: 'Europe/Rome',      label: 'Roma',        offset: 'UTC+01:00', group: 'Europa' },
  { value: 'Europe/Amsterdam', label: 'Amsterdã',    offset: 'UTC+01:00', group: 'Europa' },
  { value: 'Europe/Moscow',    label: 'Moscou',      offset: 'UTC+03:00', group: 'Europa' },

  // ============ ÁFRICA ============
  { value: 'Africa/Luanda',       label: 'Luanda',        offset: 'UTC+01:00', group: 'África' },
  { value: 'Africa/Johannesburg', label: 'Joanesburgo',   offset: 'UTC+02:00', group: 'África' },
  { value: 'Africa/Cairo',        label: 'Cairo',         offset: 'UTC+02:00', group: 'África' },

  // ============ ÁSIA ============
  { value: 'Asia/Dubai',    label: 'Dubai',           offset: 'UTC+04:00', group: 'Ásia' },
  { value: 'Asia/Tokyo',    label: 'Tóquio',          offset: 'UTC+09:00', group: 'Ásia' },
  { value: 'Asia/Shanghai', label: 'Xangai/Pequim',   offset: 'UTC+08:00', group: 'Ásia' },
  { value: 'Asia/Kolkata',  label: 'Índia (Calcutá)', offset: 'UTC+05:30', group: 'Ásia' },
  { value: 'Asia/Singapore',label: 'Singapura',       offset: 'UTC+08:00', group: 'Ásia' },

  // ============ OCEANIA ============
  { value: 'Australia/Sydney', label: 'Sydney',    offset: 'UTC+10:00', group: 'Oceania' },
  { value: 'Pacific/Auckland', label: 'Auckland',  offset: 'UTC+12:00', group: 'Oceania' },
];

export const TIMEZONE_GROUPS: TimezoneOption['group'][] = [
  'Brasil', 'UTC', 'Américas', 'Europa', 'África', 'Ásia', 'Oceania',
];
