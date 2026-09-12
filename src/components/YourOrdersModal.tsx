import React, { useState, useEffect } from 'react';
import { OrderRecord, Currency } from '../types';
import {
  getUserOrdersList,
  cancelOrder,
  ORDERS_UPDATED_EVENT,
  generateInconvenienceEmail,
  syncUserOrdersFromFirestore,
  mergeOrdersIntoStorage,
  pauseOrderGracePeriod,
  resumeOrderGracePeriod,
} from '../utils/orderStorage';
import { subscribeToUserOrders, type User } from '../firebase';
import { formatPrice } from '../utils/currency';
import { AMORE_BRANCHES } from '../data/iceCreamData';
import {
  X,
  Clock,
  MapPin,
  Phone,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Ban,
  ShoppingBag,
  Sparkles,
  Cookie,
  CreditCard,
  Banknote,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Mail,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { LocationPickerModal } from './LocationPickerModal';

interface YourOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  currency: Currency;
  highlightOrderRef?: string | null;
  onBrowseMenu?: () => void;
}

export const YourOrdersModal: React.FC<YourOrdersModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  currency,
  highlightOrderRef,
  onBrowseMenu,
}) => {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [now, setNow] = useState<number>(Date.now());
  const [expandedOrderRef, setExpandedOrderRef] = useState<string | null>(highlightOrderRef || null);

  // Cancellation toast notification
  const [cancelNotification, setCancelNotification] = useState<string | null>(null);

  // Editing address state
  const [editingRef, setEditingRef] = useState<string | null>(null);
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editCoords, setEditCoords] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [isEditLocationPickerOpen, setIsEditLocationPickerOpen] = useState(false);

  // Cancel confirmation state
  const [confirmCancelRef, setConfirmCancelRef] = useState<string | null>(null);

  // Apology letter view state
  const [viewingApologyOrder, setViewingApologyOrder] = useState<OrderRecord | null>(null);
  const [copiedApology, setCopiedApology] = useState(false);

  // Load orders
  const refreshOrders = () => {
    const list = getUserOrdersList(currentUser?.uid);
    setOrders(list);

    if (highlightOrderRef) {
      const target = list.find((o) => o.orderReference === highlightOrderRef);
      if (target) {
        setExpandedOrderRef(highlightOrderRef);
      }
    } else if (list.length > 0 && !expandedOrderRef) {
      const activeList = list.filter((o) => o.status !== 'cancelled' && o.status !== 'delivered');
      if (activeList.length > 0) {
        setExpandedOrderRef(activeList[0].orderReference);
      } else {
        setExpandedOrderRef(list[0].orderReference);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshOrders();

      if (currentUser?.uid) {
        syncUserOrdersFromFirestore(currentUser.uid).then((synced) => {
          if (synced) {
            setOrders(getUserOrdersList(currentUser.uid));
          }
        });
      }
    }
  }, [isOpen, currentUser, highlightOrderRef]);

  // Live real-time sync with Admin / Firestore updates
  useEffect(() => {
    if (!isOpen) return;

    let unsubscribeUserOrders: (() => void) | null = null;
    if (currentUser?.uid) {
      unsubscribeUserOrders = subscribeToUserOrders(currentUser.uid, (userOrders) => {
        mergeOrdersIntoStorage(userOrders);
        refreshOrders();
      });
    }

    const handleSync = () => {
      refreshOrders();
    };

    window.addEventListener(ORDERS_UPDATED_EVENT, handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      if (unsubscribeUserOrders) unsubscribeUserOrders();
      window.removeEventListener(ORDERS_UPDATED_EVENT, handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [isOpen, currentUser]);

  // Live clock tick
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (viewingApologyOrder) {
          setViewingApologyOrder(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, viewingApologyOrder]);

  if (!isOpen) return null;

  // Strictly ongoing active orders only (customer request: no past history)
  const ongoingOrders = orders.filter((o) => o.status !== 'cancelled' && o.status !== 'delivered');

  // Compute remaining seconds in 2-minute (120s) grace period
  const getRemainingSeconds = (order: OrderRecord): number => {
    if (order.isGracePeriodPaused) {
      return Math.max(0, order.gracePeriodRemainingSeconds ?? 0);
    }
    const createdTime = new Date(order.createdAt).getTime();
    const elapsedSeconds = Math.floor((now - createdTime) / 1000);
    return Math.max(0, 120 - elapsedSeconds);
  };

  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start editing: PAUSE COUNTDOWN
  const handleStartEdit = (order: OrderRecord) => {
    const currentRemaining = getRemainingSeconds(order);
    pauseOrderGracePeriod(order.orderReference, currentRemaining);
    setEditingRef(order.orderReference);
    setEditAddress(order.deliveryAddress || '');
    setEditCity(order.city || '');
    setEditPhone(order.contactNumber || '');
    setEditNote(order.specialNote || '');
    setEditCoords(order.deliveryCoordinates);
    refreshOrders();
  };

  // Save edit: RESUME COUNTDOWN
  const handleSaveEdit = (order: OrderRecord) => {
    if (!editAddress.trim()) {
      alert('Please enter your delivery street address.');
      return;
    }
    const remaining = order.isGracePeriodPaused
      ? (order.gracePeriodRemainingSeconds ?? 0)
      : getRemainingSeconds(order);

    resumeOrderGracePeriod(order.orderReference, remaining, {
      deliveryAddress: editAddress.trim(),
      city: editCity.trim(),
      contactNumber: editPhone.trim(),
      specialNote: editNote.trim(),
      deliveryCoordinates: editCoords,
    });
    setEditingRef(null);
    refreshOrders();
  };

  // Cancel edit: RESUME COUNTDOWN
  const handleCancelEdit = (order: OrderRecord) => {
    const remaining = order.isGracePeriodPaused
      ? (order.gracePeriodRemainingSeconds ?? 0)
      : getRemainingSeconds(order);

    resumeOrderGracePeriod(order.orderReference, remaining);
    setEditingRef(null);
    refreshOrders();
  };

  // Cancel order by customer -> Immediately removes from ongoing orders
  const handleConfirmCancel = (orderRef: string) => {
    cancelOrder(orderRef, 'customer', 'Cancelled by customer during grace period');
    setConfirmCancelRef(null);
    setCancelNotification(`Order ${orderRef} was cancelled. Any card payment hold has been released.`);
    refreshOrders();
  };

  const handleCopyApologyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedApology(true);
    setTimeout(() => setCopiedApology(false), 2500);
  };

  // Helper for tracking steps
  const getStepState = (orderStatus: OrderRecord['status']) => {
    switch (orderStatus) {
      case 'pending_confirmation':
        return 1;
      case 'confirmed':
        return 2;
      case 'preparing':
        return 3;
      case 'delivered':
        return 4;
      default:
        return 1;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="your-orders-title"
    >
      <div
        className="relative w-full max-w-xl bg-[#FAF7F2] rounded-3xl overflow-hidden shadow-2xl border border-[#E8DFC8] my-auto max-h-[92vh] flex flex-col transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Clean, reassuring & simple */}
        <div className="bg-white px-5 py-4 border-b border-[#E8DFC8] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#8C102A] text-white flex items-center justify-center shadow-xs">
              <ShoppingBag className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h2 id="your-orders-title" className="font-serif-title text-xl font-bold text-[#241A18] leading-tight">
                Your Orders
              </h2>
              <p className="text-xs text-[#7A6458]">
                {ongoingOrders.length === 0
                  ? 'No active orders'
                  : ongoingOrders.length === 1
                  ? '1 active order in progress'
                  : `${ongoingOrders.length} active orders in progress`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#FAF7F2] hover:bg-gray-100 text-[#5D4E46] flex items-center justify-center border border-[#E0D5C3] cursor-pointer transition-colors"
            aria-label="Close orders"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cancellation Notice Banner */}
        {cancelNotification && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between text-xs text-amber-950 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{cancelNotification}</span>
            </div>
            <button
              type="button"
              onClick={() => setCancelNotification(null)}
              className="text-amber-800 hover:text-amber-950 font-bold ml-2 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Orders List Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {ongoingOrders.length === 0 ? (
            /* Empty State - Calming, gentle & encouraging */
            <div className="text-center py-14 px-4">
              <div className="w-16 h-16 rounded-full bg-white border border-[#E8DFC8] flex items-center justify-center mx-auto mb-4 text-[#8C102A] shadow-xs">
                <ShoppingBag className="w-7 h-7 text-[#8C102A]/80" />
              </div>
              <h3 className="font-serif-title text-lg font-bold text-[#241A18]">
                No active ongoing orders
              </h3>
              <p className="text-xs text-[#7A6458] max-w-xs mx-auto mt-1.5 mb-6 leading-relaxed">
                When you order your favorite gelato, live parlour updates and your change window will appear here.
              </p>
              {onBrowseMenu && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onBrowseMenu();
                  }}
                  className="px-6 py-2.5 rounded-full bg-[#8C102A] hover:bg-[#A31634] text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  Explore Gelato Menu
                </button>
              )}
            </div>
          ) : (
            ongoingOrders.map((order) => {
              const remainingSeconds = getRemainingSeconds(order);
              const inGracePeriod = (remainingSeconds > 0 || !!order.isGracePeriodPaused) && order.status === 'pending_confirmation';
              const isConfirmed = order.status === 'confirmed';
              const isPreparing = order.status === 'preparing';
              const isPendingConfirmation = order.status === 'pending_confirmation';
              const isEditing = editingRef === order.orderReference;
              const isExpanded = expandedOrderRef === order.orderReference;
              const branch = AMORE_BRANCHES.find((b) => b.id === order.branchId) || AMORE_BRANCHES[0];
              const stepNumber = getStepState(order.status);

              return (
                <div
                  key={order.orderReference}
                  className="bg-white rounded-3xl border border-[#E8DFC8] shadow-sm hover:shadow-md transition-all overflow-hidden"
                >
                  {/* Top Order Bar */}
                  <div
                    onClick={() => setExpandedOrderRef(isExpanded ? null : order.orderReference)}
                    className="p-4 sm:px-5 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#FAF7F2]/60 transition-colors"
                  >
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-sm text-[#8C102A]">
                          {order.orderReference}
                        </span>
                        <span className="text-[11px] text-[#7A6458]">
                          • {order.branchName}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#7A6458] mt-0.5">
                        {new Date(order.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        at{' '}
                        {new Date(order.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="font-bold text-sm text-[#241A18] block">
                          {formatPrice(order.grandTotalLKR, currency)}
                        </span>
                        <span className="text-[10px] text-[#7A6458]">
                          {order.items.reduce((s, i) => s + i.quantity, 0)} items
                        </span>
                      </div>
                      <div className="w-7 h-7 rounded-full bg-[#FAF7F2] border border-[#E8DFC8] flex items-center justify-center text-slate-500">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Clean Visual Progress Stepper */}
                  <div className="px-5 py-3 bg-[#FAF7F2]/70 border-t border-b border-[#E8DFC8]/60">
                    <div className="grid grid-cols-4 gap-1 relative">
                      {/* Step 1: Received */}
                      <div className="flex flex-col items-center text-center">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mb-1 transition-colors ${
                            stepNumber >= 1
                              ? 'bg-[#8C102A] text-white'
                              : 'bg-gray-200 text-gray-500'
                          }`}
                        >
                          1
                        </div>
                        <span className={`text-[10px] ${stepNumber === 1 ? 'font-bold text-[#8C102A]' : 'text-slate-500'}`}>
                          Placed
                        </span>
                      </div>

                      {/* Step 2: Confirmed */}
                      <div className="flex flex-col items-center text-center">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mb-1 transition-colors ${
                            stepNumber >= 2
                              ? 'bg-[#8C102A] text-white'
                              : 'bg-gray-200 text-gray-500'
                          }`}
                        >
                          2
                        </div>
                        <span className={`text-[10px] ${stepNumber === 2 ? 'font-bold text-[#8C102A]' : 'text-slate-500'}`}>
                          Confirmed
                        </span>
                      </div>

                      {/* Step 3: Kitchen */}
                      <div className="flex flex-col items-center text-center">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mb-1 transition-colors ${
                            stepNumber >= 3
                              ? 'bg-[#8C102A] text-white'
                              : 'bg-gray-200 text-gray-500'
                          }`}
                        >
                          3
                        </div>
                        <span className={`text-[10px] ${stepNumber === 3 ? 'font-bold text-[#8C102A]' : 'text-slate-500'}`}>
                          In Kitchen
                        </span>
                      </div>

                      {/* Step 4: Delivered */}
                      <div className="flex flex-col items-center text-center">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mb-1 transition-colors ${
                            stepNumber >= 4
                              ? 'bg-emerald-600 text-white'
                              : 'bg-gray-200 text-gray-500'
                          }`}
                        >
                          4
                        </div>
                        <span className={`text-[10px] ${stepNumber === 4 ? 'font-bold text-emerald-700' : 'text-slate-500'}`}>
                          Delivered
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Grace Period Card (Counting down OR Paused for Edit) */}
                  {inGracePeriod && (
                    <div className="p-4 sm:px-5 bg-[#FFFDF9] border-b border-[#E8DFC8]">
                      {order.isGracePeriodPaused ? (
                        /* PAUSED STATE */
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                <Clock className="w-3.5 h-3.5 text-amber-700" />
                                <span>Countdown Paused: {formatCountdown(remainingSeconds)}</span>
                              </span>
                            </div>
                            <span className="text-[10px] font-medium text-amber-800">
                              Editing delivery address
                            </span>
                          </div>
                          <p className="text-xs text-amber-950">
                            The 2-minute timer is safely paused. Take your time updating your address below; it will resume once saved.
                          </p>
                        </div>
                      ) : (
                        /* ACTIVE COUNTDOWN STATE */
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                <Clock className="w-3.5 h-3.5 text-amber-700 animate-spin" />
                                <span>{formatCountdown(remainingSeconds)} remaining</span>
                              </span>
                              <span className="text-xs font-bold text-[#241A18]">
                                Address Change Window
                              </span>
                            </div>
                            <p className="text-[11px] text-[#7A6458]">
                              You can edit your address or cancel before the parlour prepares your order.
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {order.orderType === 'delivery' && !isEditing && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEdit(order);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-white border border-[#D9CBB7] hover:border-[#8C102A] text-[#241A18] hover:text-[#8C102A] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-[#8C102A]" />
                                <span>Edit Address</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmCancelRef(order.orderReference);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Cancel Order</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Inline Address Edit Form - Clean, spacious & simple */}
                  {isEditing && (
                    <div className="p-4 sm:p-5 bg-white border-b border-[#E8DFC8] space-y-3.5 animate-fadeIn">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                        <span className="text-xs font-bold text-[#241A18] flex items-center gap-1.5">
                          <Edit3 className="w-3.5 h-3.5 text-[#8C102A]" />
                          Update Delivery Address
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCancelEdit(order)}
                          className="text-xs text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                        >
                          ✕ Cancel
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-bold text-[#5D4E46]">
                              Street Address & House No.
                            </label>
                            <button
                              type="button"
                              onClick={() => setIsEditLocationPickerOpen(true)}
                              className="text-[11px] font-bold text-[#8C102A] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <MapPin className="w-3 h-3 text-[#8C102A]" />
                              <span>Drop Pin on Map</span>
                            </button>
                          </div>

                          {editCoords && (
                            <div className="mb-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-900 flex items-center justify-between">
                              <span className="flex items-center gap-1 font-semibold">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Pin set: {editCoords.lat.toFixed(4)}, {editCoords.lng.toFixed(4)}
                              </span>
                              <button
                                type="button"
                                onClick={() => setIsEditLocationPickerOpen(true)}
                                className="font-bold text-[#8C102A] hover:underline cursor-pointer"
                              >
                                Move Pin
                              </button>
                            </div>
                          )}

                          <input
                            type="text"
                            value={editAddress}
                            onChange={(e) => setEditAddress(e.target.value)}
                            placeholder="e.g. 24 Cinnamon Gardens, Colombo 07"
                            className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#D9CBB7] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#8C102A] focus:bg-white"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-bold text-[#5D4E46] mb-1">
                              City / Area
                            </label>
                            <input
                              type="text"
                              value={editCity}
                              onChange={(e) => setEditCity(e.target.value)}
                              placeholder="City"
                              className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#D9CBB7] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#8C102A] focus:bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-[#5D4E46] mb-1">
                              Contact Phone
                            </label>
                            <input
                              type="tel"
                              value={editPhone}
                              onChange={(e) => setEditPhone(e.target.value)}
                              placeholder="Phone"
                              className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#D9CBB7] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#8C102A] focus:bg-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-[#5D4E46] mb-1">
                            Delivery Notes (Optional)
                          </label>
                          <input
                            type="text"
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            placeholder="e.g. Leave at door, call upon arrival"
                            className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#D9CBB7] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#8C102A] focus:bg-white"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => handleCancelEdit(order)}
                          className="px-4 py-2 rounded-xl bg-white border border-[#D9CBB7] text-xs font-bold text-[#5D4E46] hover:bg-gray-50 cursor-pointer"
                        >
                          Discard
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(order)}
                          className="px-5 py-2 rounded-xl bg-[#8C102A] hover:bg-[#A31634] text-white text-xs font-bold shadow-xs cursor-pointer"
                        >
                          Save Changes & Resume
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Calm Status Messages When Past Grace Period */}
                  {!inGracePeriod && isPendingConfirmation && (
                    <div className="p-3 sm:px-5 bg-amber-50/70 border-b border-amber-200/80 flex items-center gap-2 text-xs text-amber-900">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        <strong>Awaiting parlour confirmation:</strong> Our team is verifying fresh kitchen inventory. Payment will only process after confirmation.
                      </span>
                    </div>
                  )}

                  {(isConfirmed || isPreparing) && (
                    <div className="p-3 sm:px-5 bg-emerald-50/70 border-b border-emerald-200/80 flex items-center justify-between gap-2 text-xs text-emerald-950">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          {isPreparing
                            ? 'Our artisans are churning and packing your fresh scoops!'
                            : 'Order confirmed! Heading to kitchen preparation.'}
                        </span>
                      </div>
                      <a
                        href={`https://wa.me/${branch.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                          `Hello Amore ${branch.name}, checking on order ${order.orderReference}.`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-[#8C102A] hover:underline flex items-center gap-1 shrink-0 ml-2"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  )}

                  {/* Cancel Confirmation Prompt */}
                  {confirmCancelRef === order.orderReference && (
                    <div className="p-4 bg-red-50 border-b border-red-200 space-y-2 animate-fadeIn">
                      <div className="flex items-start gap-2 text-xs text-red-950">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Cancel Order {order.orderReference}?</p>
                          <p className="text-[11px] text-red-800 mt-0.5">
                            Are you sure? This will cancel your order and release any card payment pre-authorization.
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setConfirmCancelRef(null)}
                          className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                        >
                          Keep Order
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirmCancel(order.orderReference)}
                          className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
                        >
                          Yes, Cancel Order
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Expanded Order Details */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 space-y-4 bg-[#FAF7F2]/40 animate-fadeIn">
                      {/* Items List */}
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#7A6458] block mb-2">
                          Items in this order
                        </span>
                        <div className="bg-white rounded-2xl p-3 border border-[#E8DFC8] divide-y divide-gray-100">
                          {order.items.map((it, idx) => (
                            <div key={idx} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2.5">
                                <span className="font-bold text-[#8C102A] text-xs">
                                  {it.quantity}x
                                </span>
                                <div>
                                  <span className="font-bold text-[#241A18] block">
                                    {it.name}
                                  </span>
                                  {it.format && (
                                    <span className="text-[10px] text-[#7A6458] flex items-center gap-1">
                                      {it.format.includes('biscuit') && <Cookie className="w-2.5 h-2.5 text-amber-700" />}
                                      {it.format}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="font-bold text-[#241A18]">
                                {formatPrice(it.priceLKR * it.quantity, currency)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Delivery & Payment Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="bg-white rounded-2xl p-3 border border-[#E8DFC8]">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6458] block mb-1">
                            {order.orderType === 'delivery' ? 'Delivery Destination' : 'Pickup Location'}
                          </span>
                          <p className="font-bold text-[#241A18] flex items-start gap-1">
                            <MapPin className="w-3.5 h-3.5 text-[#8C102A] shrink-0 mt-0.5" />
                            <span>
                              {order.orderType === 'delivery'
                                ? `${order.deliveryAddress || ''}, ${order.city || ''}`
                                : `${order.branchName} (${order.branchCity})`}
                            </span>
                          </p>
                          {order.specialNote && (
                            <p className="text-[11px] text-slate-500 mt-1 italic">
                              "{order.specialNote}"
                            </p>
                          )}
                        </div>

                        <div className="bg-white rounded-2xl p-3 border border-[#E8DFC8]">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6458] block mb-1">
                            Contact & Payment
                          </span>
                          <p className="font-medium text-[#241A18] flex items-center gap-1 mb-1">
                            <Phone className="w-3 h-3 text-[#8C102A]" />
                            <span>{order.contactNumber}</span>
                          </p>
                          <div className="flex items-center gap-1.5">
                            {order.paymentMethod === 'card' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700">
                                <CreditCard className="w-3 h-3" />
                                <span>Card {order.cardBrand ? `(${order.cardBrand})` : ''}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                                <Banknote className="w-3 h-3" />
                                <span>Cash on Delivery (LKR)</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="bg-white px-5 py-3 border-t border-[#E8DFC8] flex items-center justify-between text-xs text-[#7A6458]">
          <span>Amore Artisanal Gelato • Fresh Daily</span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#8C102A] hover:bg-[#A31634] text-white font-bold text-xs shadow-xs cursor-pointer transition-all"
          >
            Close
          </button>
        </div>
      </div>

      {/* Parlour Apology Notice Modal (if needed) */}
      {viewingApologyOrder && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn"
          onClick={() => setViewingApologyOrder(null)}
        >
          <div
            className="relative w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-[#E8DFC8] p-6 space-y-4 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E8DFC8] pb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#8C102A]" />
                <h3 className="font-serif-title font-bold text-base text-[#241A18]">
                  Apology Notice
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingApologyOrder(null)}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E8DFC8] font-mono text-xs text-slate-800 whitespace-pre-wrap max-h-[50vh] overflow-y-auto leading-relaxed">
              {viewingApologyOrder.inconvenienceEmailContent ||
                generateInconvenienceEmail(
                  viewingApologyOrder,
                  viewingApologyOrder.cancellationReason || 'Parlour kitchen capacity constraint'
                ).body}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  const content =
                    viewingApologyOrder.inconvenienceEmailContent ||
                    generateInconvenienceEmail(
                      viewingApologyOrder,
                      viewingApologyOrder.cancellationReason || 'Parlour kitchen capacity constraint'
                    ).body;
                  handleCopyApologyText(content);
                }}
                className="px-4 py-2 rounded-xl bg-white border border-[#D9CBB7] hover:bg-gray-50 text-xs font-bold text-[#3D2C24] flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {copiedApology ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-600" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setViewingApologyOrder(null)}
                className="px-5 py-2 rounded-xl bg-[#8C102A] hover:bg-[#A31634] text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GPS / Map Pin Location Picker */}
      <LocationPickerModal
        isOpen={isEditLocationPickerOpen}
        onClose={() => setIsEditLocationPickerOpen(false)}
        initialAddress={editAddress}
        initialCity={editCity}
        initialCoords={editCoords}
        onSelectLocation={(loc) => {
          setEditAddress(loc.address);
          if (loc.city) setEditCity(loc.city);
          setEditCoords(loc.coords);
        }}
      />
    </div>
  );
};
