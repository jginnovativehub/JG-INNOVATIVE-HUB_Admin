import React, { useState, useMemo } from 'react';
import { exportToExcel } from '@/utils/exportToExcel';
import { Eye, MoreVertical, RefreshCw, CreditCard, Download } from 'lucide-react';
import SearchBar from '@/components/admin/SearchBar';
import Table from '@/components/admin/Table';
import Pagination from '@/components/admin/Pagination';
import StatusBadge, { getStatusVariant } from '@/components/admin/StatusBadge';
import Modal from '@/components/admin/Modal';
import { formatCurrency } from '@/utils/gstCalculator';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, OrderStatus, PaymentStatus } from '@/utils/constants';
import { useAdminData } from '@/context/AdminDataContext';
import { Order, ordersApi } from '@/services/adminApi';
import { cn } from '@/lib/utils';

const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];

const PAYMENT_STATUSES: PaymentStatus[] = ['paid', 'unpaid', 'failed'];

const Orders: React.FC = () => {
  const { state, updateOrderStatus, updatePaymentStatus, updateTracking, refreshData } = useAdminData();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [isPlatformModalOpen, setIsPlatformModalOpen] = useState(false);
  const [trackingForm, setTrackingForm] = useState({ trackingLink: '', trackingMessage: '' });
  const [platformInput, setPlatformInput] = useState('');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isUpdating, setIsUpdating] = useState(false);

  const pageSize = 10;

  // Filter orders
  const filteredOrders = useMemo(() => {
    return state.orders
      .filter((order) => {
        const matchesSearch =
          order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          order.customerName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = filterStatus === 'all' || order.orderStatus === filterStatus;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [state.orders, searchQuery, filterStatus]);

  const totalPages = Math.ceil(filteredOrders.length / pageSize);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    if (activeDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [activeDropdown]);

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setIsViewModalOpen(true);
    setActiveDropdown(null);
  };

  const handleUpdateStatus = (order: Order) => {
    setSelectedOrder(order);
    setIsStatusModalOpen(true);
    setActiveDropdown(null);
  };

  const handleUpdatePayment = (order: Order) => {
    setSelectedOrder(order);
    setIsPaymentModalOpen(true);
    setActiveDropdown(null);
  };

  const handleUpdateTracking = (order: Order) => {
    setSelectedOrder(order);
    setTrackingForm({
      trackingLink: order.trackingLink || '',
      trackingMessage: order.trackingMessage || '',
    });
    setIsTrackingModalOpen(true);
    setActiveDropdown(null);
  };

  const handleUpdatePlatform = (order: Order) => {
    setSelectedOrder(order);
    setPlatformInput(order.deliveryPlatform || '');
    setIsPlatformModalOpen(true);
    setActiveDropdown(null);
  };

  const handlePlatformSave = async () => {
    if (!selectedOrder) return;
    setIsUpdating(true);
    try {
      await ordersApi.updateDeliveryPlatform(selectedOrder.id, platformInput.trim());
      await refreshData();
      setIsPlatformModalOpen(false);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!selectedOrder) return;
    setIsUpdating(true);
    await updateOrderStatus(selectedOrder.id, newStatus);
    setIsUpdating(false);
    setIsStatusModalOpen(false);
  };

  const handlePaymentChange = async (newStatus: PaymentStatus) => {
    if (!selectedOrder) return;
    setIsUpdating(true);
    await updatePaymentStatus(selectedOrder.id, newStatus);
    setIsUpdating(false);
    setIsPaymentModalOpen(false);
  };

  const handleTrackingSave = async () => {
    if (!selectedOrder) return;
    setIsUpdating(true);
    await updateTracking(selectedOrder.id, trackingForm);
    setIsUpdating(false);
    setIsTrackingModalOpen(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get product name from products list
  const getProductName = (productId: string) => {
    const product = state.products.find(p => p.id === productId);
    return product?.name || productId;
  };

  const columns = [
    {
      key: 'id',
      header: 'Order ID',
      render: (order: Order) => (
        <span className="font-medium text-foreground">{order.id}</span>
      ),
    },
    {
      key: 'customerName',
      header: 'Customer Name',
      render: (order: Order) => (
        <span className="text-foreground">{order.customerName}</span>
      ),
    },
    {
      key: 'mobileNumber',
      header: 'Mobile Number',
      render: (order: Order) => (
        <span className="text-muted-foreground">{order.deliveryMobileNumber || order.address?.mobile || '—'}</span>
      ),
    },
    {
      key: 'deliveryMethod',
      header: 'Delivery Method',
      render: (order: Order) => (
        <span className="text-sm">{order.deliveryMethod === 'manual' ? 'Manual Agreement' : 'Default'}</span>
      ),
    },
    {
      key: 'deliveryCharge',
      header: 'Delivery Charge',
      render: (order: Order) => (
        <span className="text-muted-foreground">{formatCurrency(order.deliveryCharge ?? 0)}</span>
      ),
    },
    {
      key: 'agreementStatus',
      header: 'Agreement Status',
      render: (order: Order) => (
        order.deliveryMethod === 'manual' ? (
          <StatusBadge variant="success">Manual Agreement Accepted</StatusBadge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      ),
    },
    {
      key: 'deliveryStatus',
      header: 'Delivery Status',
      render: (order: Order) => (
        <span className="text-sm text-muted-foreground capitalize">{order.deliveryStatus || 'pending'}</span>
      ),
    },
    {
      key: 'deliveryPlatform',
      header: 'Delivery Platform',
      render: (order: Order) => (
        <span className="text-sm text-muted-foreground">{order.deliveryPlatform || '—'}</span>
      ),
    },
    {
      key: 'itemsCount',
      header: 'Items',
      render: (order: Order) => (
        <span className="text-muted-foreground">{order.itemsCount} items</span>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      render: (order: Order) => (
        <span className="font-medium">{formatCurrency(order.totalAmount)}</span>
      ),
    },
    {
      key: 'paymentStatus',
      header: 'Payment',
      render: (order: Order) => (
        <StatusBadge variant={getStatusVariant(order.paymentStatus)}>
          {PAYMENT_STATUS_LABELS[order.paymentStatus]}
        </StatusBadge>
      ),
    },
    {
      key: 'orderStatus',
      header: 'Status',
      render: (order: Order) => (
        <StatusBadge variant={getStatusVariant(order.orderStatus)}>
          {ORDER_STATUS_LABELS[order.orderStatus]}
        </StatusBadge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (order: Order) => (
        <span className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (order: Order) => (
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveDropdown(activeDropdown === order.id ? null : order.id);
            }}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <MoreVertical className="w-4 h-4 text-muted-foreground" />
          </button>

          {activeDropdown === order.id && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-lg shadow-elevated z-10 animate-scale-in">
              <button
                onClick={() => handleViewOrder(order)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              >
                <Eye className="w-4 h-4" />
                Quick View
              </button>
              <button
                onClick={() => handleUpdateStatus(order)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Update Status
              </button>
              <button
                onClick={() => handleUpdatePayment(order)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                Update Payment
              </button>
              <button
                onClick={() => handleUpdateTracking(order)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Update Tracking
              </button>
              <button
                onClick={() => handleUpdatePlatform(order)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                Set Delivery Platform
              </button>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header">Orders</h1>
          <p className="page-description">
            Manage and track customer orders • {state.orders.length} total
          </p>
        </div>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto items-stretch sm:items-center gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input-field w-full sm:w-40"
          >
            <option value="all">All Status</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {ORDER_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <button onClick={() => exportToExcel(state.orders || [], 'orders')} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"><Download className="w-4 h-4" /> Export to Excel</button>
            <SearchBar
            placeholder="Search by ID or customer..."
            value={searchQuery}
            onChange={setSearchQuery}
            className="w-full sm:w-72"
          />
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Orders</p>
          <p className="text-2xl font-bold text-foreground">{state.orders.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold text-warning">
            {state.orders.filter(o => o.orderStatus === 'pending').length}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Processing</p>
          <p className="text-2xl font-bold text-info">
            {state.orders.filter(o => o.orderStatus === 'processing').length}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Shipped</p>
          <p className="text-2xl font-bold text-primary">
            {state.orders.filter(o => o.orderStatus === 'shipped').length}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Delivered</p>
          <p className="text-2xl font-bold text-success">
            {state.orders.filter(o => o.orderStatus === 'delivered').length}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Revenue</p>
          <p className="text-2xl font-bold text-success">
            {formatCurrency(state.orders.filter(o => o.paymentStatus === 'paid').reduce((sum, o) => sum + o.totalAmount, 0))}
          </p>
        </div>
      </div>

      {/* Orders Table */}
      <div className="overflow-x-auto">
        <Table
          columns={columns}
          data={paginatedOrders}
          keyExtractor={(order) => order.id}
          emptyMessage="No orders found"
        />
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* View Order Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="Order Details"
        size="lg"
      >
        {selectedOrder && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-foreground">{selectedOrder.id}</h3>
                <p className="text-muted-foreground">{formatDate(selectedOrder.createdAt)}</p>
              </div>
              <div className="flex gap-2">
                <StatusBadge variant={getStatusVariant(selectedOrder.paymentStatus)}>
                  {PAYMENT_STATUS_LABELS[selectedOrder.paymentStatus]}
                </StatusBadge>
                <StatusBadge variant={getStatusVariant(selectedOrder.orderStatus)}>
                  {ORDER_STATUS_LABELS[selectedOrder.orderStatus]}
                </StatusBadge>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Customer</p>
                <p className="font-medium text-foreground">{selectedOrder.customerName}</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Mobile Number</p>
                <p className="font-medium text-foreground">{selectedOrder.deliveryMobileNumber || selectedOrder.address?.mobile || '—'}</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="font-medium text-foreground">
                  {formatCurrency(selectedOrder.totalAmount)}
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Delivery</p>
                <p className="font-medium text-foreground">{selectedOrder.deliveryMethod === 'manual' ? 'Manual Agreement' : 'Default'} • {formatCurrency(selectedOrder.deliveryCharge ?? 0)}</p>
                {selectedOrder.deliveryMethod === 'manual' && selectedOrder.deliveryAgreement && (
                  <StatusBadge variant="success" className="mt-1">Manual Agreement Accepted</StatusBadge>
                )}
                <p className="text-xs text-muted-foreground mt-1">Status: {selectedOrder.deliveryStatus || 'pending'} • Platform: {selectedOrder.deliveryPlatform || '—'}</p>
              </div>
            </div>

            {selectedOrder.address && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Delivery Address</p>
                <p className="font-medium text-foreground">{selectedOrder.address.fullName}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedOrder.address.addressLine1} {selectedOrder.address.addressLine2}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedOrder.address.city}, {selectedOrder.address.state} - {selectedOrder.address.pincode}
                </p>
                <p className="text-sm text-muted-foreground">{selectedOrder.address.mobile}</p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-foreground mb-3">Order Items</p>
              <div className="space-y-2">
                {selectedOrder.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {getProductName(item.productId)}
                      </p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-medium">{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  handleUpdateStatus(selectedOrder);
                }}
                className="flex-1 py-2 rounded-lg font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                Update Status
              </button>
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  handleUpdatePayment(selectedOrder);
                }}
                className="flex-1 py-2 rounded-lg font-medium bg-info/10 text-info hover:bg-info/20 transition-colors"
              >
                Update Payment
              </button>
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  handleUpdateTracking(selectedOrder);
                }}
                className="flex-1 py-2 rounded-lg font-medium bg-muted/50 text-foreground hover:bg-muted transition-colors"
              >
                Update Tracking
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Update Status Modal */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title="Update Order Status"
        size="sm"
      >
        {selectedOrder && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Update status for order <strong>{selectedOrder.id}</strong>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ORDER_STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  disabled={isUpdating}
                  className={cn(
                    'p-3 rounded-lg text-sm font-medium transition-colors border disabled:opacity-50',
                    selectedOrder.orderStatus === status
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/50 text-foreground border-border hover:bg-muted'
                  )}
                >
                  {ORDER_STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Update Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Update Payment Status"
        size="sm"
      >
        {selectedOrder && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Update payment status for order <strong>{selectedOrder.id}</strong>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {PAYMENT_STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={() => handlePaymentChange(status)}
                  disabled={isUpdating}
                  className={cn(
                    'p-3 rounded-lg text-sm font-medium transition-colors border disabled:opacity-50',
                    selectedOrder.paymentStatus === status
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/50 text-foreground border-border hover:bg-muted'
                  )}
                >
                  {PAYMENT_STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Update Tracking Modal */}
      <Modal
        isOpen={isTrackingModalOpen}
        onClose={() => setIsTrackingModalOpen(false)}
        title="Update Tracking"
        size="sm"
      >
        {selectedOrder && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Update tracking details for order <strong>{selectedOrder.id}</strong>
            </p>
            <div className="space-y-3">
              <input
                value={trackingForm.trackingLink}
                onChange={(e) => setTrackingForm({ ...trackingForm, trackingLink: e.target.value })}
                placeholder="Tracking link"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background"
              />
              <textarea
                value={trackingForm.trackingMessage}
                onChange={(e) => setTrackingForm({ ...trackingForm, trackingMessage: e.target.value })}
                placeholder="Tracking message"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                rows={3}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setIsTrackingModalOpen(false)}
                className="flex-1 py-2 rounded-lg font-medium bg-muted/50 text-foreground hover:bg-muted transition-colors"
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button
                onClick={handleTrackingSave}
                className="flex-1 py-2 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                disabled={isUpdating}
              >
                Save
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Set Delivery Platform Modal */}
      <Modal
        isOpen={isPlatformModalOpen}
        onClose={() => setIsPlatformModalOpen(false)}
        title="Set Delivery Platform"
        size="sm"
      >
        {selectedOrder && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Assign delivery platform for order <strong>{selectedOrder.id}</strong>
            </p>
            <input
              value={platformInput}
              onChange={(e) => setPlatformInput(e.target.value)}
              placeholder="e.g. Shiprocket, Manual"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setIsPlatformModalOpen(false)}
                className="flex-1 py-2 rounded-lg font-medium bg-muted/50 text-foreground hover:bg-muted transition-colors"
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button
                onClick={handlePlatformSave}
                className="flex-1 py-2 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                disabled={isUpdating}
              >
                Save
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Orders;
