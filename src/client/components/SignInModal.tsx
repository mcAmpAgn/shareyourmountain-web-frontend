import type { AdventuresState } from '../hooks/use-adventures';
import { Modal } from './Modal';
import { SignInPrompt } from './SignInPrompt';

export function SignInModal({ state }: { state: AdventuresState }) {
  return (
    <Modal titleId="sign-in-title" onClose={state.closeSignIn}>
      <div className="dialog-padding">
        <p className="eyebrow">IL TUO SPAZIO IN MONTAGNA</p>
        <h2 id="sign-in-title">Salva il tuo prossimo orizzonte.</h2>
        <SignInPrompt state={state} />
      </div>
    </Modal>
  );
}
