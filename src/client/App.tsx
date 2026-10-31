import { lazy, Suspense, useState } from 'react';
import { ClassificationPage } from './components/ClassificationPage';
import type { CatalogItem } from '../shared/contracts';
import { api } from './lib/api';
import { useCatalogNavigation, pageKind } from './hooks/use-catalog-navigation';
import { CatalogTablePage } from './components/CatalogTablePage';
import { formatNumber } from './lib/presentation';
import { useResource } from './hooks/use-resource';
import { useAdventures } from './hooks/use-adventures';
import { Header, Footer } from './components/SiteChrome';
import { Hero } from './components/Hero';
import { CatalogSection } from './components/CatalogSection';
import { DetailModal } from './components/DetailModal';
import { DetailPage } from './components/DetailPage';
import { detailTarget, detailPath } from './lib/detail-navigation';
import { AdventuresModal } from './components/AdventuresModal';
import { StorySections } from './components/StorySections';
import { Modal } from './components/Modal';
import { MapSection } from './components/MapSection';
import { SignInModal } from './components/SignInModal';
import { GamePromo } from './components/GamePromo';

const ClimberGame = lazy(() => import('./game/ClimberGame'));
export function App() {
  const gamePage = location.pathname.replace(/\/$/, '') === '/game';
  const classificationPage = location.pathname.replace(/\/$/, '') === '/soiusa';
  const page = pageKind();
  const pageTarget = detailTarget(location.pathname);
  const meta = useResource(
      async (signal) => {
        if (gamePage) return null;
        const [stats, filters] = await Promise.all([api.stats(signal), api.filters(signal)]);
        return { stats, filters };
      },
      [gamePage],
    ),
    adventures = useAdventures();
  const navigation = useCatalogNavigation();
  const { query, featured, detail, change, reset, search, closeDetail } = navigation;
  const [showAdventures, setShowAdventures] = useState(() => location.hash === '#adventures');
  const [info, setInfo] = useState<'data' | 'privacy' | null>(null);
  function open(item: Pick<CatalogItem, 'kind' | 'id'>) {
    setShowAdventures(false);
    if (pageTarget) {
      location.href = detailPath(item.kind, item.id);
      return;
    }
    navigation.open(item);
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Vai al contenuto
      </a>
      <Header
        count={adventures.items.length}
        onAdventures={() => setShowAdventures(true)}
        page={gamePage ? 'game' : classificationPage ? 'soiusa' : (pageTarget?.kind ?? page)}
      />
      <main id="main">
        {gamePage ? (
          <Suspense fallback={<div className="wrapper">Caricamento del gioco…</div>}>
            <ClimberGame
              suspended={!!(showAdventures || info || detail || adventures.signInRequested)}
            />
          </Suspense>
        ) : pageTarget ? (
          <DetailPage target={pageTarget} adventures={adventures} />
        ) : classificationPage ? (
          <ClassificationPage />
        ) : page ? (
          <CatalogTablePage
            kind={page}
            query={query}
            options={meta.data?.filters ?? null}
            onChange={change}
            onReset={reset}
            onOpen={open}
            adventures={adventures}
          />
        ) : (
          <>
            <Hero filters={meta.data?.filters ?? null} onSearch={search} onOpen={open} />
            <div className="intro-strip wrapper">
              <p>
                La tua passione. <strong>Un orizzonte senza confini.</strong>
              </p>
              <div>
                <span>
                  <b>{meta.data ? formatNumber(meta.data.stats.mountains) : '—'}</b> cime da
                  esplorare
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
            <GamePromo />
            <StorySections onSearch={search} />
          </>
        )}
      </main>
      <Footer onInfo={setInfo} />
      {detail && !pageTarget && (
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
                <p>
                  La copertina carica una previsione da Open-Meteo per le coordinate del Cervino. Il
                  meteo rimane nella sessione del browser per 15 minuti; non viene salvata la tua
                  posizione.
                </p>
                <p>
                  Le gallerie delle montagne caricano fotografie da Wikimedia Commons e, aprendo la
                  scheda Instagram, dai server di Meta quando la galleria è disponibile. Autore,
                  licenza e collegamenti alla fonte sono mostrati accanto alle foto.
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
