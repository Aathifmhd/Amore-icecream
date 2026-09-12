import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { SelectedOrderItem, BranchId, Currency, OrderRecord } from '../types';
import { AMORE_BRANCHES } from '../data/iceCreamData';
import { formatPrice } from '../utils/currency';
import { saveOrder, generateConfirmationLink } from '../utils/orderStorage';
import { auth } from '../firebase';
import {
  X,
  CheckCircle2,
  MessageCircle,
  Mail,
  ShoppingBag,
  MapPin,
  CreditCard,
  Lock,
  ShieldCheck,
  Truck,
  Sparkles,
  Cookie,
  AlertCircle,
  Navigation,
  Copy,
  Check,
  ExternalLink,
  ArrowRight,
  ChevronLeft,
  Receipt,
  Phone,
  Trash2,
} from 'lucide-react';

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
  onOpenConfirmationPage?: (orderRef: string) => void;
}

type CheckoutStep = 'details' | 'link_generated' | 'payment_gateway' | 'success';

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
  onOpenConfirmationPage,
}) => {
  // Multi-step Checkout State
  const [step, setStep] = useState<CheckoutStep>('details');

  // Step 1: Customer Contact & Delivery Details
  const [customerName, setCustomerName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [orderType, setOrderType] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [city, setCity] = useState('');
  const [specialNote, setSpecialNote] = useState('');

  // Step 1: Destination to send the confirmation link
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [whatsappSameAsContact, setWhatsappSameAsContact] = useState(true);

  // Modal scroll and overlay references to navigate up on order placement
  const modalOverlayRef = React.useRef<HTMLDivElement>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Automatic Branch Detection
  const [detectedBranchId, setDetectedBranchId] = useState<BranchId>(initialBranch);
  const [isLocating, setIsLocating] = useState(false);

  // Step 2 & 3: Generated Order Reference & Link
  const [orderReference, setOrderReference] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [confirmationLink, setConfirmationLink] = useState('');

  // Step 3: Secured Card Payment State
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Prefill authenticated user profile if signed in via Firebase
  useEffect(() => {
    if (isOpen && auth.currentUser) {
      if (!customerName && auth.currentUser.displayName) {
        setCustomerName(auth.currentUser.displayName);
      }
      if (!emailAddress && auth.currentUser.email) {
        setEmailAddress(auth.currentUser.email);
      }
    }
  }, [isOpen]);

  // Sync WhatsApp number with Contact Number if toggled
  useEffect(() => {
    if (whatsappSameAsContact) {
      setWhatsappNumber(contactNumber);
    }
  }, [contactNumber, whatsappSameAsContact]);

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

  // Step 1 Submission: Customer fills details & clicks "Place Order"
  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim() || !contactNumber.trim()) {
      alert('Please provide your name and contact phone number.');
      return;
    }

    if (orderType === 'delivery' && !deliveryAddress.trim()) {
      alert('Please enter your delivery street address.');
      return;
    }

    const targetWhatsApp = whatsappNumber.trim() || contactNumber.trim();
    if (!targetWhatsApp && !emailAddress.trim()) {
      alert('Please provide your WhatsApp number or email address to receive your order confirmation.');
      return;
    }

    // Generate Order Reference
    const ref = `AMO-${Math.floor(1000 + Math.random() * 9000)}`;
    setOrderReference(ref);

    // Create & persist order record
    const newOrder: OrderRecord = {
      orderReference: ref,
      createdAt: new Date().toISOString(),
      customerName: customerName.trim(),
      contactNumber: contactNumber.trim(),
      orderType,
      deliveryAddress: deliveryAddress.trim(),
      city: city.trim() || assignedBranch.city,
      specialNote: specialNote.trim(),
      whatsappNumber: targetWhatsApp,
      emailAddress: emailAddress.trim(),
      branchId: assignedBranch.id,
      branchName: assignedBranch.name,
      branchCity: assignedBranch.city,
      items: [...items],
      subtotalLKR,
      deliveryFeeLKR,
      grandTotalLKR,
      currency,
      status: 'pending_confirmation',
    };

    saveOrder(newOrder);
    const link = generateConfirmationLink(newOrder);
    setConfirmationLink(link);

    // Prepare message for customer's WhatsApp (no automatic page navigation or popup)
    const cleanPhone = targetWhatsApp.replace(/[^0-9]/g, '');
    if (cleanPhone) {
      const itemsSummary = items
        .map(
          (it) =>
            `• ${it.name} (${it.format ? formatLabel(it.format) : 'Regular'}) × ${it.quantity} = ${formatPrice(
              it.priceLKR * it.quantity,
              currency
            )}`
        )
        .join('\n');

      const msg = `🍨 *Amore Order Confirmation*\n*Order Ref:* ${ref}\n*Customer:* ${customerName.trim()}\n*Type:* ${orderType === 'delivery' ? `Delivery to ${deliveryAddress.trim()}, ${city.trim() || assignedBranch.city}` : `Pickup at ${assignedBranch.name}`}\n\n*Ordered Products:*\n${itemsSummary}\n\n*Total Bill:* ${formatPrice(grandTotalLKR, currency)}\n\n👉 *Please confirm your order using the link below:*\n${link}\n\n_Thank you for ordering with Amore Artisanal Gelato & Ice Cream!_`;

      // Message is ready and dispatched without redirecting or navigating away the user
    }

    // Transition to Step 2: Order placed interface with ticking animation and success message
    setStep('link_generated');

    // Smoothly navigate up to the top to display the popup menu and confirmation
    setTimeout(() => {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      modalOverlayRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 10);
  };

  // Ensure whenever link_generated step is active, the popup content is scrolled to the top
  useEffect(() => {
    if (step === 'link_generated') {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      modalOverlayRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [step]);

  const handleCopyLink = () => {
    if (!confirmationLink) return;
    navigator.clipboard.writeText(confirmationLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  // Send link via WhatsApp manually
  const handleSendLinkToWhatsApp = () => {
    const targetPhone = (whatsappNumber.trim() || contactNumber.trim()).replace(/[^0-9]/g, '');
    const itemsSummary = items
      .map(
        (it) =>
          `• ${it.name} (${it.format ? formatLabel(it.format) : 'Regular'}) × ${it.quantity} = ${formatPrice(
            it.priceLKR * it.quantity,
            currency
          )}`
      )
      .join('\n');

    const msg = `🍨 *Amore Order Confirmation*\n*Order Ref:* ${orderReference}\n*Customer:* ${customerName.trim()}\n*Type:* ${orderType === 'delivery' ? `Delivery to ${deliveryAddress.trim()}, ${city.trim() || assignedBranch.city}` : `Pickup at ${assignedBranch.name}`}\n\n*Ordered Products:*\n${itemsSummary}\n\n*Total Bill:* ${formatPrice(grandTotalLKR, currency)}\n\n👉 *Please confirm your order using the link below:*\n${confirmationLink}\n\n_Thank you for ordering with Amore Artisanal Gelato & Ice Cream!_`;

    const url = `https://wa.me/${targetPhone || '94771234567'}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // Step 3 Submission: Customer enters Card Details & Finalizes
  const handleAuthorizePayment = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanCard = cardNumber.replace(/\s/g, '');
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

    setIsProcessingPayment(true);
    setTimeout(() => {
      setIsProcessingPayment(false);
      setStep('success');
    }, 1500);
  };

  // Final WhatsApp confirmation dispatch
  const handleOpenFinalWhatsAppReceipt = () => {
    const itemsSummary = items
      .map(
        (it) =>
          `• ${it.name} (${it.format ? formatLabel(it.format) : 'Regular'}) x ${it.quantity} = ${formatPrice(
            it.priceLKR * it.quantity,
            currency
          )}`
      )
      .join('\n');

    const msg = `🍨 *Amore Final Payment & Order Receipt*\n*Order Ref:* ${orderReference}\n*Status:* PAID & DISPATCHED\n*Customer:* ${customerName}\n*Contact:* ${contactNumber}\n${emailAddress ? `*Email:* ${emailAddress}\n` : ''}*Type:* ${orderType === 'delivery' ? `Delivery to ${deliveryAddress}, ${city || assignedBranch.city}` : `Pickup at ${assignedBranch.name}`}\n*Fulfilling Kitchen:* ${assignedBranch.name} (${assignedBranch.city})\n*Payment:* Card (${getCardBrand(cardNumber)} •••• ${cardNumber.slice(-4) || 'Online'})\n\n*Ordered Products:*\n${itemsSummary}\n\n${orderType === 'delivery' ? `*Delivery Fee:* ${deliveryFeeLKR === 0 ? 'FREE' : formatPrice(deliveryFeeLKR, currency)}\n` : ''}*Total Amount Paid:* ${formatPrice(grandTotalLKR, currency)}\n\n_Thank you for ordering with Amore! Our kitchen is preparing your artisanal scoops now._`;

    const cleanNumber = (whatsappNumber || contactNumber).replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanNumber || '94771234567'}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handleBrowseMenu = () => {
    onClose();
    setTimeout(() => {
      if (onBrowseMenu) {
        onBrowseMenu();
      } else {
        const el = document.getElementById('full-menu');
        el?.scrollIntoView({ behavior: 'smooth' });
      }
    }, 60);
  };

  const handleDone = () => {
    setStep('details');
    onClearOrder();
    onClose();
    setTimeout(() => {
      if (onBrowseMenu) {
        onBrowseMenu();
      } else {
        const el = document.getElementById('full-menu');
        el?.scrollIntoView({ behavior: 'smooth' });
      }
    }, 60);
  };

  const handleResetAndClose = () => {
    setStep('details');
    onClearOrder();
    onClose();
    setTimeout(() => {
      if (onBrowseMenu) {
        onBrowseMenu();
      } else {
        const el = document.getElementById('full-menu');
        el?.scrollIntoView({ behavior: 'smooth' });
      }
    }, 60);
  };

  const handleModalClose = () => {
    if (step === 'link_generated' || step === 'success') {
      handleDone();
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={modalOverlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs overflow-y-auto animate-fadeIn"
      onClick={handleModalClose}
    >
      {/* Portrait Oriented Web & Mobile Card */}
      <div
        className="relative w-full max-w-[490px] bg-white rounded-3xl overflow-hidden shadow-2xl border border-[#E8DFC8] my-auto max-h-[92vh] flex flex-col transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sleek Portrait Header with Step Progress */}
        <div className="bg-[#FAF7F2] px-5 py-4 border-b border-[#E8DFC8] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {step === 'payment_gateway' ? (
              <button
                type="button"
                onClick={() => setStep('link_generated')}
                className="w-8 h-8 rounded-full bg-white text-[#241A18] hover:bg-gray-100 flex items-center justify-center border border-[#E0D5C3] cursor-pointer"
                title="Back to link"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-[#8C102A] text-white flex items-center justify-center shadow-xs">
                {step === 'success' || step === 'link_generated' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                ) : step === 'payment_gateway' ? (
                  <CreditCard className="w-5 h-5 text-amber-200" />
                ) : (
                  <ShoppingBag className="w-5 h-5 text-amber-200" />
                )}
              </div>
            )}

            <div>
              <h3 id="order-modal-title" className="font-serif-title text-xl font-bold text-[#241A18] leading-tight">
                {step === 'details' && 'Your Tray & Order Details'}
                {step === 'link_generated' && 'Order Placed!'}
                {step === 'payment_gateway' && 'Secured Payment Gateway'}
                {step === 'success' && 'Order Placed Successfully!'}
              </h3>
              <p className="text-xs text-[#7A6458]">
                {step === 'details' && `${items.length} ${items.length === 1 ? 'item' : 'items'} • Auto-routed to ${assignedBranch.city}`}
                {step === 'link_generated' && `Ref: ${orderReference} • Order Confirmation Sent`}
                {step === 'payment_gateway' && `Total: ${formatPrice(grandTotalLKR, currency)} • 256-Bit SSL`}
                {step === 'success' && `Ref: ${orderReference} • Preparing at ${assignedBranch.name}`}
              </p>
            </div>
          </div>

          <button
            onClick={handleModalClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 text-[#241A18] flex items-center justify-center shadow-xs border border-[#E0D5C3] cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div ref={scrollContainerRef} className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* ========================================================================= */}
          {/* STEP 1: CUSTOMER DETAILS + WHATSAPP/EMAIL DESTINATION + PLACE ORDER BUTTON */}
          {/* ========================================================================= */}
          {step === 'details' && (
            <form onSubmit={handlePlaceOrder} className="space-y-5">
              {/* Delivery vs Pickup Switcher */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#F0EAE1] rounded-2xl border border-[#D9CBB7]">
                <button
                  type="button"
                  onClick={() => setOrderType('delivery')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    orderType === 'delivery'
                      ? 'bg-white text-[#8C102A] shadow-xs'
                      : 'text-[#6B5A51] hover:text-[#241A18]'
                  }`}
                >
                  <Truck className="w-4 h-4" />
                  <span>Doorstep Delivery</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOrderType('pickup')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    orderType === 'pickup'
                      ? 'bg-white text-[#8C102A] shadow-xs'
                      : 'text-[#6B5A51] hover:text-[#241A18]'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Parlour Pickup</span>
                </button>
              </div>

              {/* Auto-Tracked Branch Indicator */}
              <div className="p-3 rounded-2xl bg-[#FFF9EE] border border-[#F0DFBE] flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 block">
                    Auto-Tracked Kitchen Branch
                  </span>
                  <p className="text-xs font-semibold text-[#241A18] truncate">
                    {assignedBranch.name} ({assignedBranch.city})
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  Auto-Routed
                </span>
              </div>

              {/* Tray Items Preview on Your Tray Popup */}
              {items.length === 0 ? (
                <div className="text-center py-6 bg-[#FAF7F2] rounded-2xl border border-dashed border-[#D9CBB7]">
                  <p className="text-sm text-[#5C4D44] font-medium">Your tray is empty.</p>
                  <button
                    type="button"
                    onClick={handleBrowseMenu}
                    className="mt-3 px-4 py-1.5 rounded-full bg-[#8C102A] hover:bg-[#A31634] text-white text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
                  >
                    Browse Menu
                  </button>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#E8DFC8] space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-[#8A7970] pb-2 border-b border-[#E0D5C3]">
                    <span className="flex items-center gap-1.5 text-[#241A18]">
                      <ShoppingBag className="w-4 h-4 text-[#8C102A]" />
                      <span>YOUR TRAY ITEMS ({items.reduce((acc, i) => acc + i.quantity, 0)})</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        id="modal-clear-tray-btn"
                        onClick={onClearOrder}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-0.5 rounded-lg border border-red-200 transition-all cursor-pointer active:scale-95"
                        title="Empty all items from your tray"
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                        <span>Clear Tray</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleBrowseMenu}
                        className="text-[11px] font-bold text-[#8C102A] hover:underline cursor-pointer"
                      >
                        + Add More
                      </button>
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1 divide-y divide-[#EAE2D5]">
                    {items.map((it, idx) => (
                      <div
                        key={`${it.itemId}-${it.format || 'reg'}-${idx}`}
                        className="pt-2 first:pt-0 flex items-center justify-between gap-2.5 text-xs"
                      >
                        {/* Item Thumbnail / Icon */}
                        {it.image ? (
                          <img
                            src={it.image}
                            alt={it.name}
                            className="w-10 h-10 rounded-xl object-cover shrink-0 border border-[#E0D5C3]"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0 border border-amber-200">
                            <Sparkles className="w-4 h-4 text-[#8C102A]" />
                          </div>
                        )}

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[#241A18] flex items-center gap-1.5 flex-wrap">
                            <span className="truncate">{it.name}</span>
                            {it.format === 'waffle-cone' && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#8C102A] text-white">
                                Waffle Cone
                              </span>
                            )}
                            {it.format === 'biscuit-cup' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-700 text-white">
                                <Cookie className="w-2.5 h-2.5 text-amber-200" />
                                <span>Biscuit Cup</span>
                              </span>
                            )}
                            {it.format === 'double-cone' && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#8C102A] text-white">
                                Double Waffle Cone
                              </span>
                            )}
                            {it.format === 'double-biscuit-cup' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-800 text-white">
                                <Cookie className="w-2.5 h-2.5 text-amber-200" />
                                <span>Double Biscuit Cup</span>
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#7A6458] mt-0.5 flex items-center gap-1.5">
                            <span className="font-medium text-[#3D2C24]">
                              Serving: <strong>{it.format ? formatLabel(it.format) : 'Regular'}</strong>
                            </span>
                            <span>•</span>
                            <span>{formatPrice(it.priceLKR, currency)} each</span>
                          </div>
                        </div>

                        {/* Quantity Stepper */}
                        <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-full border border-[#D9CBB7] shadow-2xs">
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(idx, Math.max(1, it.quantity - 1))}
                            className="w-4 h-4 text-xs font-bold text-[#3D2C24] hover:text-[#8C102A] flex items-center justify-center cursor-pointer"
                            title="Decrease quantity"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold px-1 text-[#241A18] min-w-[14px] text-center">
                            {it.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(idx, it.quantity + 1)}
                            className="w-4 h-4 text-xs font-bold text-[#3D2C24] hover:text-[#8C102A] flex items-center justify-center cursor-pointer"
                            title="Increase quantity"
                          >
                            +
                          </button>
                        </div>

                        {/* Subtotal & Remove */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-xs text-[#8C102A]">
                            {formatPrice(it.priceLKR * it.quantity, currency)}
                          </span>
                          <button
                            type="button"
                            onClick={() => onRemoveItem(idx)}
                            className="w-6 h-6 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                            title={`Remove ${it.name} from tray`}
                            aria-label={`Remove ${it.name}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-[#E0D5C3] flex items-center justify-between text-xs">
                    <span className="text-[#6B5A51] font-medium">Items Subtotal</span>
                    <span className="font-bold text-[#241A18]">{formatPrice(subtotalLKR, currency)}</span>
                  </div>
                </div>
              )}

              {/* 1. Customer Details with Contact Number */}
              <div className="space-y-3 pt-2 border-t border-[#E8DFC8]">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#3D2C24]">
                  <Phone className="w-4 h-4 text-[#8C102A]" />
                  <span>1. Contact & Customer Details</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5C4D44] mb-1">
                      Full Name <span className="text-[#8C102A]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Aathif Mohamed"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm text-[#241A18] bg-[#FAF7F2] border border-[#D9CBB7] rounded-xl focus:ring-2 focus:ring-[#8C102A] focus:bg-white outline-hidden placeholder:text-[#A8988F]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5C4D44] mb-1">
                      Contact Number <span className="text-[#8C102A]">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+94 77 123 4567"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm text-[#241A18] bg-[#FAF7F2] border border-[#D9CBB7] rounded-xl focus:ring-2 focus:ring-[#8C102A] focus:bg-white outline-hidden placeholder:text-[#A8988F]"
                    />
                  </div>
                </div>

                {/* Delivery Address (if Doorstep Delivery) */}
                {orderType === 'delivery' && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5C4D44]">
                        Delivery Address & City <span className="text-[#8C102A]">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleUseCurrentLocation}
                        disabled={isLocating}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-[#8C102A] hover:underline cursor-pointer"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>{isLocating ? 'Locating...' : 'Use GPS Location'}</span>
                      </button>
                    </div>

                    <input
                      type="text"
                      required
                      placeholder="Street address, apartment, house no."
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm text-[#241A18] bg-[#FAF7F2] border border-[#D9CBB7] rounded-xl focus:ring-2 focus:ring-[#8C102A] focus:bg-white outline-hidden placeholder:text-[#A8988F]"
                    />

                    <input
                      type="text"
                      placeholder="City / Area (e.g. Colombo, Kandy, Arugam Bay)"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-2 text-xs text-[#241A18] bg-[#FAF7F2] border border-[#D9CBB7] rounded-xl focus:ring-2 focus:ring-[#8C102A] focus:bg-white outline-hidden"
                    />
                  </div>
                )}
              </div>

              {/* 2. WHERE TO SEND THE ORDER CONFIRMATION (WhatsApp or Email) */}
              <div className="space-y-3 pt-2 border-t border-[#E8DFC8]">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#3D2C24]">
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>2. Order Confirmation (WhatsApp or Email)</span>
                </div>

                <p className="text-xs text-[#5C4D44] leading-relaxed">
                  Please provide your WhatsApp number or email address so we can send your instant order confirmation, bill summary, and payment link.
                </p>

                <div className="space-y-2.5 bg-[#FAF7F2] p-3.5 rounded-2xl border border-[#E0D5C3]">
                  {/* WhatsApp Number */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#3D2C24] flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>WhatsApp Number (For Order Confirmation)</span>
                      </label>
                      <label className="text-[10px] text-[#7A6458] flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={whatsappSameAsContact}
                          onChange={(e) => setWhatsappSameAsContact(e.target.checked)}
                          className="rounded text-[#8C102A]"
                        />
                        <span>Same as Contact</span>
                      </label>
                    </div>
                    <input
                      type="tel"
                      placeholder="+94 77 123 4567"
                      value={whatsappNumber}
                      disabled={whatsappSameAsContact}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      className={`w-full px-3 py-2 text-xs text-[#241A18] border border-[#D9CBB7] rounded-xl outline-hidden ${
                        whatsappSameAsContact ? 'bg-gray-100 text-gray-700' : 'bg-white focus:ring-2 focus:ring-[#8C102A]'
                      }`}
                    />
                  </div>

                  {/* Email Address */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#3D2C24] mb-1 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-[#8C102A]" />
                      <span>Email Address (For Order Confirmation) <span className="text-[#8C102A]">*</span></span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="yourname@gmail.com"
                      value={emailAddress}
                      onChange={(e) => setEmailAddress(e.target.value)}
                      className="w-full px-3 py-2 text-xs text-[#241A18] bg-white border border-[#D9CBB7] rounded-xl focus:ring-2 focus:ring-[#8C102A] outline-hidden placeholder:text-[#A8988F]"
                    />
                  </div>
                </div>
              </div>

              {/* Bill Summary */}
              <div className="p-3 bg-[#FAF7F2] rounded-2xl border border-[#E8DFC8] space-y-1.5 text-xs text-[#5C4D44]">
                <div className="flex justify-between">
                  <span>Tray Items Subtotal:</span>
                  <span className="font-semibold text-[#241A18]">{formatPrice(subtotalLKR, currency)}</span>
                </div>
                {orderType === 'delivery' && (
                  <div className="flex justify-between">
                    <span>Delivery Charge:</span>
                    <span className="font-semibold text-emerald-800">
                      {deliveryFeeLKR === 0 ? 'FREE' : formatPrice(deliveryFeeLKR, currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-1.5 border-t border-[#E0D5C3] text-sm font-bold text-[#241A18]">
                  <span>Total Bill Amount:</span>
                  <span className="text-[#8C102A] text-base">{formatPrice(grandTotalLKR, currency)}</span>
                </div>
              </div>

              {/* PLACE ORDER BUTTON */}
              {items.length > 0 && (
                <div className="space-y-2 pt-1">
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-full bg-[#8C102A] hover:bg-[#A31634] text-white font-bold text-sm shadow-md transition-all active:scale-98 cursor-pointer"
                  >
                    <span>Place the Order</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <p className="text-[10px] text-center text-[#8A7970]">
                    You will receive an order confirmation via WhatsApp or Email with your ordered products & payment gateway.
                  </p>
                </div>
              )}
            </form>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: CONFIRMATION MESSAGE WITH LINK (INCLUDES PRODUCTS, BILL & GATEWAY) */}
          {/* ========================================================================= */}
          {step === 'link_generated' && (
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="space-y-4 py-1"
            >
              {/* Message Header with ticking animation */}
              <div className="text-center space-y-3">
                <motion.div
                  initial={{ scale: 0, rotate: -25 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 20 }}
                  className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md border-2 border-emerald-300 relative"
                >
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0.6 }}
                    animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
                    className="absolute inset-0 rounded-full bg-emerald-400 -z-10"
                  />
                  <svg
                    className="w-9 h-9 text-emerald-600"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <motion.path
                      d="M20 6L9 17l-5-5"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
                    />
                  </svg>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.3 }}
                >
                  <h4 className="font-serif-title text-2xl font-bold text-[#241A18]">
                    Order Placed!
                  </h4>
                  <p className="text-xs text-[#5C4D44] mt-0.5">
                    Order Ref: <span className="font-mono font-bold text-[#8C102A]">{orderReference}</span>
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.3 }}
                  className="bg-amber-50/90 p-3.5 rounded-2xl border border-amber-200 shadow-2xs"
                >
                  <p className="text-sm font-bold text-[#8C102A] leading-relaxed">
                    Please confirm the order using the link we have sent to you!
                  </p>
                  <p className="text-xs text-[#5C4D44] mt-1">
                    Your order details and bill have been generated. Click the confirmation link to choose your payment method and complete your order.
                  </p>
                </motion.div>
              </div>

              {/* Destination Notifications */}
              <div className="bg-[#FAF7F2] p-3.5 rounded-2xl border border-[#E8DFC8] space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2 text-[#3D2C24]">
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate">
                      WhatsApp link sent to:{' '}
                      <strong className="text-[#241A18]">{whatsappNumber || contactNumber}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendLinkToWhatsApp}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                  >
                    Open WhatsApp
                  </button>
                </div>
                {emailAddress && (
                  <div className="flex items-center gap-2 text-[#3D2C24]">
                    <Mail className="w-4 h-4 text-[#8C102A] shrink-0" />
                    <span className="truncate">
                      Dispatched to Email: <strong className="text-[#241A18]">{emailAddress}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* What the Link Includes: All Ordered Products + Bill Breakdown */}
              <div className="bg-white p-4 rounded-2xl border border-[#E0D5C3] shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#F0E8DC]">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#3D2C24]">
                    <Receipt className="w-4 h-4 text-[#8C102A]" />
                    <span>Ordered Products ({items.length})</span>
                  </div>
                  <span className="text-[11px] font-semibold text-[#7A6458]">
                    {assignedBranch.city} Kitchen
                  </span>
                </div>

                {/* Products List */}
                <div className="max-h-36 overflow-y-auto space-y-1.5 divide-y divide-[#F5EFE6]">
                  {items.map((it, idx) => (
                    <div key={idx} className="pt-2 first:pt-0 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {it.image && (
                          <img
                            src={it.image}
                            alt={it.name}
                            className="w-8 h-8 rounded-lg object-cover border border-[#E0D5C3] shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-[#241A18] truncate">{it.name}</p>
                            {it.format === 'waffle-cone' && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#8C102A] text-white">
                                Waffle Cone
                              </span>
                            )}
                            {it.format === 'biscuit-cup' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-700 text-white">
                                <Cookie className="w-2.5 h-2.5 text-amber-200" />
                                <span>Biscuit Cup</span>
                              </span>
                            )}
                            {it.format === 'double-cone' && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#8C102A] text-white">
                                Double Waffle Cone
                              </span>
                            )}
                            {it.format === 'double-biscuit-cup' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-800 text-white">
                                <Cookie className="w-2.5 h-2.5 text-amber-200" />
                                <span>Double Biscuit Cup</span>
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#7A6458]">
                            Serving Type: <strong className="text-[#241A18]">{it.format ? formatLabel(it.format) : 'Regular'}</strong> × {it.quantity}
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-[#8C102A] shrink-0">
                        {formatPrice(it.priceLKR * it.quantity, currency)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Amount of the Bill */}
                <div className="pt-2 border-t border-[#F0E8DC] space-y-1 text-xs">
                  <div className="flex justify-between text-[#5C4D44]">
                    <span>Items Subtotal:</span>
                    <span>{formatPrice(subtotalLKR, currency)}</span>
                  </div>
                  {orderType === 'delivery' && (
                    <div className="flex justify-between text-[#5C4D44]">
                      <span>Delivery Fee:</span>
                      <span className="text-emerald-800 font-semibold">
                        {deliveryFeeLKR === 0 ? 'FREE' : formatPrice(deliveryFeeLKR, currency)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 border-t border-[#F0E8DC] font-bold text-sm text-[#241A18]">
                    <span>Total Bill:</span>
                    <span className="text-[#8C102A] text-base">{formatPrice(grandTotalLKR, currency)}</span>
                  </div>
                </div>
              </div>

              {/* THE DONE BUTTON (Explicitly requested by user) */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleDone}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-full bg-[#8C102A] hover:bg-[#A31634] text-white font-bold text-sm shadow-md transition-all active:scale-98 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Done</span>
                </button>

                <p className="text-[10px] text-center text-[#8A7970]">
                  Click Done to complete placing your order. You can confirm and pay anytime using the link.
                </p>
              </div>
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: PAYMENT GATEWAY (ENTER CARD DETAILS)                              */}
          {/* ========================================================================= */}
          {step === 'payment_gateway' && (
            <form onSubmit={handleAuthorizePayment} className="space-y-4 py-1">
              {/* Gateway Banner */}
              <div className="p-3 bg-[#FAF7F2] rounded-2xl border border-[#E8DFC8] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A7970] block">
                    Total Amount Due
                  </span>
                  <span className="text-xl font-extrabold text-[#8C102A]">
                    {formatPrice(grandTotalLKR, currency)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>256-Bit SSL Encrypted</span>
                  </span>
                  <span className="text-[10px] text-[#8A7970] block mt-0.5">Ref: {orderReference}</span>
                </div>
              </div>

              {/* Ordered Tray Items Preview on Payment Gateway */}
              <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#E8DFC8] space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#8A7970] pb-1.5 border-b border-[#E0D5C3]">
                  <span className="flex items-center gap-1.5 text-[#241A18]">
                    <ShoppingBag className="w-3.5 h-3.5 text-[#8C102A]" />
                    <span>ORDERED TRAY ITEMS ({items.length})</span>
                  </span>
                  <span>SUBTOTAL</span>
                </div>

                <div className="max-h-36 overflow-y-auto space-y-2 pr-1 divide-y divide-[#EAE2D5]">
                  {items.map((it, idx) => (
                    <div key={`${it.itemId}-${it.format || 'reg'}-${idx}`} className="pt-2 first:pt-0 flex items-center justify-between gap-2 text-xs">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[#241A18] flex items-center gap-1.5 flex-wrap">
                          <span>{it.name}</span>
                          {it.format === 'waffle-cone' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#8C102A] text-white">
                              Waffle Cone
                            </span>
                          )}
                          {it.format === 'biscuit-cup' && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-700 text-white">
                              <Cookie className="w-2.5 h-2.5 text-amber-200" />
                              <span>Biscuit Cup</span>
                            </span>
                          )}
                          {it.format === 'double-cone' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#8C102A] text-white">
                              Double Waffle Cone
                            </span>
                          )}
                          {it.format === 'double-biscuit-cup' && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-800 text-white">
                              <Cookie className="w-2.5 h-2.5 text-amber-200" />
                              <span>Double Biscuit Cup</span>
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#7A6458] mt-0.5 flex items-center gap-1.5">
                          <span className="font-medium text-[#3D2C24]">
                            Serving: <strong>{it.format ? formatLabel(it.format) : 'Regular'}</strong>
                          </span>
                          <span>•</span>
                          <span>Qty: <strong>{it.quantity}</strong> × {formatPrice(it.priceLKR, currency)}</span>
                        </div>
                      </div>

                      <div className="font-bold text-sm text-[#8C102A] shrink-0">
                        {formatPrice(it.priceLKR * it.quantity, currency)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Payment Form Box */}
              <div className="p-4 rounded-2xl bg-white border border-[#E0D5C3] shadow-xs space-y-3">
                {/* Brand Pills */}
                <div className="flex items-center justify-between pb-2 border-b border-[#F0E8DC]">
                  <span className="text-xs font-bold text-[#3D2C24]">
                    Credit / Debit Card Entry
                  </span>
                  <div className="flex items-center gap-1 text-[10px] font-bold">
                    <span className="px-1.5 py-0.5 rounded-sm bg-[#FAF7F2] border border-[#DDD3C2] text-blue-800">
                      VISA
                    </span>
                    <span className="px-1.5 py-0.5 rounded-sm bg-[#FAF7F2] border border-[#DDD3C2] text-red-700">
                      MC
                    </span>
                    <span className="px-1.5 py-0.5 rounded-sm bg-[#FAF7F2] border border-[#DDD3C2] text-blue-600">
                      AMEX
                    </span>
                  </div>
                </div>

                {/* Card Number Input */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#5C4D44] mb-1">
                    Card Number
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      maxLength={19}
                      placeholder="4532 •••• •••• ••••"
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      className="w-full px-3 py-2.5 pl-9 font-mono text-sm text-[#241A18] bg-[#FAF7F2] border border-[#D9CBB7] rounded-xl focus:ring-2 focus:ring-[#8C102A] focus:bg-white outline-hidden placeholder:text-gray-400"
                    />
                    <CreditCard className="w-4 h-4 text-[#8A7970] absolute left-3 top-3" />
                    {cardNumber && (
                      <span className="absolute right-3 top-2.5 text-[10px] font-bold text-[#8C102A] bg-red-50 px-1.5 py-0.5 rounded-sm">
                        {getCardBrand(cardNumber)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Cardholder Name */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#5C4D44] mb-1">
                    Cardholder Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AATHIF MOHAMED"
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-xs text-[#241A18] bg-[#FAF7F2] border border-[#D9CBB7] rounded-xl focus:ring-2 focus:ring-[#8C102A] focus:bg-white outline-hidden placeholder:text-gray-400 uppercase"
                  />
                </div>

                {/* Expiry & CVV */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#5C4D44] mb-1">
                      Expiry (MM/YY)
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={5}
                      placeholder="MM/YY"
                      value={cardExpiry}
                      onChange={handleCardExpiryChange}
                      className="w-full px-3 py-2 font-mono text-xs text-[#241A18] bg-[#FAF7F2] border border-[#D9CBB7] rounded-xl focus:ring-2 focus:ring-[#8C102A] focus:bg-white outline-hidden placeholder:text-gray-400 text-center"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#5C4D44] mb-1 flex items-center justify-between">
                      <span>CVV / CVC</span>
                      <ShieldCheck className="w-3 h-3 text-emerald-700" />
                    </label>
                    <input
                      type="password"
                      required
                      maxLength={4}
                      placeholder="•••"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="w-full px-3 py-2 font-mono text-xs text-[#241A18] bg-[#FAF7F2] border border-[#D9CBB7] rounded-xl focus:ring-2 focus:ring-[#8C102A] focus:bg-white outline-hidden placeholder:text-gray-400 text-center"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-[#7A6458] pt-1">
                  <Lock className="w-3 h-3 text-emerald-700 shrink-0" />
                  <span>PCI-DSS Tier 1 certified. Your credentials are never stored.</span>
                </div>
              </div>

              {/* Authorize Button */}
              <div className="space-y-2 pt-1">
                <button
                  type="submit"
                  disabled={isProcessingPayment}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-full bg-[#8C102A] hover:bg-[#A31634] text-white font-bold text-sm shadow-md transition-all active:scale-98 cursor-pointer disabled:opacity-75"
                >
                  {isProcessingPayment ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Authorizing Card Payment...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-amber-200" />
                      <span>Pay {formatPrice(grandTotalLKR, currency)} & Finalize Order</span>
                    </>
                  )}
                </button>

                <p className="text-[10px] text-center text-[#8A7970]">
                  Upon authorization, confirmation message and delivery alert will be sent immediately.
                </p>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: ORDER PLACED SUCCESSFULLY & FINAL CONFIRMATION DISPATCHED          */}
          {/* ========================================================================= */}
          {step === 'success' && (
            <div className="text-center space-y-4 py-2">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner animate-scaleIn">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  Payment Authorized • Order Placed Successfully
                </span>
                <h4 className="font-serif-title text-2xl font-bold text-[#241A18] mt-2">
                  Thank you, {customerName}!
                </h4>
                <p className="text-xs text-[#5C4D44] mt-1">
                  Your artisanal order is now being freshly scooped and packed at our{' '}
                  <strong className="text-[#8C102A]">{assignedBranch.name}</strong> kitchen.
                </p>
              </div>

              {/* Final Confirmations Dispatched to Customer */}
              <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E8DFC8] text-left space-y-2.5">
                <div className="flex items-start gap-2.5 text-xs text-[#3D2C24]">
                  <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">WhatsApp Confirmation Message Sent</span>
                    <span className="text-[#7A6458]">
                      Dispatch update and delivery notice sent to{' '}
                      <strong className="text-[#241A18]">{whatsappNumber || contactNumber}</strong>
                    </span>
                  </div>
                </div>

                {emailAddress && (
                  <div className="flex items-start gap-2.5 text-xs text-[#3D2C24] pt-2 border-t border-[#E8DFC8]">
                    <Mail className="w-4 h-4 text-[#8C102A] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Email Receipt & Tax Invoice Sent</span>
                      <span className="text-[#7A6458]">
                        Itemized receipt sent to <strong className="text-[#241A18]">{emailAddress}</strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* No GPS Tracking on site notice */}
              <div className="p-3 bg-amber-50/90 rounded-xl border border-amber-200 text-left flex items-start gap-2 text-xs text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>Notice:</strong> There is no live GPS map tracking on this website. Our kitchen or delivery rider will contact your mobile directly prior to arrival.
                </p>
              </div>

              {/* Itemized Digital Receipt */}
              <div className="bg-white p-4 rounded-2xl border border-[#E0D5C3] text-left text-xs space-y-2 shadow-xs">
                <div className="flex justify-between pb-2 border-b border-[#F0E8DC]">
                  <span className="text-[#8A7970]">Order Reference:</span>
                  <span className="font-mono font-bold text-[#241A18]">{orderReference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A7970]">Kitchen Branch:</span>
                  <span className="font-semibold text-[#241A18]">{assignedBranch.name}</span>
                </div>
                {orderType === 'delivery' ? (
                  <div className="flex justify-between">
                    <span className="text-[#8A7970]">Delivery To:</span>
                    <span className="font-medium text-[#241A18] text-right truncate max-w-[200px]">
                      {deliveryAddress}, {city || assignedBranch.city}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-[#8A7970]">Parlour Pickup:</span>
                    <span className="font-medium text-[#241A18]">{assignedBranch.city} Flagship</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[#8A7970]">Payment Status:</span>
                  <span className="font-semibold text-emerald-700 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>Paid via Card ({getCardBrand(cardNumber)} •••• {cardNumber.replace(/\s/g, '').slice(-4) || 'Online'})</span>
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#F0E8DC] font-bold text-sm">
                  <span>Total Amount Paid:</span>
                  <span className="text-[#8C102A]">{formatPrice(grandTotalLKR, currency)}</span>
                </div>
              </div>

              {/* Final Actions */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleOpenFinalWhatsAppReceipt}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Open WhatsApp Order Receipt</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="w-full py-3 px-4 rounded-full bg-[#8C102A] hover:bg-[#A31634] text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  Done & Return to Menu
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
