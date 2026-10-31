import type { ComponentProps } from 'react';
import { DetailContent } from './DetailContent';
import { Modal } from './Modal';
export function DetailModal({
  onClose,
  ...props
}: Omit<ComponentProps<typeof DetailContent>, 'fullPage'> & { onClose: () => void }) {
  return (
    <Modal titleId="detail-title" onClose={onClose} className="detail-dialog">
      <DetailContent {...props} />
    </Modal>
  );
}
