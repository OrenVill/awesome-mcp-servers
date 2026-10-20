/** OpenSky state vector: see https://openskynetwork.github.io/opensky-api/rest.html */
export type OpenSkyStateVector = [
  string | null, // 0 icao24
  string | null, // 1 callsign
  string | null, // 2 origin_country
  number | null, // 3 time_position
  number | null, // 4 last_contact
  number | null, // 5 longitude
  number | null, // 6 latitude
  number | null, // 7 baro_altitude
  boolean | null, // 8 on_ground
  number | null, // 9 velocity
  number | null, // 10 true_track
  number | null, // 11 vertical_rate
  number[] | null, // 12 sensors
  number | null, // 13 geo_altitude
  string | null, // 14 squawk
  boolean | null, // 15 spi
  number | null // 16 position_source
];

export interface OpenSkyStatesResponse {
  time: number;
  states: OpenSkyStateVector[] | null;
}

export interface OpenSkyTrackResponse {
  icao24: string;
  callsign: string | null;
  startTime: number;
  endTime: number;
  path: Array<[number, number, number, number, number, boolean]>;
}

export interface OpenSkyArrivalFlight {
  icao24: string;
  firstSeen: number;
  estDepartureAirport: string | null;
  lastSeen: number;
  estArrivalAirport: string | null;
  callsign: string | null;
  estDepartureAirportHorizDistance?: number | null;
  estDepartureAirportVertDistance?: number | null;
  estArrivalAirportHorizDistance?: number | null;
  estArrivalAirportVertDistance?: number | null;
  departureAirportCandidatesCount?: number;
  arrivalAirportCandidatesCount?: number;
}

export class OpenSkyService {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options?: { baseUrl?: string; timeout?: number }) {
    this.baseUrl = options?.baseUrl ?? 'https://opensky-network.org/api';
    this.timeout = options?.timeout ?? 20000;
  }

  async getAllStates(icao24?: string[]): Promise<OpenSkyStatesResponse> {
    const url = new URL(`${this.baseUrl}/states/all`);
    if (icao24 && icao24.length > 0) {
      for (const id of icao24) {
        url.searchParams.append('icao24', id.toLowerCase());
      }
    }
    return this.fetchJson<OpenSkyStatesResponse>(url.toString());
  }

  async getFlightTrack(icao24: string, time: number): Promise<OpenSkyTrackResponse> {
    const url = new URL(`${this.baseUrl}/tracks/all`);
    url.searchParams.set('icao24', icao24.toLowerCase());
    url.searchParams.set('time', String(Math.floor(time)));
    return this.fetchJson<OpenSkyTrackResponse>(url.toString());
  }

  async getAirportArrivals(
    airport: string,
    begin: number,
    end: number
  ): Promise<OpenSkyArrivalFlight[]> {
    const url = new URL(`${this.baseUrl}/flights/arrival`);
    url.searchParams.set('airport', airport.toUpperCase());
    url.searchParams.set('begin', String(Math.floor(begin)));
    url.searchParams.set('end', String(Math.floor(end)));
    return this.fetchJson<OpenSkyArrivalFlight[]>(url.toString());
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const res = await this.fetchWithTimeout(url);
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`OpenSky API returned ${res.status}: ${text.slice(0, 200)}`);
    }
    if (text.startsWith('You cannot access')) {
      throw new Error(text.trim());
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`OpenSky API returned invalid JSON: ${text.slice(0, 200)}`);
    }
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      return await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Request timed out after ${this.timeout}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
