import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { exportToExcel } from '@/utils/exportToExcel';
import { Edit3, Plus, Trash2, Upload, Download } from 'lucide-react';
import SearchBar from '@/components/admin/SearchBar';
import Table from '@/components/admin/Table';
import Pagination from '@/components/admin/Pagination';
import Modal from '@/components/admin/Modal';
import StatusBadge, { getStatusVariant } from '@/components/admin/StatusBadge';
import { formatCurrency } from '@/utils/gstCalculator';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, TimePeriod, TIME_PERIOD_LABELS } from '@/utils/constants';

/** Includes "all" so past/future order dates are not hidden by month/year filters */
type OfflineListPeriod = 'all' | TimePeriod;
import { cn } from '@/lib/utils';
import { OfflineOrder, offlineOrdersApi, productsApi } from '@/services/adminApi';
import { useToast } from '@/hooks/use-toast';

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
const PAYMENT_STATUSES = ['paid', 'unpaid', 'failed'] as const;
const OFFLINE_ORDER_DRAFT_KEY = 'admin_offline_order_draft_v1';

const getDateTimeLocal = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

type FormState = {
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  totalAmount: string;
  profitAmount: string;
  paymentStatus: 'paid' | 'unpaid' | 'failed';
  orderStatus: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  orderDate: string;
  deliveredAt: string;
  billImageUrl: string;
  billPdfUrl: string;
  billDocUrl: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  invoiceNumber: '',
  customerName: '',
  customerPhone: '',
  totalAmount: '',
  profitAmount: '',
  paymentStatus: 'paid',
  orderStatus: 'delivered',
  orderDate: getDateTimeLocal(new Date().toISOString()),
  deliveredAt: '',
  billImageUrl: '',
  billPdfUrl: '',
  billDocUrl: '',
  notes: '',
});

