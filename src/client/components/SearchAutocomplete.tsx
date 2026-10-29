import { useEffect, useId, useRef, useState } from 'react';
import type { CatalogItem } from '../../shared/contracts';
import { useSearchSuggestions } from '../hooks/use-search-suggestions';
import { formatNumber } from '../lib/presentation';
import { useSuggestionPlacement } from '../hooks/use-suggestion-placement';
import './search-autocomplete.css';

export function SearchAutocomplete({
  value,
  activity,
  onChange,
  onSelect,
  onSearch,
}: {
  value: string;
  activity: string;
  onChange: (value: string) => void;
  onSelect: (item: CatalogItem) => void;
  onSearch: () => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const container = useRef<HTMLDivElement>(null);
  const result = useSearchSuggestions(value, activity, open);
  const visible = open && value.trim().length >= 2;
  const layout = useSuggestionPlacement(container, visible);
  useEffect(() => {
    setActive(-1);
  }, [value, activity]);
  useEffect(() => {
    if (active >= 0)
      document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, id]);
  function select(item: CatalogItem) {
    setOpen(false);
    setActive(-1);
    onChange(item.name);
    onSelect(item);
  }
  return (
    <div
      className="search-location autocomplete"
      ref={container}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setActive(-1);
        }
      }}
    >
      <label htmlFor={id} className="field-label">
        DOVE VUOI ANDARE?
      </label>
      <span className="input-line">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 5 5" />
        </svg>
        <input
          id={id}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={visible}
          aria-controls={visible ? `${id}-list` : undefined}
          aria-activedescendant={
            visible && active >= 0 && result.items[active] ? `${id}-option-${active}` : undefined
          }
          aria-describedby={visible ? `${id}-status` : undefined}
          autoComplete="off"
          value={value}
          maxLength={120}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'Escape') {
              if (visible) event.preventDefault();
              setOpen(false);
              setActive(-1);
            } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
              if (result.items.length)
                setActive((previous) =>
                  event.key === 'ArrowDown'
                    ? (previous + 1) % result.items.length
                    : previous <= 0
                      ? result.items.length - 1
                      : previous - 1,
                );
            } else if (event.key === 'Enter') {
              if (visible && active >= 0 && result.items[active]) {
                event.preventDefault();
                select(result.items[active]);
              } else {
                setOpen(false);
                setActive(-1);
              }
            }
          }}
          placeholder="Una cima, un itinerario, una zona…"
        />
      </span>
      {visible && (
        <div
          className="autocomplete-panel"
          data-placement={layout.placement}
          style={{ maxHeight: layout.maxHeight }}
        >
          <p id={`${id}-status`} role="status" className="autocomplete-status">
            {result.loading
              ? 'Cerchiamo nell’archivio…'
              : result.error
                ? 'Suggerimenti non disponibili. Puoi comunque avviare la ricerca.'
                : result.items.length
                  ? `${result.items.length} suggerimenti. Usa le frecce per scegliere e Invio per aprire.`
                  : 'Nessun suggerimento. Prova un altro nome o cerca in tutto l’archivio.'}
          </p>
          <ul
            id={`${id}-list`}
            role="listbox"
            aria-label="Montagne e itinerari suggeriti"
            aria-busy={result.loading}
          >
            {result.items.map((item, index) => (
              <li
                key={item.key}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={active === index}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(item)}
                onMouseEnter={() => setActive(index)}
              >
                <span className="suggestion-kind">
                  {item.kind === 'mountain' ? 'CIMA' : 'ITINERARIO'}
                </span>
                <span className="suggestion-name">
                  {item.name}
                  <small>
                    {[
                      item.range || item.region,
                      item.elevationM !== null ? `${formatNumber(item.elevationM)} m` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </span>
                <span aria-hidden="true">↗</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="autocomplete-all"
            onClick={() => {
              setOpen(false);
              setActive(-1);
              onSearch();
            }}
          >
            Mostra tutti i risultati per “{value.trim()}” <span aria-hidden="true">↗</span>
          </button>
        </div>
      )}
    </div>
  );
}
