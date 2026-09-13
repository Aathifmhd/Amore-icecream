import React, { useState, useEffect, useMemo } from 'react';
import { AmoreLogo } from '../AmoreLogo';
import { clearAdminSession } from '../../utils/adminAuth';
import {
  getAllOrdersAdmin,
  deleteOrder,
  updateOrderStatus,
  createAdminOrder,
  updateOrder,
  adminConfirmOrder,
  adminSetPreparing,
  adminSetOnTheWay,
  adminSetDelivered,
  adminCancelOrderWithReason,
  generateInconvenienceEmail,
  completeOrderRefund,
  ORDERS_UPDATED_EVENT,
  syncOrdersFromFirestore,
  mergeOrdersIntoStorage,
} from '../../utils/orderStorage';
import { subscribeToAllOrders } from '../../firebase';
import {
  getAllGelatoFlavours,
  getAllCoffeeItems,
  getAllCakeItems,
  createScoopItem,
  updateScoopItem,
  deleteScoopItem,
  createCoffeeItem,
  updateCoffeeItem,
  deleteCoffeeItem,
  createCakeItem,
  updateCakeItem,
  deleteCakeItem,
  toggleItemStockStatus,
  resetMenuToDefaults,
  MENU_UPDATED_EVENT,
  syncMenuFromFirestore,
  subscribeToRealtimeMenu,
} from '../../utils/menuStorage';
import { AMORE_BRANCHES } from '../../data/iceCreamData';
import {
  OrderRecord,
  ScoopItem,
  MenuItem,
  Currency,
  BranchId,
  SelectedOrderItem,
  FlavorCategory,
  BranchInfo,
} from '../../types';
import { formatPrice, convertLKRtoUSD } from '../../utils/currency';
import {
  ShoppingBag,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Filter,
  Plus,
  Trash2,
  Edit,
  Eye,
  LogOut,
  ExternalLink,
  MapPin,
  RefreshCw,
  Phone,
  DollarSign,
  Coffee,
  Cake,
  Sparkles,
  Sliders,
  Printer,
  ChevronDown,
  ChevronUp,
  X,
  Save,
  Check,
  Ban,
  Mail,
  Copy,
  FileText,
  Truck,
  Lock,
  Store,
  RotateCcw,
} from 'lucide-react';

interface AdminDashboardProps {
  onSignOut: () => void;
  onBackToStore: () => void;
  currency: Currency;
  onToggleCurrency: (c: Currency) => void;
}

