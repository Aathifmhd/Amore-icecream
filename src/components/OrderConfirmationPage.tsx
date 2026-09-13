import React, { useState, useEffect } from 'react';
import { Currency, OrderRecord } from '../types';
import { recoverOrderByReference, updateOrder } from '../utils/orderStorage';
import { subscribeToOrder, getOrderFromFirestore } from '../firebase';
import { formatPrice } from '../utils/currency';
import { CurrencyToggle } from './CurrencyToggle';
import {
  CheckCircle2,
  Clock,
  MapPin,
  Truck,
  ShoppingBag,
  CreditCard,
  Banknote,
  Lock,
  ArrowLeft,
  Copy,
  Check,
  MessageCircle,
  AlertCircle,
  Cookie,
  Receipt,
  ShieldCheck,
  Sparkles,
  Store,
  X,
} from 'lucide-react';

interface OrderConfirmationPageProps {
  orderReference: string;
  currency: Currency;
  onToggleCurrency: (c: Currency) => void;
  onBackToHome: () => void;
}

export const OrderConfirmationPage: React.FC<OrderConfirmationPageProps> = ({
  orderReference,
  currency,
  onToggleCurrency,
  onBackToHome,
}) => {
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedRef, setCopiedRef] = useState(false);
  const [isReturnPolicyOpen, setIsReturnPolicyOpen] = useState(false);

  // Payment form state
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'card' | 'cash' | 'pay_at_parlour'>('card');
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    // Scroll to top when page opens
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const params = new URLSearchParams(window.location.search);
    const loaded = recoverOrderByReference(orderReference, params);
    if (loaded) {
      setOrder(loaded);
      setCardHolder(loaded.customerName || '');
      if (loaded.orderType === 'pickup') {
        setSelectedPaymentMethod('pay_at_parlour');
      }
      if (loaded.status === 'confirmed' || loaded.status === 'paid') {
        setPaymentSuccess(true);
      }
    }
    setIsLoading(false);

    // Live sync from Cloud Firestore (amore-icecream)
    if (orderReference) {
      getOrderFromFirestore(orderReference).then((remoteOrder) => {
        if (remoteOrder) {
          setOrder(remoteOrder);
          if (remoteOrder.orderType === 'pickup') {
            setSelectedPaymentMethod('pay_at_parlour');
          }
          if (remoteOrder.status === 'confirmed' || remoteOrder.status === 'paid') {
            setPaymentSuccess(true);
          }
        }
      });

      const unsubscribe = subscribeToOrder(orderReference, (liveOrder) => {
        if (liveOrder) {
          setOrder(liveOrder);
          if (liveOrder.orderType === 'pickup') {
            setSelectedPaymentMethod('pay_at_parlour');
          }
          if (liveOrder.status === 'confirmed' || liveOrder.status === 'paid') {
            setPaymentSuccess(true);
          }
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, [orderReference]);

  const handleCopyReference = () => {
    navigator.clipboard.writeText(orderReference);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
    const parts = raw.match(/[\s\S]{1,4}/g) || [];
    setCardNumber(parts.join(' '));
  };

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
    if (/^3[47]/.test(clean)) return 'American Express';
    return 'Credit / Debit Card';
  };

  const handleCompleteOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    const isPickup = order.orderType === 'pickup';
    const effectivePaymentMethod = isPickup ? 'pay_at_parlour' : selectedPaymentMethod;

    if (!isPickup && selectedPaymentMethod === 'card') {
      const cleanCard = cardNumber.replace(/\s/g, '');
      if (cleanCard.length < 15) {
        alert('Please enter a valid 16-digit card number.');
        return;
      }
      if (!cardExpiry.includes('/') || cardExpiry.length < 5) {
        alert('Please enter a valid expiration date (MM/YY).');
        return;
      }
      if (cardCvv.length < 3) {
        alert('Please enter your 3 or 4-digit CVV security code.');
        return;
      }
    }

    setIsProcessing(true);

    setTimeout(() => {
      setIsProcessing(false);
      const updated = updateOrder(order.orderReference, {
        status: !isPickup && selectedPaymentMethod === 'card' ? 'paid' : 'confirmed',
        paymentMethod: effectivePaymentMethod,
        paidAt: !isPickup && selectedPaymentMethod === 'card' ? new Date().toISOString() : undefined,
        cardLast4: !isPickup && selectedPaymentMethod === 'card' ? cardNumber.replace(/\s/g, '').slice(-4) : undefined,
        cardBrand: !isPickup && selectedPaymentMethod === 'card' ? getCardBrand(cardNumber) : undefined,
      });

      if (updated) {
        setOrder(updated);
      }
      setPaymentSuccess(true);
    }, 1200);
  };

  const handleSendConfirmationWhatsApp = () => {
    if (!order) return;
    const cleanNumber = (order.whatsappNumber || order.contactNumber || '').replace(/[^0-9]/g, '');
    const itemsSummary = order.items
      .map((it) => `• ${it.name} (${it.format || 'Standard'}) × ${it.quantity} = ${formatPrice(it.priceLKR * it.quantity, currency)}`)
      .join('\n');

    const statusText = paymentSuccess
      ? order.paymentMethod === 'card'
        ? 'PAID & CONFIRMED'
        : order.orderType === 'pickup' || order.paymentMethod === 'pay_at_parlour'
        ? 'CONFIRMED (Pay at Parlour)'
        : 'CONFIRMED (Cash on Delivery)'
      : 'PENDING';

    const msg = `🍨 *Amore Order Confirmation & Receipt*\n*Order Ref:* ${order.orderReference}\n*Status:* ${statusText}\n*Customer:* ${order.customerName}\n*Phone:* ${order.contactNumber}\n*Type:* ${order.orderType === 'delivery' ? `Delivery to ${order.deliveryAddress}, ${order.city}` : `Pickup at ${order.branchName}`}\n*Kitchen Branch:* ${order.branchName} (${order.branchCity})\n\n*Ordered Products:*\n${itemsSummary}\n\n*Total Bill:* ${formatPrice(order.grandTotalLKR, currency)}\n\n_Thank you for ordering with Amore Sri Lanka!_`;

    const url = `https://wa.me/${cleanNumber || '94771234567'}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-[#8C102A] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-[#5C4D44]">Loading order confirmation...</p>
        </div>
      </div>
    );
  }

  // Fallback if order is missing or invalid reference
  if (!order) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-[#E0D5C3] shadow-xl text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h2 className="font-serif-title text-2xl font-bold text-[#241A18]">Order Not Found</h2>
            <p className="mt-2 text-xs text-[#5C4D44] leading-relaxed">
              We couldn't locate an order with reference code <strong className="font-mono text-[#8C102A]">{orderReference}</strong>. The link might be expired or incomplete.
            </p>
          </div>
          <button
            type="button"
            onClick={onBackToHome}
            className="w-full py-3 px-6 rounded-full bg-[#8C102A] hover:bg-[#A31634] text-white font-bold text-xs transition-colors cursor-pointer shadow-md"
          >
            Return to Amore Ice Cream Parlour
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#241A18] selection:bg-[#8C102A] selection:text-white pb-20">
      {/* Top Header / Nav */}
      <header className="sticky top-0 z-30 bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E8DFC8] px-4 sm:px-8 py-3.5 shadow-2xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToHome}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-gray-50 border border-[#D9CBB7] text-xs font-bold text-[#3D2C24] transition-colors cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Parlour Menu</span>
          </button>

          <div className="text-center">
            <h1 className="font-serif-title text-lg sm:text-xl font-bold tracking-wider text-[#8C102A] uppercase">
              Amore
            </h1>
            <span className="text-[10px] tracking-widest text-[#7A6458] uppercase block">
              Order Confirmation Portal
            </span>
          </div>

          <div className="flex items-center gap-2">
            <CurrencyToggle currency={currency} onToggle={onToggleCurrency} />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 space-y-6">
        {/* Status Announcement Banner */}
        {paymentSuccess ? (
          <div className="p-5 sm:p-6 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-fadeIn">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-800 block">
                  {order.orderType === 'pickup' ? 'Order Confirmed at Parlour' : 'Order Confirmed & Payment Verified'}
                </span>
                <h2 className="font-serif-title text-xl sm:text-2xl font-bold text-emerald-950">
                  Thank You, {order.customerName}!
                </h2>
                <p className="text-xs text-emerald-800 mt-0.5">
                  {order.orderType === 'pickup' ? (
                    <>Your pickup order is confirmed at the <strong>{order.branchName}</strong> counter. Pay upon collection.</>
                  ) : (
                    <>Your order is confirmed at the <strong>{order.branchName}</strong> kitchen. Our team is handcrafting your scoops.</>
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSendConfirmationWhatsApp}
              className="inline-flex items-center gap-2 py-2.5 px-4 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp Receipt</span>
            </button>
          </div>
        ) : (
          <div className="p-5 sm:p-6 rounded-3xl bg-amber-50/90 border border-amber-200 text-amber-950 flex items-start sm:items-center gap-3.5 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Clock className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-900">
                  Action Required
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-950 font-bold">
                  Order Awaiting Payment & Confirmation
                </span>
              </div>
              <h2 className="font-serif-title text-xl sm:text-2xl font-bold text-[#241A18] mt-0.5">
                Confirm Your Order & Select Payment
              </h2>
              <p className="text-xs text-[#5C4D44] mt-0.5">
                Please verify your ordered products and bill amount below. Choose your preferred payment method to finalize your order.
              </p>
            </div>
          </div>
        )}

        {/* Two Column Layout for Order Details & Payment */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Order Details & Products (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Order Reference & Kitchen Card */}
            <div className="bg-white p-5 rounded-3xl border border-[#E0D5C3] shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#F0E8DC]">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A7970] block">
                    Order Reference Code
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-base font-black text-[#8C102A] tracking-wider">
                      {order.orderReference}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyReference}
                      className="p-1 rounded-md text-[#7A6458] hover:text-[#241A18] hover:bg-[#F2ECE4] transition-colors cursor-pointer"
                      title="Copy Reference"
                    >
                      {copiedRef ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A7970] block">
                    Fulfillment Method
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#241A18] mt-0.5">
                    {order.orderType === 'delivery' ? (
                      <>
                        <Truck className="w-3.5 h-3.5 text-[#8C102A]" />
                        <span>Doorstep Delivery</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-3.5 h-3.5 text-amber-700" />
                        <span>Parlour Pickup</span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Customer & Address Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#5C4D44]">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A7970] block">
                    Customer Name & Mobile
                  </span>
                  <p className="font-bold text-[#241A18] text-sm mt-0.5">{order.customerName}</p>
                  <p className="text-[#6B5A51]">{order.contactNumber}</p>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A7970] block">
                    Fulfilling Kitchen Branch
                  </span>
                  <p className="font-bold text-[#241A18] text-sm mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>{order.branchName}</span>
                  </p>
                  <p className="text-[#6B5A51]">{order.branchCity} Flagship</p>
                </div>

                {order.orderType === 'delivery' && (
                  <div className="sm:col-span-2 pt-1 border-t border-[#F5EFE6]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A7970] block">
                      Delivery Address
                    </span>
                    <p className="font-medium text-[#241A18] mt-0.5">
                      {order.deliveryAddress}{order.city ? `, ${order.city}` : ''}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Itemized Ordered Products Card */}
            <div className="bg-white p-5 rounded-3xl border border-[#E0D5C3] shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#F0E8DC]">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#8C102A]" />
                  <h3 className="font-serif-title text-base font-bold text-[#241A18]">
                    Ordered Products ({order.items.length})
                  </h3>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                  Small-Batch Handcrafted
                </span>
              </div>

              {/* Items List */}
              <div className="divide-y divide-[#F2ECE4] space-y-3 pt-1">
                {order.items.map((item, idx) => (
                  <div key={idx} className="pt-3 first:pt-0 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-12 h-12 rounded-xl object-cover border border-[#E0D5C3] shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-[#FAF7F2] border border-[#E0D5C3] flex items-center justify-center shrink-0 text-[#8C102A]">
                          <Cookie className="w-5 h-5" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-[#241A18] truncate flex items-center gap-1.5">
                          <span>{item.name}</span>
                          {item.format === 'biscuit-cup' && (
                            <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Biscuit Cup
                            </span>
                          )}
                        </h4>
                        <p className="text-xs text-[#7A6458]">
                          {item.format ? item.format.replace('-', ' ').toUpperCase() : 'STANDARD'} • {formatPrice(item.priceLKR, currency)} each
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-semibold text-[#7A6458] block">
                        Qty: <strong className="text-[#241A18]">{item.quantity}</strong>
                      </span>
                      <span className="font-bold text-sm text-[#8C102A]">
                        {formatPrice(item.priceLKR * item.quantity, currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Bill Amount & Payment Method Selection (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Bill Summary Card */}
            <div className="bg-white p-5 rounded-3xl border border-[#E0D5C3] shadow-xs space-y-3">
              <h3 className="font-serif-title text-base font-bold text-[#241A18] pb-2 border-b border-[#F0E8DC]">
                Bill Breakdown
              </h3>

              <div className="space-y-2 text-xs text-[#5C4D44]">
                <div className="flex justify-between">
                  <span>Tray Items Subtotal:</span>
                  <span className="font-semibold text-[#241A18]">{formatPrice(order.subtotalLKR, currency)}</span>
                </div>

                <div className="flex justify-between">
                  <span>{order.orderType === 'delivery' ? 'Delivery Charge:' : 'Pickup Service:'}</span>
                  <span className="font-semibold text-emerald-800">
                    {order.deliveryFeeLKR === 0 ? 'FREE' : formatPrice(order.deliveryFeeLKR, currency)}
                  </span>
                </div>

                <div className="flex justify-between pt-2.5 border-t border-[#F0E8DC] text-base font-bold text-[#241A18]">
                  <span>Total Bill Amount:</span>
                  <span className="text-[#8C102A] text-lg font-black">
                    {formatPrice(order.grandTotalLKR, currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Method & Checkout Card */}
            <div className="bg-white p-5 rounded-3xl border border-[#E0D5C3] shadow-md space-y-5">
              <div>
                <h3 className="font-serif-title text-base font-bold text-[#241A18]">
                  {paymentSuccess ? 'Payment Record' : 'Select Payment Method'}
                </h3>
                <p className="text-xs text-[#7A6458] mt-0.5">
                  {paymentSuccess
                    ? 'This order has been verified and recorded.'
                    : 'Choose how you would like to pay for your artisanal scoops.'}
                </p>
              </div>

              {paymentSuccess ? (
                <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E8DFC8] space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#7A6458]">Payment Method:</span>
                    <span className="font-bold text-[#241A18] uppercase">
                      {order.orderType === 'pickup' || order.paymentMethod === 'pay_at_parlour'
                        ? 'Pay at the Parlour Counter'
                        : order.paymentMethod === 'card'
                        ? 'Online Card Payment'
                        : 'Cash on Delivery'}
                    </span>
                  </div>

                  {order.cardLast4 && (
                    <div className="flex justify-between">
                      <span className="text-[#7A6458]">Card Info:</span>
                      <span className="font-mono text-[#241A18]">
                        {order.cardBrand || 'Card'} •••• {order.cardLast4}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-[#7A6458]">Transaction Status:</span>
                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>{order.paymentMethod === 'card' ? 'Paid (Authorized)' : 'Confirmed'}</span>
                    </span>
                  </div>

                  <div className="pt-3 border-t border-[#E8DFC8] space-y-2">
                    <button
                      type="button"
                      onClick={onBackToHome}
                      className="w-full py-3 px-4 rounded-full bg-[#8C102A] hover:bg-[#A31634] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      Return to Amore Ice Cream Parlour
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCompleteOrder} className="space-y-4">
                  {order.orderType === 'pickup' ? (
                    <div className="p-4 bg-gradient-to-r from-purple-50 via-[#FAF7F2] to-amber-50/70 rounded-2xl border border-purple-200/90 space-y-2 text-xs animate-fadeIn">
                      <div className="flex items-center gap-2 text-[#241A18] font-bold">
                        <Store className="w-4 h-4 text-purple-700" />
                        <span>Pay at Parlour Counter on Collection</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-[#5D4E46]">
                        No online payment required. Settle your bill via <strong>Cash, Card, or QR payment</strong> when collecting your scoops at Amore {order.branchName} counter.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Payment Method Tabs */}
                      <div className="grid grid-cols-2 gap-2 p-1 bg-[#F2ECE4] rounded-2xl border border-[#D9CBB7]">
                        <button
                          type="button"
                          onClick={() => setSelectedPaymentMethod('card')}
                          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            selectedPaymentMethod === 'card'
                              ? 'bg-white text-[#8C102A] shadow-xs'
                              : 'text-[#6B5A51] hover:text-[#241A18]'
                          }`}
                        >
                          <CreditCard className="w-4 h-4" />
                          <span>Credit / Debit Card</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedPaymentMethod('cash')}
                          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            selectedPaymentMethod === 'cash'
                              ? 'bg-white text-[#8C102A] shadow-xs'
                              : 'text-[#6B5A51] hover:text-[#241A18]'
                          }`}
                        >
                          <Banknote className="w-4 h-4" />
                          <span>Cash on Delivery</span>
                        </button>
                      </div>

                      {/* Card Payment Form Fields */}
                      {selectedPaymentMethod === 'card' ? (
                        <div className="space-y-3 pt-1">
                          <div className="flex items-center justify-between text-[11px] font-bold text-[#5C4D44]">
                            <span className="flex items-center gap-1 text-emerald-800">
                              <Lock className="w-3 h-3 text-emerald-700" />
                              <span>256-Bit SSL Encrypted Card Gateway</span>
                            </span>
                            <span className="text-[10px] text-[#7A6458]">Visa • MC • Amex</span>
                          </div>

                          {/* Cardholder Name */}
                          <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5C4D44] mb-1">
                              Cardholder Full Name
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Aathif Mohamed"
                              value={cardHolder}
                              onChange={(e) => setCardHolder(e.target.value)}
                              className="w-full px-3 py-2.5 text-xs text-[#241A18] bg-white border border-[#D9CBB7] rounded-xl focus:ring-2 focus:ring-[#8C102A] outline-hidden placeholder:text-[#A8988F]"
                            />
                          </div>

                          {/* Card Number */}
                          <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5C4D44] mb-1">
                              Card Number
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="4000 1234 5678 9010"
                              value={cardNumber}
                              onChange={handleCardNumberChange}
                              className="w-full px-3 py-2.5 text-xs font-mono text-[#241A18] bg-white border border-[#D9CBB7] rounded-xl focus:ring-2 focus:ring-[#8C102A] outline-hidden placeholder:text-[#A8988F] tracking-wider"
                            />
                          </div>

                          {/* Expiry & CVV */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5C4D44] mb-1">
                                Expiration (MM/YY)
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="MM/YY"
                                value={cardExpiry}
                                onChange={handleCardExpiryChange}
                                className="w-full px-3 py-2.5 text-xs font-mono text-[#241A18] bg-white border border-[#D9CBB7] rounded-xl focus:ring-2 focus:ring-[#8C102A] outline-hidden placeholder:text-[#A8988F]"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5C4D44] mb-1">
                                CVV Security Code
                              </label>
                              <input
                                type="password"
                                required
                                maxLength={4}
                                placeholder="•••"
                                value={cardCvv}
                                onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                className="w-full px-3 py-2.5 text-xs font-mono text-[#241A18] bg-white border border-[#D9CBB7] rounded-xl focus:ring-2 focus:ring-[#8C102A] outline-hidden placeholder:text-[#A8988F]"
                              />
                            </div>
                          </div>

                          <div className="p-2.5 bg-emerald-50/80 rounded-xl border border-emerald-200 flex items-center gap-2 text-[11px] text-emerald-900">
                            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                            <span>Mock payment simulator with instant card authorization.</span>
                          </div>

                          {/* Return & Refund Policy Link (Strictly on Card Payment) */}
                          <div className="pt-1 flex items-center justify-between text-[11px]">
                            <button
                              type="button"
                              onClick={() => setIsReturnPolicyOpen(true)}
                              className="text-[#8C102A] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>View Return & Refund Policy</span>
                            </button>
                            <span className="text-[10px] text-[#7A6458]">100% money-back guarantee</span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#E8DFC8] space-y-2 text-xs text-[#5C4D44]">
                          <div className="flex items-center gap-2 text-[#241A18] font-bold">
                            <Banknote className="w-4 h-4 text-amber-700" />
                            <span>Cash on Delivery (Pay to Rider)</span>
                          </div>
                          <p className="text-[11px] leading-relaxed text-[#6B5A51]">
                            Please prepare exact cash of {formatPrice(order.grandTotalLKR, currency)} for the delivery rider upon doorstep arrival.
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full py-3.5 px-6 rounded-full bg-[#8C102A] hover:bg-[#A31634] text-white font-bold text-sm shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-75"
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Authorizing & Completing Order...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-200" />
                        <span>
                          {order.orderType === 'pickup'
                            ? `Confirm Parlour Pickup Order • ${formatPrice(order.grandTotalLKR, currency)}`
                            : selectedPaymentMethod === 'card'
                            ? `Pay ${formatPrice(order.grandTotalLKR, currency)} & Complete Order`
                            : 'Confirm & Complete Order'}
                        </span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Return & Refund Policy Modal */}
      {isReturnPolicyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
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
