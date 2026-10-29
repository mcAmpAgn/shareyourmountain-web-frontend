export type ItemKind = 'mountain' | 'route';
export interface SuggestionQuery {
  q: string;
  kind?: ItemKind;
  activityId?: number;
}
export interface SuggestionPage {
  items: CatalogItem[];
}
export type MapBounds = [west: number, south: number, east: number, north: number];
export interface MountainMapPage {
  items: CatalogItem[];
  limit: number;
}
export interface ProfileCapabilities {
  profileMode: 'local' | 'access' | 'disabled';
  signInUrl: string | null;
  signInProvider: 'google' | 'access' | null;
  signOutUrl: string | null;
}
export interface CatalogItem {
  key: string;
  id: number;
  kind: ItemKind;
  name: string;
  elevationM: number | null;
  range: string;
  region: string;
  countries: string[];
  activity: string;
  activityId: number | null;
  difficultyRaw: string | null;
  latitude: number | null;
  longitude: number | null;
  mountainId: number | null;
  routeCount: number;
  mountainGroup?: string;
  parentMountain?: string;
  lengthM?: number | null;
  heightM?: number | null;
}
export interface CatalogDetail extends CatalogItem {
  description: string | null;
  lengthM: number | null;
  heightM: number | null;
  lengthDescription: string | null;
  sources: { name: string; url: string | null; originalPath: string }[];
  images: { url: string; description: string | null }[];
  relatedRoutes: CatalogItem[];
  mountainLocation: { latitude: number; longitude: number } | null;
  parking: { name: string; latitude: number | null; longitude: number | null } | null;
  track: { name: string; url: string | null } | null;
}
export interface CatalogQuery {
  q?: string;
  kind?: ItemKind;
  activityId?: number;
  rangeId?: number;
  countryId?: number;
  regionId?: number;
  mountainId?: number;
  minElevation?: number;
  sort?: 'name' | 'elevation';
  page?: number;
  pageSize?: number;
}
export interface CatalogPage {
  items: CatalogItem[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}
export interface FilterOption {
  id: number;
  name: string;
}
export interface Filters {
  activities: FilterOption[];
  ranges: FilterOption[];
  countries: FilterOption[];
  regions: (FilterOption & { countryId: number })[];
}
export interface Stats {
  mountains: number;
  routes: number;
  totalMountains: number;
  totalRoutes: number;
  importedAt: string | null;
  snapshot: string | null;
}
export interface Adventure {
  id: string;
  status: 'planned' | 'completed';
  completedAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  item: CatalogItem;
}
export interface AdventureInput {
  kind: ItemKind;
  targetId: number;
}
export interface AdventureUpdate {
  status?: 'planned' | 'completed';
  notes?: string;
}