type AdminTab = 'overview' | 'orders' | 'returns' | 'menu' | 'branches';
type MenuCatalogSubTab = 'scoops' | 'coffee' | 'cakes';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onSignOut,
  onBackToStore,
  currency,
  onToggleCurrency,
}) => {
  // Navigation & Active Tabs
  const [activeTab, setActiveTab] = useState<AdminTab>('orders');
  const [menuSubTab, setMenuSubTab] = useState<MenuCatalogSubTab>('scoops');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');

  // Orders State
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<OrderRecord | null>(null);
  const [selectedOrderForReturnInvoice, setSelectedOrderForReturnInvoice] = useState<OrderRecord | null>(null);
  const [returnSearchQuery, setReturnSearchQuery] = useState('');
  const [returnStatusFilter, setReturnStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<OrderRecord | null>(null);
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState(false);
  const [expandedOrderItems, setExpandedOrderItems] = useState<Record<string, boolean>>({});

  const toggleOrderItemsExpanded = (orderRef: string) => {
    setExpandedOrderItems((prev) => ({
      ...prev,
      [orderRef]: !prev[orderRef],
    }));
  };

  // Confirm Order Modal State
  const [confirmingOrder, setConfirmingOrder] = useState<OrderRecord | null>(null);

  // Admin Cancel Order Modal State
  const [cancellingOrder, setCancellingOrder] = useState<OrderRecord | null>(null);
  const [cancelReasonPreset, setCancelReasonPreset] = useState<string>(
    'Out of Stock: Selected artisanal flavours or biscuit cups are sold out'
  );
  const [customCancelReason, setCustomCancelReason] = useState<string>('');

  // Viewing Inconvenience / Apology Email
  const [viewingInconvenienceOrder, setViewingInconvenienceOrder] = useState<OrderRecord | null>(null);
  const [copiedAdminEmail, setCopiedAdminEmail] = useState(false);

  // Menu State
  const [scoops, setScoops] = useState<ScoopItem[]>([]);
  const [coffeeItems, setCoffeeItems] = useState<MenuItem[]>([]);
  const [cakeItems, setCakeItems] = useState<MenuItem[]>([]);
  const [menuSearchQuery, setMenuSearchQuery] = useState('');
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState<{
    type: 'scoop' | 'coffee' | 'cake';
    item: ScoopItem | MenuItem;
  } | null>(null);

  // Branch Info State
  const [branches, setBranches] = useState<BranchInfo[]>(AMORE_BRANCHES);
  const [editingBranch, setEditingBranch] = useState<BranchInfo | null>(null);

  // Live Clock State for Grace Period Countdowns
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getRemainingGraceSeconds = (order: OrderRecord): number => {
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

  // Load Data
  const refreshAllData = () => {
    setOrders(getAllOrdersAdmin());
    setScoops(getAllGelatoFlavours());
    setCoffeeItems(getAllCoffeeItems());
    setCakeItems(getAllCakeItems());

    // Asynchronously sync from Cloud Firestore so orders from all devices appear
    syncOrdersFromFirestore().then((synced) => {
      if (synced && synced.length > 0) {
        setOrders(synced);
      }
    });
  };

  useEffect(() => {
    // 1. Initial render from local cache
    refreshAllData();

    // 2. Real-time Cloud Firestore subscription for all orders across all devices
    const unsubscribeFirestore = subscribeToAllOrders((cloudOrders) => {
      mergeOrdersIntoStorage(cloudOrders);
      setOrders(getAllOrdersAdmin());
    });

    // 3. Listen for local orders changes
    const handleOrdersUpdated = () => {
      setOrders(getAllOrdersAdmin());
    };
    window.addEventListener(ORDERS_UPDATED_EVENT, handleOrdersUpdated);

    // 4. Listen for external menu changes
    const handleMenuUpdated = () => {
      setScoops(getAllGelatoFlavours());
      setCoffeeItems(getAllCoffeeItems());
      setCakeItems(getAllCakeItems());
    };
    window.addEventListener(MENU_UPDATED_EVENT, handleMenuUpdated);

    // 5. Cross-tab storage sync for both orders and menu items
    const handleStorage = (e: StorageEvent) => {
      handleOrdersUpdated();
      if (!e.key || e.key.startsWith('amore_menu_')) {
        handleMenuUpdated();
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleMenuUpdated);

    // 6. Real-time Firestore Menu Sync
    syncMenuFromFirestore().then(handleMenuUpdated);
    const unsubscribeMenu = subscribeToRealtimeMenu(handleMenuUpdated);

    return () => {
      unsubscribeFirestore();
      unsubscribeMenu();
      window.removeEventListener(ORDERS_UPDATED_EVENT, handleOrdersUpdated);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(MENU_UPDATED_EVENT, handleMenuUpdated);
      window.removeEventListener('focus', handleMenuUpdated);
    };
  }, []);

  // -----------------------------------------------------------
  // OVERVIEW / KPI CALCULATIONS
  // -----------------------------------------------------------
  const metrics = useMemo(() => {
    // ONLY delivery completed (Deliver/Picked) orders are counted for Gross Sales and Total Orders
    const totalAllOrders = orders.length;
    const activeOrders = orders.filter((o) => o.status !== 'cancelled' && o.status !== 'delivered');
    const preparingOrders = orders.filter((o) => o.status === 'preparing');
    const onTheWayOrders = orders.filter((o) => o.status === 'on_the_way');
    const deliveredOrders = orders.filter((o) => o.status === 'delivered');
    const cancelledOrders = orders.filter((o) => o.status === 'cancelled');

    // Returned bills & refunds (cancelled card orders that were confirmed/captured)
    const returnedBillsList = orders.filter((o) => {
      return (
        o.status === 'cancelled' &&
        o.paymentMethod === 'card' &&
        (!!o.refundStatus || !!o.paidAt || !!o.confirmedAt || o.cancelledBy === 'admin')
      );
    });

    const completedRefundsTotalLKR = returnedBillsList
      .filter((o) => o.refundStatus === 'completed')
      .reduce((sum, o) => sum + (o.refundAmountLKR || o.grandTotalLKR || 0), 0);

    const pendingRefundsTotalLKR = returnedBillsList
      .filter((o) => o.refundStatus !== 'completed')
      .reduce((sum, o) => sum + (o.refundAmountLKR || o.grandTotalLKR || 0), 0);

    const pendingRefundCount = returnedBillsList.filter((o) => o.refundStatus !== 'completed').length;

    // GROSS SALES REVENUE RULES (Solution 2):
    // 1> Card payment: added as soon as admin confirms the order and payment is captured
    // (includes active, delivered, and cancelled card orders that were confirmed/captured)
    const capturedCardOrders = orders.filter(
      (o) => o.paymentMethod === 'card' && (o.status !== 'pending_confirmation' || !!o.paidAt || !!o.confirmedAt)
    );
    const totalCapturedCardGrossLKR = capturedCardOrders.reduce((sum, o) => sum + (o.grandTotalLKR || 0), 0);

    // 2> Parlour pickup or Cash on Delivery: added to gross sales ONLY after delivered
    const deliveredCashOrPickupOrders = orders.filter(
      (o) => (o.paymentMethod !== 'card' || o.orderType === 'pickup') && o.status === 'delivered'
    );
    const totalDeliveredCashOrPickupGrossLKR = deliveredCashOrPickupOrders.reduce((sum, o) => sum + (o.grandTotalLKR || 0), 0);

    // Total gross sales before refunds
    const totalGrossSalesBeforeRefunds = totalCapturedCardGrossLKR + totalDeliveredCashOrPickupGrossLKR;

    // 3> In middle, when card payment was captured and order cancelled:
    // When return payment is completed, deduct the refunded amount from gross sales
    const totalRevenueLKR = Math.max(0, totalGrossSalesBeforeRefunds - completedRefundsTotalLKR);

    const branchRevenue: Record<string, number> = {
      akurana: 0,
      colombo: 0,
      arugambay: 0,
    };

    capturedCardOrders.forEach((o) => {
      const b = o.branchId || 'akurana';
      branchRevenue[b] = (branchRevenue[b] || 0) + (o.grandTotalLKR || 0);
    });

    deliveredCashOrPickupOrders.forEach((o) => {
      const b = o.branchId || 'akurana';
      branchRevenue[b] = (branchRevenue[b] || 0) + (o.grandTotalLKR || 0);
    });

    returnedBillsList.filter((o) => o.refundStatus === 'completed').forEach((o) => {
      const b = o.branchId || 'akurana';
      branchRevenue[b] = Math.max(0, (branchRevenue[b] || 0) - (o.refundAmountLKR || o.grandTotalLKR || 0));
    });

    // Count of orders contributing to gross sales
    const eligibleGrossOrdersCount =
      capturedCardOrders.filter((o) => o.refundStatus !== 'completed').length +
      deliveredCashOrPickupOrders.length;

    return {
      totalAllOrders,
      totalOrders: eligibleGrossOrdersCount,
      activeOrdersCount: activeOrders.length,
      preparingCount: preparingOrders.length,
      onTheWayCount: onTheWayOrders.length,
      deliveredCount: deliveredOrders.length,
      cancelledCount: cancelledOrders.length,
      totalCapturedCardGrossLKR,
      totalDeliveredCashOrPickupGrossLKR,
      totalGrossSalesBeforeRefunds,
      completedRefundsTotalLKR,
      pendingRefundsTotalLKR,
      pendingRefundCount,
      totalRevenueLKR,
      branchRevenue,
    };
  }, [orders]);

  // -----------------------------------------------------------
  // FILTERED ORDERS
  // -----------------------------------------------------------
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Branch filter
      if (selectedBranchFilter !== 'all' && order.branchId !== selectedBranchFilter) {
        return false;
      }
      // Status filter
      if (orderStatusFilter !== 'all' && order.status !== orderStatusFilter) {
        return false;
      }
      // Search query
      if (orderSearchQuery.trim()) {
        const q = orderSearchQuery.toLowerCase();
        const matchesRef = order.orderReference.toLowerCase().includes(q);
        const matchesName = order.customerName.toLowerCase().includes(q);
        const matchesPhone = order.contactNumber.toLowerCase().includes(q);
        const matchesCity = (order.city || '').toLowerCase().includes(q);
        const matchesAddress = (order.deliveryAddress || '').toLowerCase().includes(q);
        if (!matchesRef && !matchesName && !matchesPhone && !matchesCity && !matchesAddress) {
          return false;
        }
      }
      return true;
    });
  }, [orders, selectedBranchFilter, orderStatusFilter, orderSearchQuery]);

  // -----------------------------------------------------------
  // FILTERED RETURNED BILLS (REFUNDS)
  // -----------------------------------------------------------
  const filteredReturnedBills = useMemo(() => {
    return orders.filter((order) => {
      // Must be a cancelled card order that was confirmed/captured or has refundStatus
      const isReturnedBill =
        order.status === 'cancelled' &&
        order.paymentMethod === 'card' &&
        (!!order.refundStatus || !!order.paidAt || !!order.confirmedAt || order.cancelledBy === 'admin');

      if (!isReturnedBill) return false;

      // Branch filter
      if (selectedBranchFilter !== 'all' && order.branchId !== selectedBranchFilter) {
        return false;
      }

      // Return Status filter
      if (returnStatusFilter === 'pending' && order.refundStatus === 'completed') {
        return false;
      }
      if (returnStatusFilter === 'completed' && order.refundStatus !== 'completed') {
        return false;
      }

      // Search query
      if (returnSearchQuery.trim()) {
        const q = returnSearchQuery.toLowerCase();
        const matchesRef = order.orderReference.toLowerCase().includes(q);
        const matchesName = order.customerName.toLowerCase().includes(q);
        const matchesPhone = order.contactNumber.toLowerCase().includes(q);
        if (!matchesRef && !matchesName && !matchesPhone) {
          return false;
        }
      }

      return true;
    });
  }, [orders, selectedBranchFilter, returnStatusFilter, returnSearchQuery]);

  const handleCompleteReturn = (orderRef: string) => {
    if (
      window.confirm(
        `Mark refund for order ${orderRef} as completed? This will confirm payment reversal to customer's card and deduct the amount from Gross Sales.`
      )
    ) {
      completeOrderRefund(orderRef);
      refreshAllData();
    }
  };

  // -----------------------------------------------------------
  // ORDER ACTIONS (CRUD & LIFECYCLE)
  // -----------------------------------------------------------
  const handleTriggerConfirmOrder = (order: OrderRecord) => {
    setConfirmingOrder(order);
  };

  const handleExecuteConfirmOrder = (orderRef: string) => {
    adminConfirmOrder(orderRef);
    setConfirmingOrder(null);
    refreshAllData();
  };

  const handleSendToKitchen = (orderRef: string) => {
    adminSetPreparing(orderRef);
    refreshAllData();
  };

  const handleHandoverToDelivery = (orderRef: string) => {
    adminSetOnTheWay(orderRef);
    refreshAllData();
  };

  const handleSetDelivered = (orderRef: string) => {
    adminSetDelivered(orderRef);
    refreshAllData();
  };

  const handleTriggerCancelOrder = (order: OrderRecord) => {
    setCancellingOrder(order);
    setCancelReasonPreset(
      'Out of Stock: Selected artisanal flavours or biscuit cups are sold out'
    );
    setCustomCancelReason('');
  };

  const handleExecuteCancelOrder = (order: OrderRecord) => {
    const finalReason =
      cancelReasonPreset === 'Other / Custom Reason'
        ? customCancelReason.trim() || 'Operational constraint at the parlour'
        : customCancelReason.trim()
        ? `${cancelReasonPreset} (${customCancelReason.trim()})`
        : cancelReasonPreset;

    const email = generateInconvenienceEmail(order, finalReason);
    adminCancelOrderWithReason(order.orderReference, finalReason, email.body);
    setCancellingOrder(null);
    refreshAllData();

    // If customer has email, open mailto link
    try {
      const recipient = order.emailAddress ? encodeURIComponent(order.emailAddress) : '';
      const mailto = `mailto:${recipient}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
      window.open(mailto, '_blank');
    } catch (e) {
      console.warn('Could not launch mail client:', e);
    }
  };

  const handleStatusChange = (orderRef: string, nextStatus: OrderRecord['status']) => {
    updateOrderStatus(orderRef, nextStatus);
    setOrders(getAllOrdersAdmin());
  };

  const handleDeleteOrder = (orderRef: string) => {
    const targetOrder = orders.find((o) => o.orderReference === orderRef);
    if (targetOrder && targetOrder.status !== 'pending_confirmation' && targetOrder.status !== 'cancelled') {
      alert(`CRUD Policy Restriction: Order ${orderRef} is in stage "${targetOrder.status.replace(/_/g, ' ')}" and cannot be deleted. Confirmed orders must remain in the audit record.`);
      return;
    }
    if (window.confirm(`Are you sure you want to permanently delete order ${orderRef}?`)) {
      const deleted = deleteOrder(orderRef);
      if (deleted) {
        setOrders(getAllOrdersAdmin());
      } else {
        alert(`Order ${orderRef} could not be deleted due to policy restrictions.`);
      }
    }
  };

  // -----------------------------------------------------------
  // MENU ACTIONS (CRUD)
  // -----------------------------------------------------------
  const handleToggleStock = (itemId: string, type: 'scoops' | 'coffee' | 'cakes') => {
    toggleItemStockStatus(itemId, type);
    refreshAllData();
  };

  const handleDeleteMenuItem = (itemId: string, name: string, type: 'scoop' | 'coffee' | 'cake') => {
    if (window.confirm(`Are you sure you want to remove "${name}" from the menu?`)) {
      if (type === 'scoop') deleteScoopItem(itemId);
      else if (type === 'coffee') deleteCoffeeItem(itemId);
      else deleteCakeItem(itemId);
      refreshAllData();
    }
  };

  const handleResetMenu = () => {
    if (
      window.confirm(
        'Are you sure you want to reset all menu items and prices back to original Amore defaults? This will restore the authentic 20 artisanal flavours.'
      )
    ) {
      resetMenuToDefaults();
      refreshAllData();
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F3EB] text-[#241A18] flex flex-col font-sans selection:bg-[#8C102A] selection:text-white">
      {/* Top Operations Header */}
      <header className="bg-white border-b border-[#E2D5C3] sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          {/* Brand & Admin Badge */}
          <div className="flex items-center gap-3">
            <AmoreLogo size="sm" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif-title font-bold text-lg sm:text-xl text-[#241A18] tracking-tight">
                  Amore Operations Console
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#8C102A] text-white text-[10px] font-black tracking-wider uppercase">
                  Admin
                </span>
              </div>
              <p className="text-[11px] text-[#7A6458] hidden sm:block">
                Master Database & Operations • Akurana • Colombo • Arugam Bay
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Currency Switcher */}
            <div className="flex items-center bg-[#FAF7F2] p-1 rounded-xl border border-[#E8DFC8]">
              <button
                type="button"
                onClick={() => onToggleCurrency('LKR')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currency === 'LKR' ? 'bg-[#8C102A] text-white shadow-2xs' : 'text-[#5D4E46] hover:text-[#241A18]'
                }`}
              >
                LKR
              </button>
              <button
                type="button"
                onClick={() => onToggleCurrency('USD')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currency === 'USD' ? 'bg-[#8C102A] text-white shadow-2xs' : 'text-[#5D4E46] hover:text-[#241A18]'
                }`}
              >
                USD ($)
              </button>
            </div>

            {/* Back to Storefront */}
            <button
              type="button"
              onClick={onBackToStore}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D9CBB7] hover:border-[#8C102A] text-xs font-bold text-[#5D4E46] hover:text-[#8C102A] bg-white transition-all cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Storefront</span>
            </button>

            {/* Sign Out Button */}
            <button
              type="button"
              onClick={() => {
                clearAdminSession();
                onSignOut();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition-all cursor-pointer active:scale-95"
              title="Sign Out of Admin Console"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between border-t border-[#EFE8DC] overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1 sm:gap-2 py-2">
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'orders'
                  ? 'bg-[#8C102A] text-white shadow-xs'
                  : 'text-[#5D4E46] hover:bg-[#EFE8DC] hover:text-[#241A18]'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Orders & Kitchen</span>
              {metrics.activeOrdersCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-400 text-[#8C102A] text-[10px] font-black flex items-center justify-center">
                  {metrics.activeOrdersCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('returns')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'returns'
                  ? 'bg-[#8C102A] text-white shadow-xs'
                  : 'text-[#5D4E46] hover:bg-[#EFE8DC] hover:text-[#241A18]'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>Returned Bills</span>
              {metrics.pendingRefundCount > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[10px] font-black animate-pulse">
                  {metrics.pendingRefundCount}
                </span>
              ) : (
                <span className="text-[10px] font-normal opacity-70">({metrics.cancelledCount})</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('menu')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'menu'
                  ? 'bg-[#8C102A] text-white shadow-xs'
                  : 'text-[#5D4E46] hover:bg-[#EFE8DC] hover:text-[#241A18]'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Menu & Catalog</span>
              <span className="text-[10px] font-normal opacity-80">({scoops.length + coffeeItems.length + cakeItems.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'bg-[#8C102A] text-white shadow-xs'
                  : 'text-[#5D4E46] hover:bg-[#EFE8DC] hover:text-[#241A18]'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Overview & KPIs</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('branches')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'branches'
                  ? 'bg-[#8C102A] text-white shadow-xs'
                  : 'text-[#5D4E46] hover:bg-[#EFE8DC] hover:text-[#241A18]'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>Branches</span>
            </button>
          </div>

          {/* Quick Refresh Button */}
          <button
            type="button"
            onClick={refreshAllData}
            className="p-2 rounded-xl text-[#7A6458] hover:text-[#8C102A] hover:bg-[#EFE8DC] transition-colors cursor-pointer"
            title="Refresh live data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* ======================================================== */}
        {/* TAB 1: ORDERS & KITCHEN QUEUE */}
        {/* ======================================================== */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            {/* Quick KPI Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white p-4 rounded-2xl border border-[#E8DFC8] shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold text-[#7A6458] uppercase">
                  <span>Gross Sales (Net)</span>
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="mt-2 text-xl sm:text-2xl font-black text-[#241A18]">
                  {formatPrice(metrics.totalRevenueLKR, currency)}
                </div>
                <div className="text-[11px] text-[#8A7970] mt-0.5">
                  {metrics.completedRefundsTotalLKR > 0 ? (
                    <span className="text-amber-800 font-medium">
                      Captured: {formatPrice(metrics.totalGrossSalesBeforeRefunds, currency)} - Refunds: {formatPrice(metrics.completedRefundsTotalLKR, currency)}
                    </span>
                  ) : (
                    'Captured Card + Delivered Cash/Pickup'
                  )}
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#E8DFC8] shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold text-[#7A6458] uppercase">
                  <span>In Kitchen Queue</span>
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div className="mt-2 text-xl sm:text-2xl font-black text-[#8C102A]">
                  {metrics.preparingCount} in kitchen
                </div>
                <div className="text-[11px] text-[#8A7970] mt-0.5">
                  {metrics.onTheWayCount > 0 ? `${metrics.onTheWayCount} on the way with driver` : 'Being churned & prepared'}
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#E8DFC8] shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold text-[#7A6458] uppercase">
                  <span>Dispatched / Ready</span>
                  <Truck className="w-4 h-4 text-blue-600" />
                </div>
                <div className="mt-2 text-xl sm:text-2xl font-black text-blue-700">
                  {metrics.onTheWayCount} active
                </div>
                <div className="text-[11px] text-[#8A7970] mt-0.5">
                  On the way or ready to pickup
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#E8DFC8] shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold text-[#7A6458] uppercase">
                  <span>Total Orders</span>
                  <ShoppingBag className="w-4 h-4 text-[#8C102A]" />
                </div>
                <div className="mt-2 text-xl sm:text-2xl font-black text-[#241A18]">
                  {metrics.totalOrders}
                </div>
                <div className="text-[11px] text-[#8A7970] mt-0.5">
                  Delivered / Picked ({metrics.totalAllOrders} placed)
                </div>
              </div>
            </div>

            {/* Filter, Search & Create Order Bar */}
            <div className="bg-white p-4 rounded-2xl border border-[#E8DFC8] shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-1 min-w-[280px]">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-[#7A6458] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    placeholder="Search by ref, customer name, phone, city..."
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A] bg-[#FAF7F2]/50 focus:bg-white transition-all"
                  />
                  {orderSearchQuery && (
                    <button
                      onClick={() => setOrderSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7A6458] hover:text-[#241A18]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Branch Filter */}
                <select
                  value={selectedBranchFilter}
                  onChange={(e) => setSelectedBranchFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-[#D9CBB7] bg-white text-xs font-bold text-[#241A18] focus:outline-hidden cursor-pointer"
                >
                  <option value="all">All Branches</option>
                  <option value="akurana">Akurana Flagship</option>
                  <option value="colombo">Colombo Marine Drive</option>
                  <option value="arugambay">Arugam Bay Surf</option>
                </select>

                {/* Status Filter */}
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-[#D9CBB7] bg-white text-xs font-bold text-[#241A18] focus:outline-hidden cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending_confirmation">Pending Confirmation</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="preparing">In Kitchen (Preparing)</option>
                  <option value="on_the_way">On the Way / Ready to Pickup</option>
                  <option value="delivered">Delivered / Picked</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Create Manual Walk-in / Phone Order Button */}
              <button
                type="button"
                onClick={() => setIsCreateOrderModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#8C102A] hover:bg-[#A31634] text-white text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>New Manual Order</span>
              </button>
            </div>

            {/* Orders Table */}
            <div className="bg-white rounded-2xl border border-[#E8DFC8] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#3D2C24]">
                  <thead className="bg-[#F8F4EC] border-b border-[#E8DFC8] text-[11px] font-bold text-[#7A6458] uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Order Ref</th>
                      <th className="px-4 py-3">Customer & Contact</th>
                      <th className="px-4 py-3">Branch & Type</th>
                      <th className="px-4 py-3 min-w-[260px]">Items Summary</th>
                      <th className="px-4 py-3">Total & Payment</th>
                      <th className="px-4 py-3">Stage & Status</th>
                      <th className="px-4 py-3">Lifecycle Action</th>
                      <th className="px-4 py-3 text-right">Manage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFE8DC]">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-[#8A7970]">
                          <ShoppingBag className="w-8 h-8 text-[#D9CBB7] mx-auto mb-2" />
                          <p className="font-semibold">No orders match the selected filters.</p>
                          <p className="text-[11px] text-[#A69488] mt-1">
                            New orders placed by customers or added manually will appear here in real-time.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => {
                        const isCancelled = order.status === 'cancelled';
                        const isDelivered = order.status === 'delivered';
                        const isPreparing = order.status === 'preparing';
                        const isConfirmed = order.status === 'confirmed';
                        const remainingSeconds = getRemainingGraceSeconds(order);
                        const inGracePeriod = (remainingSeconds > 0 || !!order.isGracePeriodPaused) && order.status === 'pending_confirmation';
                        const isItemsExpanded = !!expandedOrderItems[order.orderReference];
                        const hasManyItems = order.items.length > 2;
                        const displayedItems = hasManyItems && !isItemsExpanded ? order.items.slice(0, 2) : order.items;

                        return (
                          <tr
                            key={order.orderReference}
                            className={`hover:bg-[#FAF7F2] transition-colors ${
                              isCancelled ? 'opacity-60 bg-gray-50/50' : ''
                            }`}
                          >
                            {/* Order Ref & Time */}
                            <td className="px-4 py-3 align-top font-mono">
                              <span className="font-bold text-[#8C102A] text-xs block">
                                {order.orderReference}
                              </span>
                              <span className="text-[10px] text-[#7A6458]">
                                {new Date(order.createdAt).toLocaleDateString()}{' '}
                                {new Date(order.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </td>

                            {/* Customer & Contact */}
                            <td className="px-4 py-3 align-top">
                              <span className="font-bold text-[#241A18] block">
                                {order.customerName}
                              </span>
                              <div className="flex items-center gap-1.5 text-[11px] text-[#5D4E46] mt-0.5">
                                <Phone className="w-3 h-3 text-[#7A6458]" />
                                <a
                                  href={`tel:${order.contactNumber}`}
                                  className="hover:text-[#8C102A] hover:underline"
                                >
                                  {order.contactNumber}
                                </a>
                              </div>
                              {order.deliveryAddress && (
                                <span className="text-[10px] text-[#7A6458] block mt-0.5 truncate max-w-[180px]">
                                  {order.deliveryAddress}, {order.city}
                                </span>
                              )}
                              {order.deliveryCoordinates && (
                                <a
                                  href={`https://www.google.com/maps?q=${order.deliveryCoordinates.lat},${order.deliveryCoordinates.lng}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-[#8C102A] hover:underline mt-1 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 w-fit"
                                  title="View exact customer pin on Google Maps"
                                >
                                  <MapPin className="w-3 h-3 text-[#8C102A]" />
                                  <span>Pin: {order.deliveryCoordinates.lat.toFixed(3)}, {order.deliveryCoordinates.lng.toFixed(3)}</span>
                                </a>
                              )}
                            </td>

                            {/* Branch & Type */}
                            <td className="px-4 py-3 align-top">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FAF7F2] border border-[#E8DFC8] text-[11px] font-semibold text-[#3D2C24]">
                                <MapPin className="w-3 h-3 text-[#8C102A]" />
                                {order.branchName?.split(' ')[0] || 'Akurana'}
                              </span>
                              <span className="block text-[10px] uppercase tracking-wider text-[#7A6458] font-bold mt-1">
                                {order.orderType === 'delivery' ? '🚚 Delivery' : '🛍️ Self Pickup'}
                              </span>
                            </td>

                            {/* Items Summary */}
                            <td className="px-4 py-3 align-top min-w-[260px] max-w-[340px]">
                              {/* Header badge with total count */}
                              <div className="flex items-center justify-between text-[11px] font-bold text-[#7A6458] mb-1.5 pb-1 border-b border-[#EFE8DC]">
                                <span>
                                  {order.items.reduce((sum, it) => sum + it.quantity, 0)}{' '}
                                  {order.items.reduce((sum, it) => sum + it.quantity, 0) === 1 ? 'Item' : 'Items'} Total
                                </span>
                                <span className="text-[10px] text-[#8C102A] font-semibold bg-[#8C102A]/8 px-1.5 py-0.5 rounded">
                                  {order.items.length}{' '}
                                  {order.items.length === 1 ? 'flavor' : 'flavors'}
                                </span>
                              </div>

                              {/* Items list */}
                              <div className={`space-y-1.5 ${isItemsExpanded ? 'max-h-60 overflow-y-auto pr-0.5' : ''}`}>
                                {displayedItems.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between gap-1.5 bg-[#FAF7F2] py-1 px-2 rounded-lg border border-[#E8DFC8]/80 hover:border-[#D9CBB7] transition-all text-xs"
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      {/* Bold Quantity Badge */}
                                      <span className="inline-flex items-center justify-center min-w-[22px] px-1 py-0.5 rounded-md bg-[#8C102A] text-white font-black text-[10px] shadow-2xs shrink-0">
                                        {item.quantity}×
                                      </span>

                                      {/* Item Name */}
                                      <span className="font-bold text-xs sm:text-[13px] text-[#241A18] truncate" title={item.name}>
                                        {item.name}
                                      </span>

                                      {/* Format Badge */}
                                      {item.format && (
                                        <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-semibold bg-white text-[#5D4E46] border border-[#D9CBB7] capitalize shrink-0">
                                          {item.format.replace(/-/g, ' ')}
                                        </span>
                                      )}
                                    </div>

                                    {/* Subtotal */}
                                    <span className="text-[11px] font-bold text-[#8C102A] shrink-0 ml-1">
                                      {formatPrice(item.priceLKR * item.quantity, currency)}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {/* Collapsible Accordion Toggle Button for multi-item orders */}
                              {hasManyItems && (
                                <button
                                  type="button"
                                  onClick={() => toggleOrderItemsExpanded(order.orderReference)}
                                  className="w-full mt-1.5 py-1 px-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-[#8C102A] border border-amber-200 text-xs font-bold flex items-center justify-between transition-all cursor-pointer active:scale-98 shadow-2xs"
                                >
                                  <span>
                                    {isItemsExpanded
                                      ? 'Collapse items'
                                      : `+${order.items.length - 2} more ${order.items.length - 2 === 1 ? 'item' : 'items'} (${order.items.length} total)`}
                                  </span>
                                  {isItemsExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5 text-[#8C102A]" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5 text-[#8C102A]" />
                                  )}
                                </button>
                              )}
                            </td>

                            {/* Total & Payment Method */}
                            <td className="px-4 py-3 align-top">
                              <span className="font-bold text-sm text-[#241A18] block">
                                {formatPrice(order.grandTotalLKR, currency)}
                              </span>
                              <div className="flex flex-col gap-0.5 mt-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white border border-[#D9CBB7] text-[#5D4E46]">
                                  {order.orderType === 'pickup' || order.paymentMethod === 'pay_at_parlour'
                                    ? '🏪 Pay at Parlour'
                                    : order.paymentMethod === 'card'
                                    ? '💳 Card'
                                    : '💵 Cash/COD'}
                                </span>
                                {order.paymentMethod === 'card' && order.orderType !== 'pickup' && order.paymentMethod !== 'pay_at_parlour' && (
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded inline-block ${
                                      order.status === 'pending_confirmation'
                                        ? 'text-amber-800 bg-amber-50 border border-amber-200'
                                        : order.status === 'cancelled'
                                        ? 'text-gray-500 bg-gray-100'
                                        : 'text-emerald-800 bg-emerald-50 border border-emerald-200'
                                    }`}
                                  >
                                    {order.status === 'pending_confirmation'
                                      ? 'Auth (Pending Confirm)'
                                      : order.status === 'cancelled'
                                      ? 'Voided / $0'
                                      : 'Captured & Paid'}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Stage & Status Display */}
                            <td className="px-4 py-3 align-top">
                              {order.status === 'pending_confirmation' ? (
                                order.isGracePeriodPaused ? (
                                  <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                      <Clock className="w-3 h-3 text-amber-700" />
                                      Paused ({formatCountdown(remainingSeconds)})
                                    </span>
                                    <span className="text-[10px] text-amber-900/80 block font-medium">
                                      {order.orderType === 'pickup' ? 'Customer updating order' : 'Customer editing address'}
                                    </span>
                                  </div>
                                ) : inGracePeriod ? (
                                  <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-orange-100 text-orange-900 border border-orange-300 animate-pulse">
                                      <Clock className="w-3 h-3 text-orange-700" />
                                      Grace Period ({formatCountdown(remainingSeconds)})
                                    </span>
                                    <span className="text-[10px] text-amber-900/80 block font-medium">
                                      {order.orderType === 'pickup' ? 'Customer reviewing pickup' : 'Customer reviewing address'}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                      <CheckCircle2 className="w-3 h-3 text-amber-700" />
                                      Customer Waiting
                                    </span>
                                    <span className="text-[10px] text-emerald-800 block font-bold">
                                      {order.orderType === 'pickup' ? 'Pickup Confirmed' : 'Address Confirmed'}
                                    </span>
                                  </div>
                                )
                              ) : order.status === 'confirmed' ? (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
                                    {order.orderType === 'pickup' ? (
                                      <>
                                        <Store className="w-3 h-3 text-blue-700" />
                                        <span>Confirmed (Pickup)</span>
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle2 className="w-3 h-3 text-blue-700" />
                                        <span>Confirmed</span>
                                      </>
                                    )}
                                  </span>
                                  <span className="text-[10px] text-emerald-700 block font-bold">
                                    {order.orderType === 'pickup' ? '🏪 Pay at Counter' : 'Payment Captured'}
                                  </span>
                                </div>
                              ) : order.status === 'preparing' ? (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
                                    <Sparkles className="w-3 h-3 text-purple-700" />
                                    In Kitchen (Process)
                                  </span>
                                  <span className="text-[10px] text-[#7A6458] block font-medium">
                                    Scooping & Churning
                                  </span>
                                </div>
                              ) : order.status === 'on_the_way' ? (
                                <div className="space-y-0.5">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                                      order.orderType === 'pickup'
                                        ? 'bg-purple-100 text-purple-900 border-purple-300'
                                        : 'bg-sky-100 text-sky-900 border-sky-300'
                                    }`}
                                  >
                                    {order.orderType === 'pickup' ? (
                                      <Store className="w-3 h-3 text-purple-700" />
                                    ) : (
                                      <Truck className="w-3 h-3 text-sky-700" />
                                    )}
                                    {order.orderType === 'pickup' ? 'Ready to Pickup' : 'On The Way'}
                                  </span>
                                  <span
                                    className={`text-[10px] block font-medium ${
                                      order.orderType === 'pickup' ? 'text-purple-800 font-bold' : 'text-sky-800'
                                    }`}
                                  >
                                    {order.orderType === 'pickup' ? 'Waiting at Parlour Counter' : 'With Delivery Partner'}
                                  </span>
                                </div>
                              ) : order.status === 'delivered' ? (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                    {order.orderType === 'pickup' ? 'Picked Up' : 'Delivered'}
                                  </span>
                                  <span className="text-[10px] text-emerald-800 block font-medium">
                                    {order.orderType === 'pickup' ? 'Collected by Customer' : 'Fulfilled & Completed'}
                                  </span>
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  {order.cancelledBy === 'admin' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-100 text-red-900 border border-red-300">
                                      <AlertTriangle className="w-3 h-3 text-red-700" />
                                      Cancelled by Admin
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-gray-200 text-gray-800 border border-gray-300">
                                      <Ban className="w-3 h-3 text-gray-600" />
                                      Cancelled by Customer
                                    </span>
                                  )}
                                  {order.cancelledBy === 'admin' && (
                                    <button
                                      type="button"
                                      onClick={() => setViewingInconvenienceOrder(order)}
                                      className="text-[10px] text-[#8C102A] hover:underline font-bold block text-left cursor-pointer"
                                    >
                                      View Apology Email
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Lifecycle Action Buttons */}
                            <td className="px-4 py-3 align-top">
                              {order.status === 'pending_confirmation' ? (
                                order.isGracePeriodPaused ? (
                                  /* COUNTDOWN PAUSED: Customer is editing address -> DO NOT SHOW CONFIRM OR CANCEL BUTTONS */
                                  <div className="flex flex-col gap-1 min-w-[150px] p-2.5 rounded-xl bg-amber-50/90 border border-amber-300 text-left shadow-2xs">
                                    <div className="flex items-center gap-1.5 text-amber-950 font-bold text-[11px]">
                                      <Clock className="w-3.5 h-3.5 text-amber-700" />
                                      <span>Timer Paused: {formatCountdown(remainingSeconds)}</span>
                                    </div>
                                    <p className="text-[10px] text-amber-800 leading-tight">
                                      Customer is editing address. Actions unlock once saved and countdown completes.
                                    </p>
                                  </div>
                                ) : inGracePeriod ? (
                                  /* COUNTDOWN ACTIVE: DO NOT SHOW CONFIRM OR CANCEL BUTTONS */
                                  <div className="flex flex-col gap-1 min-w-[150px] p-2.5 rounded-xl bg-amber-50/90 border border-amber-300 text-left shadow-2xs">
                                    <div className="flex items-center gap-1.5 text-amber-950 font-bold text-[11px]">
                                      <Clock className="w-3.5 h-3.5 text-amber-700 animate-spin" />
                                      <span>Grace Period: {formatCountdown(remainingSeconds)}</span>
                                    </div>
                                    <p className="text-[10px] text-amber-800 leading-tight">
                                      Customer is checking address or may cancel. Actions unlock when countdown completes.
                                    </p>
                                  </div>
                                ) : (
                                  /* COUNTDOWN EXPIRED: CUSTOMER WAITING FOR ORDER -> UNLOCK ADMIN ACTIONS */
                                  <div className="flex flex-col gap-1.5 min-w-[140px]">
                                    <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-center">
                                      Ready for Parlour Action
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleTriggerConfirmOrder(order)}
                                      className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-2xs transition-colors cursor-pointer"
                                      title="Customer confirmed address. Open confirmation modal to approve order and process payment."
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Confirm Order</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleTriggerCancelOrder(order)}
                                      className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold transition-colors cursor-pointer"
                                      title="Cancel order and send apology email from zenatiqcodes@gmail.com"
                                    >
                                      <Ban className="w-3 h-3" />
                                      <span>Cancel Order</span>
                                    </button>
                                  </div>
                                )
                              ) : order.status === 'confirmed' ? (
                                <div className="flex flex-col gap-1.5 min-w-[150px]">
                                  <div className="text-[9px] font-bold uppercase tracking-wider text-[#7A6458]">Select Status:</div>
                                  <button
                                    type="button"
                                    onClick={() => handleSendToKitchen(order.orderReference)}
                                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#8C102A] hover:bg-[#A31634] text-white text-[11px] font-bold shadow-2xs transition-colors cursor-pointer"
                                    title="Transition order to Kitchen (In Process)"
                                  >
                                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                    <span>In Kitchen (Process)</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleTriggerCancelOrder(order)}
                                    className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold transition-colors cursor-pointer"
                                    title="Cancel order and initiate return/refund"
                                  >
                                    <Ban className="w-3 h-3" />
                                    <span>Cancel Order</span>
                                  </button>
                                </div>
                              ) : order.status === 'preparing' ? (
                                <div className="flex flex-col gap-1.5 min-w-[150px]">
                                  <div className="text-[9px] font-bold uppercase tracking-wider text-[#7A6458]">Select Status:</div>
                                  <button
                                    type="button"
                                    onClick={() => handleHandoverToDelivery(order.orderReference)}
                                    className={`inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-white text-[11px] font-bold shadow-2xs transition-colors cursor-pointer ${
                                      order.orderType === 'pickup'
                                        ? 'bg-purple-600 hover:bg-purple-700'
                                        : 'bg-blue-600 hover:bg-blue-700'
                                    }`}
                                    title={
                                      order.orderType === 'pickup'
                                        ? 'Mark order as Ready to Pickup'
                                        : 'Handover order to delivery partner'
                                    }
                                  >
                                    {order.orderType === 'pickup' ? (
                                      <Store className="w-3.5 h-3.5" />
                                    ) : (
                                      <Truck className="w-3.5 h-3.5" />
                                    )}
                                    <span>
                                      {order.orderType === 'pickup'
                                        ? 'Mark Ready to Pickup'
                                        : 'Handover to Delivery Partner'}
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleTriggerCancelOrder(order)}
                                    className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold transition-colors cursor-pointer"
                                    title="Cancel order and initiate return/refund"
                                  >
                                    <Ban className="w-3 h-3" />
                                    <span>Cancel Order</span>
                                  </button>
                                </div>
                              ) : order.status === 'on_the_way' ? (
                                <div className="flex flex-col gap-1.5 min-w-[150px]">
                                  <div className="text-[9px] font-bold uppercase tracking-wider text-[#7A6458]">Select Status:</div>
                                  <button
                                    type="button"
                                    onClick={() => handleSetDelivered(order.orderReference)}
                                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-2xs transition-colors cursor-pointer"
                                    title={order.orderType === 'pickup' ? 'Mark order as Picked Up / Completed' : 'Mark order as Delivered / Completed'}
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>{order.orderType === 'pickup' ? 'Mark Picked Up' : 'Mark Delivered'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleTriggerCancelOrder(order)}
                                    className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold transition-colors cursor-pointer"
                                    title="Cancel order and initiate return/refund"
                                  >
                                    <Ban className="w-3 h-3" />
                                    <span>Cancel Order</span>
                                  </button>
                                </div>
                              ) : order.status === 'delivered' ? (
                                <div className="flex flex-col gap-1 min-w-[120px]">
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    {order.orderType === 'pickup' ? 'Fulfilled & Picked Up' : 'Fulfilled & Delivered'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleSendToKitchen(order.orderReference)}
                                    className="text-[9px] text-[#8C102A] hover:underline font-bold text-left cursor-pointer"
                                  >
                                    Re-send to Kitchen
                                  </button>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600">
                                  <Ban className="w-3.5 h-3.5" />
                                  Cancelled
                                </span>
                              )}
                            </td>

                            {/* Actions Buttons */}
                            <td className="px-4 py-3 align-top text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Invoice / Printable Receipt */}
                                <button
                                  type="button"
                                  onClick={() => setSelectedOrderForInvoice(order)}
                                  className="p-1.5 rounded-lg text-[#5D4E46] hover:text-[#8C102A] hover:bg-[#EFE8DC] transition-colors cursor-pointer"
                                  title="View & Print Order Invoice"
                                >
                                  <Printer className="w-4 h-4" />
                                </button>

                                {/* Edit Order */}
                                <button
                                  type="button"
                                  onClick={() => setSelectedOrderForEdit(order)}
                                  className="p-1.5 rounded-lg text-[#5D4E46] hover:text-[#8C102A] hover:bg-[#EFE8DC] transition-colors cursor-pointer"
                                  title="Edit Order Details"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>

                                {/* Delete Order (CRUD Policy Protected) */}
                                {order.status === 'pending_confirmation' || order.status === 'cancelled' ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteOrder(order.orderReference)}
                                    className="p-1.5 rounded-lg text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors cursor-pointer"
                                    title="Delete Order Record (Allowed for unconfirmed or cancelled)"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <span
                                    className="p-1.5 rounded-lg text-[#A69488]/60 inline-flex items-center justify-center cursor-not-allowed bg-gray-50 border border-gray-200/60"
                                    title="CRUD Policy Restriction: Confirmed or in-progress orders cannot be deleted from the system"
                                  >
                                    <Lock className="w-3.5 h-3.5 text-[#A69488]" />
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB: RETURNED BILLS & REFUNDS */}
        {/* ======================================================== */}
        {activeTab === 'returns' && (
          <div className="space-y-6">
            {/* KPI Stat Cards for Returns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-white p-4 rounded-2xl border border-[#E8DFC8] shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold text-[#7A6458] uppercase">
                  <span>Total Returned Bills</span>
                  <RotateCcw className="w-4 h-4 text-[#8C102A]" />
                </div>
                <div className="mt-2 text-xl sm:text-2xl font-black text-[#241A18]">
                  {orders.filter((o) => o.status === 'cancelled' && o.paymentMethod === 'card').length}
                </div>
                <div className="text-[11px] text-[#8A7970] mt-0.5">
                  Card transactions cancelled after authorization
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/40 shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold text-amber-800 uppercase">
                  <span>Pending Refund Reversal</span>
                  <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                </div>
                <div className="mt-2 text-xl sm:text-2xl font-black text-amber-900">
                  {formatPrice(metrics.pendingRefundsTotalLKR, currency)}
                </div>
                <div className="text-[11px] text-amber-800 font-semibold mt-0.5 flex items-center gap-1">
                  <span>⚠️</span>
                  <span>{metrics.pendingRefundCount} {metrics.pendingRefundCount === 1 ? 'bill requires' : 'bills require'} refund completion</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-800 uppercase">
                  <span>Completed Refunds</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="mt-2 text-xl sm:text-2xl font-black text-emerald-950">
                  {formatPrice(metrics.completedRefundsTotalLKR, currency)}
                </div>
                <div className="text-[11px] text-emerald-800 font-medium mt-0.5">
                  Deducted directly from Gross Sales in Kitchen
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-[#E8DFC8] shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-1 min-w-[280px]">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-[#7A6458] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={returnSearchQuery}
                    onChange={(e) => setReturnSearchQuery(e.target.value)}
                    placeholder="Search returned bill by ref, customer, phone..."
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A] bg-[#FAF7F2]/50 focus:bg-white transition-all"
                  />
                  {returnSearchQuery && (
                    <button
                      onClick={() => setReturnSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7A6458] hover:text-[#241A18] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Return Status Filter */}
                <div className="flex items-center gap-1 bg-[#FAF7F2] p-1 rounded-xl border border-[#E8DFC8]">
                  <button
                    type="button"
                    onClick={() => setReturnStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      returnStatusFilter === 'all'
                        ? 'bg-[#8C102A] text-white shadow-2xs'
                        : 'text-[#5D4E46] hover:text-[#241A18]'
                    }`}
                  >
                    All Returns
                  </button>
                  <button
                    type="button"
                    onClick={() => setReturnStatusFilter('pending')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      returnStatusFilter === 'pending'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'text-amber-800 hover:text-amber-950'
                    }`}
                  >
                    <span>Pending Action</span>
                    {metrics.pendingRefundCount > 0 && (
                      <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[9px] flex items-center justify-center font-black">
                        {metrics.pendingRefundCount}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReturnStatusFilter('completed')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      returnStatusFilter === 'completed'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-emerald-800 hover:text-emerald-950'
                    }`}
                  >
                    Completed
                  </button>
                </div>

                {/* Branch Filter */}
                <select
                  value={selectedBranchFilter}
                  onChange={(e) => setSelectedBranchFilter(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-[#D9CBB7] bg-[#FAF7F2] text-[#3D2C24] font-bold focus:outline-hidden focus:border-[#8C102A] cursor-pointer"
                >
                  <option value="all">All Branches</option>
                  <option value="akurana">Akurana Flagship</option>
                  <option value="colombo">Colombo 03</option>
                  <option value="arugambay">Arugam Bay</option>
                </select>
              </div>
            </div>

            {/* Returned Bills Table */}
            <div className="bg-white rounded-2xl border border-[#E8DFC8] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#FAF7F2] border-b border-[#E8DFC8] text-[11px] uppercase tracking-wider text-[#7A6458] font-bold">
                      <th className="px-4 py-3">Return / Order Ref</th>
                      <th className="px-4 py-3">Customer & Contact</th>
                      <th className="px-4 py-3">Card / Branch</th>
                      <th className="px-4 py-3">Returned Items</th>
                      <th className="px-4 py-3">Cancellation Reason</th>
                      <th className="px-4 py-3">Return Amount</th>
                      <th className="px-4 py-3">Refund Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFE8DC]">
                    {filteredReturnedBills.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-[#7A6458]">
                          <div className="max-w-md mx-auto space-y-2">
                            <RotateCcw className="w-10 h-10 text-slate-300 mx-auto" />
                            <p className="font-bold text-sm text-[#241A18]">No Returned Bills Found</p>
                            <p className="text-xs text-[#7A6458]">
                              When an order paid by card is cancelled by parlour management after confirmation, it will automatically appear here for refund processing.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredReturnedBills.map((order) => {
                        const isCompleted = order.refundStatus === 'completed';
                        const returnAmount = order.refundAmountLKR || order.grandTotalLKR || 0;

                        return (
                          <tr key={order.orderReference} className="hover:bg-[#FAF7F2]/60 transition-colors">
                            {/* Ref & Date */}
                            <td className="px-4 py-3 align-top">
                              <span className="font-mono font-bold text-xs text-[#8C102A] block">
                                {order.orderReference}
                              </span>
                              <span className="text-[10px] text-[#7A6458] block mt-0.5">
                                Ordered: {new Date(order.createdAt).toLocaleDateString()}
                              </span>
                              {order.refundedAt && (
                                <span className="text-[10px] text-emerald-800 font-semibold block mt-0.5">
                                  Refunded: {new Date(order.refundedAt).toLocaleDateString()}
                                </span>
                              )}
                            </td>

                            {/* Customer */}
                            <td className="px-4 py-3 align-top">
                              <span className="font-bold text-xs text-[#241A18] block">
                                {order.customerName}
                              </span>
                              <span className="text-[11px] text-[#7A6458] block flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3 text-[#7A6458]" />
                                <span>{order.contactNumber}</span>
                              </span>
                              {order.emailAddress && (
                                <span className="text-[10px] text-slate-500 block truncate max-w-[180px]">
                                  {order.emailAddress}
                                </span>
                              )}
                            </td>

                            {/* Card / Branch */}
                            <td className="px-4 py-3 align-top">
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FAF7F2] border border-[#E8DFC8] text-[11px] font-semibold text-[#3D2C24]">
                                  <MapPin className="w-3 h-3 text-[#8C102A]" />
                                  <span>{order.branchName?.split(' ')[0] || 'Akurana'}</span>
                                </span>
                                <div className="text-[10px] font-mono text-[#5C4D44] block">
                                  {order.cardBrand || 'Card'} •••• {order.cardLast4 || '****'}
                                </div>
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 border border-amber-200 text-amber-900 inline-block">
                                  Online Card Payment
                                </span>
                              </div>
                            </td>

                            {/* Returned Items */}
                            <td className="px-4 py-3 align-top min-w-[200px] max-w-[260px]">
                              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                                {order.items.map((it, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-[11px] py-0.5">
                                    <span className="truncate pr-1 text-[#241A18]">
                                      <strong className="text-[#8C102A]">{it.quantity}×</strong> {it.name}
                                    </span>
                                    <span className="font-mono text-[10px] text-[#5C4D44] shrink-0">
                                      {formatPrice(it.priceLKR * it.quantity, currency)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>

                            {/* Cancellation Reason */}
                            <td className="px-4 py-3 align-top max-w-[220px]">
                              <div className="p-2 rounded-xl bg-red-50/70 border border-red-200 text-[11px] text-red-950 space-y-1">
                                <p className="font-semibold leading-tight">
                                  {order.cancellationReason || 'Cancelled by Parlour Management'}
                                </p>
                                {order.cancelledBy === 'admin' && (
                                  <button
                                    type="button"
                                    onClick={() => setViewingInconvenienceOrder(order)}
                                    className="text-[10px] text-[#8C102A] hover:underline font-bold block cursor-pointer"
                                  >
                                    View Apology Letter
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* Return Amount */}
                            <td className="px-4 py-3 align-top">
                              <span className="font-black text-sm text-[#8C102A] block">
                                {formatPrice(returnAmount, currency)}
                              </span>
                              <span className="text-[10px] text-[#7A6458] block mt-0.5">
                                100% Bill Value
                              </span>
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3 align-top">
                              {isCompleted ? (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-950 border border-emerald-300">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                                    <span>Refund Completed</span>
                                  </span>
                                  <span className="text-[10px] text-emerald-800 block font-medium">
                                    Deducted from Gross Sales
                                  </span>
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-950 border border-amber-300 animate-pulse">
                                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                                    <span>Pending Refund</span>
                                  </span>
                                  <span className="text-[10px] text-amber-800 block font-medium">
                                    Awaiting Payment Return
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3 align-top text-right">
                              <div className="flex flex-col items-end gap-1.5 min-w-[140px]">
                                {!isCompleted ? (
                                  <button
                                    type="button"
                                    onClick={() => handleCompleteReturn(order.orderReference)}
                                    className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95 w-full"
                                    title="Confirm that refund payment to customer's card is completed. Deducts amount from Kitchen Gross Sales."
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Complete Return</span>
                                  </button>
                                ) : (
                                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 block text-center w-full">
                                    ✓ Settled & Deducted
                                  </span>
                                )}

                                <button
                                  type="button"
                                  onClick={() => setSelectedOrderForReturnInvoice(order)}
                                  className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold transition-all cursor-pointer w-full"
                                  title="Print official Returned Bill / Refund Credit Note"
                                >
                                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                                  <span>Print Return Bill</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: MENU CATALOG & INVENTORY CRUD */}
        {/* ======================================================== */}
        {activeTab === 'menu' && (
          <div className="space-y-6">
            {/* Top Sub-navigation & Actions */}
            <div className="bg-white p-4 rounded-2xl border border-[#E8DFC8] shadow-xs flex flex-wrap items-center justify-between gap-4">
              {/* Category Subtabs */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMenuSubTab('scoops')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    menuSubTab === 'scoops'
                      ? 'bg-[#8C102A] text-white shadow-2xs'
                      : 'text-[#5D4E46] hover:bg-[#FAF7F2]'
                  }`}
                >
                  🍨 Gelato Scoops ({scoops.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMenuSubTab('coffee')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    menuSubTab === 'coffee'
                      ? 'bg-[#8C102A] text-white shadow-2xs'
                      : 'text-[#5D4E46] hover:bg-[#FAF7F2]'
                  }`}
                >
                  ☕ Specialty Coffee ({coffeeItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMenuSubTab('cakes')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    menuSubTab === 'cakes'
                      ? 'bg-[#8C102A] text-white shadow-2xs'
                      : 'text-[#5D4E46] hover:bg-[#FAF7F2]'
                  }`}
                >
                  🍰 Artisan Cakes ({cakeItems.length})
                </button>
              </div>

              {/* Action Buttons: Add Item & Reset Menu */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetMenu}
                  className="px-3 py-2 rounded-xl border border-[#D9CBB7] hover:border-[#8C102A] text-xs font-bold text-[#5D4E46] hover:text-[#8C102A] bg-white transition-all cursor-pointer"
                  title="Reset all prices and flavours back to authentic recipes"
                >
                  Restore Defaults
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddItemModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#8C102A] hover:bg-[#A31634] text-white text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Product</span>
                </button>
              </div>
            </div>

            {/* Menu Items Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {menuSubTab === 'scoops' &&
                scoops.map((scoop) => (
                  <div
                    key={scoop.id}
                    className="bg-white rounded-2xl border border-[#E8DFC8] p-4 shadow-xs flex flex-col justify-between relative group"
                  >
                    <div>
                      {/* Image & Badges */}
                      <div className="relative h-44 rounded-xl overflow-hidden mb-3 bg-[#FAF7F2]">
                        <img
                          src={scoop.image}
                          alt={scoop.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                          {scoop.isIconic && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-400 text-[#8C102A] text-[10px] font-black uppercase">
                              ★ Iconic Legend
                            </span>
                          )}
                          {scoop.isPopular && (
                            <span className="px-2 py-0.5 rounded-md bg-[#8C102A] text-white text-[10px] font-black uppercase">
                              Bestseller
                            </span>
                          )}
                        </div>

                        {/* Stock Availability Toggle Badge */}
                        <button
                          type="button"
                          onClick={() => handleToggleStock(scoop.id, 'scoops')}
                          className={`absolute top-2 right-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-xs transition-all cursor-pointer ${
                            scoop.isAvailable !== false
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'bg-red-600 text-white hover:bg-red-700'
                          }`}
                        >
                          {scoop.isAvailable !== false ? 'In Stock' : 'Sold Out'}
                        </button>
                      </div>

                      {/* Info */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-serif-title font-bold text-base text-[#241A18] leading-tight">
                            {scoop.name}
                          </h3>
                          <span className="text-[11px] text-[#8C102A] font-semibold block mt-0.5">
                            {scoop.tagline}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-[#6B5A51] mt-2 line-clamp-2 leading-relaxed">
                        {scoop.description}
                      </p>

                      {/* Pricing Grid */}
                      <div className="mt-3 pt-3 border-t border-[#EFE8DC] grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-[#FAF7F2] p-2 rounded-lg border border-[#E8DFC8]">
                          <span className="text-[10px] text-[#7A6458] block uppercase font-bold">
                            Waffle Cone
                          </span>
                          <span className="font-bold text-[#241A18]">
                            {formatPrice(scoop.conePriceLKR, currency)}
                          </span>
                        </div>
                        <div className="bg-[#FAF7F2] p-2 rounded-lg border border-[#E8DFC8]">
                          <span className="text-[10px] text-[#7A6458] block uppercase font-bold">
                            Biscuit Cup
                          </span>
                          <span className="font-bold text-[#8C102A]">
                            {formatPrice(scoop.biscuitCupPriceLKR, currency)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Footer */}
                    <div className="mt-4 pt-3 border-t border-[#EFE8DC] flex items-center justify-between">
                      <span className="text-[10px] text-[#7A6458] font-mono">ID: {scoop.id}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingMenuItem({ type: 'scoop', item: scoop })}
                          className="p-1.5 rounded-lg border border-[#D9CBB7] hover:border-[#8C102A] text-[#5D4E46] hover:text-[#8C102A] transition-colors cursor-pointer"
                          title="Edit Scoop Details & Pricing"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMenuItem(scoop.id, scoop.name, 'scoop')}
                          className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Delete Flavour"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

              {menuSubTab === 'coffee' &&
                coffeeItems.map((coffee) => (
                  <div
                    key={coffee.id}
                    className="bg-white rounded-2xl border border-[#E8DFC8] p-4 shadow-xs flex flex-col justify-between relative"
                  >
                    <div>
                      <div className="relative h-44 rounded-xl overflow-hidden mb-3 bg-[#FAF7F2]">
                        <img
                          src={coffee.image || 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=600&q=80'}
                          alt={coffee.name}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleToggleStock(coffee.id, 'coffee')}
                          className={`absolute top-2 right-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-xs cursor-pointer ${
                            coffee.isAvailable !== false
                              ? 'bg-emerald-600 text-white'
                              : 'bg-red-600 text-white'
                          }`}
                        >
                          {coffee.isAvailable !== false ? 'In Stock' : 'Sold Out'}
                        </button>
                      </div>

                      <h3 className="font-serif-title font-bold text-base text-[#241A18]">
                        {coffee.name}
                      </h3>
                      <p className="text-xs text-[#6B5A51] mt-1 line-clamp-2">
                        {coffee.description}
                      </p>

                      <div className="mt-3 p-2 bg-[#FAF7F2] rounded-lg border border-[#E8DFC8]">
                        <span className="text-[10px] text-[#7A6458] block uppercase font-bold">
                          Price
                        </span>
                        <span className="font-bold text-sm text-[#8C102A]">
                          {formatPrice(coffee.priceLKR, currency)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#EFE8DC] flex items-center justify-between">
                      <span className="text-[10px] text-[#7A6458] font-mono">ID: {coffee.id}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingMenuItem({ type: 'coffee', item: coffee })}
                          className="p-1.5 rounded-lg border border-[#D9CBB7] hover:border-[#8C102A] text-[#5D4E46] hover:text-[#8C102A] transition-colors cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMenuItem(coffee.id, coffee.name, 'coffee')}
                          className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

              {menuSubTab === 'cakes' &&
                cakeItems.map((cake) => (
                  <div
                    key={cake.id}
                    className="bg-white rounded-2xl border border-[#E8DFC8] p-4 shadow-xs flex flex-col justify-between relative"
                  >
                    <div>
                      <div className="relative h-44 rounded-xl overflow-hidden mb-3 bg-[#FAF7F2]">
                        <img
                          src={cake.image || 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80'}
                          alt={cake.name}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleToggleStock(cake.id, 'cakes')}
                          className={`absolute top-2 right-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-xs cursor-pointer ${
                            cake.isAvailable !== false
                              ? 'bg-emerald-600 text-white'
                              : 'bg-red-600 text-white'
                          }`}
                        >
                          {cake.isAvailable !== false ? 'In Stock' : 'Sold Out'}
                        </button>
                      </div>

                      <h3 className="font-serif-title font-bold text-base text-[#241A18]">
                        {cake.name}
                      </h3>
                      <p className="text-xs text-[#6B5A51] mt-1 line-clamp-2">
                        {cake.description}
                      </p>

                      <div className="mt-3 p-2 bg-[#FAF7F2] rounded-lg border border-[#E8DFC8]">
                        <span className="text-[10px] text-[#7A6458] block uppercase font-bold">
                          Slice Price
                        </span>
                        <span className="font-bold text-sm text-[#8C102A]">
                          {formatPrice(cake.priceLKR, currency)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#EFE8DC] flex items-center justify-between">
                      <span className="text-[10px] text-[#7A6458] font-mono">ID: {cake.id}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingMenuItem({ type: 'cake', item: cake })}
                          className="p-1.5 rounded-lg border border-[#D9CBB7] hover:border-[#8C102A] text-[#5D4E46] hover:text-[#8C102A] transition-colors cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMenuItem(cake.id, cake.name, 'cake')}
                          className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: OVERVIEW & KPIS */}
        {/* ======================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Main Stats Banner */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E8DFC8] shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E8DFC8]">
                <div>
                  <h2 className="font-serif-title font-bold text-xl sm:text-2xl text-[#241A18]">
                    Business Performance & Financial Highlights
                  </h2>
                  <p className="text-xs text-[#7A6458] mt-1">
                    Live operational metrics aggregated from all three parlours.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-[#7A6458] uppercase tracking-wider font-bold block">
                    Total Gross Sales
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-[#8C102A]">
                    {formatPrice(metrics.totalRevenueLKR, currency)}
                  </span>
                  <span className="text-[11px] text-[#7A6458] block mt-0.5">
                    Net Captured & Delivered Sales • ≈ ${convertLKRtoUSD(metrics.totalRevenueLKR).toFixed(2)} USD
                  </span>
                </div>
              </div>

              {/* Branch Sales Breakdown */}
              <div className="mt-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#7A6458] mb-4">
                  Branch Revenue Distribution
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E8DFC8]">
                    <span className="text-xs font-bold text-[#8C102A] block">
                      Akurana Flagship (Kandy)
                    </span>
                    <span className="text-lg font-black text-[#241A18] mt-1 block">
                      {formatPrice(metrics.branchRevenue.akurana || 0, currency)}
                    </span>
                    <span className="text-[10px] text-[#7A6458]">Heritage mountain parlour</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E8DFC8]">
                    <span className="text-xs font-bold text-[#8C102A] block">
                      Colombo Marine Drive
                    </span>
                    <span className="text-lg font-black text-[#241A18] mt-1 block">
                      {formatPrice(metrics.branchRevenue.colombo || 0, currency)}
                    </span>
                    <span className="text-[10px] text-[#7A6458]">Coastal urban parlour</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E8DFC8]">
                    <span className="text-xs font-bold text-[#8C102A] block">
                      Arugam Bay Surf Parlour
                    </span>
                    <span className="text-lg font-black text-[#241A18] mt-1 block">
                      {formatPrice(metrics.branchRevenue.arugambay || 0, currency)}
                    </span>
                    <span className="text-[10px] text-[#7A6458]">East coast tourist hub</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: BRANCHES CRUD */}
        {/* ======================================================== */}
        {activeTab === 'branches' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-[#E8DFC8] shadow-xs">
              <h2 className="font-serif-title font-bold text-xl text-[#241A18] mb-2">
                Parlour Outlets & Operational Status
              </h2>
              <p className="text-xs text-[#7A6458] mb-6">
                Update operational hours, delivery hotlines, and status for the three Sri Lankan parlours.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {branches.map((branch) => (
                  <div
                    key={branch.id}
                    className="p-5 rounded-2xl bg-[#FAF7F2] border border-[#E8DFC8] flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2 py-0.5 rounded-full bg-[#8C102A] text-white text-[10px] font-bold">
                          {branch.badge || 'Active Parlour'}
                        </span>
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                          Open Today
                        </span>
                      </div>
                      <h3 className="font-serif-title font-bold text-lg text-[#241A18]">
                        {branch.name}
                      </h3>
                      <p className="text-xs text-[#7A6458] mt-1">{branch.address}</p>

                      <div className="mt-4 space-y-2 text-xs text-[#3D2C24]">
                        <div>
                          <strong className="block text-[#7A6458] text-[10px] uppercase">
                            Operational Hours:
                          </strong>
                          <span>{branch.hours}</span>
                        </div>
                        <div>
                          <strong className="block text-[#7A6458] text-[10px] uppercase">
                            Hotline / WhatsApp:
                          </strong>
                          <span className="font-mono">{branch.phone}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-[#E8DFC8]">
                      <button
                        type="button"
                        onClick={() => setEditingBranch(branch)}
                        className="w-full py-2 px-3 rounded-xl border border-[#D9CBB7] hover:border-[#8C102A] text-xs font-bold text-[#5D4E46] hover:text-[#8C102A] bg-white transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Edit Branch Settings</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* MODAL: PRINTABLE ORDER INVOICE / RECEIPT */}
      {/* ======================================================== */}
      {selectedOrderForInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-[#E8DFC8] shadow-2xl relative animate-scaleIn max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedOrderForInvoice(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-[#7A6458] hover:text-[#241A18] hover:bg-[#FAF7F2] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center pb-4 border-b border-[#E8DFC8]">
              <AmoreLogo size="sm" />
              <h2 className="font-serif-title font-bold text-xl text-[#241A18] mt-2">
                Amore Speciality Ice Cream
              </h2>
              <p className="text-xs text-[#7A6458]">Official Order Receipt & Kitchen Slip</p>
              <span className="inline-block mt-2 font-mono font-bold text-xs bg-[#FAF7F2] px-3 py-1 rounded-md border border-[#E8DFC8] text-[#8C102A]">
                {selectedOrderForInvoice.orderReference}
              </span>
            </div>

            <div className="py-4 space-y-2 text-xs text-[#3D2C24] border-b border-[#E8DFC8]">
              <div className="flex justify-between">
                <span className="text-[#7A6458]">Date & Time:</span>
                <span className="font-medium">
                  {new Date(selectedOrderForInvoice.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7A6458]">Customer:</span>
                <span className="font-bold">{selectedOrderForInvoice.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7A6458]">Contact Phone:</span>
                <span>{selectedOrderForInvoice.contactNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7A6458]">Branch:</span>
                <span>{selectedOrderForInvoice.branchName}</span>
              </div>
              {selectedOrderForInvoice.deliveryAddress && (
                <div className="flex justify-between">
                  <span className="text-[#7A6458]">Delivery Address:</span>
                  <span className="text-right max-w-[220px]">
                    {selectedOrderForInvoice.deliveryAddress}, {selectedOrderForInvoice.city}
                  </span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="py-4 border-b border-[#E8DFC8]">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#7A6458] mb-2">
                Ordered Items:
              </h4>
              <div className="space-y-2">
                {selectedOrderForInvoice.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-[#8C102A]">{item.quantity}x</span>{' '}
                      <span className="font-medium text-[#241A18]">{item.name}</span>
                      {item.format && (
                        <span className="text-[10px] text-[#7A6458] block">
                          Format: {item.format.replace('-', ' ')}
                        </span>
                      )}
                    </div>
                    <span className="font-bold">
                      {formatPrice(item.priceLKR * item.quantity, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="py-4 space-y-1.5 text-xs text-[#3D2C24]">
              <div className="flex justify-between">
                <span className="text-[#7A6458]">Subtotal:</span>
                <span>{formatPrice(selectedOrderForInvoice.subtotalLKR, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7A6458]">Delivery Fee:</span>
                <span>{formatPrice(selectedOrderForInvoice.deliveryFeeLKR, currency)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-[#8C102A] pt-2 border-t border-[#E8DFC8]">
                <span>Grand Total:</span>
                <span>{formatPrice(selectedOrderForInvoice.grandTotalLKR, currency)}</span>
              </div>
            </div>

            {/* Print Action */}
            <div className="mt-4 pt-4 border-t border-[#E8DFC8] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full py-2.5 px-4 rounded-xl bg-[#8C102A] text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:bg-[#A31634]"
              >
                <Printer className="w-4 h-4" />
                <span>Print Invoice</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: PRINTABLE RETURN BILL / REFUND CREDIT NOTE */}
      {/* ======================================================== */}
      {selectedOrderForReturnInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-[#E8DFC8] shadow-2xl relative animate-scaleIn max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedOrderForReturnInvoice(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-[#7A6458] hover:text-[#241A18] hover:bg-[#FAF7F2] cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center pb-4 border-b border-[#E8DFC8]">
              <AmoreLogo size="sm" />
              <h2 className="font-serif-title font-bold text-xl text-[#241A18] mt-2">
                Amore Speciality Ice Cream
              </h2>
              <div className="mt-1.5 inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-red-100 text-red-900 border border-red-300 font-bold text-xs uppercase tracking-wider">
                <RotateCcw className="w-3.5 h-3.5 text-red-700" />
                <span>Returned Bill & Credit Note</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <span className="font-mono font-bold text-xs bg-[#FAF7F2] px-3 py-1 rounded-md border border-[#E8DFC8] text-[#8C102A]">
                  Order Ref: {selectedOrderForReturnInvoice.orderReference}
                </span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                    selectedOrderForReturnInvoice.refundStatus === 'completed'
                      ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                      : 'bg-amber-100 text-amber-950 border border-amber-300'
                  }`}
                >
                  {selectedOrderForReturnInvoice.refundStatus === 'completed' ? 'Refund Completed' : 'Pending Reversal'}
                </span>
              </div>
            </div>

            <div className="py-4 space-y-2 text-xs text-[#3D2C24] border-b border-[#E8DFC8]">
              <div className="flex justify-between">
                <span className="text-[#7A6458]">Original Order Date:</span>
                <span className="font-medium">
                  {new Date(selectedOrderForReturnInvoice.createdAt).toLocaleString()}
                </span>
              </div>
              {selectedOrderForReturnInvoice.refundedAt && (
                <div className="flex justify-between">
                  <span className="text-[#7A6458]">Refund Settled Date:</span>
                  <span className="font-bold text-emerald-800">
                    {new Date(selectedOrderForReturnInvoice.refundedAt).toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#7A6458]">Customer Name:</span>
                <span className="font-bold">{selectedOrderForReturnInvoice.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7A6458]">Contact Phone:</span>
                <span>{selectedOrderForReturnInvoice.contactNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7A6458]">Issuing Branch:</span>
                <span>{selectedOrderForReturnInvoice.branchName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7A6458]">Payment Method:</span>
                <span className="font-mono font-medium">
                  {selectedOrderForReturnInvoice.cardBrand || 'Card'} •••• {selectedOrderForReturnInvoice.cardLast4 || '****'}
                </span>
              </div>
            </div>

            {/* Cancellation Reason Note */}
            <div className="py-3 px-3.5 my-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-950 space-y-1">
              <span className="font-bold block uppercase tracking-wider text-[10px] text-red-900">
                Reason for Order Return / Cancellation:
              </span>
              <p className="font-medium leading-relaxed">
                {selectedOrderForReturnInvoice.cancellationReason || 'Cancelled by Parlour Management after payment capture'}
              </p>
            </div>

            {/* Returned Items Table */}
            <div className="py-4 border-b border-[#E8DFC8]">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#7A6458] mb-2">
                Returned Products Credited:
              </h4>
              <div className="space-y-2">
                {selectedOrderForReturnInvoice.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-[#8C102A]">{item.quantity}x</span>{' '}
                      <span className="font-medium text-[#241A18]">{item.name}</span>
                      {item.format && (
                        <span className="text-[10px] text-[#7A6458] block">
                          Format: {item.format.replace('-', ' ')}
                        </span>
                      )}
                    </div>
                    <span className="font-bold">
                      {formatPrice(item.priceLKR * item.quantity, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Return Breakdown */}
            <div className="py-4 space-y-1.5 text-xs text-[#3D2C24]">
              <div className="flex justify-between">
                <span className="text-[#7A6458]">Items Total Refunded:</span>
                <span>{formatPrice(selectedOrderForReturnInvoice.subtotalLKR, currency)}</span>
              </div>
              {selectedOrderForReturnInvoice.deliveryFeeLKR > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#7A6458]">Delivery Fee Refunded:</span>
                  <span>{formatPrice(selectedOrderForReturnInvoice.deliveryFeeLKR, currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-[#8C102A] pt-2 border-t border-[#E8DFC8]">
                <span>Total Amount Credited / Returned:</span>
                <span>{formatPrice(selectedOrderForReturnInvoice.refundAmountLKR || selectedOrderForReturnInvoice.grandTotalLKR, currency)}</span>
              </div>
            </div>

            <div className="pt-2 text-[10px] text-[#7A6458] text-center border-t border-[#E8DFC8] space-y-1">
              <p>Accounting Notice: Completed refund amounts are automatically deducted from Kitchen Gross Sales.</p>
              <p>Authorized by Amore Operations & Audit Management</p>
            </div>

            {/* Print Action */}
            <div className="mt-4 pt-4 border-t border-[#E8DFC8] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full py-2.5 px-4 rounded-xl bg-[#8C102A] text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:bg-[#A31634] transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Print Return Bill & Credit Note</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT ORDER DETAILS */}
      {/* ======================================================== */}
      {selectedOrderForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-[#E8DFC8] shadow-2xl relative animate-scaleIn max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedOrderForEdit(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-[#7A6458] hover:text-[#241A18] hover:bg-[#FAF7F2] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="font-serif-title font-bold text-xl text-[#241A18] mb-1">
              Edit Order {selectedOrderForEdit.orderReference}
            </h2>
            <p className="text-xs text-[#7A6458] mb-4">
              Modify customer contact info, delivery address, or special notes.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateOrder(selectedOrderForEdit.orderReference, selectedOrderForEdit);
                setOrders(getAllOrdersAdmin());
                setSelectedOrderForEdit(null);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-[#3D2C24] mb-1">Customer Name</label>
                <input
                  type="text"
                  value={selectedOrderForEdit.customerName}
                  onChange={(e) =>
                    setSelectedOrderForEdit({ ...selectedOrderForEdit, customerName: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#3D2C24] mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={selectedOrderForEdit.contactNumber}
                  onChange={(e) =>
                    setSelectedOrderForEdit({ ...selectedOrderForEdit, contactNumber: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#3D2C24] mb-1">Delivery Address</label>
                <input
                  type="text"
                  value={selectedOrderForEdit.deliveryAddress || ''}
                  onChange={(e) =>
                    setSelectedOrderForEdit({ ...selectedOrderForEdit, deliveryAddress: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#3D2C24] mb-1">City / Town</label>
                <input
                  type="text"
                  value={selectedOrderForEdit.city || ''}
                  onChange={(e) =>
                    setSelectedOrderForEdit({ ...selectedOrderForEdit, city: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#3D2C24] mb-1">Special Kitchen Note</label>
                <textarea
                  rows={2}
                  value={selectedOrderForEdit.specialNote || ''}
                  onChange={(e) =>
                    setSelectedOrderForEdit({ ...selectedOrderForEdit, specialNote: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrderForEdit(null)}
                  className="px-4 py-2 rounded-xl border border-[#D9CBB7] text-[#5D4E46] font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#8C102A] text-white font-bold cursor-pointer hover:bg-[#A31634]"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CREATE MANUAL ORDER */}
      {/* ======================================================== */}
      {isCreateOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-[#E8DFC8] shadow-2xl relative animate-scaleIn max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsCreateOrderModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-[#7A6458] hover:text-[#241A18] hover:bg-[#FAF7F2] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="font-serif-title font-bold text-xl text-[#241A18] mb-1">
              Create Manual Walk-in / Phone Order
            </h2>
            <p className="text-xs text-[#7A6458] mb-4">
              Enter walk-in or telephone customer details to send directly to kitchen queue.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const customerName = (formData.get('customerName') as string) || 'Walk-in Customer';
                const contactNumber = (formData.get('contactNumber') as string) || '+94 77 123 4567';
                const branchId = (formData.get('branchId') as BranchId) || 'akurana';
                const orderType = (formData.get('orderType') as 'delivery' | 'pickup') || 'pickup';
                const totalAmount = Number(formData.get('grandTotalLKR')) || 1500;

                createAdminOrder({
                  customerName,
                  contactNumber,
                  branchId,
                  branchName: branchId === 'akurana' ? 'Akurana Flagship' : branchId === 'colombo' ? 'Colombo Marine Drive' : 'Arugam Bay Surf Parlour',
                  orderType,
                  grandTotalLKR: totalAmount,
                  subtotalLKR: totalAmount,
                  status: 'confirmed',
                  items: [
                    {
                      itemId: 'durian-best',
                      name: 'Iconic Durian Custard in Biscuit Cup',
                      category: 'scoops',
                      format: 'biscuit-cup',
                      priceLKR: totalAmount,
                      quantity: 1,
                    },
                  ],
                });

                setOrders(getAllOrdersAdmin());
                setIsCreateOrderModalOpen(false);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-[#3D2C24] mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  name="customerName"
                  required
                  placeholder="e.g. Tariq Mansoor"
                  className="w-full px-3 py-2 rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#3D2C24] mb-1">Contact Phone *</label>
                <input
                  type="text"
                  name="contactNumber"
                  required
                  placeholder="+94 77 123 4567"
                  className="w-full px-3 py-2 rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#3D2C24] mb-1">Branch</label>
                  <select
                    name="branchId"
                    className="w-full px-3 py-2 rounded-xl border border-[#D9CBB7] bg-white focus:outline-hidden"
                  >
                    <option value="akurana">Akurana Flagship</option>
                    <option value="colombo">Colombo Marine Drive</option>
                    <option value="arugambay">Arugam Bay</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#3D2C24] mb-1">Type</label>
                  <select
                    name="orderType"
                    className="w-full px-3 py-2 rounded-xl border border-[#D9CBB7] bg-white focus:outline-hidden"
                  >
                    <option value="pickup">Self Pickup / Dine-in</option>
                    <option value="delivery">Delivery</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#3D2C24] mb-1">Total Amount (LKR) *</label>
                <input
                  type="number"
                  name="grandTotalLKR"
                  required
                  defaultValue={1450}
                  className="w-full px-3 py-2 rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOrderModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#D9CBB7] text-[#5D4E46] font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#8C102A] text-white font-bold cursor-pointer hover:bg-[#A31634]"
                >
                  Create & Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD NEW MENU ITEM */}
      {/* ======================================================== */}
      {isAddItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-[#E8DFC8] shadow-2xl relative animate-scaleIn max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsAddItemModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-[#7A6458] hover:text-[#241A18] hover:bg-[#FAF7F2] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="font-serif-title font-bold text-xl text-[#241A18] mb-1">
              Add New Product to Menu
            </h2>
            <p className="text-xs text-[#7A6458] mb-4">
              Create a new handcrafted gelato flavour, barista beverage, or bakery item.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const categoryType = formData.get('categoryType') as string;
                const name = formData.get('name') as string;
                const tagline = formData.get('tagline') as string;
                const description = formData.get('description') as string;
                const price = Number(formData.get('price')) || 650;
                const imageUrl = (formData.get('image') as string) || 'https://images.unsplash.com/photo-1560008581-09826d1de69e?auto=format&fit=crop&w=600&q=80';

                if (categoryType === 'scoops') {
                  createScoopItem({
                    id: `flavour-${Date.now()}`,
                    name,
                    tagline: tagline || 'Artisanal Batch',
                    description,
                    category: 'signature',
                    conePriceLKR: price,
                    biscuitCupPriceLKR: price + 100,
                    doubleConePriceLKR: price * 1.8,
                    doubleCupPriceLKR: (price + 100) * 1.8,
                    image: imageUrl,
                    dietary: ['Halal', 'Vegetarian'],
                    tastingNotes: ['Creamy', 'Fresh'],
                    creaminess: 5,
                    sweetness: 4,
                    intensity: 4,
                    accentColor: '#8C102A',
                    isAvailable: true,
                  });
                } else if (categoryType === 'coffee') {
                  createCoffeeItem({
                    id: `coffee-${Date.now()}`,
                    name,
                    category: 'coffee',
                    description,
                    priceLKR: price,
                    image: imageUrl,
                    isAvailable: true,
                  });
                } else {
                  createCakeItem({
                    id: `cake-${Date.now()}`,
                    name,
                    category: 'cakes',
                    description,
                    priceLKR: price,
                    image: imageUrl,
                    isAvailable: true,
                  });
                }

                refreshAllData();
                setIsAddItemModalOpen(false);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-[#3D2C24] mb-1">Product Category</label>
                <select
                  name="categoryType"
                  defaultValue={menuSubTab}
                  className="w-full px-3 py-2 rounded-xl border border-[#D9CBB7] bg-white focus:outline-hidden"
                >
                  <option value="scoops">Gelato Scoop (Flavour)</option>
                  <option value="coffee">Specialty Barista Coffee</option>
                  <option value="cakes">Artisan Bakery Cake</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#3D2C24] mb-1">Product Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Ceylon Cinnamon Roasted Almond"
                  className="w-full px-3 py-2 rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#3D2C24] mb-1">Tagline / Subtitle</label>
                <input
                  type="text"
                  name="tagline"
                  placeholder="e.g. Spiced Heritage Gelato"
                  className="w-full px-3 py-2 rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#3D2C24] mb-1">Description *</label>
                <textarea
                  name="description"
                  required
                  rows={2}
                  placeholder="Handcrafted small-batch gelato churned with authentic Ceylon spices..."
                  className="w-full px-3 py-2 rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#3D2C24] mb-1">Base Price (LKR) *</label>
                <input
                  type="number"
                  name="price"
                  required
                  defaultValue={650}
                  className="w-full px-3 py-2 rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#3D2C24] mb-1">Image URL (Optional)</label>
                <input
                  type="url"
                  name="image"
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddItemModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#D9CBB7] text-[#5D4E46] font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#8C102A] text-white font-bold cursor-pointer hover:bg-[#A31634]"
                >
                  Save to Menu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT MENU ITEM */}
      {/* ======================================================== */}
      {editingMenuItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-[#E8DFC8] shadow-2xl relative animate-scaleIn max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditingMenuItem(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-[#7A6458] hover:text-[#241A18] hover:bg-[#FAF7F2] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="font-serif-title font-bold text-xl text-[#241A18] mb-1">
              Edit Product Details
            </h2>
            <p className="text-xs text-[#7A6458] mb-4">
              Update pricing, description, or availability for {editingMenuItem.item.name}.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editingMenuItem.type === 'scoop') {
                  updateScoopItem(editingMenuItem.item.id, editingMenuItem.item as ScoopItem);
                } else if (editingMenuItem.type === 'coffee') {
                  updateCoffeeItem(editingMenuItem.item.id, editingMenuItem.item as MenuItem);
                } else {
                  updateCakeItem(editingMenuItem.item.id, editingMenuItem.item as MenuItem);
                }
                refreshAllData();
                setEditingMenuItem(null);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-[#3D2C24] mb-1">Product Name</label>
                <input
                  type="text"
                  value={editingMenuItem.item.name}
                  onChange={(e) =>
                    setEditingMenuItem({
                      ...editingMenuItem,
                      item: { ...editingMenuItem.item, name: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#3D2C24] mb-1">Image URL</label>
                <div className="flex gap-3 items-center">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#FAF7F2] border border-[#D9CBB7] shrink-0">
                    <img
                      src={editingMenuItem.item.image || 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80'}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80';
                      }}
                    />
                  </div>
                  <input
                    type="url"
                    value={editingMenuItem.item.image || ''}
                    onChange={(e) =>
                      setEditingMenuItem({
                        ...editingMenuItem,
                        item: { ...editingMenuItem.item, image: e.target.value },
                      })
                    }
                    placeholder="https://images.unsplash.com/..."
                    className="flex-1 px-3 py-2 rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A]"
                  />
                </div>
              </div>

              {editingMenuItem.type === 'scoop' ? (
                <div>
                  <label className="block font-bold text-[#3D2C24] mb-1">Tagline / Short Subtitle</label>
                  <input
                    type="text"
                    value={(editingMenuItem.item as ScoopItem).tagline || ''}
                    onChange={(e) =>
                      setEditingMenuItem({
                        ...editingMenuItem,
                        item: {
                          ...(editingMenuItem.item as ScoopItem),
                          tagline: e.target.value,
                        },
                      })
                    }
                    placeholder="e.g. King of Fruits • Signature Custard"
                    className="w-full px-3 py-2 rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A]"
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-bold text-[#3D2C24] mb-1">Portion / Serving Info</label>
                  <input
                    type="text"
                    value={(editingMenuItem.item as MenuItem).portionOrTemp || ''}
                    onChange={(e) =>
                      setEditingMenuItem({
                        ...editingMenuItem,
                        item: {
                          ...(editingMenuItem.item as MenuItem),
                          portionOrTemp: e.target.value,
                        },
                      })
                    }
                    placeholder="e.g. Hot & Iced or Artisan Slice"
                    className="w-full px-3 py-2 rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A]"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-[#3D2C24] mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editingMenuItem.item.description}
                  onChange={(e) =>
                    setEditingMenuItem({
                      ...editingMenuItem,
                      item: { ...editingMenuItem.item, description: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A]"
                />
              </div>

              {editingMenuItem.type === 'scoop' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[#3D2C24] mb-1">Waffle Cone (LKR)</label>
                    <input
                      type="number"
                      value={(editingMenuItem.item as ScoopItem).conePriceLKR}
                      onChange={(e) =>
                        setEditingMenuItem({
                          ...editingMenuItem,
                          item: {
                            ...(editingMenuItem.item as ScoopItem),
                            conePriceLKR: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#3D2C24] mb-1">Biscuit Cup (LKR)</label>
                    <input
                      type="number"
                      value={(editingMenuItem.item as ScoopItem).biscuitCupPriceLKR}
                      onChange={(e) =>
                        setEditingMenuItem({
                          ...editingMenuItem,
                          item: {
                            ...(editingMenuItem.item as ScoopItem),
                            biscuitCupPriceLKR: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A]"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block font-bold text-[#3D2C24] mb-1">Price (LKR)</label>
                  <input
                    type="number"
                    value={(editingMenuItem.item as MenuItem).priceLKR}
                    onChange={(e) =>
                      setEditingMenuItem({
                        ...editingMenuItem,
                        item: {
                          ...(editingMenuItem.item as MenuItem),
                          priceLKR: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A]"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[#F0EBE0]">
                <div>
                  <label className="block font-bold text-[#3D2C24] mb-1">Stock Availability</label>
                  <select
                    value={editingMenuItem.item.isAvailable !== false ? 'in_stock' : 'sold_out'}
                    onChange={(e) =>
                      setEditingMenuItem({
                        ...editingMenuItem,
                        item: {
                          ...editingMenuItem.item,
                          isAvailable: e.target.value === 'in_stock',
                        },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D9CBB7] bg-white focus:outline-hidden focus:border-[#8C102A] font-bold text-xs"
                  >
                    <option value="in_stock">🟢 In Stock</option>
                    <option value="sold_out">🔴 Sold Out</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#3D2C24] mb-1">Badges</label>
                  <div className="flex items-center gap-3 pt-2">
                    {editingMenuItem.type === 'scoop' ? (
                      <>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!(editingMenuItem.item as ScoopItem).isPopular}
                            onChange={(e) =>
                              setEditingMenuItem({
                                ...editingMenuItem,
                                item: {
                                  ...(editingMenuItem.item as ScoopItem),
                                  isPopular: e.target.checked,
                                },
                              })
                            }
                            className="rounded border-[#D9CBB7] text-[#8C102A] focus:ring-[#8C102A]"
                          />
                          <span className="text-[11px] font-medium">Popular</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!(editingMenuItem.item as ScoopItem).isIconic}
                            onChange={(e) =>
                              setEditingMenuItem({
                                ...editingMenuItem,
                                item: {
                                  ...(editingMenuItem.item as ScoopItem),
                                  isIconic: e.target.checked,
                                },
                              })
                            }
                            className="rounded border-[#D9CBB7] text-[#8C102A] focus:ring-[#8C102A]"
                          />
                          <span className="text-[11px] font-medium">#1 Iconic</span>
                        </label>
                      </>
                    ) : (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!(editingMenuItem.item as MenuItem).popular}
                          onChange={(e) =>
                            setEditingMenuItem({
                              ...editingMenuItem,
                              item: {
                                ...(editingMenuItem.item as MenuItem),
                                popular: e.target.checked,
                              },
                            })
                          }
                          className="rounded border-[#D9CBB7] text-[#8C102A] focus:ring-[#8C102A]"
                        />
                        <span className="text-[11px] font-medium">Bestseller</span>
                      </label>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingMenuItem(null)}
                  className="px-4 py-2 rounded-xl border border-[#D9CBB7] text-[#5D4E46] font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#8C102A] text-white font-bold cursor-pointer hover:bg-[#A31634]"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT BRANCH SETTINGS */}
      {/* ======================================================== */}
      {editingBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-[#E8DFC8] shadow-2xl relative animate-scaleIn">
            <button
              onClick={() => setEditingBranch(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-[#7A6458] hover:text-[#241A18] hover:bg-[#FAF7F2] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="font-serif-title font-bold text-xl text-[#241A18] mb-1">
              Edit Branch: {editingBranch.name}
            </h2>
            <p className="text-xs text-[#7A6458] mb-4">
              Update operational hours, address, and telephone hotlines.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setBranches((prev) =>
                  prev.map((b) => (b.id === editingBranch.id ? editingBranch : b))
                );
                setEditingBranch(null);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-[#3D2C24] mb-1">Operating Hours</label>
                <input
                  type="text"
                  value={editingBranch.hours}
                  onChange={(e) => setEditingBranch({ ...editingBranch, hours: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#3D2C24] mb-1">Hotline Number</label>
                <input
                  type="text"
                  value={editingBranch.phone}
                  onChange={(e) => setEditingBranch({ ...editingBranch, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#3D2C24] mb-1">Physical Address</label>
                <input
                  type="text"
                  value={editingBranch.address}
                  onChange={(e) => setEditingBranch({ ...editingBranch, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingBranch(null)}
                  className="px-4 py-2 rounded-xl border border-[#D9CBB7] text-[#5D4E46] font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#8C102A] text-white font-bold cursor-pointer hover:bg-[#A31634]"
                >
                  Save Branch Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADMIN CONFIRM ORDER & PROCESS PAYMENT POPUP */}
      {/* ======================================================== */}
      {confirmingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-[#E8DFC8] shadow-2xl relative space-y-4 animate-scaleIn">
            <button
              onClick={() => setConfirmingOrder(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-[#7A6458] hover:text-[#241A18] hover:bg-[#FAF7F2] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-serif-title font-bold text-xl text-[#241A18]">
                  Confirm Order & Process Payment
                </h2>
                <p className="text-xs text-[#7A6458]">
                  Order Ref: <span className="font-mono font-bold text-[#8C102A]">{confirmingOrder.orderReference}</span>
                </p>
              </div>
            </div>

            {/* Order Details Summary */}
            <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E8DFC8] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#7A6458]">Customer Name:</span>
                <span className="font-bold text-[#241A18]">{confirmingOrder.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7A6458]">Contact Phone:</span>
                <span className="font-bold text-[#241A18]">{confirmingOrder.contactNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7A6458]">Branch:</span>
                <span className="font-bold text-[#241A18]">{confirmingOrder.branchName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7A6458]">Type:</span>
                <span className="font-bold text-[#241A18] uppercase">
                  {confirmingOrder.orderType === 'delivery' ? '🚚 Delivery' : '🛍️ Self Pickup'}
                </span>
              </div>
              {confirmingOrder.deliveryAddress && (
                <div className="flex justify-between">
                  <span className="text-[#7A6458]">Address:</span>
                  <span className="font-bold text-[#241A18] text-right truncate max-w-[240px]">
                    {confirmingOrder.deliveryAddress}, {confirmingOrder.city}
                  </span>
                </div>
              )}
              {confirmingOrder.deliveryCoordinates && (
                <div className="flex justify-between items-center">
                  <span className="text-[#7A6458]">GPS Location:</span>
                  <a
                    href={`https://www.google.com/maps?q=${confirmingOrder.deliveryCoordinates.lat},${confirmingOrder.deliveryCoordinates.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-[#8C102A] hover:underline flex items-center gap-1 text-[11px]"
                  >
                    <MapPin className="w-3 h-3 text-[#8C102A]" />
                    <span>View Pinned Location on Map</span>
                  </a>
                </div>
              )}
              <div className="pt-2 border-t border-[#E8DFC8]/80">
                <div className="text-[11px] font-bold text-[#7A6458] mb-1">
                  Ordered Products ({confirmingOrder.items.length}):
                </div>
                <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                  {confirmingOrder.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-[11px]">
                      <span>
                        {it.quantity}x {it.name} {it.format ? `(${it.format})` : ''}
                      </span>
                      <span className="font-bold">
                        {formatPrice(it.priceLKR * it.quantity, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-2 border-t border-[#E8DFC8] flex justify-between text-sm font-bold text-[#241A18]">
                <span>Total Amount to Capture:</span>
                <span className="text-[#8C102A] text-base">
                  {formatPrice(confirmingOrder.grandTotalLKR, currency)}
                </span>
              </div>
            </div>

            {/* Live Payment Capture Notice */}
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs text-emerald-950 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Payment & Customer Live Notice</p>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  {confirmingOrder.orderType === 'pickup' || confirmingOrder.paymentMethod === 'pay_at_parlour'
                    ? 'Confirming this order will approve parlour preparation (customer will settle bill at parlour counter upon collection) and notify the customer in real-time.'
                    : `Confirming this order will capture customer payment (${confirmingOrder.paymentMethod === 'card' ? 'Pre-authorized card charged' : 'Cash on delivery marked'}) and notify the customer's portal in real-time.`}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmingOrder(null)}
                className="px-4 py-2.5 rounded-xl border border-[#D9CBB7] text-[#5D4E46] text-xs font-bold hover:bg-gray-50 cursor-pointer"
              >
                Cancel / Review Later
              </button>
              <button
                type="button"
                onClick={() => handleExecuteConfirmOrder(confirmingOrder.orderReference)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>
                  {confirmingOrder.orderType === 'pickup' || confirmingOrder.paymentMethod === 'pay_at_parlour'
                    ? 'Yes, Confirm Parlour Order'
                    : 'Yes, Confirm Order & Capture Payment'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADMIN CANCEL ORDER WITH REASON & INCONVENIENCE EMAIL */}
      {/* ======================================================== */}
      {cancellingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 border border-[#E8DFC8] shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto animate-scaleIn">
            <button
              onClick={() => setCancellingOrder(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-[#7A6458] hover:text-[#241A18] hover:bg-[#FAF7F2] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center shadow-xs">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-serif-title font-bold text-xl text-[#241A18]">
                  Cancel Order & Send Inconvenience Notice
                </h2>
                <p className="text-xs text-[#7A6458]">
                  Order Ref: <span className="font-mono font-bold text-[#8C102A]">{cancellingOrder.orderReference}</span> • {cancellingOrder.customerName}
                </p>
              </div>
            </div>

            {/* Payment Return Notice if Card was confirmed / captured */}
            {cancellingOrder.paymentMethod === 'card' &&
              (cancellingOrder.status !== 'pending_confirmation' || !!cancellingOrder.paidAt || !!cancellingOrder.confirmedAt) && (
                <div className="p-3.5 bg-red-50/90 rounded-2xl border-2 border-red-300 space-y-1.5 animate-fadeIn text-xs">
                  <div className="flex items-center gap-2 text-red-950 font-bold">
                    <RotateCcw className="w-4 h-4 text-red-700 shrink-0" />
                    <span>Card Payment Captured — Return Confirmation Required</span>
                  </div>
                  <p className="text-[11px] text-red-900 leading-relaxed">
                    Customer paid <strong>{formatPrice(cancellingOrder.grandTotalLKR, currency)}</strong> via Credit/Debit Card ({cancellingOrder.cardBrand || 'Card'} •••• {cancellingOrder.cardLast4 || '****'}).
                  </p>
                  <p className="text-[11px] text-red-800 font-semibold leading-relaxed">
                    ⚠️ Confirming cancellation will immediately route this order to the <strong>Returned Bills</strong> tab as a pending refund for payment return to the customer. When settled, it will be deducted from Kitchen Gross Sales.
                  </p>
                </div>
              )}

            {/* Reason Selection */}
            <div className="space-y-2 text-xs">
              <label className="block font-bold text-[#3D2C24]">
                Select Reason for Cancellation (mentioned in apology email):
              </label>
              <select
                value={cancelReasonPreset}
                onChange={(e) => setCancelReasonPreset(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#D9CBB7] bg-white text-xs font-medium text-[#241A18] focus:outline-hidden focus:border-[#8C102A] cursor-pointer"
              >
                <option value="Out of Stock: Selected artisanal flavours or biscuit cups are sold out">
                  Out of Stock: Flavour or biscuit cups sold out
                </option>
                <option value="Delivery Distance: Address is outside our safe fresh gelato delivery radius">
                  Delivery Distance: Location outside fresh transit radius
                </option>
                <option value="Kitchen Peak Capacity: Parlour kitchen is currently experiencing extreme volume">
                  Kitchen Peak Capacity: Reached maximum churn volume
                </option>
                <option value="Parlour Equipment Maintenance: Unscheduled churner maintenance underway">
                  Equipment / Operational maintenance at branch
                </option>
                <option value="Customer Requested: Customer contacted parlour to cancel order">
                  Customer requested cancellation by phone
                </option>
                <option value="Other / Custom Reason">Other / Custom Reason</option>
              </select>

              <div>
                <label className="block text-[11px] font-bold text-[#5D4E46] mb-1">
                  Additional Details / Custom Message to Customer:
                </label>
                <textarea
                  rows={2}
                  value={customCancelReason}
                  onChange={(e) => setCustomCancelReason(e.target.value)}
                  placeholder="Optional details: E.g., We attempted to call you; vanilla beans are replenishing at 5 PM."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A]"
                />
              </div>
            </div>

            {/* Email Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-[#7A6458]">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#8C102A]" />
                  <span>Generated Amore Apology Notice:</span>
                </span>
                <span className="text-[10px] text-[#8C102A] bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 font-semibold">
                  From: zenatiqcodes@gmail.com
                </span>
              </div>

              <div className="bg-[#FAF7F2] p-3.5 rounded-xl border border-[#E8DFC8] font-mono text-[11px] text-[#3D2C24] whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed select-text">
                {(() => {
                  const computedReason =
                    cancelReasonPreset === 'Other / Custom Reason'
                      ? customCancelReason.trim() || 'Operational constraint at the parlour'
                      : customCancelReason.trim()
                      ? `${cancelReasonPreset} (${customCancelReason.trim()})`
                      : cancelReasonPreset;
                  return generateInconvenienceEmail(cancellingOrder, computedReason).body;
                })()}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-between border-t border-[#E8DFC8]">
              <button
                type="button"
                onClick={() => setCancellingOrder(null)}
                className="px-4 py-2 rounded-xl border border-[#D9CBB7] text-[#5D4E46] text-xs font-bold hover:bg-gray-50 cursor-pointer"
              >
                Keep Order
              </button>

              <button
                type="button"
                onClick={() => handleExecuteCancelOrder(cancellingOrder)}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5 active:scale-98 transition-all"
              >
                <Ban className="w-4 h-4" />
                <span>
                  {cancellingOrder.paymentMethod === 'card' &&
                  (cancellingOrder.status !== 'pending_confirmation' || !!cancellingOrder.paidAt || !!cancellingOrder.confirmedAt)
                    ? 'Confirm Cancellation & Send to Returned Bills'
                    : 'Confirm Cancellation & Dispatch Email'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: VIEW SENT APOLOGY / INCONVENIENCE EMAIL */}
      {/* ======================================================== */}
      {viewingInconvenienceOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-[#E8DFC8] shadow-2xl relative space-y-4 animate-scaleIn">
            <button
              onClick={() => setViewingInconvenienceOrder(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-[#7A6458] hover:text-[#241A18] hover:bg-[#FAF7F2] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center shadow-xs">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-serif-title font-bold text-lg text-[#241A18]">
                  Inconvenience Email Notice
                </h2>
                <p className="text-xs text-[#7A6458]">
                  Order {viewingInconvenienceOrder.orderReference} • {viewingInconvenienceOrder.customerName}
                </p>
              </div>
            </div>

            <div className="bg-[#FAF7F2] p-4 rounded-xl border border-[#E8DFC8] font-mono text-xs text-slate-800 whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed">
              {viewingInconvenienceOrder.inconvenienceEmailContent ||
                generateInconvenienceEmail(
                  viewingInconvenienceOrder,
                  viewingInconvenienceOrder.cancellationReason || 'Operational constraint at the parlour'
                ).body}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  const content =
                    viewingInconvenienceOrder.inconvenienceEmailContent ||
                    generateInconvenienceEmail(
                      viewingInconvenienceOrder,
                      viewingInconvenienceOrder.cancellationReason || 'Operational constraint at the parlour'
                    ).body;
                  navigator.clipboard.writeText(content);
                  setCopiedAdminEmail(true);
                  setTimeout(() => setCopiedAdminEmail(false), 2000);
                }}
                className="px-4 py-2 rounded-xl bg-white border border-[#D9CBB7] hover:bg-gray-50 text-xs font-bold text-[#3D2C24] flex items-center gap-1.5 cursor-pointer"
              >
                {copiedAdminEmail ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-600" />
                    <span>Copy Email Text</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setViewingInconvenienceOrder(null)}
                className="px-5 py-2 rounded-xl bg-[#8C102A] hover:bg-[#A31634] text-white text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

