import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, Flame, Lock, Play, ShoppingBag, Sparkles, Store } from 'lucide-react';
import { useAuth } from '../../account/useAuth';
import { SocialNav } from '../../social/components/SocialNav';
import { Modal } from '../../social/components/Modal';
import { UserAvatar } from '../../social/components/UserAvatar';
import { achievementIcon } from '../../achievements/icons';
import { usePlafee } from '../usePlafee';
import { invalidateCosmetics } from '../useCosmetics';
import { buyItem, equipItem, getMyPurchases, getShopItems, type Purchase, type ShopCategory, type ShopItem } from '../api';
import { FeesAmount } from '../components/bits';
import { formatFees } from '../format';
import { celebrate, type VictoryAnim } from '../victory';

type Tab = 'cards' | 'site' | 'badges' | 'profile' | 'anims';

const TABS: { id: Tab; label: string; categories: ShopCategory[] }[] = [
  { id: 'cards', label: 'Cartes', categories: ['card_theme'] },
  { id: 'site', label: 'Site', categories: ['site_theme'] },
  { id: 'badges', label: 'Badges', categories: ['badge'] },
  { id: 'profile', label: 'Profil', categories: ['profile_border', 'avatar_accessory', 'nameplate'] },
  { id: 'anims', label: 'Animations', categories: ['victory_animation'] },
];

const CATEGORY_TITLES: Partial<Record<ShopCategory, string>> = {
  profile_border: 'Contours de profil',
  avatar_accessory: 'Accessoires de photo',
  nameplate: 'Plaques nominatives',
};

/** La condition d'achat, en français. */
function requirementText(req: Record<string, number>): string | null {
  if (req.account_age_days) return `Compte de plus de ${Math.round(req.account_age_days / 365)} an${req.account_age_days >= 730 ? 's' : ''}`;
  if (req.leaderboard_top) return `Top ${req.leaderboard_top} du classement du mois`;
  if (req.lifetime_earned) return `${formatFees(req.lifetime_earned)} FEES gagnés au total`;
  return null;
}

/** L'aperçu d'un objet, selon ce qu'il change. */
function ItemPreview({ item, username, avatar }: { item: ShopItem; username: string; avatar: string | null }) {
  const p = item.payload as Record<string, string | boolean>;
  switch (item.category) {
    case 'card_theme':
      return (
        <span className="plf-prev-card" data-cards-preview={String(p.skin)} aria-hidden>
          <span>7</span>
        </span>
      );
    case 'site_theme':
      return (
        <span className="plf-prev-skin" data-skin-preview={String(p.skin)} aria-hidden>
          <i />
          <i />
          <i />
          <b>PLAFEE</b>
        </span>
      );
    case 'profile_border':
      return (
        <span className="plf-prev-border" data-border-preview={String(p.border)} aria-hidden>
          <UserAvatar username={username} src={avatar} size={56} preview={{ border: String(p.border) }} />
        </span>
      );
    case 'avatar_accessory':
      return (
        <span className="plf-prev-border" aria-hidden>
          <UserAvatar username={username} src={avatar} size={56} preview={{ accessory: p.accessory ? String(p.accessory) : null }} />
        </span>
      );
    case 'nameplate':
      return (
        <span className="plf-prev-plate" aria-hidden>
          <strong>{username}</strong>
          <span className="plf-plate">{p.custom ? 'ABCDE' : String(p.plate)}</span>
        </span>
      );
    case 'victory_animation':
      return (
        <span className="plf-prev-anim" data-anim={String(p.anim)} aria-hidden>
          <Sparkles size={34} />
        </span>
      );
    default: {
      const Icon = achievementIcon(item.sku?.includes('anniv') ? 'Cake' : item.sku?.includes('million') ? 'Gem' : 'Medal');
      return (
        <span className="plf-prev-badge" aria-hidden>
          {item.icon_url ? <img src={item.icon_url} alt="" /> : <Icon size={34} />}
        </span>
      );
    }
  }
}

