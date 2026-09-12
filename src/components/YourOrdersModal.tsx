import React, { useState, useEffect } from 'react';
import { OrderRecord, Currency } from '../types';
import {
  getUserOrdersList,
  cancelOrder,
  updateOrderDelivery,
  ORDERS_UPDATED_EVENT,
  generateInconvenienceEmail,
} from '../utils/orderStorage';
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
  FileText,
  Mail,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { type User } from '../firebase';

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
  const [activeTab, setActiveTab] = useState<'ongoing' | 'history'>('ongoing');
  const [now, setNow] = useState<number>(Date.now());
  const [expandedOrderRef, setExpandedOrderRef] = useState<string | null>(highlightOrderRef || null);

  // Cancellation toast notification
  const [cancelNotification, setCancelNotification] = useState<string | null>(null);

  // Editing state
  const [editingRef, setEditingRef] = useState<string | null>(null);
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNote, setEditNote] = useState('');

  // Cancel confirmation state
  const [confirmCancelRef, setConfirmCancelRef] = useState<string | null>(null);

  // Apology letter view state
  const [viewingApologyOrder, setViewingApologyOrder] = useState<OrderRecord | null>(null);
  const [copiedApology, setCopiedApology] = useState(false);

  // Load orders
  const refreshOrders = () => {
    const list = getUserOrdersList(currentUser?.uid);
    setOrders(list);

    // If highlightOrderRef is supplied, auto select the matching tab & expand
    if (highlightOrderRef) {
      const target = list.find((o) => o.orderReference === highlightOrderRef);
      if (target) {
        if (target.status === 'cancelled' || target.status === 'delivered') {
          setActiveTab('history');
        } else {
          setActiveTab('ongoing');
        }
        setExpandedOrderRef(highlightOrderRef);
      }
    } else if (list.length > 0 && !expandedOrderRef) {
      setExpandedOrderRef(list[0].orderReference);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshOrders();
    }
  }, [isOpen, currentUser, highlightOrderRef]);

  // Live real-time sync with Admin changes or multi-tab changes
  useEffect(() => {
    if (!isOpen) return;

    const handleSync = () => {
      refreshOrders();
    };

    window.addEventListener(ORDERS_UPDATED_EVENT, handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener(ORDERS_UPDATED_EVENT, handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [isOpen, currentUser]);

  // Update live clock every second for grace period countdowns
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

  // Split orders
  const ongoingOrders = orders.filter((o) => o.status !== 'cancelled' && o.status !== 'delivered');
  const historyOrders = orders.filter((o) => o.status === 'cancelled' || o.status === 'delivered');
  const displayedOrders = activeTab === 'ongoing' ? ongoingOrders : historyOrders;

  // Calculate remaining seconds in 2-minute (120s) grace period
  const getRemainingSeconds = (createdAt: string): number => {
    const createdTime = new Date(createdAt).getTime();
    const elapsedSeconds = Math.floor((now - createdTime) / 1000);
    const remaining = 120 - elapsedSeconds;
    return Math.max(0, remaining);
  };

  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start editing
  const handleStartEdit = (order: OrderRecord) => {
    setEditingRef(order.orderReference);
    setEditAddress(order.deliveryAddress || '');
    setEditCity(order.city || '');
    setEditPhone(order.contactNumber || '');
    setEditNote(order.specialNote || '');
  };

  // Save edited delivery details
  const handleSaveEdit = (orderRef: string) => {
    if (!editAddress.trim()) {
      alert('Please enter your delivery street address.');
      return;
    }
    updateOrderDelivery(orderRef, {
      deliveryAddress: editAddress.trim(),
      city: editCity.trim(),
      contactNumber: editPhone.trim(),
      specialNote: editNote.trim(),
    });
    setEditingRef(null);
    refreshOrders();
  };

  // Cancel order by customer -> Automatically clears from ongoing orders
  const handleConfirmCancel = (orderRef: string) => {
    cancelOrder(orderRef, 'customer', 'Cancelled by customer during grace period');
    setConfirmCancelRef(null);
    setCancelNotification(
      `Order ${orderRef} was cancelled successfully. It has been cleared from active orders. Any pre-authorized card payment has been released.`
    );
    refreshOrders();
  };

  const handleCopyApologyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedApology(true);
    setTimeout(() => setCopiedApology(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs overflow-y-auto animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="your-orders-title"
    >
      <div
        className="relative w-full max-w-xl bg-white rounded-3xl overflow-hidden shadow-2xl border border-[#E8DFC8] my-auto max-h-[92vh] flex flex-col transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#FAF7F2] px-5 py-4 border-b border-[#E8DFC8] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#8C102A] text-white flex items-center justify-center shadow-xs">
              <ShoppingBag className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h2 id="your-orders-title" className="font-serif-title text-xl font-bold text-[#241A18] leading-tight">
                Your Orders
              </h2>
              <p className="text-xs text-[#7A6458]">
                {ongoingOrders.length} active • {historyOrders.length} past / completed
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 text-[#241A18] flex items-center justify-center shadow-xs border border-[#E0D5C3] cursor-pointer"
            aria-label="Close orders"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation: Active Ongoing Orders vs Past & Cancelled */}
        <div className="px-5 pt-3 pb-2 bg-[#FAF7F2] border-b border-[#E8DFC8]/70 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('ongoing')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'ongoing'
                ? 'bg-[#8C102A] text-white shadow-xs'
                : 'bg-white text-[#5D4E46] border border-[#E8DFC8] hover:bg-gray-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Active Ongoing Orders</span>
            {ongoingOrders.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  activeTab === 'ongoing'
                    ? 'bg-white text-[#8C102A]'
                    : 'bg-[#8C102A] text-white'
                }`}
              >
                {ongoingOrders.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-[#8C102A] text-white shadow-xs'
                : 'bg-white text-[#5D4E46] border border-[#E8DFC8] hover:bg-gray-50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>History & Cancelled</span>
            {historyOrders.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-gray-200 text-gray-700">
                {historyOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* Cancellation Notice Banner */}
        {cancelNotification && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 flex items-center justify-between text-xs text-red-900 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
              <span>{cancelNotification}</span>
            </div>
            <button
              type="button"
              onClick={() => setCancelNotification(null)}
              className="text-red-700 hover:text-red-900 font-bold ml-2 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Orders List Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {displayedOrders.length === 0 ? (
            /* Empty State */
            <div className="text-center py-12 px-4">
              <div className="w-16 h-16 rounded-full bg-[#FAF5EE] border border-[#E8DFC8] flex items-center justify-center mx-auto mb-4 text-[#8C102A]">
                <ShoppingBag className="w-8 h-8 text-[#8C102A]/80" />
              </div>
              <h3 className="font-serif-title text-lg font-bold text-[#241A18]">
                {activeTab === 'ongoing' ? 'No active ongoing orders' : 'No past or cancelled orders'}
              </h3>
              <p className="text-xs text-[#7A6458] max-w-xs mx-auto mt-1 mb-6">
                {activeTab === 'ongoing'
                  ? 'All cancelled or completed orders are automatically archived into your History tab.'
                  : 'Your past fulfilled and cancelled orders will show here for your records.'}
              </p>

              {activeTab === 'ongoing' && historyOrders.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="px-4 py-2 mr-2 rounded-full bg-white border border-[#E0D5C3] text-xs font-bold text-[#5D4E46] hover:bg-gray-50 shadow-xs cursor-pointer"
                >
                  View Order History ({historyOrders.length})
                </button>
              )}

              {onBrowseMenu && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onBrowseMenu();
                  }}
                  className="px-5 py-2.5 rounded-full bg-[#8C102A] hover:bg-[#A31634] text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  Explore 20 Flavours
                </button>
              )}
            </div>
          ) : (
            displayedOrders.map((order) => {
              const remainingSeconds = getRemainingSeconds(order.createdAt);
              const inGracePeriod = remainingSeconds > 0 && order.status !== 'cancelled' && order.status === 'pending_confirmation';
              const isCancelled = order.status === 'cancelled';
              const isConfirmed = order.status === 'confirmed';
              const isPreparing = order.status === 'preparing';
              const isDelivered = order.status === 'delivered';
              const isPendingConfirmation = order.status === 'pending_confirmation';
              const isEditing = editingRef === order.orderReference;
              const isExpanded = expandedOrderRef === order.orderReference;
              const branch = AMORE_BRANCHES.find((b) => b.id === order.branchId) || AMORE_BRANCHES[0];

              return (
                <div
                  key={order.orderReference}
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                    highlightOrderRef === order.orderReference
                      ? 'border-[#8C102A] ring-2 ring-[#8C102A]/15 shadow-md'
                      : isCancelled
                      ? 'border-gray-200 bg-gray-50/70 opacity-80'
                      : 'border-[#E0D5C3] bg-white shadow-xs hover:border-[#8C102A]/50'
                  }`}
                >
                  {/* Order Summary Top Bar */}
                  <div
                    onClick={() => setExpandedOrderRef(isExpanded ? null : order.orderReference)}
                    className="p-4 bg-[#FAF7F2]/60 hover:bg-[#FAF7F2] cursor-pointer flex items-center justify-between gap-3 border-b border-[#E8DFC8]/60 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-xs sm:text-sm text-[#8C102A]">
                            {order.orderReference}
                          </span>

                          {/* Dynamic Status Badges */}
                          {isCancelled ? (
                            order.cancelledBy === 'admin' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                                <AlertTriangle className="w-2.5 h-2.5 text-red-600" />
                                Cancelled by Parlour
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 text-gray-700">
                                <Ban className="w-2.5 h-2.5" />
                                Cancelled by Customer
                              </span>
                            )
                          ) : isPendingConfirmation ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <Clock className="w-2.5 h-2.5 text-amber-700 animate-spin" />
                              Order Placed (Awaiting Confirmation)
                            </span>
                          ) : isConfirmed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
                              <CheckCircle2 className="w-2.5 h-2.5 text-blue-600" />
                              Confirmed & Payment Captured
                            </span>
                          ) : isPreparing ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
                              <Sparkles className="w-2.5 h-2.5 text-purple-600" />
                              In Kitchen (Preparing)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                              Delivered / Completed
                            </span>
                          )}

                          {inGracePeriod && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-900 border border-orange-300 animate-pulse">
                              <Clock className="w-2.5 h-2.5 text-orange-700" />
                              Grace Period ({formatCountdown(remainingSeconds)})
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] text-[#7A6458] mt-0.5">
                          {new Date(order.createdAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          at{' '}
                          {new Date(order.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          • {order.branchName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-bold text-sm text-[#241A18]">
                        {formatPrice(order.grandTotalLKR, currency)}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Grace Period Alert & Action Banner */}
                  {inGracePeriod && (
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 p-3 sm:px-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                            <Clock className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-amber-950">
                              {formatCountdown(remainingSeconds)} remaining to edit address or cancel
                            </p>
                            <p className="text-[11px] text-amber-800">
                              Cancelling now immediately releases your order and any card authorization.
                            </p>
                          </div>
                        </div>

                        {/* Grace Period Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          {order.orderType === 'delivery' && !isEditing && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(order);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 text-xs font-bold hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit Address</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmCancelRef(order.orderReference);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Ban className="w-3 h-3" />
                            <span>Cancel Order</span>
                          </button>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-1.5 bg-amber-200 rounded-full overflow-hidden mt-2.5">
                        <div
                          className="h-full bg-amber-500 transition-all duration-1000 ease-linear rounded-full"
                          style={{ width: `${(remainingSeconds / 120) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Pending Confirmation Parlour Message */}
                  {!inGracePeriod && isPendingConfirmation && (
                    <div className="bg-amber-50/90 border-b border-amber-200 p-2.5 px-4 flex items-center justify-between text-xs text-amber-950">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="text-[11px]">
                          <strong>Awaiting Parlour Confirmation:</strong> Our manager at {order.branchName} is verifying kitchen inventory. Payment will only process after confirmation.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Confirmed / Preparing Message */}
                  {(isConfirmed || isPreparing) && (
                    <div className="bg-emerald-50/90 border-b border-emerald-200 p-2.5 px-4 flex items-center justify-between text-xs text-emerald-950">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="text-[11px]">
                          <strong>{isPreparing ? 'Kitchen Preparing:' : 'Order Confirmed:'}</strong> Payment captured. Our artisans at {order.branchName} are packing your fresh scoops!
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
                        <MessageCircle className="w-3 h-3" />
                        <span>WhatsApp Branch</span>
                      </a>
                    </div>
                  )}

                  {/* Parlour Inconvenience Box (Admin Cancelled) */}
                  {isCancelled && order.cancelledBy === 'admin' && (
                    <div className="bg-red-50 border-b border-red-200 p-3 sm:px-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-start gap-2.5">
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-bold text-red-950">
                              Parlour Cancellation & Sincere Apology
                            </p>
                            <p className="text-[11px] text-red-800 mt-0.5">
                              <strong>Reason:</strong>{' '}
                              {order.cancellationReason || 'Parlour kitchen capacity constraint'}
                            </p>
                            <p className="text-[10px] text-red-700 mt-0.5">
                              Payment status: Pre-authorization cancelled ($0 charged).
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingApologyOrder(order);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white border border-red-300 hover:bg-red-50 text-red-800 text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer self-start sm:self-auto"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#8C102A]" />
                          <span>View Apology Letter</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Customer Cancelled Notice */}
                  {isCancelled && order.cancelledBy !== 'admin' && (
                    <div className="bg-gray-100 border-b border-gray-200 p-2.5 px-4 flex items-center gap-2 text-xs text-gray-700">
                      <Ban className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                      <span>
                        You cancelled this order on{' '}
                        {order.cancelledAt
                          ? new Date(order.cancelledAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'request'}
                        . No payment was charged.
                      </span>
                    </div>
                  )}

                  {/* Inline Address Edit Form */}
                  {isEditing && (
                    <div className="p-4 bg-amber-50/60 border-b border-amber-200 space-y-3 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-950 flex items-center gap-1">
                          <Edit3 className="w-3.5 h-3.5 text-[#8C102A]" />
                          Update Delivery Details
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingRef(null)}
                          className="text-xs text-slate-500 hover:text-slate-800 font-bold"
                        >
                          Cancel
                        </button>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">
                            Street Address
                          </label>
                          <input
                            type="text"
                            value={editAddress}
                            onChange={(e) => setEditAddress(e.target.value)}
                            placeholder="Street Address, House/Apartment No."
                            className="w-full px-3 py-2 text-xs bg-white border border-amber-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#8C102A]"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">
                              City / Area
                            </label>
                            <input
                              type="text"
                              value={editCity}
                              onChange={(e) => setEditCity(e.target.value)}
                              placeholder="City"
                              className="w-full px-3 py-2 text-xs bg-white border border-amber-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#8C102A]"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">
                              Contact Phone
                            </label>
                            <input
                              type="tel"
                              value={editPhone}
                              onChange={(e) => setEditPhone(e.target.value)}
                              placeholder="Phone"
                              className="w-full px-3 py-2 text-xs bg-white border border-amber-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#8C102A]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">
                            Special Note
                          </label>
                          <input
                            type="text"
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            placeholder="Optional notes for courier"
                            className="w-full px-3 py-2 text-xs bg-white border border-amber-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#8C102A]"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingRef(null)}
                          className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          Discard
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(order.orderReference)}
                          className="px-4 py-1.5 rounded-lg bg-[#8C102A] hover:bg-[#A31634] text-white text-xs font-bold shadow-xs cursor-pointer"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Cancel Confirmation Dialog */}
                  {confirmCancelRef === order.orderReference && (
                    <div className="p-4 bg-red-50 border-b border-red-200 animate-fadeIn">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs font-bold text-red-950">
                            Cancel Order {order.orderReference}?
                          </p>
                          <p className="text-[11px] text-red-800 mt-0.5">
                            Are you sure? This will instantly cancel your order, clear it from active ongoing orders, and release any card authorization.
                          </p>
                          <div className="flex items-center gap-2 mt-3">
                            <button
                              type="button"
                              onClick={() => setConfirmCancelRef(null)}
                              className="px-3 py-1.5 rounded-lg bg-white border border-red-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                            >
                              Keep Order
                            </button>
                            <button
                              type="button"
                              onClick={() => handleConfirmCancel(order.orderReference)}
                              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                            >
                              Yes, Cancel Order
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Expandable Order Details View */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 space-y-4 animate-fadeIn">
                      {/* Items Ordered List */}
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#7A6458] mb-2.5 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-[#8C102A]" />
                          <span>Ordered Products ({order.items.length})</span>
                        </h4>

                        <div className="space-y-2 divide-y divide-gray-100">
                          {order.items.map((it, idx) => (
                            <div key={idx} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2.5 min-w-0">
                                {it.image ? (
                                  <img
                                    src={it.image}
                                    alt={it.name}
                                    className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-xs shrink-0">
                                    🍨
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="font-bold text-[#241A18] truncate">
                                    {it.name}
                                  </p>
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                    <span>Qty: {it.quantity}</span>
                                    {it.format && (
                                      <>
                                        <span>•</span>
                                        <span className="inline-flex items-center gap-0.5 text-[#8C102A] font-semibold">
                                          {it.format.includes('biscuit') && <Cookie className="w-2.5 h-2.5" />}
                                          {it.format}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <span className="font-bold text-[#241A18] shrink-0">
                                {formatPrice(it.priceLKR * it.quantity, currency)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Delivery / Pickup Summary */}
                      <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E8DFC8] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6458] block mb-0.5">
                            {order.orderType === 'delivery' ? 'Delivery Address' : 'Pickup Branch'}
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
                            <p className="text-[10px] text-slate-500 mt-1 italic">
                              Note: {order.specialNote}
                            </p>
                          )}
                        </div>

                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6458] block mb-0.5">
                            Contact & Payment Processing
                          </span>
                          <p className="font-medium text-[#241A18] flex items-center gap-1">
                            <Phone className="w-3 h-3 text-[#8C102A]" />
                            <span>{order.contactNumber}</span>
                          </p>
                          <div className="mt-1 text-[11px] font-medium text-slate-700">
                            {order.paymentMethod === 'card' ? (
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5 text-blue-700 font-semibold">
                                  <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Card {order.cardBrand ? `(${order.cardBrand})` : ''}</span>
                                </div>
                                <span className="text-[10px] text-slate-500">
                                  {isPendingConfirmation
                                    ? 'Pre-authorized • Captured upon parlour confirmation'
                                    : isCancelled
                                    ? 'Pre-authorization released • $0 charged'
                                    : 'Payment safely processed & captured'}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                                <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Cash on Delivery (LKR)</span>
                              </div>
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
        <div className="bg-[#FAF7F2] px-5 py-3 border-t border-[#E8DFC8] flex items-center justify-between text-xs text-[#7A6458]">
          <span>Need help? Akurana • Colombo • Arugam Bay</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#8C102A] hover:bg-[#A31634] text-white font-bold text-xs shadow-xs cursor-pointer transition-all"
          >
            Close
          </button>
        </div>
      </div>

      {/* Parlour Inconvenience / Apology Letter Modal */}
      {viewingApologyOrder && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-fadeIn"
          onClick={() => setViewingApologyOrder(null)}
        >
          <div
            className="relative w-full max-w-lg bg-[#FAF7F2] rounded-3xl overflow-hidden shadow-2xl border border-[#D9CBB7] p-6 space-y-4 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E8DFC8] pb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#8C102A]" />
                <h3 className="font-serif-title font-bold text-base text-[#241A18]">
                  Official Amore Apology Notice
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingApologyOrder(null)}
                className="w-7 h-7 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center border border-gray-300 text-gray-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E8DFC8] shadow-2xs font-mono text-xs text-slate-800 whitespace-pre-wrap max-h-[50vh] overflow-y-auto leading-relaxed">
              {viewingApologyOrder.inconvenienceEmailContent ||
                generateInconvenienceEmail(
                  viewingApologyOrder,
                  viewingApologyOrder.cancellationReason || 'Parlour kitchen capacity constraint'
                ).body}
            </div>

            {/* Voucher Code Box */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 p-3 rounded-xl flex items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase text-amber-900 block">
                  Complimentary 15% Courtesy Discount
                </span>
                <span className="font-mono font-black text-sm text-[#8C102A]">
                  AMOREAPOLOGY15
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText('AMOREAPOLOGY15');
                  alert('Voucher code AMOREAPOLOGY15 copied to clipboard!');
                }}
                className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 text-xs font-bold hover:bg-amber-100 cursor-pointer shadow-2xs"
              >
                Copy Code
              </button>
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
                className="px-4 py-2 rounded-xl bg-white border border-[#D9CBB7] hover:bg-gray-50 text-xs font-bold text-[#3D2C24] flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                {copiedApology ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-600" />
                    <span>Copy Letter</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setViewingApologyOrder(null)}
                className="px-5 py-2 rounded-xl bg-[#8C102A] hover:bg-[#A31634] text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Close Notice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
