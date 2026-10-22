import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SelectedOrderItem, BranchId, Currency, OrderRecord } from '../types';
import { AMORE_BRANCHES } from '../data/iceCreamData';
import { formatPrice } from '../utils/currency';
import { placeOrder, generateOrderReference } from '../utils/orderStorage';
import { ApiError } from '../api';
import { ONLINE_CARD_PAYMENTS_ENABLED } from '../config';
import {
  X,
  CheckCircle2,
  ShoppingBag,
  MapPin,
  CreditCard,
  Banknote,
  Lock,
  ShieldCheck,
  Truck,
  Sparkles,
  AlertCircle,
  LogIn,
  Clock,
  ArrowRight,
  Phone,
  User as UserIcon,
  Navigation,
  Store,
  Minus,
  Plus,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import { type User } from '../customerAuth';
import { LocationPickerModal } from './LocationPickerModal';
import { repriceForBranch } from '../utils/branchMenu';
import { nearestBranch } from '../utils/branchLocation';

interface QuickOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: SelectedOrderItem[];
  onRemoveItem: (index: number) => void;
  onUpdateQuantity: (index: number, newQty: number) => void;
  currency: Currency;
  initialBranch?: BranchId;
  onClearOrder: () => void;
  onBrowseMenu?: () => void;
  currentUser?: User | null;
  onOpenSignInModal?: () => void;
  onViewOrderInOrders?: (orderRef: string) => void;
}

type CheckoutStep = 'details' | 'processing' | 'confirmed';

const fieldClass =
  'w-full h-12 px-3.5 text-sm text-[#241A18] bg-[#FAF7F2] border border-[#D9CBB7] rounded-xl focus:ring-2 focus:ring-[#8C102A] focus:bg-white outline-hidden placeholder:text-[#A8988B]';

const StepTitle: React.FC<{ n: number; title: string }> = ({ n, title }) => (
  <div className="flex items-center gap-2.5 mb-3">
    <span className="w-6 h-6 rounded-full bg-[#8C102A] text-white text-xs font-bold flex items-center justify-center shrink-0">{n}</span>
    <h4 className="font-serif-title text-base font-bold text-[#241A18]">{title}</h4>
  </div>
);

// The last order's contact and address, kept on this device so the next checkout is quicker
const SAVED_DETAILS_KEY = 'amore_checkout_details_v1';
interface SavedDetails {
  uid: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  coords?: { lat: number; lng: number };
  orderType: 'delivery' | 'pickup';
  pickupBranch: BranchId;
}
function readSavedDetails(uid?: string): SavedDetails | null {
  if (!uid) return null;
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_DETAILS_KEY) || 'null') as SavedDetails | null;
    return saved && saved.uid === uid ? saved : null;
  } catch {
    return null;
  }
}
function saveDetails(details: SavedDetails) {
  try {
    localStorage.setItem(SAVED_DETAILS_KEY, JSON.stringify(details));
  } catch {
    /* storage blocked */
  }
}

