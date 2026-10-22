/**
 * Each branch can use its own prices, photos and text for a menu item
 * (`branchOverrides.<branch>`, only what differs). Everything else follows the standard item.
 */
import { useCallback } from 'react';
import type { BranchId, BranchOverride, MenuItem, ScoopItem, SelectedOrderItem, ServingFormat } from '../types';
import { useCustomerBranch } from './stock';
import { scoopPhoto } from './menuPhotos';
import { getAllCakeItems, getAllCoffeeItems, getAllGelatoFlavours } from './menuStorage';

type Item = ScoopItem | MenuItem;

/** The fields a branch can change (everything in BranchOverride except who/when). */
export const BRANCH_FIELDS = [
  'name',
  'tagline',
  'description',
  'portionOrTemp',
  'image',
  'coneImage',
  'conePriceLKR',
  'biscuitCupPriceLKR',
  'doubleConePriceLKR',
  'doubleCupPriceLKR',
  'priceLKR',
] as const;
export type BranchField = (typeof BRANCH_FIELDS)[number];

/** The item as sold at this branch. */
export function forBranch<T extends Item>(item: T, branch: BranchId): T {
  const own = item.branchOverrides?.[branch];
  if (!own) return item;
  const { updatedAt: _at, updatedBy: _by, ...fields } = own;
  return { ...item, ...fields };
}

/** `forBranch` for the branch the customer has picked on the website. */
export function useForBranch(): <T extends Item>(item: T) => T {
  const [branch] = useCustomerBranch();
  return useCallback(<T extends Item>(item: T) => forBranch(item, branch), [branch]);
}

/** The fields this branch has changed (ignores values that happen to equal the standard). */
export function branchChanges(item: Item, branch: BranchId): Partial<Record<BranchField, unknown>> {
  const own = item.branchOverrides?.[branch];
  const out: Partial<Record<BranchField, unknown>> = {};
  if (!own) return out;
  for (const key of BRANCH_FIELDS) {
    if (own[key] !== undefined && own[key] !== (item as unknown as Record<string, unknown>)[key]) out[key] = own[key];
  }
  return out;
}

/** Price of one serving of an item. */
export function priceFor(item: Item, format?: ServingFormat): number {
  if (!('conePriceLKR' in item)) return item.priceLKR;
  switch (format) {
    case 'biscuit-cup':
      return item.biscuitCupPriceLKR;
    case 'double-cone':
      return item.doubleConePriceLKR;
    case 'double-biscuit-cup':
      return item.doubleCupPriceLKR;
    default:
      return item.conePriceLKR;
  }
}

/**
 * A tray line priced (and named, pictured) for the branch that will make the order —
 * the customer may have added it while looking at another branch.
 */
export function repriceForBranch(line: SelectedOrderItem, branch: BranchId): SelectedOrderItem {
  const base = [...getAllGelatoFlavours(), ...getAllCoffeeItems(), ...getAllCakeItems()].find((i) => i.id === line.itemId) as Item | undefined;
  if (!base) return line;
  const item = forBranch(base, branch);
  const photo = 'conePriceLKR' in item ? scoopPhoto(item, line.format) : item.image;
  return { ...line, name: item.name, priceLKR: priceFor(item, line.format), image: photo || line.image };
}

export type { BranchOverride };
