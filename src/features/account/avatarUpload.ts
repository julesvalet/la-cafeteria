import { getSupabase, supabaseConfig } from '../../lib/supabase';

/*
 * Photo de profil : vérification, recadrage, envoi.
 *
 * Le fichier choisi ne part jamais tel quel. Il est recadré en carré et
 * réencodé en 512 × 512 côté navigateur : ce qui arrive dans le bucket pèse
 * quelques dizaines de kilo-octets, les métadonnées de l'appareil photo
 * (position GPS comprise) sont perdues au passage, et un fichier piégé qui se
 * ferait passer pour une image ne survit pas au décodage.
 */

export const MAX_BYTES = 5 * 1024 * 1024;
export const MIN_SIDE = 200;
export const OUTPUT_SIDE = 512;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

export const ACCEPT_ATTR = ACCEPTED.join(',');

export async function loadImage(file: File): Promise<ImageBitmap> {
  if (!ACCEPTED.includes(file.type)) throw new Error('Formats acceptés : JPG, PNG ou WebP.');
  if (file.size > MAX_BYTES) throw new Error('Image trop lourde : 5 Mo au maximum.');
  let bitmap: ImageBitmap;
  try {
    // L'orientation EXIF est appliquée : une photo prise en portrait ne se
    // retrouve pas couchée.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Cette image ne se lit pas. Essaie un autre fichier.');
  }
  if (bitmap.width < MIN_SIDE || bitmap.height < MIN_SIDE) {
    bitmap.close();
    throw new Error(`Image trop petite : ${MIN_SIDE} × ${MIN_SIDE} pixels au minimum.`);
  }
  return bitmap;
}

/** Cadrage : zoom ≥ 1, et une position de −1 à 1 sur chaque axe (−1 = bord gauche/haut). */
export interface Framing {
  zoom: number;
  x: number;
  y: number;
}

/**
 * Où dessiner l'image pour un cadre carré de `side` pixels. À zoom 1 l'image
 * couvre juste le cadre ; la position répartit le surplus d'un bord à l'autre.
 * Le même calcul sert à l'aperçu et à l'export, qui ne peuvent donc pas
 * diverger.
 */
export function placement(img: { width: number; height: number }, f: Framing, side: number) {
  const scale = (side / Math.min(img.width, img.height)) * f.zoom;
  const w = img.width * scale;
  const h = img.height * scale;
  const slackX = w - side;
  const slackY = h - side;
  return { dx: -(slackX / 2) * (1 + f.x), dy: -(slackY / 2) * (1 + f.y), w, h, slackX, slackY };
}

export function drawFramed(ctx: CanvasRenderingContext2D, img: ImageBitmap, f: Framing, side: number) {
  const p = placement(img, f, side);
  ctx.clearRect(0, 0, side, side);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, p.dx, p.dy, p.w, p.h);
}

/** Le carré final. WebP si le navigateur sait l'encoder, JPEG sinon (Safari). */
export async function exportSquare(img: ImageBitmap, f: Framing): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = OUTPUT_SIDE;
  drawFramed(canvas.getContext('2d')!, img, f, OUTPUT_SIDE);
  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
  const webp = await encode('image/webp');
  if (webp && webp.type === 'image/webp') return webp;
  const jpeg = await encode('image/jpeg');
  if (!jpeg) throw new Error("Impossible de préparer l'image.");
  return jpeg;
}

const EXT: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };

/**
 * Dépose la photo dans `avatars/users/<id>/avatar.<ext>` en écrasant la
 * précédente, et renvoie son URL publique.
 *
 * Par XMLHttpRequest plutôt que par la bibliothèque : c'est la seule façon de
 * suivre la progression d'un envoi dans un navigateur.
 */
export async function uploadAvatar(userId: string, blob: Blob, onProgress: (ratio: number) => void): Promise<string> {
  const client = await getSupabase();
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Session expirée : reconnecte-toi.');

  const ext = EXT[blob.type] ?? 'webp';
  const path = `users/${userId}/avatar.${ext}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${supabaseConfig.url}/storage/v1/object/avatars/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', supabaseConfig.key);
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.setRequestHeader('Content-Type', blob.type);
    xhr.setRequestHeader('Cache-Control', 'max-age=3600');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(xhr.status === 413 ? 'Image trop lourde.' : `Envoi refusé (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error('Envoi interrompu. Vérifie ta connexion.'));
    xhr.send(blob);
  });

  // Une photo passée d'un format à l'autre laisserait l'ancien fichier orphelin.
  const stale = Object.values(EXT)
    .filter((e) => e !== ext)
    .map((e) => `users/${userId}/avatar.${e}`);
  void client.storage.from('avatars').remove(stale).catch(() => {});

  // Le paramètre de version contourne les caches : même chemin, nouvelle image.
  return `${supabaseConfig.url}/storage/v1/object/public/avatars/${path}?v=${Date.now()}`;
}

/** Retire la photo : le profil repasse à l'initiale, les fichiers sont effacés. */
export async function removeAvatarFiles(userId: string) {
  const client = await getSupabase();
  await client.storage
    .from('avatars')
    .remove(Object.values(EXT).map((e) => `users/${userId}/avatar.${e}`))
    .catch(() => {});
}
