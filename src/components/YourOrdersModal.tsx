import React, { useState, useEffect } from 'react';
import { OrderRecord, Currency } from '../types';
import {
  getUserOrdersList,
  cancelOrder,
  deleteCustomerHistoryOrder,
  clearCustomerOrderHistory,
  ORDERS_UPDATED_EVENT,
  generateInconvenienceEmail,
  syncOrdersFromFirestore,
  syncUserOrdersFromFirestore,
  mergeOrdersIntoStorage,
  pauseOrderGracePeriod,
  resumeOrderGracePeriod,
} from '../utils/orderStorage';
import { subscribeToAllOrders, subscribeToUserOrders, type User } from '../firebase';
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
  Truck,
  Store,
  History,
  Trash2,
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

  // Active tab: 'ongoing' for live orders, 'history' for past orders
  const [activeOrdersTab, setActiveOrdersTab] = useState<'ongoing' | 'history'>('ongoing');
  const [selectedHistoryOrder, setSelectedHistoryOrder] = useState<OrderRecord | null>(null);

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

    const activeList = list.filter((o) => o.status !== 'cancelled' && o.status !== 'delivered');
    const historyList = list.filter((o) => o.status === 'delivered' || o.status === 'cancelled');

    if (highlightOrderRef) {
      const target = list.find((o) => o.orderReference === highlightOrderRef);
      if (target) {
        if (target.status === 'delivered' || target.status === 'cancelled') {
          setActiveOrdersTab('history');
          setSelectedHistoryOrder(target);
        } else {
          setActiveOrdersTab('ongoing');
          setExpandedOrderRef(highlightOrderRef);
        }
      }
    } else if (activeList.length === 0 && historyList.length > 0) {
      // Default to history tab if no ongoing orders are active
      setActiveOrdersTab('history');
    } else if (activeList.length > 0 && !expandedOrderRef) {
      setExpandedOrderRef(activeList[0].orderReference);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshOrders();

      // Immediately fetch latest orders from Cloud Firestore so completed/delivered orders
      // or status changes from Admin panel reflect instantly, whether guest or logged-in!
      syncOrdersFromFirestore().then(() => {
        refreshOrders();
      });

      if (currentUser?.uid) {
        syncUserOrdersFromFirestore(currentUser.uid).then(() => {
          refreshOrders();
        });
      }
    }
  }, [isOpen, currentUser, highlightOrderRef]);

  // Live real-time sync with Admin / Firestore updates
  useEffect(() => {
    if (!isOpen) return;

    // Real-time listener: any status change made on Admin panel (e.g. marked delivered)
    // immediately updates localStorage and triggers re-render for the customer.
    const unsubscribeAllOrders = subscribeToAllOrders((allOrders) => {
      mergeOrdersIntoStorage(allOrders);
      refreshOrders();
    });

    const handleSync = () => {
      refreshOrders();
    };

    window.addEventListener(ORDERS_UPDATED_EVENT, handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      unsubscribeAllOrders();
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
        if (selectedHistoryOrder) {
          setSelectedHistoryOrder(null);
        } else if (viewingApologyOrder) {
          setViewingApologyOrder(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, viewingApologyOrder, selectedHistoryOrder]);

  if (!isOpen) return null;

  // Active ongoing orders vs Past order history
  const ongoingOrders = orders.filter((o) => o.status !== 'cancelled' && o.status !== 'delivered');
  const historyOrders = orders.filter((o) => o.status === 'delivered' || o.status === 'cancelled');

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

  // Delete a specific history order
  const handleDeleteHistoryOrder = (orderRef: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm(`Delete order #${orderRef} from your order history?`)) {
      deleteCustomerHistoryOrder(orderRef);
      if (selectedHistoryOrder?.orderReference === orderRef) {
        setSelectedHistoryOrder(null);
      }
      setCancelNotification(`Order #${orderRef} was deleted from your history.`);
      refreshOrders();
    }
  };

  // Clear all past history orders
  const handleClearAllHistory = () => {
    if (historyOrders.length === 0) return;
    if (
      window.confirm(
        `Are you sure you want to clear all ${historyOrders.length} past order records from your history?`
      )
    ) {
      clearCustomerOrderHistory(currentUser?.uid);
      setSelectedHistoryOrder(null);
      setCancelNotification('All past order history has been cleared.');
      refreshOrders();
    }
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
      case 'paid':
        return 2;
      case 'preparing':
        return 3;
      case 'on_the_way':
        return 4;
      case 'delivered':
        return 5;
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
                Your Orders & History
              </h2>
              <p className="text-xs text-[#7A6458]">
                {activeOrdersTab === 'ongoing'
                  ? ongoingOrders.length === 0
                    ? 'No active orders in progress'
                    : ongoingOrders.length === 1
                    ? '1 active order in progress'
                    : `${ongoingOrders.length} active orders in progress`
                  : historyOrders.length === 0
                  ? 'No past orders in history'
                  : `${historyOrders.length} past order${historyOrders.length > 1 ? 's' : ''} in history`}
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

        {/* Active Orders vs Order History Tab Bar */}
        <div className="bg-[#FAF7F2] px-4 sm:px-5 pt-2.5 border-b border-[#E8DFC8] flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveOrdersTab('ongoing')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeOrdersTab === 'ongoing'
                ? 'border-[#8C102A] text-[#8C102A]'
                : 'border-transparent text-[#7A6458] hover:text-[#241A18]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Active Orders</span>
            {ongoingOrders.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#8C102A] text-white text-[10px] font-black flex items-center justify-center shadow-xs">
                {ongoingOrders.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveOrdersTab('history')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeOrdersTab === 'history'
                ? 'border-[#8C102A] text-[#8C102A]'
                : 'border-transparent text-[#7A6458] hover:text-[#241A18]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Order History</span>
            {historyOrders.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-white border border-[#E8DFC8] text-[#5D4E46] text-[10px] font-black">
                {historyOrders.length}
              </span>
            )}
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
          {activeOrdersTab === 'ongoing' ? (
            ongoingOrders.length === 0 ? (
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
              {historyOrders.length > 0 && (
                <div className="mt-4 mb-3 p-3 bg-white rounded-2xl border border-[#E8DFC8] text-xs text-[#5D4E46] flex items-center justify-between gap-3 max-w-sm mx-auto shadow-2xs">
                  <div className="flex items-center gap-2 text-left">
                    <History className="w-4 h-4 text-[#8C102A] shrink-0" />
                    <span>You have <strong>{historyOrders.length} past order{historyOrders.length > 1 ? 's' : ''}</strong> in history</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveOrdersTab('history')}
                    className="px-3 py-1.5 rounded-xl bg-[#8C102A] hover:bg-[#A31634] text-white text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0"
                  >
                    View History
                  </button>
                </div>
              )}
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
              const isOnTheWay = order.status === 'on_the_way';
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

                  {/* Visual Progress Stepper with Organic Breathing Status Circle */}
                  <div className="px-4 sm:px-6 py-4 bg-[#FAF7F2]/90 border-t border-b border-[#E8DFC8]/70 relative overflow-hidden">
                    {/* Connecting track running behind circles */}
                    <div className="absolute top-[28px] sm:top-[30px] left-[10%] right-[10%] h-[2px] bg-[#E8DFC8] -z-0">
                      <div
                        className="h-full transition-all duration-700 ease-out rounded-full"
                        style={{
                          width: `${Math.min(100, Math.max(0, ((stepNumber - 1) / 4) * 100))}%`,
                          backgroundColor:
                            stepNumber >= 5 ? '#059669' : stepNumber >= 4 ? '#2563EB' : '#8C102A',
                        }}
                      />
                    </div>

                    {/* 5 Progress Step Nodes */}
                    <div className="grid grid-cols-5 gap-1 relative z-10">
                      {[
                        {
                          num: 1,
                          label: 'Placed',
                          activeColor: '#8C102A',
                          breatheClass: 'animate-breathe bg-[#8C102A] text-white ring-4 ring-[#8C102A]/25',
                          activeTextClass: 'text-[#8C102A] font-extrabold',
                          activeIcon: '1',
                        },
                        {
                          num: 2,
                          label: 'Confirmed',
                          activeColor: '#8C102A',
                          breatheClass: 'animate-breathe bg-[#8C102A] text-white ring-4 ring-[#8C102A]/25',
                          activeTextClass: 'text-[#8C102A] font-extrabold',
                          activeIcon: '2',
                        },
                        {
                          num: 3,
                          label: 'Kitchen',
                          activeColor: '#8C102A',
                          breatheClass: 'animate-breathe bg-[#8C102A] text-white ring-4 ring-[#8C102A]/25',
                          activeTextClass: 'text-[#8C102A] font-extrabold',
                          activeIcon: <Sparkles className="w-3.5 h-3.5 text-amber-200" />,
                        },
                        {
                          num: 4,
                          label: order.orderType === 'delivery' ? 'On the Way' : 'Ready to Pickup',
                          activeColor: order.orderType === 'delivery' ? '#2563EB' : '#7C3AED',
                          breatheClass:
                            order.orderType === 'delivery'
                              ? 'animate-breathe-blue bg-blue-600 text-white ring-4 ring-blue-600/25'
                              : 'animate-breathe bg-purple-600 text-white ring-4 ring-purple-600/25',
                          activeTextClass:
                            order.orderType === 'delivery' ? 'text-blue-700 font-extrabold' : 'text-purple-700 font-extrabold',
                          activeIcon:
                            order.orderType === 'delivery' ? (
                              <Truck className="w-3.5 h-3.5" />
                            ) : (
                              <ShoppingBag className="w-3.5 h-3.5" />
                            ),
                        },
                        {
                          num: 5,
                          label: order.orderType === 'delivery' ? 'Delivered' : 'Picked Up',
                          activeColor: '#059669',
                          breatheClass: 'animate-breathe-green bg-emerald-600 text-white ring-4 ring-emerald-600/25',
                          activeTextClass: 'text-emerald-700 font-extrabold',
                          activeIcon: <Check className="w-3.5 h-3.5 stroke-[3]" />,
                        },
                      ].map((s) => {
                        const isPast = stepNumber > s.num;
                        const isCurrent = stepNumber === s.num;

                        return (
                          <div key={s.num} className="flex flex-col items-center text-center relative">
                            <div className="relative mb-1.5">
                              {/* Glowing breathing ambient halo ring on active step */}
                              {isCurrent && (
                                <span
                                  className="absolute -inset-1.5 rounded-full opacity-40 animate-ping -z-10 pointer-events-none"
                                  style={{ backgroundColor: s.activeColor }}
                                />
                              )}
                              <div
                                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-300 select-none ${
                                  isPast
                                    ? 'bg-[#8C102A] text-white shadow-xs'
                                    : isCurrent
                                    ? `${s.breatheClass} shadow-md`
                                    : 'bg-white text-[#9C8A80] border border-[#D9CBB7]'
                                }`}
                              >
                                {isPast ? (
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                ) : isCurrent ? (
                                  s.activeIcon
                                ) : (
                                  <span className="font-semibold">{s.num}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-center gap-1">
                              {isCurrent && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                                  style={{ backgroundColor: s.activeColor }}
                                />
                              )}
                              <span
                                className={`text-[10px] sm:text-[11px] transition-colors leading-tight ${
                                  isCurrent
                                    ? s.activeTextClass
                                    : isPast
                                    ? 'font-medium text-[#4A3C34]'
                                    : 'text-[#9C8A80]'
                                }`}
                              >
                                {s.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
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
                        <strong>Awaiting parlour confirmation:</strong> Our team is verifying fresh kitchen inventory. {order.orderType === 'pickup' ? 'Your order will be prepared shortly for parlour pickup.' : 'Payment will only process after confirmation.'}
                      </span>
                    </div>
                  )}

                  {(isConfirmed || isPreparing) && (
                    <div className="p-3.5 sm:px-5 bg-emerald-50/70 border-b border-emerald-200/80 flex items-center justify-between gap-2 text-xs text-emerald-950">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center shadow-xs transition-all ${
                              isPreparing
                                ? 'bg-[#8C102A] text-white animate-breathe ring-2 ring-[#8C102A]/20'
                                : 'bg-emerald-600 text-white'
                            }`}
                          >
                            <Sparkles className="w-4 h-4 text-amber-200" />
                          </div>
                        </div>
                        <div>
                          <span className="font-bold text-[#241A18] block text-xs flex items-center gap-1.5">
                            {isPreparing && (
                              <span className="w-2 h-2 rounded-full bg-[#8C102A] animate-pulse inline-block" />
                            )}
                            {isPreparing
                              ? 'Scooping & Churning Fresh Gelato'
                              : order.orderType === 'pickup'
                              ? 'Order Confirmed at Parlour'
                              : order.paymentMethod === 'card'
                              ? 'Order Confirmed & Payment Captured'
                              : 'Order Confirmed (Cash on Delivery)'}
                          </span>
                          <span className="text-[11px] text-[#5D4E46] block mt-0.5">
                            {isPreparing
                              ? order.orderType === 'pickup'
                                ? 'Our parlour artisans are crafting your custom flavours. Your order will be ready for pickup shortly.'
                                : 'Our parlour artisans are crafting your custom flavours and biscuit cones right now.'
                              : order.orderType === 'pickup'
                              ? 'Your pickup order has been approved by the parlour and is queued for preparation. Pay at counter upon collection.'
                              : 'Your order has been approved by the parlour and sent to the preparation queue.'}
                          </span>
                        </div>
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

                  {isOnTheWay && (
                    <div
                      className={`p-3.5 sm:px-5 border-b flex items-center justify-between gap-2 text-xs animate-fadeIn ${
                        order.orderType === 'pickup'
                          ? 'bg-purple-50/90 border-purple-200/90 text-purple-950'
                          : 'bg-sky-50/90 border-sky-200/90 text-sky-950'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <span
                            className={`absolute -inset-1 rounded-full animate-pulse-glow -z-0 ${
                              order.orderType === 'pickup' ? 'bg-purple-500/25' : 'bg-blue-500/25'
                            }`}
                          />
                          <div
                            className={`w-8 h-8 rounded-full text-white flex items-center justify-center shadow-xs relative z-10 ring-2 ${
                              order.orderType === 'pickup'
                                ? 'bg-purple-600 animate-breathe ring-purple-500/20'
                                : 'bg-blue-600 animate-breathe-blue ring-blue-500/20'
                            }`}
                          >
                            {order.orderType === 'pickup' ? (
                              <ShoppingBag className="w-4 h-4" />
                            ) : (
                              <Truck className="w-4 h-4" />
                            )}
                          </div>
                        </div>
                        <div>
                          <span
                            className={`font-bold block text-xs flex items-center gap-1.5 ${
                              order.orderType === 'pickup' ? 'text-purple-950' : 'text-sky-950'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full animate-pulse inline-block ${
                                order.orderType === 'pickup' ? 'bg-purple-600' : 'bg-blue-600'
                              }`}
                            />
                            {order.orderType === 'delivery'
                              ? 'Delivery partner on the way'
                              : 'Ready to pickup'}
                          </span>
                          <span
                            className={`text-[11px] block mt-0.5 ${
                              order.orderType === 'pickup' ? 'text-purple-800' : 'text-sky-800'
                            }`}
                          >
                            {order.orderType === 'delivery'
                              ? 'Your scoops are packed in thermal containers and our delivery partner is en route.'
                              : `Your gelato is freshly prepared and waiting for you at Amore ${order.branchName} counter!`}
                          </span>
                        </div>
                      </div>
                      <a
                        href={`https://wa.me/${branch.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                          order.orderType === 'delivery'
                            ? `Hello Amore ${branch.name}, checking on order ${order.orderReference} that is on the way.`
                            : `Hello Amore ${branch.name}, I am on my way to collect order ${order.orderReference}.`
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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {order.orderType === 'pickup' || order.paymentMethod === 'pay_at_parlour' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                                <Store className="w-3 h-3 text-purple-600" />
                                <span>Pay at the Parlour / Counter</span>
                              </span>
                            ) : order.paymentMethod === 'card' ? (
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
            )
          ) : (
            /* ======================================================== */
            /* ORDER HISTORY SECTION */
            /* ======================================================== */
            historyOrders.length === 0 ? (
              <div className="text-center py-14 px-4">
                <div className="w-16 h-16 rounded-full bg-white border border-[#E8DFC8] flex items-center justify-center mx-auto mb-4 text-[#8C102A] shadow-xs">
                  <History className="w-7 h-7 text-[#8C102A]/80" />
                </div>
                <h3 className="font-serif-title text-lg font-bold text-[#241A18]">
                  No past orders yet
                </h3>
                <p className="text-xs text-[#7A6458] max-w-xs mx-auto mt-1.5 mb-6 leading-relaxed">
                  Once your artisanal gelato order is delivered or completed, receipts and wanted details will be kept here for your records.
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
              <div className="space-y-3 animate-fadeIn">
                {/* History Section Header Bar with Clear History Button */}
                <div className="flex items-center justify-between px-1 pb-1">
                  <span className="text-[11px] font-bold text-[#7A6458] uppercase tracking-wider">
                    Archived Orders ({historyOrders.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleClearAllHistory}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 transition-all cursor-pointer shadow-2xs active:scale-95"
                    title="Clear all past orders from your history"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear History</span>
                  </button>
                </div>

                {historyOrders.map((order) => {
                  const isDelivered = order.status === 'delivered';
                  const isCancelled = order.status === 'cancelled';
                  const totalItemsCount = order.items.reduce((s, i) => s + i.quantity, 0);
                  const orderDateStr = new Date(order.createdAt).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });
                  const orderTimeStr = new Date(order.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={order.orderReference}
                      className="bg-white rounded-2xl border border-[#E8DFC8] hover:border-[#8C102A]/50 transition-all p-4 shadow-2xs space-y-3"
                    >
                      {/* Top Bar: Ref, Status Badge, Date & Total */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-sm text-[#8C102A]">
                              {order.orderReference}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                isDelivered
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-800 border border-rose-200'
                              }`}
                            >
                              {isDelivered ? '✓ Delivered' : '✕ Cancelled'}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#7A6458] mt-1 flex items-center gap-1.5 flex-wrap">
                            <span>{orderDateStr} at {orderTimeStr}</span>
                            <span>•</span>
                            <span className="font-medium text-[#5D4E46]">{order.branchName?.replace(' Flagship', '')}</span>
                            <span>•</span>
                            <span>{order.orderType === 'delivery' ? '🚚 Delivery' : '🏪 Pickup'}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-bold text-sm text-[#241A18] block">
                            {formatPrice(order.grandTotalLKR, currency)}
                          </span>
                          <span className="text-[10px] text-[#7A6458]">
                            {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}
                          </span>
                        </div>
                      </div>

                      {/* Middle: Clean Items Summary Line */}
                      <div className="bg-[#FAF7F2] p-2.5 rounded-xl border border-[#E8DFC8]/70 text-xs text-[#5D4E46]">
                        <span className="text-[10px] uppercase font-bold text-[#7A6458] block mb-1">
                          Ordered Flavours & Items:
                        </span>
                        <p className="truncate font-medium text-[#241A18]">
                          {order.items.map((it) => `${it.quantity}× ${it.name}${it.format ? ` (${it.format.replace(/-/g, ' ')})` : ''}`).join(', ')}
                        </p>
                      </div>

                      {/* Bottom Row: Payment & Action Buttons */}
                      <div className="flex items-center justify-between pt-1 border-t border-[#E8DFC8]/50 gap-2 flex-wrap">
                        <span className="text-[11px] text-[#7A6458]">
                          Payment: <strong className="text-[#241A18]">{order.paymentMethod === 'card' ? '💳 Card' : order.paymentMethod === 'pay_at_parlour' ? '🏪 Parlour' : '💵 Cash'}</strong>
                        </span>
                        <div className="flex items-center gap-2">
                          {isCancelled && (order.inconvenienceEmailContent || order.cancellationReason) && (
                            <button
                              type="button"
                              onClick={() => setViewingApologyOrder(order)}
                              className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              title="View Apology & Refund Letter"
                            >
                              <Mail className="w-3 h-3 text-amber-700" />
                              <span>Apology Note</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteHistoryOrder(order.orderReference, e)}
                            className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                            title={`Delete order #${order.orderReference} from history`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedHistoryOrder(order)}
                            className="px-3.5 py-1.5 rounded-xl bg-[#FAF7F2] hover:bg-[#8C102A] text-[#8C102A] hover:text-white border border-[#E8DFC8] hover:border-[#8C102A] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                          >
                            <span>View Details 🔍</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
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

      {/* ======================================================== */}
      {/* USER-FRIENDLY HISTORY ORDER DETAILS POPUP (WANTED DETAILS ONLY) */}
      {/* ======================================================== */}
      {selectedHistoryOrder && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs animate-fadeIn"
          onClick={() => setSelectedHistoryOrder(null)}
        >
          <div
            className="bg-white rounded-3xl border border-[#E8DFC8] shadow-2xl w-full max-w-md overflow-hidden animate-scaleUp text-[#3D2C24]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. Header: Ref, Status & Close */}
            <div className="px-5 py-4 bg-[#FAF7F2] border-b border-[#E8DFC8] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-base text-[#8C102A]">
                    {selectedHistoryOrder.orderReference}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                      selectedHistoryOrder.status === 'delivered'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {selectedHistoryOrder.status === 'delivered' ? '✓ Delivered' : '✕ Cancelled'}
                  </span>
                </div>
                <span className="text-[11px] text-[#7A6458] block mt-0.5">
                  {new Date(selectedHistoryOrder.createdAt).toLocaleDateString([], {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}{' '}
                  at{' '}
                  {new Date(selectedHistoryOrder.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSelectedHistoryOrder(null)}
                className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 text-[#5D4E46] border border-[#E8DFC8] flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Close details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 2. Body: Wanted Details Only */}
            <div className="p-5 space-y-3.5 max-h-[65vh] overflow-y-auto">
              {/* Quick Details Box: 2-column clean card */}
              <div className="grid grid-cols-2 gap-2.5 p-3 bg-[#FAF7F2] rounded-2xl border border-[#E8DFC8] text-xs">
                <div>
                  <span className="text-[10px] text-[#7A6458] font-bold uppercase tracking-wider block">Branch</span>
                  <span className="font-bold text-[#241A18] block mt-0.5 truncate">
                    {selectedHistoryOrder.branchName?.replace(' Flagship', '')}
                  </span>
                  <span className="text-[11px] text-[#5D4E46] flex items-center gap-1 mt-0.5">
                    {selectedHistoryOrder.orderType === 'delivery' ? '🚚 Delivery' : '🏪 Parlour Pickup'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-[#7A6458] font-bold uppercase tracking-wider block">Customer</span>
                  <span className="font-bold text-[#241A18] block mt-0.5 truncate">
                    {selectedHistoryOrder.customerName}
                  </span>
                  <span className="text-[11px] text-[#5D4E46] block mt-0.5 font-mono">
                    {selectedHistoryOrder.contactNumber}
                  </span>
                </div>

                {selectedHistoryOrder.orderType === 'delivery' && selectedHistoryOrder.deliveryAddress && (
                  <div className="col-span-2 pt-2 border-t border-[#E8DFC8]/60">
                    <span className="text-[10px] text-[#7A6458] font-bold uppercase tracking-wider block">Delivery Address</span>
                    <span className="text-[#3D2C24] font-medium block mt-0.5 text-xs">
                      {selectedHistoryOrder.deliveryAddress}{selectedHistoryOrder.city ? `, ${selectedHistoryOrder.city}` : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Short Item List */}
              <div>
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#7A6458] mb-1.5 px-1">
                  <span>Ordered Items ({selectedHistoryOrder.items.length})</span>
                  <span>Price</span>
                </div>
                <div className="divide-y divide-[#E8DFC8]/60 bg-white rounded-2xl border border-[#E8DFC8] overflow-hidden">
                  {selectedHistoryOrder.items.map((item, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between gap-2 hover:bg-[#FAF7F2]/40">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-[#8C102A]/10 text-[#8C102A] font-black text-[11px] flex items-center justify-center shrink-0">
                          {item.quantity}×
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold text-[#241A18] block truncate text-xs">
                            {item.name}
                          </span>
                          {item.format && (
                            <span className="text-[10px] text-[#7A6458] block capitalize">
                              {item.format.replace(/-/g, ' ')}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-bold text-[#8C102A] text-xs shrink-0">
                        {formatPrice(item.priceLKR * item.quantity, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals & Payment Method */}
              <div className="p-3 bg-[#FAF7F2] rounded-2xl border border-[#E8DFC8] space-y-1.5 text-xs">
                <div className="flex justify-between text-[#7A6458]">
                  <span>Items Subtotal</span>
                  <span className="font-medium text-[#241A18]">{formatPrice(selectedHistoryOrder.subtotalLKR, currency)}</span>
                </div>
                <div className="flex justify-between text-[#7A6458]">
                  <span>Delivery Fee</span>
                  <span className="font-medium text-[#241A18]">
                    {selectedHistoryOrder.orderType === 'pickup'
                      ? 'Free (Parlour Pickup)'
                      : formatPrice(selectedHistoryOrder.deliveryFeeLKR, currency)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm font-black text-[#241A18] pt-2 border-t border-[#E8DFC8]">
                  <span>Total Paid</span>
                  <span className="text-[#8C102A] text-base">
                    {formatPrice(selectedHistoryOrder.grandTotalLKR, currency)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 text-[11px] text-[#7A6458]">
                  <span>Payment Method</span>
                  <span className="font-bold text-[#241A18]">
                    {selectedHistoryOrder.paymentMethod === 'card'
                      ? '💳 Card Payment'
                      : selectedHistoryOrder.paymentMethod === 'pay_at_parlour'
                      ? '🏪 Paid at Parlour'
                      : '💵 Cash on Delivery'}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Footer: Simple, clean Close & Delete Order */}
            <div className="p-4 bg-[#FAF7F2] border-t border-[#E8DFC8] flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDeleteHistoryOrder(selectedHistoryOrder.orderReference)}
                className="py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0"
                title="Delete this order record from history"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Order</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedHistoryOrder(null)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#8C102A] hover:bg-[#A31634] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer text-center"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
