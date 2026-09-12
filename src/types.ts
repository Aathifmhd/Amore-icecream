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

export type ServingFormat = 'waffle-cone' | 'biscuit-cup' | 'double-cone' | 'double-biscuit-cup';

export interface ScoopItem {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: FlavorCategory;
  conePriceLKR: number;
  biscuitCupPriceLKR: number;
  doubleConePriceLKR: number;
  doubleCupPriceLKR: number;
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
  isAvailable?: boolean;
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
  isAvailable?: boolean;
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
  paymentMethod: 'card' | 'cash';
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
  status: 'pending_confirmation' | 'paid' | 'confirmed' | 'cancelled' | 'preparing' | 'delivered';
  paymentMethod?: 'card' | 'cash' | 'cod';
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
  deliveredAt?: string;
}