export const QuickOrderModal: React.FC<QuickOrderModalProps> = ({
  isOpen,
  onClose,
  items,
  onRemoveItem,
  onUpdateQuantity,
  currency,
  initialBranch = 'akurana',
  onClearOrder,
  onBrowseMenu,
  currentUser,
  onOpenSignInModal,
  onViewOrderInOrders,
}) => {
  // Multi-step Checkout State
  const [step, setStep] = useState<CheckoutStep>('details');
  const [processingMessage, setProcessingMessage] = useState('Securing order details...');
  const [placeError, setPlaceError] = useState<string | null>(null);

  // Step 1: Customer Contact & Delivery Details
  const [customerName, setCustomerName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [orderType, setOrderType] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [city, setCity] = useState('');
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [specialNote, setSpecialNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);

  // Payment Method Selection: 'card' or 'cod' for delivery; 'pay_at_parlour' for pickup
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cod' | 'pay_at_parlour'>(
    ONLINE_CARD_PAYMENTS_ENABLED ? 'card' : 'cod'
  );

  // Secured Card Payment State
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [isReturnPolicyOpen, setIsReturnPolicyOpen] = useState(false);

  // Delivery: the parlour nearest the pin (or named in the address). Pickup: the one the customer picks.
  const [detectedBranchId, setDetectedBranchId] = useState<BranchId>(initialBranch);
  const [pickupBranchId, setPickupBranchId] = useState<BranchId>(initialBranch);

  // Confirmed Order Reference
  const [confirmedOrderRef, setConfirmedOrderRef] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState<OrderRecord | null>(null);

  // Fill in what this customer used last time (only empty fields)
  useEffect(() => {
    const saved = readSavedDetails(currentUser?.uid);
    if (!saved) return;
    setCustomerName((v) => v || saved.name);
    setContactNumber((v) => v || saved.phone);
    if (!deliveryAddress && saved.address) {
      setDeliveryAddress(saved.address);
      setCity(saved.city);
      if (saved.coords) {
        setDeliveryCoords(saved.coords);
        setDetectedBranchId(nearestBranch(saved.coords));
      }
    }
    setOrderType(saved.orderType);
    setPickupBranchId(saved.pickupBranch);
  }, [currentUser?.uid]);

  // Auto-fill customer details from currentUser if available
  useEffect(() => {
    if (currentUser) {
      if (currentUser.displayName) {
        setCustomerName((v) => v || currentUser.displayName || '');
      }
      if (!cardHolder && currentUser.displayName) {
        setCardHolder(currentUser.displayName);
      }
    }
  }, [currentUser]);

  // Sync payment method when orderType switches: Parlour Pickup defaults to 'pay_at_parlour'
  useEffect(() => {
    if (orderType === 'pickup') {
      setPaymentMethod('pay_at_parlour');
    } else if (paymentMethod === 'pay_at_parlour') {
      setPaymentMethod(ONLINE_CARD_PAYMENTS_ENABLED ? 'card' : 'cod');
    }
  }, [orderType]);

  // Enforce USD rule: If currency is USD and delivery is selected, cash on delivery is not allowed
  useEffect(() => {
    if (ONLINE_CARD_PAYMENTS_ENABLED && orderType === 'delivery' && currency === 'USD' && paymentMethod === 'cod') {
      setPaymentMethod('card');
    }
  }, [currency, paymentMethod, orderType]);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setStep('details');
      setConfirmedOrderRef('');
      setConfirmedOrder(null);
    }
  }, [isOpen]);

  // Automatically track and resolve branch based on address & city
  useEffect(() => {
    // A map pin already says which parlour is nearest
    if (deliveryCoords) return;
    const text = `${deliveryAddress} ${city}`.toLowerCase().trim();
    if (!text) return;

    if (
      text.includes('colombo') ||
      text.includes('marine') ||
      text.includes('dehiwala') ||
      text.includes('kollupitiya') ||
      text.includes('bambalapitiya') ||
      text.includes('wellawatte') ||
      text.includes('mount lavinia') ||
      text.includes('nugegoda') ||
      text.includes('rajagiriya') ||
      text.includes('battaramulla') ||
      text.includes('negombo') ||
      text.includes('gampaha') ||
      text.includes('kalutara') ||
      text.includes('moratuwa') ||
      text.includes('havelock') ||
      text.includes('western')
    ) {
      setDetectedBranchId('colombo');
    } else if (
      text.includes('arugam') ||
      text.includes('bay') ||
      text.includes('pottuvil') ||
      text.includes('eastern') ||
      text.includes('batticaloa') ||
      text.includes('ampara') ||
      text.includes('kalmunai') ||
      text.includes('pasikuda') ||
      text.includes('panama')
    ) {
      setDetectedBranchId('arugambay');
    } else if (
      text.includes('kandy') ||
      text.includes('akurana') ||
      text.includes('katugastota') ||
      text.includes('peradeniya') ||
      text.includes('matale') ||
      text.includes('gampola') ||
      text.includes('kundasale') ||
      text.includes('central')
    ) {
      setDetectedBranchId('akurana');
    }
  }, [deliveryAddress, city, deliveryCoords]);

  const assignedBranchId = orderType === 'pickup' ? pickupBranchId : detectedBranchId;
  const assignedBranch = AMORE_BRANCHES.find((b) => b.id === assignedBranchId) || AMORE_BRANCHES[0];

  // A fixed field clears the message about it
  useEffect(() => {
    setFormError(null);
  }, [customerName, contactNumber, deliveryAddress, orderType, cardNumber, cardExpiry, cardCvv]);

  // Pricing calculations
  // Each branch can set its own prices: price the tray for the branch that will make the order
  const pricedItems = useMemo(() => items.map((it) => repriceForBranch(it, assignedBranch.id)), [items, assignedBranch.id]);
  const subtotalLKR = pricedItems.reduce((acc, it) => acc + it.priceLKR * it.quantity, 0);
  const deliveryFeeLKR = orderType === 'delivery' ? (subtotalLKR >= 3000 ? 0 : 250) : 0;
  const grandTotalLKR = subtotalLKR + deliveryFeeLKR;

  // Format card number with spaces
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
    const parts = raw.match(/[\s\S]{1,4}/g) || [];
    setCardNumber(parts.join(' '));
  };

  // Format expiry MM/YY
  const handleCardExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      setCardExpiry(`${raw.slice(0, 2)}/${raw.slice(2)}`);
    } else {
      setCardExpiry(raw);
    }
  };

  const getCardBrand = (num: string) => {
    const clean = num.replace(/\s/g, '');
    if (clean.startsWith('4')) return 'Visa';
    if (/^5[1-5]/.test(clean) || /^2[2-7]/.test(clean)) return 'Mastercard';
    if (/^3[47]/.test(clean)) return 'Amex';
    return 'Credit/Debit';
  };

  const formatLabel = (format?: string) => {
    switch (format) {
      case 'biscuit-cup':
        return 'Biscuit Cup';
      case 'waffle-cone':
        return 'Waffle Cone';
      case 'double-biscuit-cup':
        return 'Double Biscuit Cup';
      case 'double-cone':
        return 'Double Waffle Cone';
      default:
        return 'Standard';
    }
  };

  // Submission: "Confirm Order"
  const handleConfirmOrder = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Mandatory Login Gate
    if (!currentUser) {
      if (onOpenSignInModal) {
        onOpenSignInModal();
      }
      return;
    }

    // 2. Validate Contact and Delivery Details (the message shows above the button)
    const fail = (message: string, field?: React.RefObject<HTMLInputElement | null>) => {
      setFormError(message);
      field?.current?.focus();
      field?.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    if (orderType === 'delivery' && !deliveryAddress.trim()) {
      return fail('Add your house number and street, or drop a pin on the map.', addressRef);
    }
    if (!customerName.trim()) return fail('Add your name.', nameRef);
    if (contactNumber.replace(/\D/g, '').length < 9) return fail('Add a phone number we can call (at least 9 digits).', phoneRef);

    // 3. Validate Card Details only if Doorstep Delivery with Card payment is selected
    const cleanCard = cardNumber.replace(/\s/g, '');
    if (ONLINE_CARD_PAYMENTS_ENABLED && orderType === 'delivery' && paymentMethod === 'card') {
      if (cleanCard.length < 15) return fail('Enter your full card number.');
      if (!cardExpiry.includes('/') || cardExpiry.length < 5) return fail('Enter the card expiry date (MM/YY).');
      if (cardCvv.length < 3) return fail('Enter the 3 or 4 digit CVV.');
    }

    // 4. Trigger 2.5s Processing Animation
    setFormError(null);
    setPlaceError(null);
    setStep('processing');
    setProcessingMessage(orderType === 'pickup' ? 'Locking in your parlour pickup order...' : 'Securing payment details...');

    setTimeout(() => {
      setProcessingMessage(`Routing order to Amore ${assignedBranch.city} parlour...`);
    }, 800);

    setTimeout(() => {
      setProcessingMessage('Locking in kitchen batch & creating reference...');
    }, 1600);

    // Generate Order Reference
    const ref = generateOrderReference('AMO');

    const newOrder: OrderRecord = {
      orderReference: ref,
      createdAt: new Date().toISOString(),
      customerName: customerName.trim(),
      contactNumber: contactNumber.trim(),
      orderType,
      deliveryAddress: deliveryAddress.trim(),
      city: city.trim() || assignedBranch.city,
      deliveryCoordinates: deliveryCoords,
      specialNote: specialNote.trim(),
      whatsappNumber: contactNumber.trim(),
      emailAddress: currentUser.email || '',
      branchId: assignedBranch.id,
      branchName: assignedBranch.name,
      branchCity: assignedBranch.city,
      items: pricedItems,
      subtotalLKR,
      deliveryFeeLKR,
      grandTotalLKR,
      currency,
      status: 'pending_confirmation',
      paymentMethod: orderType === 'pickup' ? 'pay_at_parlour' : paymentMethod === 'card' ? 'card' : 'cod',
      paidAt: undefined,
      cardLast4: orderType === 'delivery' && paymentMethod === 'card' ? cleanCard.slice(-4) : undefined,
      cardBrand: orderType === 'delivery' && paymentMethod === 'card' ? getCardBrand(cardNumber) : undefined,
      userId: currentUser?.uid,
    };

    // The order is sent while the animation plays; "confirmed" only shows once the parlour has it
    const placing = placeOrder(newOrder);
    const minimumWait = new Promise((resolve) => setTimeout(resolve, 2400));

    Promise.all([placing, minimumWait])
      .then(([saved]) => {
        setConfirmedOrderRef(saved.orderReference);
        setConfirmedOrder(saved);
        saveDetails({
          uid: currentUser.uid,
          name: customerName.trim(),
          phone: contactNumber.trim(),
          address: deliveryAddress.trim(),
          city: city.trim(),
          coords: deliveryCoords,
          orderType,
          pickupBranch: pickupBranchId,
        });
        // Clear the cart
        onClearOrder();
        // Show Confirmed Animation Step
        setStep('confirmed');
      })
      .catch(async (err) => {
        await minimumWait;
        setPlaceError(
          err instanceof ApiError && err.status !== 0
            ? err.message
            : 'We could not reach Amore. Check your internet connection and try again — your tray is still here.'
        );
        setStep('details');
      });
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-modal-title"
      className="mobile-sheet-backdrop fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="mobile-sheet-panel relative w-full max-w-[500px] bg-white rounded-3xl overflow-hidden shadow-2xl border border-[#E8DFC8] my-auto max-h-[92vh] flex flex-col transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#FAF7F2] px-5 py-4 border-b border-[#E8DFC8] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#8C102A] text-white flex items-center justify-center shadow-xs">
              {step === 'confirmed' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
              ) : step === 'processing' ? (
                <Sparkles className="w-5 h-5 text-amber-200 animate-spin" />
              ) : (
                <ShoppingBag className="w-5 h-5 text-amber-200" />
              )}
            </div>
            <div>
              <h3 id="order-modal-title" className="font-serif-title text-xl font-bold text-[#241A18] leading-tight">
                {step === 'details' && 'Your Tray & Checkout'}
                {step === 'processing' && 'Processing Order...'}
                {step === 'confirmed' && 'Order Confirmed!'}
              </h3>
              <p className="text-xs text-[#7A6458]">
                {step === 'details' && `${items.length} ${items.length === 1 ? 'item' : 'items'} in Tray`}
                {step === 'processing' && 'Connecting with parlour kitchen'}
                {step === 'confirmed' && `Reference: ${confirmedOrderRef}`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 text-[#241A18] flex items-center justify-center shadow-xs border border-[#E0D5C3] cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEP 2: PROCESSING ANIMATION */}
        {step === 'processing' && (
          <div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center space-y-6 animate-fadeIn">
            {/* Churning Ice Cream Luxury Spinner */}
            <div className="relative w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-[#8C102A]/15 border-t-[#8C102A] animate-spin" />
              <div className="w-16 h-16 rounded-full bg-[#FAF5EE] border border-[#E8DFC8] flex items-center justify-center text-2xl shadow-inner animate-pulse">
                🍨
              </div>
            </div>

            <div>
              <h4 className="font-serif-title text-xl font-bold text-[#241A18]">
                Preparing Your Order
              </h4>
              <p className="text-xs text-[#8C102A] font-semibold mt-2 animate-pulse">
                {processingMessage}
              </p>
              <p className="text-[11px] text-[#7A6458] mt-1 max-w-xs mx-auto">
                Connecting directly to our Akurana, Colombo, and Arugam Bay parlour networks.
              </p>
            </div>
          </div>
        )}

        {/* STEP 3: ORDER CONFIRMED ANIMATION & PREVIEW */}
        {step === 'confirmed' && (
          <div className="p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-5 animate-fadeIn">
            {/* Animated Checkmark Badge */}
            <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-lg border-4 border-emerald-200 animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wider mb-2">
                Order Placed Successfully
              </span>
              <h4 className="font-serif-title text-2xl font-bold text-[#241A18]">
                Thank You for Your Order!
              </h4>
              <p className="text-sm font-mono font-bold text-[#8C102A] mt-1">
                Ref: {confirmedOrderRef}
              </p>
            </div>

            {/* 2-Minute Grace Period Alert */}
            <div className="w-full p-4 rounded-2xl bg-amber-50 border border-amber-200 text-left space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                <Clock className="w-4 h-4 text-amber-700 animate-pulse" />
                <span>2-Minute Grace Period Active</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                You have a <strong>2-minute window</strong> to edit your delivery address or cancel your order in <strong>Your Orders</strong> before the kitchen locks in preparation!
              </p>
            </div>

            {/* Actions */}
            <div className="w-full flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onViewOrderInOrders) {
                    onViewOrderInOrders(confirmedOrderRef);
                  }
                }}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#8C102A] hover:bg-[#A31634] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <span>Track in Your Orders</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Done & Continue Browsing
              </button>
            </div>
          </div>
        )}

        {/* STEP 1: DETAILS & CHECKOUT FORM */}
        {step === 'details' && (
          <form onSubmit={handleConfirmOrder} noValidate className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
              {/* Tray */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-serif-title text-base font-bold text-[#241A18]">Your tray</h4>
                  {items.length > 0 && (
                    <button type="button" onClick={onClearOrder} className="text-xs font-bold text-red-600 hover:underline cursor-pointer px-1 py-1">
                      Clear tray
                    </button>
                  )}
                </div>

                {items.length === 0 ? (
                  <div className="p-6 text-center bg-[#FAF7F2] rounded-2xl border border-dashed border-[#E8DFC8]">
                    <ShoppingBag className="w-8 h-8 mx-auto text-[#8C102A]/60 mb-2" />
                    <p className="text-sm font-bold text-[#241A18]">Your tray is empty</p>
                    <p className="text-xs text-[#7A6458] mt-1">Add ice cream, coffee or cake from the menu.</p>
                    {onBrowseMenu && (
                      <button
                        type="button"
                        onClick={onBrowseMenu}
                        className="mt-4 px-5 py-2.5 rounded-xl bg-[#8C102A] hover:bg-[#A31634] text-white text-sm font-bold cursor-pointer"
                      >
                        Browse the menu
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {pricedItems.map((it, idx) => (
                      <div key={idx} className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#E8DFC8] flex items-center gap-3">
                        {it.image ? (
                          <img
                            loading="lazy"
                            decoding="async"
                            src={it.image}
                            alt=""
                            className="w-14 h-14 rounded-xl object-cover border border-[#E0D5C3] shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-amber-100 flex items-center justify-center text-xl shrink-0">🍨</div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-[#241A18] truncate">{it.name}</p>
                          <p className="text-xs text-[#7A6458]">
                            {it.format ? formatLabel(it.format) : 'Regular'} · {formatPrice(it.priceLKR, currency)}
                          </p>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="flex items-center bg-white rounded-full border border-[#D9CBB7]">
                              <button
                                type="button"
                                onClick={() => (it.quantity <= 1 ? onRemoveItem(idx) : onUpdateQuantity(idx, it.quantity - 1))}
                                aria-label={it.quantity <= 1 ? `Remove ${it.name}` : `One less ${it.name}`}
                                className="w-9 h-9 rounded-full flex items-center justify-center text-[#3D2C24] hover:text-[#8C102A] hover:bg-[#FAF7F2] cursor-pointer"
                              >
                                {it.quantity <= 1 ? <Trash2 className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                              </button>
                              <span className="w-7 text-center text-sm font-bold text-[#241A18]" aria-label="Quantity">
                                {it.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => onUpdateQuantity(idx, it.quantity + 1)}
                                aria-label={`One more ${it.name}`}
                                className="w-9 h-9 rounded-full flex items-center justify-center text-[#3D2C24] hover:text-[#8C102A] hover:bg-[#FAF7F2] cursor-pointer"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                            <span className="text-sm font-bold text-[#8C102A]">{formatPrice(it.priceLKR * it.quantity, currency)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* MANDATORY SIGN-IN GATE */}
              {!currentUser ? (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-[#FAF5EE] to-[#F2E5D5] border-2 border-[#8C102A]/20 shadow-xs space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#8C102A] text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                      <LogIn className="w-5 h-5 text-amber-200" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#241A18]">Sign in to order</h4>
                      <p className="text-xs text-[#6E5D54] mt-0.5 leading-relaxed">
                        One tap with Google. Your order then shows in Your Orders, and you can change it for 2 minutes.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {currentUser.photoURL ? (
                      <img
                        loading="lazy"
                        decoding="async"
                        src={currentUser.photoURL}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-full object-cover border border-[#8C102A] shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#8C102A] text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {(currentUser.displayName || currentUser.email || 'A')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-emerald-950 truncate">Ordering as {currentUser.displayName || 'Amore Member'}</p>
                      <p className="text-[11px] text-emerald-700 truncate">{currentUser.email}</p>
                    </div>
                  </div>
                  <button type="button" onClick={onOpenSignInModal} className="text-xs font-bold text-[#8C102A] hover:underline cursor-pointer ml-2 px-1 py-1 shrink-0">
                    Switch
                  </button>
                </div>
              )}

              <div className={`space-y-6 ${!currentUser ? 'hidden sm:block sm:opacity-40 sm:pointer-events-none' : ''}`}>
                {/* 1 · Delivery or pickup */}
                <section>
                  <StepTitle n={1} title="How would you like it?" />
                  <div className="grid grid-cols-2 gap-2.5">
                    {(
                      [
                        {
                          id: 'delivery',
                          icon: <Truck className="w-5 h-5" />,
                          title: 'Delivery',
                          sub: subtotalLKR >= 3000 ? 'Free delivery' : `${formatPrice(250, currency)} · free over ${formatPrice(3000, currency)}`,
                        },
                        { id: 'pickup', icon: <Store className="w-5 h-5" />, title: 'Pickup', sub: 'Ready in 15–20 min' },
                      ] as const
                    ).map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        aria-pressed={orderType === o.id}
                        onClick={() => setOrderType(o.id)}
                        className={`relative p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                          orderType === o.id ? 'bg-red-50/70 border-[#8C102A] ring-1 ring-[#8C102A] shadow-xs' : 'bg-[#FAF7F2] border-[#D9CBB7] hover:bg-white'
                        }`}
                      >
                        <span
                          className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${
                            orderType === o.id ? 'bg-[#8C102A] text-amber-200' : 'bg-white border border-[#E0D5C3] text-[#8C102A]'
                          }`}
                        >
                          {o.icon}
                        </span>
                        <span className="block text-sm font-bold text-[#241A18]">{o.title}</span>
                        <span className="block text-[11px] text-[#7A6458] mt-0.5 leading-snug">{o.sub}</span>
                        {orderType === o.id && <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-[#8C102A]" />}
                      </button>
                    ))}
                  </div>
                </section>

                {/* 2 · Where */}
                {orderType === 'delivery' ? (
                  <section>
                    <StepTitle n={2} title="Delivery address" />
                    {deliveryCoords ? (
                      <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center shrink-0">
                          <MapPin className="w-5 h-5 text-emerald-700" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Pinned on the map</p>
                          <p className="text-sm text-[#241A18] truncate">{[deliveryAddress, city].filter(Boolean).join(', ') || 'Your pin'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsLocationPickerOpen(true)}
                          className="px-3 py-2 rounded-xl text-xs font-bold text-[#8C102A] hover:bg-white cursor-pointer shrink-0"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsLocationPickerOpen(true)}
                        className="w-full p-3.5 rounded-2xl border-2 border-dashed border-[#8C102A]/35 bg-[#8C102A]/5 hover:bg-[#8C102A]/10 flex items-center gap-3 text-left transition-colors cursor-pointer"
                      >
                        <span className="w-11 h-11 rounded-xl bg-[#8C102A] text-amber-200 flex items-center justify-center shrink-0 shadow-xs">
                          <Navigation className="w-5 h-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-[#8C102A]">Detect location & drop pin</span>
                          <span className="block text-xs text-[#7A6458] mt-0.5">We find you on the map — just check the pin is on your door.</span>
                        </span>
                        <ChevronRight className="w-5 h-5 text-[#8C102A] shrink-0" />
                      </button>
                    )}

                    <div className="mt-3 space-y-2.5">
                      <label className="block">
                        <span className="block text-xs font-bold text-[#5C4D44] mb-1.5">
                          House no. & street <span className="text-[#8C102A]">*</span>
                        </span>
                        <input
                          ref={addressRef}
                          type="text"
                          autoComplete="street-address"
                          placeholder="e.g. 12, Deegala Road"
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          className={fieldClass}
                        />
                      </label>
                      <label className="block">
                        <span className="block text-xs font-bold text-[#5C4D44] mb-1.5">Town / city</span>
                        <input
                          type="text"
                          autoComplete="address-level2"
                          placeholder="e.g. Akurana"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className={fieldClass}
                        />
                      </label>
                      <p className="flex items-center gap-1.5 text-xs text-[#7A6458]">
                        <Store className="w-3.5 h-3.5 text-[#8C102A] shrink-0" />
                        <span>
                          Made and sent from <strong className="text-[#3D2C24]">Amore {assignedBranch.name}</strong>
                        </span>
                      </p>
                    </div>
                  </section>
                ) : (
                  <section>
                    <StepTitle n={2} title="Pick up from" />
                    <div className="space-y-2">
                      {AMORE_BRANCHES.map((b) => {
                        const on = pickupBranchId === b.id;
                        return (
                          <button
                            key={b.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setPickupBranchId(b.id)}
                            className={`w-full p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                              on ? 'bg-red-50/70 border-[#8C102A] ring-1 ring-[#8C102A] shadow-xs' : 'bg-[#FAF7F2] border-[#D9CBB7] hover:bg-white'
                            }`}
                          >
                            <span
                              className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                on ? 'border-[#8C102A]' : 'border-[#C9B9A4]'
                              }`}
                            >
                              {on && <span className="w-2.5 h-2.5 rounded-full bg-[#8C102A]" />}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-bold text-[#241A18]">Amore {b.name}</span>
                              <span className="block text-xs text-[#7A6458] mt-0.5">{b.address}</span>
                              <span className="block text-[11px] text-[#7A6458] mt-0.5">{b.hours}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* 3 · Contact */}
                <section>
                  <StepTitle n={3} title="Your details" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <label className="block">
                      <span className="block text-xs font-bold text-[#5C4D44] mb-1.5">
                        Name <span className="text-[#8C102A]">*</span>
                      </span>
                      <span className="relative block">
                        <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          ref={nameRef}
                          type="text"
                          autoComplete="name"
                          placeholder="Your name"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className={`${fieldClass} pl-10`}
                        />
                      </span>
                    </label>
                    <label className="block">
                      <span className="block text-xs font-bold text-[#5C4D44] mb-1.5">
                        Phone number <span className="text-[#8C102A]">*</span>
                      </span>
                      <span className="relative block">
                        <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          ref={phoneRef}
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="077 123 4567"
                          value={contactNumber}
                          onChange={(e) => setContactNumber(e.target.value)}
                          className={`${fieldClass} pl-10`}
                        />
                      </span>
                    </label>
                  </div>
                  <p className="text-[11px] text-[#7A6458] mt-1.5">
                    {orderType === 'delivery' ? 'The rider calls this number if they can’t find you.' : 'The parlour calls this number if needed.'}
                  </p>

                  {showNote || specialNote ? (
                    <label className="block mt-3">
                      <span className="block text-xs font-bold text-[#5C4D44] mb-1.5">Note for the parlour</span>
                      <textarea
                        value={specialNote}
                        onChange={(e) => setSpecialNote(e.target.value)}
                        rows={2}
                        maxLength={300}
                        placeholder="e.g. Ring the bell twice, less sugar…"
                        className={`${fieldClass} h-auto py-3`}
                      />
                    </label>
                  ) : (
                    <button type="button" onClick={() => setShowNote(true)} className="mt-2 text-xs font-bold text-[#8C102A] hover:underline cursor-pointer py-1">
                      + Add a note for the parlour
                    </button>
                  )}
                </section>

                {/* 4 · Payment */}
                <section>
                  <StepTitle n={4} title="Payment" />
                  {orderType === 'pickup' ? (
                    <div className="p-3.5 rounded-2xl bg-red-50/70 border border-[#8C102A] ring-1 ring-[#8C102A] flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl bg-white border border-[#E0D5C3] flex items-center justify-center text-purple-700 shrink-0">
                        <Store className="w-5 h-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-[#241A18]">Pay at the parlour</span>
                        <span className="block text-xs text-[#7A6458] mt-0.5">Cash, card or QR when you collect. Nothing to pay now.</span>
                      </span>
                      <CheckCircle2 className="w-5 h-5 text-[#8C102A] shrink-0" />
                    </div>
                  ) : (
                    <>
                      <div className={`grid ${!ONLINE_CARD_PAYMENTS_ENABLED || currency === 'USD' ? 'grid-cols-1' : 'grid-cols-2'} gap-2.5`}>
                        {ONLINE_CARD_PAYMENTS_ENABLED && (
                          <button
                            type="button"
                            aria-pressed={paymentMethod === 'card'}
                            onClick={() => setPaymentMethod('card')}
                            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                              paymentMethod === 'card' ? 'bg-red-50/70 border-[#8C102A] ring-1 ring-[#8C102A] shadow-xs' : 'bg-[#FAF7F2] border-[#D9CBB7] hover:bg-white'
                            }`}
                          >
                            <span className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-blue-600 shrink-0">
                              <CreditCard className="w-5 h-5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-bold text-[#241A18]">Card</span>
                              <span className="block text-xs text-slate-500">Visa, Mastercard, Amex</span>
                            </span>
                          </button>
                        )}
                        {(!ONLINE_CARD_PAYMENTS_ENABLED || currency !== 'USD') && (
                          <button
                            type="button"
                            aria-pressed={paymentMethod === 'cod'}
                            onClick={() => setPaymentMethod('cod')}
                            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                              paymentMethod === 'cod' ? 'bg-red-50/70 border-[#8C102A] ring-1 ring-[#8C102A] shadow-xs' : 'bg-[#FAF7F2] border-[#D9CBB7] hover:bg-white'
                            }`}
                          >
                            <span className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-emerald-600 shrink-0">
                              <Banknote className="w-5 h-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-bold text-[#241A18]">Cash on delivery</span>
                              <span className="block text-xs text-slate-500">Pay in LKR cash when your order arrives</span>
                            </span>
                            {paymentMethod === 'cod' && <CheckCircle2 className="w-5 h-5 text-[#8C102A] shrink-0" />}
                          </button>
                        )}
                      </div>

                      {ONLINE_CARD_PAYMENTS_ENABLED && paymentMethod === 'card' && (
                        <div className="mt-2.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5 animate-fadeIn">
                          <div className="flex items-center justify-between text-xs text-slate-600">
                            <span className="font-bold">Card details</span>
                            <span className="text-[11px] text-slate-500 flex items-center gap-1">
                              <Lock className="w-3 h-3 text-emerald-600" />
                              Encrypted
                            </span>
                          </div>
                          <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="cc-number"
                            placeholder="Card number"
                            value={cardNumber}
                            onChange={handleCardNumberChange}
                            className={`${fieldClass} bg-white font-mono tracking-wider`}
                          />
                          <input
                            type="text"
                            autoComplete="cc-name"
                            placeholder="Name on card"
                            value={cardHolder}
                            onChange={(e) => setCardHolder(e.target.value)}
                            className={`${fieldClass} bg-white`}
                          />
                          <div className="grid grid-cols-2 gap-2.5">
                            <input
                              type="text"
                              inputMode="numeric"
                              autoComplete="cc-exp"
                              placeholder="MM/YY"
                              value={cardExpiry}
                              onChange={handleCardExpiryChange}
                              className={`${fieldClass} bg-white font-mono text-center`}
                            />
                            <input
                              type="password"
                              inputMode="numeric"
                              autoComplete="cc-csc"
                              maxLength={4}
                              placeholder="CVV"
                              value={cardCvv}
                              onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                              className={`${fieldClass} bg-white font-mono text-center`}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsReturnPolicyOpen(true)}
                            className="text-xs text-[#8C102A] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Return & Refund Policy</span>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </section>
              </div>

              {/* Bill */}
              {items.length > 0 && (
                <section className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E8DFC8] space-y-2 text-sm text-[#5C4D44]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatPrice(subtotalLKR, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery</span>
                    <span>{orderType === 'pickup' || deliveryFeeLKR === 0 ? 'Free' : formatPrice(deliveryFeeLKR, currency)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base text-[#241A18] pt-2 border-t border-[#E8DFC8]">
                    <span>Total</span>
                    <span className="text-[#8C102A]">{formatPrice(grandTotalLKR, currency)}</span>
                  </div>
                </section>
              )}
            </div>

            {/* Always in reach: what's wrong (if anything) and the order button */}
            <div className="shrink-0 border-t border-[#E8DFC8] bg-white px-4 sm:px-5 pt-3 pb-3">
              {(formError || placeError) && (
                <p role="alert" className="mb-2.5 flex items-start gap-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                  <span>{formError || `Your order was not placed. ${placeError}`}</span>
                </p>
              )}
              <button
                type="submit"
                disabled={items.length === 0}
                className="w-full h-14 px-4 rounded-2xl bg-[#8C102A] hover:bg-[#A31634] text-white font-bold text-base shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {currentUser ? (
                  <>
                    <span>Confirm order · {formatPrice(grandTotalLKR, currency)}</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5 text-amber-200" />
                    <span>Sign in to order</span>
                  </>
                )}
              </button>
              <p className="text-[11px] text-slate-500 text-center mt-2">You can change or cancel your order for 2 minutes after placing it.</p>
            </div>
          </form>
        )}
      </div>

      {/* Interactive Map & GPS Location Picker Modal */}
      <LocationPickerModal
        isOpen={isLocationPickerOpen}
        onClose={() => setIsLocationPickerOpen(false)}
        initialAddress={deliveryAddress}
        initialCity={city}
        initialCoords={deliveryCoords}
        fallbackBranch={detectedBranchId}
        onSelectLocation={(loc) => {
          setDeliveryAddress(loc.address);
          if (loc.city) setCity(loc.city);
          setDeliveryCoords(loc.coords);
          setDetectedBranchId(nearestBranch(loc.coords));
        }}
      />

      {/* Return & Refund Policy Modal */}
      {isReturnPolicyOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#E8DFC8] space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0E8DC]">
              <div className="flex items-center gap-2 text-[#8C102A]">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-serif-title text-base font-bold text-[#241A18]">
                  Card Return & Refund Policy
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReturnPolicyOpen(false)}
                className="w-8 h-8 rounded-full bg-[#FAF7F2] text-slate-500 hover:text-black flex items-center justify-center cursor-pointer transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#5C4D44] leading-relaxed">
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                <p className="font-bold text-emerald-950 flex items-center gap-1.5 mb-1">
                  <span>🛡️</span>
                  <span>100% Refund Guarantee</span>
                </p>
                <p className="text-emerald-900 text-[11px] leading-relaxed">
                  If your order cannot be fulfilled by our parlour kitchen or is cancelled by management after your card payment has been captured, you are eligible for an immediate 100% refund of the full bill amount.
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-[#241A18] text-xs">Refund Method & Timeline:</h4>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-[#6B5A51]">
                  <li>Refunds are credited directly back to the original debit/credit card used during checkout.</li>
                  <li>Once approved by parlour management, funds typically reflect in your account within <strong>2 to 3 business days</strong> depending on your issuing bank.</li>
                  <li>A formal <strong>Returned Bill & Credit Note</strong> is generated and logged in our system for your financial records.</li>
                </ul>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-[#241A18] text-xs">Direct Parlour Support:</h4>
                <p className="text-[11px] text-[#6B5A51]">
                  For questions regarding returned transactions or immediate status inquiries, please contact our counter team at <strong>+94 11 234 5678</strong> or WhatsApp us with your Order Reference code.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsReturnPolicyOpen(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-[#8C102A] hover:bg-[#A31634] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                Understood & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
