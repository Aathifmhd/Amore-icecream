/**
 * Stock is kept per branch: an item's `soldOutAt` lists the branches where it is sold out.
 * (`isAvailable: false` is the old switch and still means sold out everywhere.)
 */
import { useSyncExternalStore } from 'react';
import type { BranchId } from '../types';

interface Stocked {
  isAvailable?: boolean;
  soldOutAt?: BranchId[];
}

export const isSoldOutAt = (item: Stocked, branch: BranchId) =>
  item.isAvailable === false || Boolean(item.soldOutAt?.includes(branch));

// The branch the customer is ordering from (the branch picker on the website)
let customerBranch: BranchId = 'akurana';
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const setCustomerBranch = (branch: BranchId) => {
  customerBranch = branch;
  listeners.forEach((fn) => fn());
};

export function useCustomerBranch(): [BranchId, (branch: BranchId) => void] {
  return [useSyncExternalStore(subscribe, () => customerBranch), setCustomerBranch];
}

/** `isSoldOut(item)` for the branch the customer has picked. */
export function useIsSoldOut(): (item: Stocked) => boolean {
  const [branch] = useCustomerBranch();
  return (item) => isSoldOutAt(item, branch);
}