export function ShopPage() {
  const { status, user, profile } = useAuth();
  const { wallet, refreshWallet, refreshMine } = usePlafee();
  const [items, setItems] = useState<ShopItem[] | null>(null);
  const [owned, setOwned] = useState<Purchase[]>([]);
  const [tab, setTab] = useState<Tab>('cards');
  const [error, setError] = useState<string | null>(null);
  const [buying, setBuying] = useState<ShopItem | null>(null);
  const [revealed, setRevealed] = useState<ShopItem | null>(null);
  const [nonce, setNonce] = useState(0);
  const uid = user?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    getShopItems()
      .then((i) => !cancelled && setItems(i))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Boutique indisponible.'));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!uid) {
      setOwned([]);
      return;
    }
    let cancelled = false;
    getMyPurchases(uid)
      .then((p) => !cancelled && setOwned(p))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [uid, nonce]);

  const ownedById = useMemo(() => new Map(owned.map((p) => [p.item_id, p])), [owned]);
  const balance = wallet?.balance ?? 0;
  const current = TABS.find((t) => t.id === tab)!;

  /** Équipé : l'objet acheté marqué équipé, ou le défaut quand rien d'autre ne l'est. */
  const isEquipped = (item: ShopItem) => {
    if (ownedById.get(item.id)?.equipped) return true;
    if (!item.is_default || !items) return false;
    return !items.some((i) => i.category === item.category && ownedById.get(i.id)?.equipped);
  };

  const afterChange = () => {
    setNonce((n) => n + 1);
    refreshWallet();
    refreshMine();
    if (uid) invalidateCosmetics(uid);
  };

  const equip = async (item: ShopItem) => {
    setError(null);
    try {
      await equipItem(item.id);
      afterChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible d’équiper cet objet.');
    }
  };

  return (
    <div className="container acc-scope">
      <div className="acc-page acc-page-wide">
        <SocialNav />
        <section className="acc-card acc-card-wide plf-shop-head">
          <div>
            <h1 className="acc-title">
              <Store size={26} aria-hidden /> Boutique
            </h1>
            <p className="acc-subtitle">Des cosmétiques pour ta borne. Tout se gagne en jouant : victoires, événements, série quotidienne.</p>
          </div>
          {status === 'signed-in' ? (
            <div className="plf-shop-balance">
              <span className="plf-shop-balance-label">Ton solde</span>
              <FeesAmount value={balance} size="lg" />
              {wallet && wallet.current_streak > 0 && (
                <span className="plf-streak">
                  <Flame size={14} aria-hidden /> Série : {wallet.current_streak}/7 jours
                </span>
              )}
            </div>
          ) : (
            <p className="neon-hint">
              <Link to="/connexion">Connecte-toi</Link> pour gagner et dépenser des FEES.
            </p>
          )}
        </section>

        <section className="acc-card acc-card-wide">
          <div className="soc-tabs plf-tabs" role="tablist" aria-label="Rayons de la boutique">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" className="soc-tab" aria-selected={tab === t.id} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          {error && (
            <p className="neon-error" role="alert">
              {error}
            </p>
          )}

          {items === null ? (
            <p className="neon-hint" role="status">
              Chargement…
            </p>
          ) : (
            current.categories.map((cat) => {
              const list = items.filter((i) => i.category === cat);
              return (
                <div key={cat} className="plf-shop-group">
                  {current.categories.length > 1 && <h2 className="ach-group-title">{CATEGORY_TITLES[cat]}</h2>}
                  <ul className="plf-shop-grid">
                    {list.map((item) => {
                      const mine = ownedById.get(item.id);
                      const equipped = isEquipped(item);
                      const req = requirementText(item.requirement ?? {});
                      const affordable = balance >= item.price;
                      return (
                        <li key={item.id} className="plf-shop-item" data-equipped={equipped || undefined} data-owned={Boolean(mine) || item.is_default || undefined}>
                          <ItemPreview item={item} username={profile?.username ?? 'Toi'} avatar={profile?.avatar ?? null} />
                          <h3>{item.name}</h3>
                          {item.description && <p>{item.description}</p>}
                          {req && (
                            <p className="plf-shop-req">
                              <Lock size={12} aria-hidden /> {req}
                            </p>
                          )}
                          <div className="plf-shop-foot">
                            {item.is_default ? <span className="plf-free">Gratuit</span> : <FeesAmount value={item.price} size="sm" />}
                            {item.category === 'victory_animation' && (
                              <button
                                type="button"
                                className="neon-btn plf-btn-sm"
                                data-variant="ghost"
                                onClick={() => celebrate({ fees: 0, anim: String(item.payload.anim) as VictoryAnim, preview: true })}
                              >
                                <Play size={14} aria-hidden /> Aperçu
                              </button>
                            )}
                            {status !== 'signed-in' ? null : equipped ? (
                              <span className="plf-equipped">
                                <Check size={14} aria-hidden /> Équipé
                              </span>
                            ) : mine || item.is_default ? (
                              item.category === 'badge' ? (
                                <span className="plf-equipped">
                                  <Check size={14} aria-hidden /> Possédé
                                </span>
                              ) : (
                                <button type="button" className="neon-btn plf-btn-sm" onClick={() => void equip(item)}>
                                  Équiper
                                </button>
                              )
                            ) : (
                              <button
                                type="button"
                                className="neon-btn plf-btn-sm"
                                data-variant={affordable ? 'solid' : undefined}
                                onClick={() => {
                                  setError(null);
                                  setBuying(item);
                                }}
                              >
                                <ShoppingBag size={14} aria-hidden /> Acheter
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
        </section>
      </div>

      {buying && (
        <BuyDialog
          item={buying}
          balance={balance}
          onClose={() => setBuying(null)}
          onBought={() => {
            setRevealed(buying);
            setBuying(null);
            afterChange();
          }}
        />
      )}
      {revealed && <HoloReveal item={revealed} onClose={() => setRevealed(null)} />}
    </div>
  );
}

function BuyDialog({ item, balance, onClose, onBought }: { item: ShopItem; balance: number; onClose: () => void; onBought: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const custom = Boolean(item.payload.custom);
  const short = balance < item.price;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (short) return;
    setBusy(true);
    setError(null);
    try {
      await buyItem(item.id, custom ? text : undefined);
      onBought();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Achat impossible.');
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Confirmer l'achat">
      <form className="plf-buy" onSubmit={submit}>
        <p>
          <strong>{item.name}</strong> pour <FeesAmount value={item.price} size="sm" />
        </p>
        {short ? (
          <p className="neon-error" role="alert">
            Pas assez de FEES ! Tu en as {formatFees(balance)}, il en faut {formatFees(item.price)}.
          </p>
        ) : (
          <p className="neon-hint">
            Solde après l'achat : {formatFees(balance - item.price)} FEES. Un achat est définitif.
          </p>
        )}
        {custom && !short && (
          <label className="neon-field">
            <span className="neon-field-label">Texte de ta plaque (5 caractères max.)</span>
            <input
              className="neon-input plf-plate-input"
              value={text}
              maxLength={5}
              onChange={(e) => setText(e.target.value.toUpperCase().replace(/[^A-Z0-9 !?]/g, ''))}
              placeholder="GOAT"
              autoFocus
            />
          </label>
        )}
        {error && (
          <p className="neon-error" role="alert">
            {error}
          </p>
        )}
        <div className="plf-actions">
          <button type="submit" className="neon-btn" data-variant="solid" disabled={short || busy || (custom && !text.trim())}>
            {busy ? 'Achat…' : 'Acheter'}
          </button>
          <button type="button" className="neon-btn" data-variant="ghost" onClick={onClose}>
            Annuler
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** La confirmation d'achat : l'objet se retourne comme une carte holo. */
function HoloReveal({ item, onClose }: { item: ShopItem; onClose: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onClose, 4200);
    return () => window.clearTimeout(t);
  }, [onClose]);
  return (
    <div className="plf-holo-overlay" role="status" onClick={onClose}>
      <div className="plf-holo-card">
        <div className="plf-holo-face">
          <Sparkles size={40} aria-hidden />
          <span className="plf-holo-kicker">Nouvel objet</span>
          <strong>{item.name}</strong>
          <span>Équipé !</span>
        </div>
      </div>
    </div>
  );
}
