import type { AdventuresState } from '../hooks/use-adventures';

export function SignInPrompt({ state }: { state: AdventuresState }) {
  const available = !!state.signInUrl;
  return (
    <div className="sign-in-prompt">
      <span className="sign-in-heart" aria-hidden="true">
        ♡
      </span>
      <h3>Le tue prossime mete, tutte insieme.</h3>
      <p>Accedi per salvare le avventure che ami e ritrovarle nel tuo profilo personale.</p>
      {state.signInTarget && (
        <p className="sign-in-target">
          La tua scelta: <strong>{state.signInTarget.name}</strong>
        </p>
      )}
      <button
        className="google-sign-in"
        disabled={!available || state.loading}
        onClick={state.beginSignIn}
      >
        {state.signInProvider === 'access' ? (
          'Accedi al tuo profilo'
        ) : (
          <>
            <span aria-hidden="true" className="google-letter">
              G
            </span>
            Continua con Google
          </>
        )}
      </button>
      {!available && (
        <p className="muted">
          L’accesso Google sarà disponibile quando il servizio online sarà configurato. Puoi
          continuare a esplorare le montagne.
        </p>
      )}
      <p className="sign-in-note">
        Il catalogo è aperto a tutti. L’accesso serve solo per le tue avventure personali.
      </p>
    </div>
  );
}
