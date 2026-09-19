import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Check, ImagePlus, Trash2, Upload, ZoomIn } from 'lucide-react';
import { Modal } from '../../social/components/Modal';
import { useAuth } from '../useAuth';
import {
  ACCEPT_ATTR,
  drawFramed,
  exportSquare,
  loadImage,
  placement,
  removeAvatarFiles,
  uploadAvatar,
  type Framing,
} from '../avatarUpload';

/** Côté du cadre d'aperçu, en pixels CSS. Le rendu final, lui, fait 512 px. */
const PREVIEW = 280;

/**
 * « Changer photo » : choisir, recadrer en cercle, envoyer.
 *
 * Si l'envoi échoue, rien ne change : le profil garde son ancienne photo tant
 * que la nouvelle n'est pas en place.
 */
export function AvatarUpload({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone?: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Photo de profil" variant="casino">
      <Uploader onClose={onClose} onDone={onDone} />
    </Modal>
  );
}

function Uploader({ onClose, onDone }: { onClose: () => void; onDone?: () => void }) {
  const { user, profile, updateProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; start: Framing } | null>(null);

  const [image, setImage] = useState<ImageBitmap | null>(null);
  const [framing, setFraming] = useState<Framing>({ zoom: 1, x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => () => image?.close(), [image]);

  // L'aperçu se redessine à chaque réglage, à la résolution de l'écran.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.height = Math.round(PREVIEW * ratio);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawFramed(ctx, image, framing, PREVIEW);
  }, [image, framing]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const bitmap = await loadImage(file);
      setImage(bitmap);
      setFraming({ zoom: 1, x: 0, y: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image illisible.');
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, start: framing };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drag.current || !image) return;
    const { start } = drag.current;
    const p = placement(image, start, PREVIEW);
    // Glisser l'image vers la droite montre davantage son bord gauche.
    const nx = p.slackX > 0 ? start.x - (2 * (e.clientX - drag.current.x)) / p.slackX : 0;
    const ny = p.slackY > 0 ? start.y - (2 * (e.clientY - drag.current.y)) / p.slackY : 0;
    setFraming({ ...start, x: clamp(nx), y: clamp(ny) });
  }

  async function confirm() {
    if (!image || !user) return;
    setError(null);
    setProgress(0);
    try {
      const blob = await exportSquare(image, framing);
      const url = await uploadAvatar(user.id, blob, setProgress);
      await updateProfile({ avatar: url });
      onDone?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible.');
      setProgress(null);
    }
  }

  async function remove() {
    if (!user) return;
    setError(null);
    try {
      await updateProfile({ avatar: null });
      await removeAvatarFiles(user.id);
      onDone?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible.');
    }
  }

  const busy = progress !== null;

  return (
    <div className="av-up">
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="soc-sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {!image ? (
        <div className="av-empty">
          <button type="button" className="av-drop" onClick={() => fileRef.current?.click()}>
            <ImagePlus size={30} aria-hidden />
            <strong>Choisir une photo</strong>
            <small>JPG, PNG ou WebP · 5 Mo max · 200 × 200 px min</small>
          </button>
          {profile?.avatar && (
            <button type="button" className="av-link" onClick={() => void remove()}>
              <Trash2 size={14} aria-hidden /> Retirer ma photo actuelle
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="av-stage" style={{ width: PREVIEW, height: PREVIEW }}>
            <canvas
              ref={canvasRef}
              style={{ width: PREVIEW, height: PREVIEW }}
              aria-label="Aperçu : fais glisser pour recadrer"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              onWheel={(e) => setFraming((f) => ({ ...f, zoom: clampZoom(f.zoom - e.deltaY * 0.0015) }))}
            />
            <span className="av-mask" aria-hidden />
          </div>

          <div className="av-sliders">
            <label>
              <span>
                <ZoomIn size={14} aria-hidden /> Zoom
              </span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={framing.zoom}
                onChange={(e) => setFraming((f) => ({ ...f, zoom: Number(e.target.value) }))}
              />
            </label>
            <label>
              <span>Horizontal</span>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.01}
                value={framing.x}
                onChange={(e) => setFraming((f) => ({ ...f, x: Number(e.target.value) }))}
              />
            </label>
            <label>
              <span>Vertical</span>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.01}
                value={framing.y}
                onChange={(e) => setFraming((f) => ({ ...f, y: Number(e.target.value) }))}
              />
            </label>
          </div>

          {busy && (
            <div className="av-progress" role="progressbar" aria-label="Envoi" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((progress ?? 0) * 100)}>
              <span style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
            </div>
          )}

          <div className="av-actions">
            <button type="button" className="sess-primary" disabled={busy} onClick={() => void confirm()}>
              {busy ? <Upload size={16} aria-hidden /> : <Check size={16} aria-hidden />}
              {busy ? 'Envoi…' : 'Confirmer'}
            </button>
            <button type="button" className="av-link" disabled={busy} onClick={() => fileRef.current?.click()}>
              Autre photo
            </button>
            <button type="button" className="av-link" disabled={busy} onClick={onClose}>
              Annuler
            </button>
          </div>
        </>
      )}

      {error && (
        <p className="sess-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function clamp(v: number) {
  return Math.max(-1, Math.min(1, v));
}

function clampZoom(v: number) {
  return Math.max(1, Math.min(3, v));
}
