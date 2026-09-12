import React, { useState, useEffect, useMemo } from 'react';
import { AmoreLogo } from '../AmoreLogo';
import { clearAdminSession } from '../../utils/adminAuth';
import {
  getAllOrdersAdmin,
  deleteOrder,
  updateOrderStatus,
  createAdminOrder,
  updateOrder,
} from '../../utils/orderStorage';
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
  X,
  Save,
  Check,
} from 'lucide-react';

interface AdminDashboardProps {
  onSignOut: () => void;
  onBackToStore: () => void;
  currency: Currency;
  onToggleCurrency: (c: Currency) => void;
}

type AdminTab = 'overview' | 'orders' | 'menu' | 'branches';
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
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<OrderRecord | null>(null);
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState(false);

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

  // Load Data
  const refreshAllData = () => {
    setOrders(getAllOrdersAdmin());
    setScoops(getAllGelatoFlavours());
    setCoffeeItems(getAllCoffeeItems());
    setCakeItems(getAllCakeItems());
  };

  useEffect(() => {
    refreshAllData();

    // Listen for external menu changes
    const handleMenuUpdated = () => {
      setScoops(getAllGelatoFlavours());
      setCoffeeItems(getAllCoffeeItems());
      setCakeItems(getAllCakeItems());
    };
    window.addEventListener(MENU_UPDATED_EVENT, handleMenuUpdated);
    return () => window.removeEventListener(MENU_UPDATED_EVENT, handleMenuUpdated);
  }, []);

  // -----------------------------------------------------------
  // OVERVIEW / KPI CALCULATIONS
  // -----------------------------------------------------------
  const metrics = useMemo(() => {
    const totalOrders = orders.length;
    const activeOrders = orders.filter((o) => o.status !== 'cancelled' && o.status !== 'delivered');
    const preparingOrders = orders.filter((o) => o.status === 'preparing');
    const deliveredOrders = orders.filter((o) => o.status === 'delivered');
    const cancelledOrders = orders.filter((o) => o.status === 'cancelled');

    const totalRevenueLKR = orders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (o.grandTotalLKR || 0), 0);

    const branchRevenue: Record<string, number> = {
      akurana: 0,
      colombo: 0,
      arugambay: 0,
    };

    orders.forEach((o) => {
      if (o.status !== 'cancelled') {
        const b = o.branchId || 'akurana';
        branchRevenue[b] = (branchRevenue[b] || 0) + (o.grandTotalLKR || 0);
      }
    });

    return {
      totalOrders,
      activeOrdersCount: activeOrders.length,
      preparingCount: preparingOrders.length,
      deliveredCount: deliveredOrders.length,
      cancelledCount: cancelledOrders.length,
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
  // ORDER ACTIONS (CRUD)
  // -----------------------------------------------------------
  const handleStatusChange = (orderRef: string, nextStatus: OrderRecord['status']) => {
    updateOrderStatus(orderRef, nextStatus);
    setOrders(getAllOrdersAdmin());
  };

  const handleDeleteOrder = (orderRef: string) => {
    if (window.confirm(`Are you sure you want to permanently delete order ${orderRef}?`)) {
      deleteOrder(orderRef);
      setOrders(getAllOrdersAdmin());
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
                  <span>Gross Sales</span>
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="mt-2 text-xl sm:text-2xl font-black text-[#241A18]">
                  {formatPrice(metrics.totalRevenueLKR, currency)}
                </div>
                <div className="text-[11px] text-[#8A7970] mt-0.5">
                  Across all active orders
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#E8DFC8] shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold text-[#7A6458] uppercase">
                  <span>In Kitchen Queue</span>
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div className="mt-2 text-xl sm:text-2xl font-black text-[#8C102A]">
                  {metrics.preparingCount} orders
                </div>
                <div className="text-[11px] text-[#8A7970] mt-0.5">
                  Being churned & prepared
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#E8DFC8] shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold text-[#7A6458] uppercase">
                  <span>Delivered / Picked</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="mt-2 text-xl sm:text-2xl font-black text-emerald-700">
                  {metrics.deliveredCount} orders
                </div>
                <div className="text-[11px] text-[#8A7970] mt-0.5">
                  Successfully completed
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
                  {metrics.cancelledCount} cancelled
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
                      <th className="px-4 py-3">Items Summary</th>
                      <th className="px-4 py-3">Total & Payment</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFE8DC]">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-[#8A7970]">
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

                            {/* Items */}
                            <td className="px-4 py-3 align-top">
                              <div className="space-y-1 max-w-[200px]">
                                {order.items.slice(0, 3).map((item, idx) => (
                                  <div key={idx} className="text-[11px] text-[#3D2C24] truncate">
                                    <span className="font-bold text-[#8C102A]">{item.quantity}x</span>{' '}
                                    {item.name}{' '}
                                    {item.format && (
                                      <span className="text-[9px] text-[#7A6458]">
                                        ({item.format.replace('-', ' ')})
                                      </span>
                                    )}
                                  </div>
                                ))}
                                {order.items.length > 3 && (
                                  <span className="text-[10px] text-[#8C102A] font-bold">
                                    +{order.items.length - 3} more items
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Total & Payment Method */}
                            <td className="px-4 py-3 align-top">
                              <span className="font-bold text-sm text-[#241A18] block">
                                {formatPrice(order.grandTotalLKR, currency)}
                              </span>
                              <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white border border-[#D9CBB7] text-[#5D4E46]">
                                {order.paymentMethod === 'card' ? '💳 Card' : '💵 Cash/COD'}
                              </span>
                            </td>

                            {/* Status Changer */}
                            <td className="px-4 py-3 align-top">
                              <select
                                value={order.status}
                                onChange={(e) =>
                                  handleStatusChange(
                                    order.orderReference,
                                    e.target.value as OrderRecord['status']
                                  )
                                }
                                className={`text-xs font-bold px-2.5 py-1 rounded-lg border focus:outline-hidden cursor-pointer ${
                                  isCancelled
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : isDelivered
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : isPreparing
                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                    : 'bg-blue-50 text-blue-700 border-blue-200'
                                }`}
                              >
                                <option value="pending_confirmation">Pending Confirmation</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="preparing">In Kitchen (Preparing)</option>
                                <option value="delivered">Delivered / Completed</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
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

                                {/* Delete Order */}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteOrder(order.orderReference)}
                                  className="p-1.5 rounded-lg text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors cursor-pointer"
                                  title="Delete Order Record"
                                >
                                  <Trash2 className="w-4 h-4" />
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
                    ≈ ${convertLKRtoUSD(metrics.totalRevenueLKR).toFixed(2)} USD
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
    </div>
  );
};

