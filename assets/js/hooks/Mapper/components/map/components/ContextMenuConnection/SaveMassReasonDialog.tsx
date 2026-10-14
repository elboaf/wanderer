import { Dialog } from 'primereact/dialog';
import { InputTextarea } from 'primereact/inputtextarea';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { WdButton } from '@/hooks/Mapper/components/ui-kit';

type SaveMassReasonDialogProps = {
  visible: boolean;
  onHide: () => void;
  onSave: (reason: string) => void;
};

/**
 * Asks for the reason before the save-mass flag is applied to a link.
 * Save is disabled until the reason has non-whitespace content; closing the
 * dialog any other way (Cancel, ESC, backdrop click) applies nothing.
 */
export const SaveMassReasonDialog = ({ visible, onHide, onSave }: SaveMassReasonDialogProps) => {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (visible) {
      return;
    }

    setReason('');
  }, [visible]);

  const trimmed = reason.trim();
  const canSave = trimmed.length > 0;

  const handleSave = () => {
    if (!canSave) {
      return;
    }

    onSave(trimmed);
    setReason('');
  };

  return (
    <Dialog
      header="Save mass"
      visible={visible}
      draggable
      resizable={false}
      style={{ width: '420px' }}
      onHide={onHide}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm text-stone-300" htmlFor="save-mass-reason">
            Reason
          </label>

          <InputTextarea
            id="save-mass-reason"
            autoFocus
            value={reason}
            onChange={event => setReason(event.target.value)}
            placeholder="Why is this link locked?"
            rows={3}
            className="w-full"
          />

          <div className={clsx('text-xs', canSave ? 'text-stone-500' : 'text-stone-400')}>
            {canSave ? 'Press Save to lock the link.' : 'A reason is required to lock the link.'}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <WdButton outlined size="small" label="Cancel" onClick={onHide} />
          <WdButton outlined size="small" label="Save" onClick={handleSave} disabled={!canSave} />
        </div>
      </div>
    </Dialog>
  );
};
