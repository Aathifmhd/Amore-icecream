/**
 * Ice cream flavours have two photos: `image` (the biscuit cup — the default) and an
 * optional `coneImage` (the waffle cone). A cone serving shows the cone photo when there is one.
 */
import type { ServingFormat } from '../types';

export const isConeFormat = (format?: string | null) => format === 'waffle-cone' || format === 'double-cone';

interface Photos {
  image?: string;
  coneImage?: string;
}

/** The photo for one serving of a flavour (also what is stored with the order line). */
export const scoopPhoto = (item: Photos, format?: ServingFormat | null): string | undefined =>
  (isConeFormat(format) && item.coneImage) || item.image;

/**
 * The photo on a menu card: the cone photo when the menu is switched to waffle cones, or when
 * the customer has picked only cones for this flavour; otherwise the biscuit cup photo.
 */
export function cardPhoto(item: Photos, view: 'both' | 'biscuit-cup' | 'waffle-cone', chosen: ServingFormat[] = []): string | undefined {
  const cone = view === 'waffle-cone' || (view === 'both' && chosen.length > 0 && chosen.every(isConeFormat));
  return scoopPhoto(item, cone ? 'waffle-cone' : 'biscuit-cup');
}
