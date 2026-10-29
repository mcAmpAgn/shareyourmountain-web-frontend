import type { CatalogQuery, Filters } from '../../shared/contracts';
export function CatalogFilters({
  query,
  options,
  onChange,
  onReset,
  hideSearch = false,
}: {
  query: CatalogQuery;
  options: Filters | null;
  onChange: (change: Partial<CatalogQuery>) => void;
  onReset: () => void;
  hideSearch?: boolean;
}) {
  const numeric = (value: string) => (value ? Number(value) : undefined);
  return (
    <div className="filters">
      {!hideSearch && (
        <label>
          Cerca nell’archivio
          <input
            type="search"
            value={query.q ?? ''}
            maxLength={120}
            onChange={(event) => onChange({ q: event.target.value || undefined })}
            placeholder="Cima, itinerario o zona"
          />
        </label>
      )}
      <label>
        Catena montuosa
        <select
          value={query.rangeId ?? ''}
          onChange={(event) => onChange({ rangeId: numeric(event.target.value) })}
        >
          <option value="">Tutte le catene</option>
          {options?.ranges.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Paese
        <select
          value={query.countryId ?? ''}
          onChange={(event) =>
            onChange({ countryId: numeric(event.target.value), regionId: undefined })
          }
        >
          <option value="">Tutti i paesi</option>
          {options?.countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Regione
        <select
          value={query.regionId ?? ''}
          onChange={(event) => onChange({ regionId: numeric(event.target.value) })}
        >
          <option value="">Tutte le regioni</option>
          {options?.regions
            .filter((r) => !query.countryId || r.countryId === query.countryId)
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        Quota minima
        <select
          value={query.minElevation ?? 0}
          onChange={(event) => onChange({ minElevation: numeric(event.target.value) || undefined })}
        >
          {[0, 1500, 2500, 3500].map((n) => (
            <option key={n} value={n}>
              {n ? n.toLocaleString('it-IT') + ' m' : 'Qualsiasi quota'}
            </option>
          ))}
        </select>
      </label>
      <label>
        Ordina per
        <select
          value={query.sort ?? 'name'}
          onChange={(event) => onChange({ sort: event.target.value as 'name' | 'elevation' })}
        >
          <option value="name">Nome A–Z</option>
          <option value="elevation">Quota decrescente</option>
        </select>
      </label>
      <button className="text-button" onClick={onReset}>
        Azzera filtri ↺
      </button>
    </div>
  );
}
