import React, { useState, useMemo } from 'react';
import { exportToExcel } from '@/utils/exportToExcel';
import { CreditCard, Eye, Download } from 'lucide-react';
import SearchBar from '@/components/admin/SearchBar';
import Table from '@/components/admin/Table';
import Pagination from '@/components/admin/Pagination';
import StatusBadge, { getStatusVariant } from '@/components/admin/StatusBadge';
import Modal from '@/components/admin/Modal';
import { formatCurrency } from '@/utils/gstCalculator';
import { useAdminData } from '@/context/AdminDataContext';
import { Payment } from '@/services/adminApi';

const Payments: React.FC = () => {
  const { state } = useAdminData();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const pageSize = 10;

  // Filter payments
  const filteredPayments = useMemo(() => {
    return state.payments.filter((payment) => {
      const matchesSearch =
        payment.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.transactionId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === 'all' || payment.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [state.payments, searchQuery, filterStatus]);

  const totalPages = Math.ceil(filteredPayments.length / pageSize);
  const paginatedPayments = filteredPayments.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus]);

  const handleViewPayment = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsViewModalOpen(true);
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

  const getPaymentStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      success: 'Success',
      pending: 'Pending',
      failed: 'Failed',
    };
    return labels[status] || status;
  };

  const columns = [
    {
      key: 'id',
      header: 'Payment ID',
      render: (payment: Payment) => (
        <span className="font-medium text-foreground">{payment.id}</span>
      ),
    },
    {
      key: 'orderId',
      header: 'Order ID',
      render: (payment: Payment) => (
        <span className="text-primary hover:underline cursor-pointer">{payment.orderId}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (payment: Payment) => (
        <span className="font-medium">{formatCurrency(payment.amount)}</span>
      ),
    },
    {
      key: 'method',
      header: 'Method',
      render: (payment: Payment) => (
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">{payment.method}</span>
        </div>
      ),
    },
    {
      key: 'transactionId',
      header: 'Transaction ID',
      render: (payment: Payment) => (
        <span className="text-sm text-muted-foreground font-mono">{payment.transactionId}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (payment: Payment) => (
        <StatusBadge variant={getStatusVariant(payment.status)}>
          {getPaymentStatusLabel(payment.status)}
        </StatusBadge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (payment: Payment) => (
        <span className="text-sm text-muted-foreground">{formatDate(payment.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (payment: Payment) => (
        <button
          onClick={() => handleViewPayment(payment)}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <Eye className="w-4 h-4 text-muted-foreground" />
        </button>
      ),
    },
  ];

  // Calculate totals from context
  const totalSuccessful = filteredPayments
    .filter((p) => p.status === 'success')
    .reduce((sum, p) => sum + p.amount, 0);
  const totalFailed = filteredPayments
    .filter((p) => p.status === 'failed')
    .reduce((sum, p) => sum + p.amount, 0);
  const totalPending = filteredPayments
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header">Payments</h1>
          <p className="page-description">
            Track all payment transactions • {state.payments.length} total
          </p>
        </div>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto items-stretch sm:items-center gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input-field w-full sm:w-36"
          >
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <button onClick={() => exportToExcel(state.payments || [], 'payments')} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"><Download className="w-4 h-4" /> Export to Excel</button>
            <SearchBar
            placeholder="Search payments..."
            value={searchQuery}
            onChange={setSearchQuery}
            className="w-full sm:w-72"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Transactions</p>
          <p className="text-2xl font-bold text-foreground">{filteredPayments.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Successful Payments</p>
          <p className="text-2xl font-bold text-success">{formatCurrency(totalSuccessful)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Pending Payments</p>
          <p className="text-2xl font-bold text-warning">{formatCurrency(totalPending)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Failed Payments</p>
          <p className="text-2xl font-bold text-destructive">{formatCurrency(totalFailed)}</p>
        </div>
      </div>

      {/* Payments Table */}
      <div className="overflow-x-auto">
        <Table
          columns={columns}
          data={paginatedPayments}
          keyExtractor={(payment) => payment.id}
          emptyMessage="No payments found"
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

      {/* View Payment Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="Payment Details"
        size="md"
      >
        {selectedPayment && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-foreground">{selectedPayment.id}</h3>
                <p className="text-muted-foreground">{formatDate(selectedPayment.createdAt)}</p>
              </div>
              <StatusBadge variant={getStatusVariant(selectedPayment.status)}>
                {getPaymentStatusLabel(selectedPayment.status)}
              </StatusBadge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Order ID</p>
                <p className="font-medium text-foreground">{selectedPayment.orderId}</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="font-medium text-foreground">
                  {formatCurrency(selectedPayment.amount)}
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Payment Method</p>
                <p className="font-medium text-foreground">{selectedPayment.method}</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Transaction ID</p>
                <p className="font-medium text-foreground font-mono text-sm">
                  {selectedPayment.transactionId}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Payments;
