import { OrderRecord } from '../../../types';
import { adminConfirmOrder, adminSetDelivered, adminSetOnTheWay, adminSetPreparing, adminSetReadyForRider } from '../../../utils/orderStorage';
import { isPickup, nextStep, shortRef } from './orderMeta';

/** Moves an order one step forward. Returns a short confirmation message, or null if nothing to do. */
export function advanceOrder(o: OrderRecord): string | null {
  const next = nextStep(o);
  if (!next) return null;
  const ref = shortRef(o.orderReference);
  switch (next.step) {
    case 'accept':
      adminConfirmOrder(o.orderReference);
      return `${ref} accepted`;
    case 'start':
      adminSetPreparing(o.orderReference);
      return `${ref} is being prepared`;
    case 'ready':
      adminSetReadyForRider(o.orderReference);
      return `${ref} is ready – riders can pick it up`;
    case 'send':
      adminSetOnTheWay(o.orderReference);
      return isPickup(o) ? `${ref} is ready for pickup` : `${ref} is out for delivery`;
    case 'finish':
      adminSetDelivered(o.orderReference);
      return isPickup(o) ? `${ref} collected` : `${ref} delivered`;
  }
}
