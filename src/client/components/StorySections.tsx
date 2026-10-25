export function StorySections({
  onSearch,
}: {
  onSearch: (query: string, activity: string) => void;
}) {
  return (
    <>
      <section
        id="destinations"
        className="destinations section-space"
        aria-labelledby="destination-title"
      >
        <div className="wrapper">
          <div className="section-heading">
            <div>
              <p className="eyebrow">CAMBIA PROSPETTIVA</p>
              <h2 id="destination-title">Ogni orizzonte, una nuova storia.</h2>
            </div>
            <p className="heading-aside">
              Dalle pareti di casa alle grandi vette.
              <br />
              Trova il tuo angolo di mondo.
            </p>
          </div>
          <div className="destination-grid">
            {[
              {
                name: 'Dolomiti',
                country: 'ITALIA',
                image: 'dolomites.jpg',
                copy: 'La meraviglia, a ogni passo.',
              },
              {
                name: 'Alpi Pennine',
                country: 'ITALIA · SVIZZERA',
                image: 'cervino.jpg',
                copy: 'Dove le cime incontrano il cielo.',
              },
              {
                name: 'Prealpi Bergamasche',
                country: 'LOMBARDIA',
                image: 'hiking.jpg',
                copy: 'L’avventura, più vicina di quanto pensi.',
              },
            ].map((place, index) => (
              <button
                key={place.name}
                className={'destination ' + (index === 0 ? 'destination-large' : '')}
                onClick={() => onSearch(place.name, '')}
              >
                <img
                  src={'/assets/' + place.image}
                  alt={place.name + (index === 2 ? ' · foto illustrativa' : '')}
                  loading="lazy"
                />
                <span className="destination-content">
                  <small>{place.country}</small>
                  <strong>{place.name}</strong>
                  <span>{place.copy}</span>
                </span>
                <span className="round-arrow">↗</span>
              </button>
            ))}
          </div>
        </div>
      </section>
      <section
        id="community"
        className="community wrapper section-space"
        aria-labelledby="community-title"
      >
        <div className="community-photo">
          <img
            src="/assets/climbing.jpg"
            alt="Un escursionista osserva le grandi pareti alpine"
            loading="lazy"
          />
          <span className="photo-label">Stessa passione. Nuovi punti di vista.</span>
        </div>
        <div className="community-copy">
          <p className="eyebrow">LO SPIRITO DI SHARE YOUR MOUNTAIN</p>
          <h2 id="community-title">
            Le montagne ci uniscono.
            <br />
            Le storie ci portano lontano.
          </h2>
          <p>
            Un’idea semplice: riunire le informazioni su cime e itinerari, valorizzare le fonti e
            lasciare una traccia delle nostre avventure.
          </p>
          <p>
            Questo nuovo capitolo riparte dal progetto originale. Un archivio da esplorare, una
            lista personale per i tuoi sogni, e la stessa voglia di guardare più in alto.
          </p>
          <a className="button" href="#explore">
            Trova la tua prossima storia <span>↗</span>
          </a>
          <a
            className="subtle-link"
            href="https://gitlab.com/campagna.marcello/shareyourmountain"
            target="_blank"
            rel="noreferrer"
          >
            Scopri le radici del progetto ↗
          </a>
        </div>
      </section>
      <section className="closing-banner">
        <div className="wrapper">
          <p className="eyebrow light">IL PROSSIMO PASSO È TUO</p>
          <h2>Ci vediamo lassù.</h2>
          <a href="#explore" className="button cream-button">
            Inizia a esplorare ↗
          </a>
        </div>
      </section>
    </>
  );
}
