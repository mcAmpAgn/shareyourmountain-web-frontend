import { useState } from 'react';
import type { Adventure, CatalogItem } from '../../shared/contracts';
import type { AdventuresState } from '../hooks/use-adventures';
import { Modal } from './Modal';
export function AdventuresModal({
  state,
  onClose,
  onOpen,
}: {
  state: AdventuresState;
  onClose: () => void;
  onOpen: (item: CatalogItem) => void;
}) {
  return (
    <Modal titleId="saved-title" onClose={onClose}>
      <div className="dialog-padding">
        <p className="eyebrow">IL TUO PROSSIMO ORIZZONTE</p>
        <h2 id="saved-title">Le mie avventure</h2>
        <p className="muted">
          Il tuo profilo locale. Preferiti e note sono salvati nel database su questo computer.
        </p>
        {state.error && (
          <div className="notice" role="alert">
            {state.error}
            <button className="text-button" onClick={state.retry}>
              Riprova
            </button>
          </div>
        )}
        {state.loading && !state.items.length ? (
          <p role="status">Caricamento delle avventure…</p>
        ) : state.items.length ? (
          state.items.map((entry) => (
            <AdventureRow key={entry.id} entry={entry} state={state} onOpen={onOpen} />
          ))
        ) : (
          <div className="empty-state">
            <h3>Ogni avventura comincia con un’idea.</h3>
            <p>
              Tocca il cuore su una cima o un itinerario.
              <br />
              Ritroverai qui tutte le tue prossime mete.
            </p>
            <button
              className="button"
              onClick={() => {
                onClose();
                document.getElementById('explore')?.scrollIntoView();
              }}
            >
              Trova la tua montagna ↗
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
function AdventureRow({
  entry,
  state,
  onOpen,
}: {
  entry: Adventure;
  state: AdventuresState;
  onOpen: (item: CatalogItem) => void;
}) {
  const [notes, setNotes] = useState(entry.notes),
    [editing, setEditing] = useState(false);
  return (
    <div className="adventure-entry">
      <div className="saved-row">
        <button className="saved-name" onClick={() => onOpen(entry.item)}>
          {entry.item.name}
          <small>
            {entry.status === 'completed' ? '✓ Avventura completata' : 'Da raggiungere'} ·{' '}
            {entry.item.range || entry.item.region}
          </small>
        </button>
        <button
          className="secondary-button"
          disabled={state.pending}
          onClick={() =>
            void state.update(entry, {
              status: entry.status === 'completed' ? 'planned' : 'completed',
            })
          }
        >
          {entry.status === 'completed' ? '✓ Completata' : 'Segna completata'}
        </button>
        <button className="secondary-button" onClick={() => setEditing(!editing)}>
          Note
        </button>
        <button
          className="secondary-button"
          disabled={state.pending}
          aria-label={'Rimuovi ' + entry.item.name}
          onClick={() => void state.remove(entry)}
        >
          ×
        </button>
      </div>
      {editing && (
        <form
          className="notes-form"
          onSubmit={(event) => {
            event.preventDefault();
            void state.update(entry, { notes });
            setEditing(false);
          }}
        >
          <label>
            Le tue note per {entry.item.name}
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={2000}
              rows={3}
            />
          </label>
          <button className="secondary-button" disabled={state.pending}>
            Salva note
          </button>
        </form>
      )}
      {!editing && entry.notes && <p className="adventure-notes">{entry.notes}</p>}
    </div>
  );
}
