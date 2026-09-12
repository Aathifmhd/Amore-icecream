import React, { useState, useEffect } from 'react';
import { SelectedOrderItem, BranchId, Currency, OrderRecord } from '../types';
import { AMORE_BRANCHES } from '../data/iceCreamData';
import { formatPrice } from '../utils/currency';
import { saveOrder } from '../utils/orderStorage';
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
  Cookie,
  AlertCircle,
  LogIn,
  Clock,
  ArrowRight,
  Phone,
  User as UserIcon,
} from 'lucide-react';
import { type User } from '../firebase';

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

  // Step 1: Customer Contact & Delivery Details
  const [customerName, setCustomerName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [orderType, setOrderType] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [city, setCity] = useState('');
  const [specialNote, setSpecialNote] = useState('');

  // Payment Method Selection
  // When currency is USD, only 'card' is allowed. When LKR, 'card' or 'cod' are allowed.
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cod'>('card');

  // Secured Card Payment State
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // Automatic Branch Detection
  const [detectedBranchId, setDetectedBranchId] = useState<BranchId>(initialBranch);
  const [isLocating, setIsLocating] = useState(false);

  // Confirmed Order Reference
  const [confirmedOrderRef, setConfirmedOrderRef] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState<OrderRecord | null>(null);

  // Auto-fill customer details from currentUser if available
  useEffect(() => {
    if (currentUser) {
      if (currentUser.displayName && !customerName) {
        setCustomerName(currentUser.displayName);
      }
      if (!cardHolder && currentUser.displayName) {
        setCardHolder(currentUser.displayName);
      }
    }
  }, [currentUser]);

  // Enforce USD rule: If currency is USD, cash on delivery is not allowed
  useEffect(() => {
    if (currency === 'USD' && paymentMethod === 'cod') {
      setPaymentMethod('card');
    }
  }, [currency, paymentMethod]);

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
  }, [deliveryAddress, city]);

  const assignedBranch =
    AMORE_BRANCHES.find((b) => b.id === detectedBranchId) || AMORE_BRANCHES[0];

  // Geolocation quick locator helper
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Location service is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        const distColombo = Math.hypot(latitude - 6.927, longitude - 79.861);
        const distKandy = Math.hypot(latitude - 7.29, longitude - 80.633);
        const distArugam = Math.hypot(latitude - 6.841, longitude - 81.835);

        if (distColombo < distKandy && distColombo < distArugam) {
          setCity('Colombo Area');
          setDetectedBranchId('colombo');
        } else if (distArugam < distKandy) {
          setCity('Arugam Bay / Coastal Area');
          setDetectedBranchId('arugambay');
        } else {
          setCity('Kandy / Akurana Area');
          setDetectedBranchId('akurana');
        }
      },
      () => {
        setIsLocating(false);
        setCity('Colombo');
        setDetectedBranchId('colombo');
      },
      { timeout: 6000 }
    );
  };

  // Pricing calculations
  const subtotalLKR = items.reduce((acc, it) => acc + it.priceLKR * it.quantity, 0);
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

    // 2. Validate Contact and Delivery Details
    if (!customerName.trim() || !contactNumber.trim()) {
      alert('Please provide your full name and contact phone number.');
      return;
    }

    if (orderType === 'delivery' && !deliveryAddress.trim()) {
      alert('Please provide your delivery street address.');
      return;
    }

    // 3. Validate Card Details if Card payment is selected
    const cleanCard = cardNumber.replace(/\s/g, '');
    if (paymentMethod === 'card') {
      if (cleanCard.length < 15) {
        alert('Please enter a valid 16-digit card number.');
        return;
      }
      if (!cardExpiry.includes('/') || cardExpiry.length < 5) {
        alert('Please enter your card expiry date (MM/YY).');
        return;
      }
      if (cardCvv.length < 3) {
        alert('Please enter your 3 or 4-digit CVV security code.');
        return;
      }
    }

    // 4. Trigger 2.5s Processing Animation
    setStep('processing');
    setProcessingMessage('Securing payment details...');

    setTimeout(() => {
      setProcessingMessage(`Routing order to Amore ${assignedBranch.city} parlour...`);
    }, 800);

    setTimeout(() => {
      setProcessingMessage('Locking in kitchen batch & creating reference...');
    }, 1600);

    setTimeout(() => {
      // Generate Order Reference
      const ref = `AMO-${Math.floor(1000 + Math.random() * 9000)}`;
      setConfirmedOrderRef(ref);

      const newOrder: OrderRecord = {
        orderReference: ref,
        createdAt: new Date().toISOString(),
        customerName: customerName.trim(),
        contactNumber: contactNumber.trim(),
        orderType,
        deliveryAddress: deliveryAddress.trim(),
        city: city.trim() || assignedBranch.city,
        specialNote: specialNote.trim(),
        whatsappNumber: contactNumber.trim(),
        emailAddress: currentUser.email || '',
        branchId: assignedBranch.id,
        branchName: assignedBranch.name,
        branchCity: assignedBranch.city,
        items: [...items],
        subtotalLKR,
        deliveryFeeLKR,
        grandTotalLKR,
        currency,
        status: paymentMethod === 'card' ? 'paid' : 'confirmed',
        paymentMethod: paymentMethod === 'card' ? 'card' : 'cod',
        paidAt: paymentMethod === 'card' ? new Date().toISOString() : undefined,
        cardLast4: paymentMethod === 'card' ? cleanCard.slice(-4) : undefined,
        cardBrand: paymentMethod === 'card' ? getCardBrand(cardNumber) : undefined,
        userId: currentUser.uid,
      };

      // Persist in local storage and Firestore
      saveOrder(newOrder);
      setConfirmedOrder(newOrder);

      // Clear the cart
      onClearOrder();

      // Show Confirmed Animation Step
      setStep('confirmed');
    }, 2400);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[500px] bg-white rounded-3xl overflow-hidden shadow-2xl border border-[#E8DFC8] my-auto max-h-[92vh] flex flex-col transition-all"
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
            {/* Churning Gelato Luxury Spinner */}
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
          <form onSubmit={handleConfirmOrder} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Tray Items List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#7A6458]">
                  Items in Tray ({items.length})
                </span>
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearOrder}
                    className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
                  >
                    Clear Tray
                  </button>
                )}
              </div>

              {items.length === 0 ? (
                <div className="p-6 text-center bg-[#FAF7F2] rounded-2xl border border-dashed border-[#E8DFC8]">
                  <ShoppingBag className="w-8 h-8 mx-auto text-[#8C102A]/60 mb-2" />
                  <p className="text-xs font-bold text-[#241A18]">Your tray is empty</p>
                  <p className="text-[11px] text-[#7A6458] mt-0.5">
                    Add artisanal scoops or cakes from our flavours menu.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {items.map((it, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#E8DFC8] flex items-center justify-between gap-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {it.image ? (
                          <img
                            src={it.image}
                            alt={it.name}
                            className="w-9 h-9 rounded-lg object-cover border border-[#E0D5C3] shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-xs shrink-0">
                            🍨
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-[#241A18] truncate">{it.name}</p>
                          <p className="text-[10px] text-[#7A6458]">
                            {it.format ? formatLabel(it.format) : 'Regular'} • {formatPrice(it.priceLKR, currency)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Stepper */}
                        <div className="flex items-center bg-white rounded-lg border border-[#D9CBB7] px-1.5 py-0.5">
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(idx, Math.max(1, it.quantity - 1))}
                            className="w-4 h-4 text-xs font-bold text-[#3D2C24] hover:text-[#8C102A]"
                          >
                            -
                          </button>
                          <span className="px-1 text-[11px] font-bold min-w-[14px] text-center">
                            {it.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(idx, it.quantity + 1)}
                            className="w-4 h-4 text-xs font-bold text-[#3D2C24] hover:text-[#8C102A]"
                          >
                            +
                          </button>
                        </div>

                        <span className="font-bold text-[#8C102A] text-xs">
                          {formatPrice(it.priceLKR * it.quantity, currency)}
                        </span>

                        <button
                          type="button"
                          onClick={() => onRemoveItem(idx)}
                          className="text-slate-400 hover:text-red-600 p-1"
                          aria-label="Remove item"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* MANDATORY SIGN-IN / SIGN-UP GATE */}
            {!currentUser ? (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#FAF5EE] to-[#F2E5D5] border-2 border-[#8C102A]/20 shadow-xs space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#8C102A] text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                    <LogIn className="w-5 h-5 text-amber-200" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#241A18]">
                      Sign In or Sign Up to Checkout
                    </h4>
                    <p className="text-xs text-[#6E5D54] mt-0.5 leading-relaxed">
                      Please sign in to enter your contact and delivery details. This connects your order to live tracking and enables our 2-minute change window.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onOpenSignInModal}
                  className="w-full py-3 px-4 rounded-xl bg-[#8C102A] hover:bg-[#A31634] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <LogIn className="w-4 h-4 text-amber-200" />
                  <span>Sign In / Create Account to Proceed</span>
                </button>
              </div>
            ) : (
              /* SIGNED-IN VERIFIED CUSTOMER BADGE */
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt="Profile"
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover border border-[#8C102A] shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#8C102A] text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {(currentUser.displayName || currentUser.email || 'A')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-emerald-950 truncate">
                      Ordering as {currentUser.displayName || 'Amore Member'}
                    </p>
                    <p className="text-[10px] text-emerald-700 truncate">{currentUser.email}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onOpenSignInModal}
                  className="text-[11px] font-bold text-[#8C102A] hover:underline cursor-pointer ml-2 shrink-0"
                >
                  Switch
                </button>
              </div>
            )}

            {/* CONTACT & DELIVERY DETAILS (ENABLED ONLY WHEN SIGNED IN) */}
            <div className={`space-y-3 pt-2 border-t border-[#E8DFC8] ${!currentUser ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#3D2C24]">
                <MapPin className="w-4 h-4 text-[#8C102A]" />
                <span>Contact & Delivery Details</span>
              </div>

              {/* Full Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5C4D44] mb-1">
                    Full Name <span className="text-[#8C102A]">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <UserIcon className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Aathif Mohamed"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs text-[#241A18] bg-[#FAF7F2] border border-[#D9CBB7] rounded-xl focus:ring-2 focus:ring-[#8C102A] focus:bg-white outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5C4D44] mb-1">
                    Contact Number <span className="text-[#8C102A]">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Phone className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="tel"
                      required
                      placeholder="+94 77 123 4567"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs text-[#241A18] bg-[#FAF7F2] border border-[#D9CBB7] rounded-xl focus:ring-2 focus:ring-[#8C102A] focus:bg-white outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Order Type Toggle (Delivery vs Pickup) */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOrderType('delivery')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                    orderType === 'delivery'
                      ? 'bg-[#8C102A] text-white border-[#8C102A] shadow-xs'
                      : 'bg-[#FAF7F2] text-[#5C4D44] border-[#D9CBB7] hover:bg-white'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Doorstep Delivery</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOrderType('pickup')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                    orderType === 'pickup'
                      ? 'bg-[#8C102A] text-white border-[#8C102A] shadow-xs'
                      : 'bg-[#FAF7F2] text-[#5C4D44] border-[#D9CBB7] hover:bg-white'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Parlour Pickup</span>
                </button>
              </div>

              {/* Address Fields for Delivery */}
              {orderType === 'delivery' ? (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5C4D44]">
                      Street Address & City <span className="text-[#8C102A]">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleUseCurrentLocation}
                      disabled={isLocating}
                      className="text-[10px] font-bold text-[#8C102A] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isLocating ? 'Locating...' : 'Auto-detect location'}</span>
                    </button>
                  </div>

                  <input
                    type="text"
                    required
                    placeholder="House/Apartment no., Street Name"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full px-3 py-2 text-xs text-[#241A18] bg-[#FAF7F2] border border-[#D9CBB7] rounded-xl focus:ring-2 focus:ring-[#8C102A] focus:bg-white outline-hidden"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="City / Area (e.g. Akurana, Colombo 03)"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-2 text-xs text-[#241A18] bg-[#FAF7F2] border border-[#D9CBB7] rounded-xl focus:ring-2 focus:ring-[#8C102A] focus:bg-white outline-hidden"
                    />
                    <div className="px-3 py-2 bg-[#FAF7F2] border border-[#D9CBB7] rounded-xl text-[11px] text-[#7A6458] flex items-center gap-1 truncate">
                      <span className="font-bold text-[#8C102A]">Parlour:</span>
                      <span className="truncate">{assignedBranch.city}</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Pickup Branch Info */
                <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#D9CBB7] text-xs space-y-1">
                  <p className="font-bold text-[#241A18]">
                    Pickup Branch: {assignedBranch.name} ({assignedBranch.city})
                  </p>
                  <p className="text-[11px] text-[#7A6458]">
                    {assignedBranch.address} • Ready in approx. 15-20 mins
                  </p>
                </div>
              )}
            </div>

            {/* PAYMENT METHOD SELECTION & USD CASH RESTRICTION */}
            <div className={`space-y-3 pt-2 border-t border-[#E8DFC8] ${!currentUser ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#3D2C24] flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-[#8C102A]" />
                  <span>Payment Method</span>
                </span>
                {currency === 'USD' && (
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                    USD: Card Only
                  </span>
                )}
              </div>

              {/* Payment Method Selector */}
              <div className={`grid ${currency === 'USD' ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                    paymentMethod === 'card'
                      ? 'bg-red-50/70 border-[#8C102A] ring-1 ring-[#8C102A] shadow-xs'
                      : 'bg-[#FAF7F2] border-[#D9CBB7] hover:bg-white'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-blue-600 shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#241A18]">Credit / Debit Card</p>
                    <p className="text-[10px] text-slate-500">Visa, Mastercard, Amex</p>
                  </div>
                </button>

                {/* Cash on Delivery is strictly hidden when USD currency is active */}
                {currency !== 'USD' && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cod')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                      paymentMethod === 'cod'
                        ? 'bg-red-50/70 border-[#8C102A] ring-1 ring-[#8C102A] shadow-xs'
                        : 'bg-[#FAF7F2] border-[#D9CBB7] hover:bg-white'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-emerald-600 shrink-0">
                      <Banknote className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#241A18]">Cash on Delivery</p>
                      <p className="text-[10px] text-slate-500">Pay cash upon arrival (LKR)</p>
                    </div>
                  </button>
                )}
              </div>

              {/* Card Payment Inputs */}
              {paymentMethod === 'card' && (
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                    <span className="font-bold">Card Details</span>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-emerald-600" />
                      256-bit Encrypted
                    </span>
                  </div>

                  {/* Card Number */}
                  <div>
                    <input
                      type="text"
                      required={paymentMethod === 'card'}
                      placeholder="Card number (16 digits)"
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      className="w-full px-3 py-2 bg-white text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#8C102A] font-mono tracking-wider"
                    />
                  </div>

                  {/* Cardholder, Expiry, CVV */}
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      required={paymentMethod === 'card'}
                      placeholder="Name on card"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      className="col-span-1 px-3 py-2 bg-white text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#8C102A]"
                    />
                    <input
                      type="text"
                      required={paymentMethod === 'card'}
                      placeholder="MM/YY"
                      value={cardExpiry}
                      onChange={handleCardExpiryChange}
                      className="col-span-1 px-3 py-2 bg-white text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#8C102A] font-mono text-center"
                    />
                    <input
                      type="password"
                      maxLength={4}
                      required={paymentMethod === 'card'}
                      placeholder="CVV"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                      className="col-span-1 px-3 py-2 bg-white text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#8C102A] font-mono text-center"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Bill Summary */}
            <div className="pt-2 border-t border-[#E8DFC8] space-y-1.5 text-xs text-[#5C4D44]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatPrice(subtotalLKR, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery Fee</span>
                <span>
                  {orderType === 'pickup'
                    ? 'FREE (Pickup)'
                    : deliveryFeeLKR === 0
                    ? 'FREE (Over LKR 3,000)'
                    : formatPrice(deliveryFeeLKR, currency)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-sm text-[#241A18] pt-1.5 border-t border-[#E8DFC8]">
                <span>Total Bill</span>
                <span className="text-[#8C102A]">{formatPrice(grandTotalLKR, currency)}</span>
              </div>
            </div>

            {/* Primary Action Button: "Confirm Order" */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={items.length === 0}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#8C102A] hover:bg-[#A31634] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Confirm Order • {formatPrice(grandTotalLKR, currency)}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-[10px] text-slate-500 text-center mt-2">
                Includes a 2-minute grace period to edit delivery details or cancel after confirmation.
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
