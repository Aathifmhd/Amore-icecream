export type Currency = 'LKR' | 'USD';

export type BranchId = 'akurana' | 'colombo' | 'arugambay';

export interface BranchInfo {
  id: BranchId;
  name: string;
  selectorLabel?: string;
  tagline: string;
  address: string;
  city: string;
  phone: string;
  whatsapp: string;
  hours: string;
  touristHighlight?: string;
  vibeTag: string;
  badge?: string;
  mapUrl: string;
  image: string;
  description: string;
}

/**
 * A branch's own version of a menu item: only the fields that differ from the standard
 * (the super admin's) item. Set by that branch's admin or the super admin.
 */
export interface BranchOverride {
  name?: string;
  tagline?: string;
  description?: string;
  portionOrTemp?: string;
  image?: string;
  coneImage?: string;
  conePriceLKR?: number;
  biscuitCupPriceLKR?: number;
  priceLKR?: number;
  updatedAt?: string;
  updatedBy?: string;
}

export type FlavorCategory = 
  | 'all' 
  | 'signature' 
  | 'tropical-fruit' 
  | 'chocolate-decadence' 
  | 'bakery-swirl' 
  | 'coffee-spice'
  | 'gelato'
  | 'sorbet'
  | 'srilankan-twist';

// Double cone / double cup are no longer sold; they stay here so older orders still show them
export type ServingFormat = 'waffle-cone' | 'biscuit-cup' | 'double-cone' | 'double-biscuit-cup';

export interface ScoopItem {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: FlavorCategory;
  conePriceLKR: number;
  biscuitCupPriceLKR: number;
  image: string;
  dietary: ('Eggless' | 'Halal' | 'Gluten-Free' | 'Dairy-Free' | 'Vegetarian' | '100% Real Fruit')[];
  tastingNotes: string[];
  creaminess: number; // 1 to 5
  sweetness: number; // 1 to 5
  intensity: number; // 1 to 5
  isIconic?: boolean;
  isPopular?: boolean;
  isArugamBaySpecial?: boolean;
  accentColor: string;
  /** Waffle cone photo (optional). `image` is the biscuit cup photo, the default. */
  coneImage?: string;
  /** Old "sold out everywhere" switch; stock is now per branch (soldOutAt). */
  isAvailable?: boolean;
  /** Branches where this item is sold out right now. */
  soldOutAt?: BranchId[];
  /** Each branch's own prices, photos or text, where they differ from the standard item. */
  branchOverrides?: Partial<Record<BranchId, BranchOverride>>;
}

export type MenuTab = 'all' | 'scoops' | 'coffee' | 'cakes' | 'tourist-specials';

export interface MenuItem {
  id: string;
  name: string;
  category: 'coffee' | 'cakes' | 'beverages' | 'sundae';
  description: string;
  priceLKR: number;
  popular?: boolean;
  image?: string;
  portionOrTemp?: string;
  tags?: string[];
  /** Old "sold out everywhere" switch; stock is now per branch (soldOutAt). */
  isAvailable?: boolean;
  /** Branches where this item is sold out right now. */
  soldOutAt?: BranchId[];
  /** Each branch's own prices, photos or text, where they differ from the standard item. */
  branchOverrides?: Partial<Record<BranchId, BranchOverride>>;
}

export interface SelectedOrderItem {
  itemId: string;
  name: string;
  category: string;
  format?: ServingFormat;
  priceLKR: number;
  quantity: number;
  notes?: string;
  image?: string;
}

export interface OrderFormData {
  customerName: string;
  phone: string;
  email?: string;
  orderType: 'delivery' | 'pickup';
  deliveryAddress?: string;
  city?: string;
  branch: BranchId;
  pickupTime: string;
  paymentMethod: 'card' | 'cash' | 'pay_at_parlour';
  cardDetails?: {
    cardNumber: string;
    cardholderName: string;
    expiryDate: string;
    cvv: string;
  };
  notes?: string;
}

export interface OrderRecord {
  orderReference: string;
  createdAt: string;
  customerName: string;
  contactNumber: string;
  orderType: 'delivery' | 'pickup';
  deliveryAddress?: string;
  city?: string;
  deliveryCoordinates?: { lat: number; lng: number };
  specialNote?: string;
  whatsappNumber?: string;
  emailAddress?: string;
  branchId: BranchId;
  branchName: string;
  branchCity: string;
  items: SelectedOrderItem[];
  subtotalLKR: number;
  deliveryFeeLKR: number;
  grandTotalLKR: number;
  currency: Currency;
  status: 'pending_confirmation' | 'paid' | 'confirmed' | 'cancelled' | 'preparing' | 'on_the_way' | 'delivered';
  paymentMethod?: 'card' | 'cash' | 'cod' | 'pay_at_parlour';
  paidAt?: string;
  cardLast4?: string;
  cardBrand?: string;
  userId?: string;
  cancelledAt?: string;
  updatedAt?: string;
  cancelledBy?: 'customer' | 'admin';
  cancellationReason?: string;
  inconvenienceEmailContent?: string;
  confirmedAt?: string;
  preparingAt?: string;
  onTheWayAt?: string;
  deliveredAt?: string;
  isGracePeriodPaused?: boolean;
  gracePeriodRemainingSeconds?: number;
  gracePeriodPausedAt?: string;
  refundStatus?: 'pending' | 'completed';
  refundedAt?: string;
  refundAmountLKR?: number;
  customerDeletedHistory?: boolean;
  /** Delivery packed and waiting for a rider (the status stays "preparing" until one picks it up) */
  readyAt?: string;
  /** The rider who picked it up (rider app) */
  riderId?: string;
  riderName?: string;
  riderPhone?: string;
  /** Cash the rider confirmed collecting at the door */
  cashCollectedLKR?: number;
  /** Why the last rider handed it back ("Kamal: Customer not answering") */
  riderNote?: string;
}

