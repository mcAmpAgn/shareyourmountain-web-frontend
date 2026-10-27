import { useState } from 'react';
import type { CatalogItem } from '../shared/contracts';
import { api } from './lib/api';
import { useCatalogNavigation } from './hooks/use-catalog-navigation';
import { formatNumber } from './lib/presentation';
import { useResource } from './hooks/use-resource';
import { useAdventures } from './hooks/use-adventures';
import { Header, Footer } from './components/SiteChrome';
import { Hero } from './components/Hero';
import { CatalogSection } from './components/CatalogSection';
import { DetailModal } from './components/DetailModal';
import { AdventuresModal } from './components/AdventuresModal';
import { StorySections } from './components/StorySections';
import { Modal } from './components/Modal';
import { MapSection } from './components/MapSection';
import { SignInModal } from './components/SignInModal';

export function App() {
  const meta = useResource(async (signal) => {
      const [stats, filters] = await Promise.all([api.stats(signal), api.filters(signal)]);
      return { stats, filters };
    }, []),
    adventures = useAdventures();
  const navigation = useCatalogNavigation();
  const { query, featured, detail, change, reset, search, closeDetail } = navigation;
  const [showAdventures, setShowAdventures] = useState(() => location.hash === '#adventures');
  const [info, setInfo] = useState<'data' | 'privacy' | null>(null);
  function open(item: Pick<CatalogItem, 'kind' | 'id'>) {
    setShowAdventures(false);
    navigation.open(item);
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Vai al contenuto
      </a>
      <Header count={adventures.items.length} onAdventures={() => setShowAdventures(true)} />
      <main id="main">
        <Hero filters={meta.data?.filters ?? null} onSearch={search} onOpen={open} />
        <div className="intro-strip wrapper">
          <p>
            La tua passione. <strong>Un orizzonte senza confini.</strong>
          </p>
          <div>
            <span>
              <b>{meta.data ? formatNumber(meta.data.stats.mountains) : '—'}</b> cime da esplorare
            </span>
            <span>
              <b>{meta.data ? formatNumber(meta.data.stats.routes) : '—'}</b> itinerari da
              riscoprire
            </span>
            <a href="#community">Una storia da continuare ↗</a>
          </div>
        </div>
        {meta.error && (
          <div className="wrapper notice" role="alert">
            {meta.error}
            <button className="text-button" onClick={meta.retry}>
              Riprova
            </button>
          </div>
        )}
        {meta.data?.stats.totalMountains === 0 && (
          <div className="wrapper notice">
            L’archivio non è ancora stato importato. Segui le istruzioni di avvio nel README per
            caricare il backup locale.
          </div>
        )}
        <CatalogSection
          query={query}
          featured={featured}
          options={meta.data?.filters ?? null}
          adventures={adventures}
          onChange={change}
          onReset={reset}
          onOpen={open}
          onFeatured={navigation.inspire}
        />
        <MapSection onOpen={open} />
        <StorySections onSearch={search} />
      </main>
      <Footer onInfo={setInfo} />
      {detail && (
        <DetailModal
          key={detail.kind + detail.id}
          target={detail}
          adventures={adventures}
          onClose={closeDetail}
          onOpen={open}
        />
      )}{' '}
      {showAdventures && (
        <AdventuresModal
          state={adventures}
          onClose={() => setShowAdventures(false)}
          onOpen={open}
        />
      )}{' '}
      {info && (
        <Modal titleId="info-title" onClose={() => setInfo(null)}>
          <div className="dialog-padding">
            <p className="eyebrow">SHARE YOUR MOUNTAIN</p>
            <h2 id="info-title">
              {info === 'data' ? 'Un archivio, tante storie.' : 'La tua lista rimane tua.'}
            </h2>
            {info === 'data' ? (
              <>
                <p>
                  Catalogo storico del 28 dicembre 2017:{' '}
                  {meta.data ? formatNumber(meta.data.stats.totalMountains) : '12.311'} montagne e{' '}
                  {meta.data ? formatNumber(meta.data.stats.totalRoutes) : '3.041'} itinerari,
                  comprese le schede inattive. La ricerca mostra solo le schede attive.
                </p>
                <p>
                  Le informazioni possono essere incomplete o superate. Le foto illustrative sono
                  indicate nelle schede. Fonti, descrizioni e collegamenti originali sono conservati
                  nell’archivio.
                </p>
                <p>
                  Il progetto originale descrive i dati condivisi con licenza CC BY-SA 3.0 e il
                  codice con licenza Apache 2.0.
                </p>
                <a
                  className="source-link"
                  href="https://gitlab.com/campagna.marcello/shareyourmountain"
                  target="_blank"
                  rel="noreferrer"
                >
                  Repository e fonti originali ↗
                </a>
              </>
            ) : (
              <>
                <p>
                  {adventures.profileMode === 'local'
                    ? 'Il profilo locale salva le tue mete, le note e lo stato di completamento nel database di questo computer, tramite il servizio locale. Non è un account online e non sincronizza i dati tra dispositivi.'
                    : 'Il tuo profilo personale conserva le mete, le note e lo stato di completamento in un database online protetto. Il salvataggio richiede il tuo accesso personale.'}
                </p>
                <p>
                  Puoi rimuovere singole avventure dalla tua lista. Non usiamo tracciatori, cookie
                  pubblicitari o analisi di navigazione. Le foto storiche e le fonti esterne vengono
                  servite dai rispettivi siti.
                </p>
                <p>
                  Aprendo la mappa, il browser carica lo sfondo da OpenStreetMap. Non richiediamo la
                  tua posizione.
                </p>
              </>
            )}
          </div>
        </Modal>
      )}
      {adventures.signInRequested && <SignInModal state={adventures} />}
    </>
  );
}
