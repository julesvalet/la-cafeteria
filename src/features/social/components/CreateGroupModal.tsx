import { useState, type FormEvent } from 'react';
import { Lock, Plus } from 'lucide-react';
import { NeonButton } from '../../account/components/NeonButton';
import { NeonInput } from '../../account/components/NeonInput';
import { AccBanner } from '../../account/components/AccBanner';
import { Modal } from './Modal';
import type { Group } from '../types';

export interface GroupFormValues {
  name: string;
  description: string;
  isPrivate: boolean;
}

/** Même formulaire pour créer et pour modifier : seuls le titre et l'action changent. */
export function CreateGroupModal({
  open,
  onClose,
  onSubmit,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: GroupFormValues) => Promise<void>;
  initial?: Pick<Group, 'name' | 'description' | 'is_private'>;
}) {
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Modifier le groupe' : 'Nouveau groupe'}>
      <GroupForm onSubmit={onSubmit} initial={initial} onCancel={onClose} />
    </Modal>
  );
}

function GroupForm({
  onSubmit,
  onCancel,
  initial,
}: {
  onSubmit: (values: GroupFormValues) => Promise<void>;
  onCancel: () => void;
  initial?: Pick<Group, 'name' | 'description' | 'is_private'>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [isPrivate, setIsPrivate] = useState(initial?.is_private ?? false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 3 || trimmed.length > 50) {
      setNameError('Entre 3 et 50 caractères.');
      return;
    }
    setNameError(null);
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ name: trimmed, description: description.trim(), isPrivate });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setBusy(false);
    }
  }

  return (
    <form className="acc-form" onSubmit={submit} noValidate>
      {error && <AccBanner tone="error">{error}</AccBanner>}
      <NeonInput
        label="Nom"
        value={name}
        maxLength={50}
        error={nameError}
        placeholder="Les habitués du jeudi"
        autoFocus
        onChange={(e) => setName(e.target.value)}
      />
      <div className="neon-field">
        <label className="neon-field-label" htmlFor="soc-group-desc">
          Description
        </label>
        <textarea
          id="soc-group-desc"
          className="neon-input soc-textarea"
          value={description}
          maxLength={500}
          rows={3}
          placeholder="Facultatif"
          onChange={(e) => setDescription(e.target.value)}
        />
        <span className="neon-hint">{description.length} / 500 caractères.</span>
      </div>
      <label className="soc-check">
        <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
        <Lock size={15} aria-hidden />
        <span>
          <strong>Groupe privé</strong>
          <span className="neon-hint"> — on n'y entre que sur invitation d'un admin ; le code ne suffit plus.</span>
        </span>
      </label>
      <div className="acc-edit-actions">
        <NeonButton type="submit" variant="solid" loading={busy} icon={<Plus size={16} aria-hidden />}>
          {initial ? 'Enregistrer' : 'Créer le groupe'}
        </NeonButton>
        <NeonButton variant="ghost" onClick={onCancel} disabled={busy}>
          Annuler
        </NeonButton>
      </div>
    </form>
  );
}
