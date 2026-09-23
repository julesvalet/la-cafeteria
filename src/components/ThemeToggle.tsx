import { useEffect, useState } from 'react';
import { Check, Settings } from 'lucide-react';
import { BACKDROPS, LOOKS, RGB_MAX_MS, RGB_MIN_MS, RGB_SPEEDS, useDisplay, type Look } from '../hooks/useTheme';
import { Modal } from '../features/social/components/Modal';
import { useAuth } from '../features/account/useAuth';
import { usePlafee } from '../features/plafee/usePlafee';
import { equipItem, getMyPurchases, getShopItems, type ShopItem } from '../features/plafee/api';

/**
 * Les réglages d'affichage, derrière l'engrenage de l'en-tête : le thème (les
 * quatre de base et ceux achetés à la boutique), la vitesse du RGB, le fond
 * de la salle, l'effet cathodique et les animations néon.
 *
 * Tout s'applique au clic (on voit le résultat derrière la fenêtre) ; « OK »
 * referme. Pas de rechargement : seuls les attributs de <html> changent.
 */
export function ThemeToggle() {
  const { backdrop, crt, fx, look, rgbMs, setBackdrop, setCrt, setFx, setLook, setRgbMs } = useDisplay();
  const [open, setOpen] = useState(false);
  const owned = useOwnedSiteThemes(open);
  const { mine, refreshMine } = usePlafee();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Un thème acheté ne vaut que sur l'interface arcade : c'est lui qui est coché.
  const equippedSkin = mine?.site_skin && mine.site_skin !== 'arcade' ? mine.site_skin : null;
  const selected = look === 'arcade' && equippedSkin ? `skin:${equippedSkin}` : look;
  const arcadeLike = look === 'arcade' || look === 'rgb';

  const equip = async (item: ShopItem | undefined) => {
    if (!item) return;
    setBusy(true);
    setError(null);
    try {
      await equipItem(item.id);
      refreshMine();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de changer de thème.');
    } finally {
      setBusy(false);
    }
  };

  const pickLook = (id: Look) => {
    setLook(id);
    // Un thème de base remplace celui de la boutique : on revient au défaut.
    if (equippedSkin) void equip(owned?.defaultItem);
  };

  const pickSkin = (item: ShopItem) => {
    setLook('arcade');
    void equip(item);
  };

  return (
    <>
      <button type="button" className="theme-toggle" onClick={() => setOpen(true)} aria-label="Réglages d'affichage" title="Réglages d'affichage">
        <Settings size={18} strokeWidth={1.75} />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Affichage">
        <h3 className="thm-heading">Thème</h3>
        <div className="thm-looks" role="radiogroup" aria-label="Thème du site">
          {LOOKS.map((l) => (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={selected === l.id}
              className="thm-option thm-look"
              onClick={() => pickLook(l.id)}
            >
              <span className="thm-swatch" data-look-preview={l.id} aria-hidden>
                {selected === l.id && (
                  <span className="thm-check">
                    <Check size={14} strokeWidth={3} />
                  </span>
                )}
              </span>
              <strong>{l.label}</strong>
              <small>{l.hint}</small>
            </button>
          ))}
          {owned?.items.map((item) => {
            const skin = String(item.payload.skin);
            const id = `skin:${skin}`;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={selected === id}
                className="thm-option thm-look"
                disabled={busy}
                onClick={() => pickSkin(item)}
              >
                <span className="thm-swatch" data-skin-preview={skin} aria-hidden>
                  {selected === id && (
                    <span className="thm-check">
                      <Check size={14} strokeWidth={3} />
                    </span>
                  )}
                </span>
                <strong>{item.name}</strong>
                <small>Acheté à la boutique.</small>
              </button>
            );
          })}
        </div>
        {error && (
          <p className="neon-error" role="alert">
            {error}
          </p>
        )}

        {look === 'rgb' && <RgbSpeed ms={rgbMs} onChange={setRgbMs} />}

        {arcadeLike && (
          <>
            <h3 className="thm-heading">Fond de la salle</h3>
            <div className="thm-options" role="radiogroup" aria-label="Fond du site">
              {BACKDROPS.map((b) => (
                <button key={b.id} type="button" role="radio" aria-checked={backdrop === b.id} className="thm-option" onClick={() => setBackdrop(b.id)}>
                  <span className="thm-preview" data-preview={b.id} aria-hidden>
                    {backdrop === b.id && (
                      <span className="thm-check">
                        <Check size={14} strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <strong>{b.label}</strong>
                  <small>{b.hint}</small>
                </button>
              ))}
            </div>

            <div className="thm-switches">
              <Switch label="Effet cathodique" hint="Lignes de balayage et léger vignettage, comme sur un vieil écran." checked={crt} onChange={setCrt} />
              <Switch label="Animations néon" hint="Pulsations, clignotements et balayage permanents." checked={fx} onChange={setFx} />
            </div>
          </>
        )}

        <div className="thm-actions">
          <button type="button" className="neon-btn" data-variant="solid" onClick={() => setOpen(false)}>
            OK
          </button>
        </div>
      </Modal>
    </>
  );
}

/** Les thèmes du site achetés (et l'objet par défaut, pour y revenir). Lus à l'ouverture. */
function useOwnedSiteThemes(open: boolean) {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [owned, setOwned] = useState<{ items: ShopItem[]; defaultItem?: ShopItem } | null>(null);
  useEffect(() => {
    if (!open || !uid) return;
    let cancelled = false;
    Promise.all([getShopItems(true), getMyPurchases(uid)])
      .then(([items, purchases]) => {
        if (cancelled) return;
        const mineIds = new Set(purchases.map((p) => p.item_id));
        const site = items.filter((i) => i.category === 'site_theme');
        setOwned({ items: site.filter((i) => !i.is_default && mineIds.has(i.id)), defaultItem: site.find((i) => i.is_default) });
      })
      .catch(() => {
        /* hors ligne : les thèmes de base suffisent */
      });
    return () => {
      cancelled = true;
    };
  }, [open, uid]);
  return uid ? owned : null;
}

/** La vitesse du RGB : trois crans, un curseur, ou une durée exacte en ms. */
function RgbSpeed({ ms, onChange }: { ms: number; onChange: (ms: number) => void }) {
  const [typed, setTyped] = useState(String(ms));
  useEffect(() => setTyped(String(ms)), [ms]);
  return (
    <div className="thm-rgb">
      <h3 className="thm-heading">Vitesse du RGB</h3>
      <div className="thm-rgb-presets" role="radiogroup" aria-label="Vitesse">
        {RGB_SPEEDS.map((s) => (
          <button key={s.id} type="button" role="radio" aria-checked={ms === s.ms} className="thm-chip" onClick={() => onChange(s.ms)}>
            {s.label}
          </button>
        ))}
      </div>
      <label className="thm-rgb-slider">
        <span>Plus vite</span>
        {/* Le curseur va du rapide au lent : à droite, un tour dure plus longtemps. */}
        <input type="range" min={RGB_MIN_MS} max={RGB_MAX_MS / 2} step={100} value={Math.min(ms, RGB_MAX_MS / 2)} onChange={(e) => onChange(Number(e.target.value))} aria-label="Durée d'un tour de couleurs" />
        <span>Plus lent</span>
      </label>
      <label className="thm-rgb-ms">
        Un tour de couleurs en
        <input
          className="neon-input"
          inputMode="numeric"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onBlur={() => {
            const n = Number(typed);
            if (Number.isFinite(n) && n > 0) onChange(n);
            else setTyped(String(ms));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          aria-label="Durée en millisecondes"
        />
        ms
      </label>
    </div>
  );
}

function Switch({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="thm-switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="thm-switch-track" aria-hidden>
        <span className="thm-switch-thumb" />
      </span>
      <span className="thm-switch-text">
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
    </label>
  );
}