const OfflineOrdersPage: React.FC = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<OfflineOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<OfflineListPeriod>('all');
  const [customYear, setCustomYear] = useState<number>(new Date().getFullYear());
  const [currentPage, setCurrentPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OfflineOrder | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [exportingId, setExportingId] = useState<string | null>(null);

  const pageSize = 10;

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await offlineOrdersApi.getAll({
        search: searchQuery || undefined,
        status: filterStatus !== 'all' ? filterStatus : undefined,
        period: selectedPeriod === 'all' ? undefined : selectedPeriod,
        year: selectedPeriod === 'custom-year' ? customYear : undefined,
      });
      setOrders(data);
    } catch (error) {
      toast({ title: 'Error', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [customYear, filterStatus, searchQuery, selectedPeriod, toast]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders, selectedPeriod, customYear, filterStatus]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, selectedPeriod, customYear]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const search = searchQuery.toLowerCase();
      return (
        order.invoiceNumber.toLowerCase().includes(search) ||
        order.customerName.toLowerCase().includes(search) ||
        (order.customerPhone || '').toLowerCase().includes(search)
      );
    });
  }, [orders, searchQuery]);

  const summary = useMemo(() => {
    const total = filteredOrders.length;
    const delivered = filteredOrders.filter((o) => o.orderStatus === 'delivered').length;
    const revenue = filteredOrders
      .filter((o) => o.orderStatus === 'delivered')
      .reduce((sum, o) => sum + o.totalAmount, 0);
    const profit = filteredOrders
      .filter((o) => o.orderStatus === 'delivered')
      .reduce((sum, o) => sum + (o.profitAmount || 0), 0);
    return { total, delivered, revenue, profit };
  }, [filteredOrders]);

  const totalPages = Math.ceil(filteredOrders.length / pageSize);
  const paginated = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const openCreate = () => {
    setEditingOrder(null);
    try {
      const draft = localStorage.getItem(OFFLINE_ORDER_DRAFT_KEY);
      if (draft) {
        const parsed = JSON.parse(draft) as Partial<FormState>;
        setForm({ ...emptyForm(), ...parsed });
      } else {
        setForm(emptyForm());
      }
    } catch {
      setForm(emptyForm());
    }
    setIsFormOpen(true);
  };

  const openEdit = (order: OfflineOrder) => {
    setEditingOrder(order);
    setForm({
      invoiceNumber: order.invoiceNumber || '',
      customerName: order.customerName || '',
      customerPhone: order.customerPhone || '',
      totalAmount: String(order.totalAmount || ''),
      profitAmount: String(order.profitAmount || ''),
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      orderDate: getDateTimeLocal(order.orderDate || order.createdAt),
      deliveredAt: getDateTimeLocal(order.deliveredAt),
      billImageUrl: order.billImageUrl || '',
      billPdfUrl: order.billPdfUrl || '',
      billDocUrl: order.billDocUrl || '',
      notes: order.notes || '',
    });
    setIsFormOpen(true);
  };

  const handleUploadBill = async (file: File) => {
    setSubmitting(true);
    try {
      const url = await productsApi.uploadImage(file);
      setForm((prev) => ({ ...prev, billImageUrl: url }));
      toast({ title: 'Bill Uploaded', description: 'Bill image uploaded successfully' });
    } catch (error) {
      toast({ title: 'Upload Failed', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadBillPdf = async (file: File) => {
    setSubmitting(true);
    try {
      const url = await offlineOrdersApi.uploadBillPdf(file);
      setForm((prev) => ({ ...prev, billPdfUrl: url }));
      toast({ title: 'PDF uploaded', description: 'Bill PDF saved' });
    } catch (error) {
      toast({ title: 'Upload failed', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadBillDoc = async (file: File) => {
    setSubmitting(true);
    try {
      const url = await offlineOrdersApi.uploadBillDoc(file);
      setForm((prev) => ({ ...prev, billDocUrl: url }));
      toast({ title: 'Document uploaded', description: 'Word bill saved' });
    } catch (error) {
      toast({ title: 'Upload failed', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSave = async () => {
    const inv = (form.invoiceNumber ?? '').trim();
    const name = (form.customerName ?? '').trim();
    const amt = (form.totalAmount ?? '').trim();
    if (!inv || !name || !amt) {
      toast({ title: 'Required Fields', description: 'Invoice, customer, and total amount are required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        invoiceNumber: inv,
        customerName: name,
        customerPhone: (form.customerPhone ?? '').trim(),
        totalAmount: Number(form.totalAmount) || 0,
        profitAmount: Number(form.profitAmount) || 0,
        paymentStatus: form.paymentStatus,
        orderStatus: form.orderStatus,
        orderDate: form.orderDate ? new Date(form.orderDate).toISOString() : new Date().toISOString(),
        deliveredAt: form.deliveredAt ? new Date(form.deliveredAt).toISOString() : undefined,
        billImageUrl: (form.billImageUrl ?? '').trim(),
        billPdfUrl: (form.billPdfUrl ?? '').trim(),
        billDocUrl: (form.billDocUrl ?? '').trim(),
        notes: (form.notes ?? '').trim(),
      };

      if (editingOrder) {
        await offlineOrdersApi.update(editingOrder.id, payload);
        toast({ title: 'Updated', description: 'Offline order updated successfully' });
      } else {
        await offlineOrdersApi.create(payload);
        localStorage.removeItem(OFFLINE_ORDER_DRAFT_KEY);
        toast({ title: 'Created', description: 'Offline order created successfully' });
      }
      setIsFormOpen(false);
      await loadOrders();
    } catch (error) {
      toast({ title: 'Save Failed', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportBill = async (order: OfflineOrder, format: 'pdf' | 'doc') => {
    setExportingId(order.id);
    try {
      await offlineOrdersApi.downloadBill(order.id, format);
    } catch (error) {
      toast({ title: 'Export failed', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setExportingId(null);
    }
  };

  const handleDownloadUploaded = async (
    order: OfflineOrder,
    type: 'image' | 'pdf' | 'doc'
  ) => {
    setExportingId(order.id);
    try {
      await offlineOrdersApi.downloadUploadedBill(order.id, type);
    } catch (error) {
      toast({ title: 'Download failed', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setExportingId(null);
    }
  };

  const handleDelete = async (order: OfflineOrder) => {
    const ok = window.confirm(`Delete offline order ${order.invoiceNumber}?`);
    if (!ok) return;
    try {
      await offlineOrdersApi.delete(order.id);
      toast({ title: 'Deleted', description: 'Offline order deleted successfully' });
      await loadOrders();
    } catch (error) {
      toast({ title: 'Delete Failed', description: (error as Error).message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (!isFormOpen || editingOrder) return;
    localStorage.setItem(OFFLINE_ORDER_DRAFT_KEY, JSON.stringify(form));
  }, [form, isFormOpen, editingOrder]);

  const formatDate = (value?: string) => {
    if (!value) return '—';
    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const columns = [
    { key: 'invoiceNumber', header: 'Invoice', render: (o: OfflineOrder) => <span className="font-medium">{o.invoiceNumber}</span> },
    { key: 'customerName', header: 'Customer', render: (o: OfflineOrder) => <span>{o.customerName}</span> },
    { key: 'totalAmount', header: 'Amount', render: (o: OfflineOrder) => <span className="font-medium">{formatCurrency(o.totalAmount)}</span> },
    { key: 'profitAmount', header: 'Profit', render: (o: OfflineOrder) => <span>{formatCurrency(o.profitAmount || 0)}</span> },
    {
      key: 'paymentStatus',
      header: 'Payment',
      render: (o: OfflineOrder) => <StatusBadge variant={getStatusVariant(o.paymentStatus)}>{PAYMENT_STATUS_LABELS[o.paymentStatus]}</StatusBadge>,
    },
    {
      key: 'orderStatus',
      header: 'Status',
      render: (o: OfflineOrder) => <StatusBadge variant={getStatusVariant(o.orderStatus)}>{ORDER_STATUS_LABELS[o.orderStatus]}</StatusBadge>,
    },
    { key: 'orderDate', header: 'Date & Time', render: (o: OfflineOrder) => <span className="text-sm text-muted-foreground">{formatDate(o.orderDate)}</span> },
    {
      key: 'billImageUrl',
      header: 'Bill',
      render: (o: OfflineOrder) => (
        <div className="flex flex-col gap-1.5 min-w-[9rem]">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Generated</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <button
              type="button"
              className="text-primary font-medium hover:underline disabled:opacity-50"
              disabled={exportingId === o.id}
              onClick={() => handleExportBill(o, 'pdf')}
            >
              PDF
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              type="button"
              className="text-primary font-medium hover:underline disabled:opacity-50"
              disabled={exportingId === o.id}
              onClick={() => handleExportBill(o, 'doc')}
            >
              DOC
            </button>
          </div>
          {(o.billImageUrl || o.billPdfUrl || o.billDocUrl) ? (
            <div className="flex flex-col gap-0.5 text-xs">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Uploaded</span>
              {o.billImageUrl ? (
                <button
                  type="button"
                  className="text-left text-muted-foreground hover:text-primary hover:underline truncate max-w-[10rem] disabled:opacity-50"
                  title={o.billImageUrl}
                  disabled={exportingId === o.id}
                  onClick={() => handleDownloadUploaded(o, 'image')}
                >
                  Image
                </button>
              ) : null}
              {o.billPdfUrl ? (
                <button
                  type="button"
                  className="text-left text-muted-foreground hover:text-primary hover:underline truncate max-w-[10rem] disabled:opacity-50"
                  title={o.billPdfUrl}
                  disabled={exportingId === o.id}
                  onClick={() => handleDownloadUploaded(o, 'pdf')}
                >
                  PDF file
                </button>
              ) : null}
              {o.billDocUrl ? (
                <button
                  type="button"
                  className="text-left text-muted-foreground hover:text-primary hover:underline truncate max-w-[10rem] disabled:opacity-50"
                  title={o.billDocUrl}
                  disabled={exportingId === o.id}
                  onClick={() => handleDownloadUploaded(o, 'doc')}
                >
                  Word file
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (o: OfflineOrder) => (
        <div className="flex items-center gap-1">
          <button onClick={() => openEdit(o)} className="p-2 rounded-lg hover:bg-muted transition-colors" title="Edit">
            <Edit3 className="w-4 h-4" />
          </button>
          <button onClick={() => handleDelete(o)} className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="page-header">Offline Orders</h1>
          <p className="page-description">
            Manage offline invoices, delivery status, revenue and profit. The list defaults to all dates so past or future order dates always appear; use Today, This Month, or Custom Year to filter.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-muted rounded-lg">
            <button
              type="button"
              onClick={() => setSelectedPeriod('all')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                selectedPeriod === 'all'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              All dates
            </button>
            {(Object.entries(TIME_PERIOD_LABELS) as [TimePeriod, string][]).map(([key, label]) => (
              <button
                type="button"
                key={key}
                onClick={() => setSelectedPeriod(key)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  selectedPeriod === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {selectedPeriod === 'custom-year' && (
            <input
              type="number"
              min="2000"
              max={new Date().getFullYear()}
              value={customYear}
              onChange={(e) => setCustomYear(Number(e.target.value) || new Date().getFullYear())}
              className="input-field w-28"
            />
          )}
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Offline Order
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="stat-card"><p className="text-sm text-muted-foreground">Total Offline Orders</p><p className="text-2xl font-bold">{summary.total}</p></div>
        <div className="stat-card"><p className="text-sm text-muted-foreground">Delivered</p><p className="text-2xl font-bold text-success">{summary.delivered}</p></div>
        <div className="stat-card"><p className="text-sm text-muted-foreground">Revenue</p><p className="text-2xl font-bold text-success">{formatCurrency(summary.revenue)}</p></div>
        <div className="stat-card"><p className="text-sm text-muted-foreground">Profit</p><p className="text-2xl font-bold text-primary">{formatCurrency(summary.profit)}</p></div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-field sm:w-48">
          <option value="all">All Status</option>
          {ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>{ORDER_STATUS_LABELS[status]}</option>
          ))}
        </select>
        <button onClick={() => exportToExcel(state.offlineOrders || [], 'offlineOrders')} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"><Download className="w-4 h-4" /> Export to Excel</button>
            <SearchBar placeholder="Search invoice, customer, phone…" value={searchQuery} onChange={setSearchQuery} className="sm:w-80" />
      </div>

      <div className="overflow-x-auto">
        <Table columns={columns} data={paginated} keyExtractor={(row) => row.id} emptyMessage={loading ? 'Loading...' : 'No offline orders found'} />
      </div>
      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      )}

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingOrder ? 'Edit Offline Order' : 'Add Offline Order'}
        size="lg"
        closeOnBackdrop={false}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className="input-field" placeholder="Invoice Number *" value={form.invoiceNumber} onChange={(e) => setForm((p) => ({ ...p, invoiceNumber: e.target.value }))} />
            <input className="input-field" placeholder="Customer Name *" value={form.customerName} onChange={(e) => setForm((p) => ({ ...p, customerName: e.target.value }))} />
            <input className="input-field" placeholder="Customer Phone" value={form.customerPhone} onChange={(e) => setForm((p) => ({ ...p, customerPhone: e.target.value }))} />
            <input className="input-field" type="number" min="0" step="0.01" placeholder="Total Amount *" value={form.totalAmount} onChange={(e) => setForm((p) => ({ ...p, totalAmount: e.target.value }))} />
            <input className="input-field" type="number" min="0" step="0.01" placeholder="Profit Amount" value={form.profitAmount} onChange={(e) => setForm((p) => ({ ...p, profitAmount: e.target.value }))} />
            <select className="input-field" value={form.paymentStatus} onChange={(e) => setForm((p) => ({ ...p, paymentStatus: e.target.value as FormState['paymentStatus'] }))}>
              {PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{PAYMENT_STATUS_LABELS[status]}</option>)}
            </select>
            <select className="input-field" value={form.orderStatus} onChange={(e) => setForm((p) => ({ ...p, orderStatus: e.target.value as FormState['orderStatus'] }))}>
              {ORDER_STATUSES.map((status) => <option key={status} value={status}>{ORDER_STATUS_LABELS[status]}</option>)}
            </select>
            <input className="input-field" type="datetime-local" value={form.orderDate} onChange={(e) => setForm((p) => ({ ...p, orderDate: e.target.value }))} />
            <input className="input-field" type="datetime-local" value={form.deliveredAt} onChange={(e) => setForm((p) => ({ ...p, deliveredAt: e.target.value }))} />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Attachments (optional)</p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <input
                className="input-field flex-1"
                placeholder="Bill image URL (optional)"
                value={form.billImageUrl}
                onChange={(e) => setForm((p) => ({ ...p, billImageUrl: e.target.value }))}
              />
              <label className="btn-secondary cursor-pointer inline-flex items-center gap-2 shrink-0">
                <Upload className="w-4 h-4" />
                Image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadBill(file);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <input
                className="input-field flex-1"
                placeholder="Bill PDF URL (optional)"
                value={form.billPdfUrl}
                onChange={(e) => setForm((p) => ({ ...p, billPdfUrl: e.target.value }))}
              />
              <label className="btn-secondary cursor-pointer inline-flex items-center gap-2 shrink-0">
                <Upload className="w-4 h-4" />
                PDF
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadBillPdf(file);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <input
                className="input-field flex-1"
                placeholder="Bill Word URL (optional)"
                value={form.billDocUrl}
                onChange={(e) => setForm((p) => ({ ...p, billDocUrl: e.target.value }))}
              />
              <label className="btn-secondary cursor-pointer inline-flex items-center gap-2 shrink-0">
                <Upload className="w-4 h-4" />
                DOC
                <input
                  type="file"
                  accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadBillDoc(file);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <textarea className="input-field min-h-[90px]" placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button onClick={() => setIsFormOpen(false)} className="btn-secondary flex-1" disabled={submitting}>Cancel</button>
            <button onClick={handleSave} className="btn-primary flex-1" disabled={submitting}>{editingOrder ? 'Update Order' : 'Create Order'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default OfflineOrdersPage;
