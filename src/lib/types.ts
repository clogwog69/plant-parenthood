export type Place = 'garden' | 'indoor';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Category =
  | 'herb'
  | 'vegetable'
  | 'fruit'
  | 'houseplant'
  | 'succulent'
  | 'flower'
  | 'shrub';

export type Sign =
  | 'soil_dry'
  | 'soil_soggy'
  | 'wilting'
  | 'yellow'
  | 'brown_tips'
  | 'flowering'
  | 'fruit_ready'
  | 'roots_out'
  | 'top_heavy'
  | 'leggy'
  | 'pests'
  | 'spots'
  | 'new_growth'
  | 'looks_great';

export interface Harvest {
  /** continuous = pick little and often; seasonal = one crop window per year */
  kind: 'continuous' | 'seasonal';
  seasons?: Season[];
  how: string;
}

export interface Guide {
  key: string;
  name: string;
  aka?: string[];
  latin: string;
  category: Category;
  /** Days between waterings in mild weather (in the ground outdoors, or in a pot indoors). */
  waterDays: number;
  water: string;
  light: string;
  /** Months between repots when grown in a pot. */
  repotMonths: number;
  frostTender?: boolean;
  harvest?: Harvest;
  tips: string[];
  /** Species-specific advice that replaces the general advice for a sign. */
  signs?: Partial<Record<Sign, string>>;
}

export type AdviceKind = 'water' | 'hold' | 'repot' | 'harvest' | 'prune' | 'care' | 'good';

export interface Advice {
  sign: Sign;
  kind: AdviceKind;
  title: string;
  detail: string;
}

export interface Todo {
  id: string;
  kind: AdviceKind;
  title: string;
  detail: string;
  createdAt: number;
}

export interface Checkin {
  id: string;
  date: number;
  photoId?: string;
  thumb?: string;
  signs: Sign[];
  advice: Advice[];
  note?: string;
  /** Who did it, when the plant is shared with a household. */
  by?: string;
}

export type EventType = 'watered' | 'repotted' | 'harvested' | 'added';

export interface PlantEvent {
  type: EventType;
  date: number;
  by?: string;
}

export interface Plant {
  id: string;
  /** Key into the built-in guide, or `custom:<category>` for plants we don't know. */
  guideKey: string;
  species: string;
  nickname?: string;
  place: Place;
  potted: boolean;
  createdAt: number;
  /** Last change on any phone; the newest copy wins when syncing. */
  updatedAt?: number;
  thumb?: string;
  photoId?: string;
  lastWatered?: number;
  lastRepotted?: number;
  lastHarvested?: number;
  /** Don't ask for water before this time (set when the soil was reported soggy). */
  holdWaterUntil?: number;
  todos: Todo[];
  checkins: Checkin[];
  events: PlantEvent[];
}

export interface Photo {
  id: string;
  plantId: string;
  date: number;
  dataUrl: string;
}

export interface Location {
  name: string;
  lat: number;
  lon: number;
}

export interface DayWeather {
  date: string; // YYYY-MM-DD
  tmax: number;
  tmin: number;
  rain: number; // mm
  rainChance: number | null; // %
  code: number;
}

export interface Weather {
  fetchedAt: number;
  temp: number;
  code: number;
  today: string;
  days: DayWeather[]; // includes a few past days
}

export type TaskKind = 'water' | 'repot' | 'harvest' | 'photo' | 'todo';

export interface Task {
  id: string;
  plantId: string;
  kind: TaskKind;
  title: string;
  reason: string;
  /** Days from today; 0 or less means due now. */
  dueIn: number;
  /** Rain is doing this one for you. */
  skipped?: boolean;
  todo?: Todo;
}
