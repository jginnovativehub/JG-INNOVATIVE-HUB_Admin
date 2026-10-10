import React, { useState, useMemo, useRef } from 'react';
import { exportToExcel } from '@/utils/exportToExcel';
import { Plus, Edit, Trash2, Eye, MoreVertical, Package, Power, Download } from 'lucide-react';
import SearchBar from '@/components/admin/SearchBar';
import Table from '@/components/admin/Table';
import Pagination from '@/components/admin/Pagination';
import StatusBadge, { getStatusVariant } from '@/components/admin/StatusBadge';
import Modal from '@/components/admin/Modal';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { formatCurrency, calculateGst, calculateDiscount } from '@/utils/gstCalculator';
import { PRODUCT_CATEGORIES, GST_RATES } from '@/utils/constants';
import { useAdminData } from '@/context/AdminDataContext';
import { Order, Product, ordersApi, productsApi } from '@/services/adminApi';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import RichTextEditor from '@/components/admin/RichTextEditor';

const Products: React.FC = () => {
  const { state, addProduct, updateProduct, deleteProduct, toggleProductStock } = useAdminData();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
  const [salesHistory, setSalesHistory] = useState<Array<{ orderId: string; customerName: string; quantity: number; price: number; total: number; createdAt: string }>>([]);
  const [salesProduct, setSalesProduct] = useState<Product | null>(null);
  const [isLoadingSales, setIsLoadingSales] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    productId: string;
    productName: string;
  }>({
    isOpen: false,
    productId: '',
    productName: '',
  });

  // Form state for add/edit
  const [formData, setFormData] = useState<Partial<Product> & { videos?: string[] }>({
    name: '',
    shortDescription: '',
    sku: '',
    mrp: 0,
    sellingPrice: 0,
    gstMode: 'including',
    gstPercentage: 18,
    longDescription: '',
    images: [],
    videos: [],
    stockStatus: 'in_stock',
    stockQuantity: 0,
    categories: [],
  });
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  const pageSize = 10;

  // Filter products
  const filteredProducts = useMemo(() => {
    return state.products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStock = stockFilter === 'all' || product.stockStatus === stockFilter;
      return matchesSearch && matchesStock;
    });
  }, [state.products, searchQuery, stockFilter]);

  const soldByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    state.orders
      .filter((o) => o.orderStatus === 'delivered')
      .forEach((order: Order) => {
        order.items.forEach((item) => {
          map[item.productId] = (map[item.productId] || 0) + item.quantity;
        });
      });
    return map;
  }, [state.orders]);

  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Reset to page 1 when search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, stockFilter]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    if (activeDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [activeDropdown]);

  const handleViewProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsViewModalOpen(true);
    setActiveDropdown(null);
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      ...product,
      videos: product.videos || [],
    });
    setImageUrl(product.images[0] || '');
    setVideoUrl('');
    setIsEditModalOpen(true);
    setActiveDropdown(null);
  };

  const handleAddNew = () => {
    setSelectedProduct(null);
    setFormData({
      name: '',
      shortDescription: '',
      sku: '',
      mrp: 0,
      sellingPrice: 0,
      gstMode: 'including',
      gstPercentage: 18,
      longDescription: '',
      images: [],
      videos: [],
      stockStatus: 'in_stock',
      stockQuantity: 0,
      categories: [],
    });
    setImageUrl('');
    setVideoUrl('');
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (product: Product) => {
    setConfirmDialog({
      isOpen: true,
      productId: product.id,
      productName: product.name,
    });
    setActiveDropdown(null);
  };

  const handleConfirmDelete = async () => {
    await deleteProduct(confirmDialog.productId);
    setConfirmDialog({ ...confirmDialog, isOpen: false });
  };

  const handleToggleStock = async (product: Product) => {
    await toggleProductStock(product.id);
    setActiveDropdown(null);
  };

  const handleViewSales = async (product: Product) => {
    setIsSalesModalOpen(true);
    setSalesProduct(product);
    setIsLoadingSales(true);
    try {
      const sales = await ordersApi.getProductSales(product.id);
      setSalesHistory(Array.isArray(sales) ? sales : []);
    } finally {
      setIsLoadingSales(false);
    }
  };

  const handleCategoryToggle = (category: string) => {
    const current = formData.categories || [];
    if (current.includes(category)) {
      setFormData({ ...formData, categories: current.filter(c => c !== category) });
    } else {
      setFormData({ ...formData, categories: [...current, category] });
    }
  };

  const uploadFiles = async (files: FileList) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of Array.from(files)) {
        const url = await productsApi.uploadImage(file);
        if (url) uploadedUrls.push(url);
      }
      if (uploadedUrls.length) {
        setFormData((prev) => ({
          ...prev,
          images: [...(prev.images || []), ...uploadedUrls],
        }));
      }
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddImage = () => {
    if (imageUrl.trim()) {
      setFormData({
        ...formData,
        images: [...(formData.images || []), imageUrl.trim()],
      });
      setImageUrl('');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleRemoveImage = (index: number) => {
    setFormData({
      ...formData,
      images: formData.images?.filter((_, i) => i !== index) || [],
    });
  };

  const handleAddVideo = () => {
    const url = videoUrl.trim();
    if (!url) {
      videoFileInputRef.current?.click();
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      toast({ title: 'URL must start with http:// or https://', variant: 'destructive' });
      return;
    }
    setFormData({
      ...formData,
      videos: [...(formData.videos || []), url],
    });
    setVideoUrl('');
  };

  const handleVideoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsUploadingVideo(true);
    try {
      const url = await productsApi.uploadVideo(file);
      if (url) {
        setFormData({
          ...formData,
          videos: [...(formData.videos || []), url],
        });
        toast({ title: 'Video uploaded' });
      }
    } catch (err) {
      toast({ title: (err as Error).message || 'Video upload failed', variant: 'destructive' });
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleRemoveVideo = (index: number) => {
    setFormData({
      ...formData,
      videos: formData.videos?.filter((_, i) => i !== index) || [],
    });
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    let success = false;
    try {
      if (selectedProduct) {
        // Update existing product
        await updateProduct(selectedProduct.id, formData);
      } else {
        // Add new product
        await addProduct(formData as Omit<Product, 'id' | 'createdAt' | 'updatedAt'>);
      }
      success = true;
    } finally {
      setIsSubmitting(false);
    }
    if (success) setIsEditModalOpen(false);
  };

  const columns = [
    {
      key: 'name',
      header: 'Product',
      render: (product: Product) => (
        <div className="flex items-center gap-3">
          {product.images[0] ? (
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-12 h-12 rounded-lg object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
              <Package className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          <div>
            <p className="font-medium text-foreground">{product.name}</p>
            <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'mrp',
      header: 'MRP',
      render: (product: Product) => (
        <span className="text-muted-foreground line-through">
          {formatCurrency(product.mrp)}
        </span>
      ),
    },
    {
      key: 'sellingPrice',
      header: 'Selling Price',
      render: (product: Product) => (
        <div>
          <p className="font-medium">{formatCurrency(product.sellingPrice)}</p>
          <p className="text-xs text-success">
            {calculateDiscount(product.mrp, product.sellingPrice)}% off
          </p>
        </div>
      ),
    },
    {
      key: 'gst',
      header: 'GST',
      render: (product: Product) => (
        <div>
          <p className="text-sm">{product.gstPercentage}%</p>
          <p className="text-xs text-muted-foreground">
            {product.gstMode === 'including' ? 'Incl.' : 'Excl.'}
          </p>
        </div>
      ),
    },
    {
      key: 'stockStatus',
      header: 'Stock',
      render: (product: Product) => (
        <div>
          <StatusBadge variant={getStatusVariant(product.stockStatus)}>
            {product.stockStatus === 'in_stock' ? 'In Stock' : 'Out of Stock'}
          </StatusBadge>
          {product.stockQuantity !== undefined && (
            <p className="text-xs text-muted-foreground mt-1">
              Qty:{' '}
              <button
                type="button"
                onClick={() => setStockFilter(product.stockStatus)}
                className="text-primary hover:underline"
              >
                {product.stockQuantity}
              </button>
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'sold',
      header: 'Sold',
      render: (product: Product) => (
        <button
          type="button"
          onClick={() => handleViewSales(product)}
          className="text-primary hover:underline text-sm"
        >
          {soldByProduct[product.id] || 0}
        </button>
      ),
    },
    {
      key: 'categories',
      header: 'Categories',
      render: (product: Product) => (
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {product.categories.slice(0, 2).map((cat) => (
            <span
              key={cat}
              className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded"
            >
              {cat}
            </span>
          ))}
          {product.categories.length > 2 && (
            <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded">
              +{product.categories.length - 2}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (product: Product) => (
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveDropdown(activeDropdown === product.id ? null : product.id);
            }}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <MoreVertical className="w-4 h-4 text-muted-foreground" />
          </button>

          {activeDropdown === product.id && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-lg shadow-elevated z-10 animate-scale-in">
              <button
                onClick={() => handleViewProduct(product)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              >
                <Eye className="w-4 h-4" />
                View Details
              </button>
              <button
                onClick={() => handleEditProduct(product)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit Product
              </button>
              <button
                onClick={() => handleToggleStock(product)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              >
                <Power className="w-4 h-4" />
                {product.stockStatus === 'in_stock' ? 'Mark Out of Stock' : 'Mark In Stock'}
              </button>
              <button
                onClick={() => handleDeleteClick(product)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Product
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
          <h1 className="page-header">Products</h1>
          <p className="page-description">
            Manage your product catalog • {state.products.length} total
          </p>
        </div>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto items-stretch sm:items-center gap-3">
          <button onClick={() => exportToExcel(state.products || [], 'products')} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"><Download className="w-4 h-4" /> Export to Excel</button>
            <SearchBar
            placeholder="Search by name or SKU..."
            value={searchQuery}
            onChange={setSearchQuery}
            className="w-full sm:w-72"
          />
          <button onClick={handleAddNew} className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Product</span>
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button type="button" className="stat-card text-left" onClick={() => setStockFilter('all')}>
          <p className="text-sm text-muted-foreground">Total Products</p>
          <p className="text-2xl font-bold text-foreground">{state.products.length}</p>
        </button>
        <button type="button" className="stat-card text-left" onClick={() => setStockFilter('in_stock')}>
          <p className="text-sm text-muted-foreground">In Stock</p>
          <p className="text-2xl font-bold text-success">
            {state.products.filter(p => p.stockStatus === 'in_stock').length}
          </p>
        </button>
        <button type="button" className="stat-card text-left" onClick={() => setStockFilter('out_of_stock')}>
          <p className="text-sm text-muted-foreground">Out of Stock</p>
          <p className="text-2xl font-bold text-destructive">
            {state.products.filter(p => p.stockStatus === 'out_of_stock').length}
          </p>
        </button>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Stock Units</p>
          <p className="text-2xl font-bold text-primary">
            {state.products.reduce((sum, p) => sum + (p.stockQuantity || 0), 0)}
          </p>
        </div>
      </div>

      {/* Products Table */}
      <div className="overflow-x-auto">
        <Table
          columns={columns}
          data={paginatedProducts}
          keyExtractor={(product) => product.id}
          emptyMessage="No products found"
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

      {/* View Product Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="Product Details"
        size="xl"
      >
        {selectedProduct && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-6">
              {selectedProduct.images[0] ? (
                <img
                  src={selectedProduct.images[0]}
                  alt={selectedProduct.name}
                  className="w-32 h-32 rounded-xl object-cover"
                />
              ) : (
                <div className="w-32 h-32 rounded-xl bg-muted flex items-center justify-center">
                  <Package className="w-12 h-12 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-foreground">
                  {selectedProduct.name}
                </h3>
                <div
                  className="prose prose-sm max-w-none text-muted-foreground mt-1"
                  dangerouslySetInnerHTML={{ __html: selectedProduct.shortDescription }}
                />
                <div className="flex items-center gap-4 mt-4">
                  <StatusBadge variant={getStatusVariant(selectedProduct.stockStatus)}>
                    {selectedProduct.stockStatus === 'in_stock' ? 'In Stock' : 'Out of Stock'}
                  </StatusBadge>
                  <span className="text-sm text-muted-foreground">
                    SKU: {selectedProduct.sku}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">MRP</p>
                <p className="font-semibold text-foreground line-through">
                  {formatCurrency(selectedProduct.mrp)}
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Selling Price</p>
                <p className="font-semibold text-foreground">
                  {formatCurrency(selectedProduct.sellingPrice)}
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">GST</p>
                <p className="font-semibold text-foreground">
                  {selectedProduct.gstPercentage}% ({selectedProduct.gstMode})
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Stock Qty</p>
                <p className="font-semibold text-foreground">
                  {selectedProduct.stockQuantity ?? 'N/A'}
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Categories</p>
              <div className="flex flex-wrap gap-2">
                {selectedProduct.categories.map((cat) => (
                  <span
                    key={cat}
                    className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Description</p>
              <div
                className="prose prose-sm max-w-none text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: selectedProduct.longDescription }}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Add/Edit Product Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={selectedProduct ? 'Edit Product' : 'Add New Product'}
        size="xl"
      >
        <form onSubmit={handleSubmitForm} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Product Name *
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">SKU *</label>
              <input
                type="text"
                value={formData.sku || ''}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="input-field"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Short Description
            </label>
            <RichTextEditor
              value={formData.shortDescription || ''}
              onChange={(val) => setFormData({ ...formData, shortDescription: val })}
              placeholder="Enter short product description..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">MRP (₹) *</label>
              <input
                type="number"
                value={formData.mrp || ''}
                onChange={(e) => setFormData({ ...formData, mrp: parseFloat(e.target.value) || 0 })}
                className="input-field"
                required
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Selling Price (₹) *
              </label>
              <input
                type="number"
                value={formData.sellingPrice || ''}
                onChange={(e) =>
                  setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })
                }
                className="input-field"
                required
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">GST Mode</label>
              <select
                value={formData.gstMode || 'including'}
                onChange={(e) =>
                  setFormData({ ...formData, gstMode: e.target.value as 'including' | 'excluding' })
                }
                className="input-field"
              >
                <option value="including">Including GST</option>
                <option value="excluding">Excluding GST</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">GST %</label>
              <input
                type="number"
                value={formData.gstPercentage ?? 18}
                onChange={(e) =>
                  setFormData({ ...formData, gstPercentage: parseFloat(e.target.value) || 0 })
                }
                className="input-field"
                min="0"
                step="0.01"
                list="gst-rate-options"
              />
              <datalist id="gst-rate-options">
                {GST_RATES.map((rate) => (
                  <option key={rate} value={rate} />
                ))}
              </datalist>
            </div>
          </div>

          {/* GST Calculation Preview */}
          {formData.sellingPrice && formData.gstPercentage && formData.gstMode && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium text-foreground mb-2">GST Calculation Preview</p>
              {(() => {
                const calc = calculateGst(
                  formData.sellingPrice,
                  formData.gstPercentage,
                  formData.gstMode
                );
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Base Price</p>
                      <p className="font-medium">{formatCurrency(calc.basePrice)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">CGST</p>
                      <p className="font-medium">{formatCurrency(calc.cgst)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">SGST</p>
                      <p className="font-medium">{formatCurrency(calc.sgst)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Final Price</p>
                      <p className="font-medium text-primary">{formatCurrency(calc.totalPrice)}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Stock Status</label>
              <select
                value={formData.stockStatus || 'in_stock'}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    stockStatus: e.target.value as 'in_stock' | 'out_of_stock',
                  })
                }
                className="input-field"
              >
                <option value="in_stock">In Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Stock Quantity
              </label>
              <input
                type="number"
                value={formData.stockQuantity || ''}
                onChange={(e) =>
                  setFormData({ ...formData, stockQuantity: parseInt(e.target.value) || 0 })
                }
                className="input-field"
                min="0"
              />
            </div>
          </div>

          {/* Image URLs */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Product Images (Cloudinary URLs)
            </label>
            <div className="flex flex-col sm:flex-row gap-2 mb-2">
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="input-field flex-1"
                placeholder="Enter image URL..."
              />
              <button
                type="button"
                onClick={handleAddImage}
                className="btn-secondary"
                disabled={isUploading}
              >
                Add
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) uploadFiles(e.target.files);
                e.currentTarget.value = '';
              }}
            />
            {formData.images && formData.images.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.images.map((img, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={img}
                      alt={`Product ${index + 1}`}
                      className="w-20 h-20 rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Product Videos (Drive, YouTube or direct link) */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Product Videos (Drive, YouTube or direct link)
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Paste a video link (e.g. Google Drive, YouTube). Click to play on the product page.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mb-2">
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddVideo())}
                className="input-field flex-1"
                placeholder="Enter video or link URL..."
              />
              <button
                type="button"
                onClick={handleAddVideo}
                className="btn-secondary"
                disabled={isUploadingVideo}
              >
                {isUploadingVideo ? 'Uploading…' : 'Add'}
              </button>
            </div>
            <input
              ref={videoFileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleVideoFileSelect}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave the field empty and click Add to choose a video file from your PC.
            </p>
            {formData.videos && formData.videos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.videos.map((url, index) => (
                  <div key={index} className="relative group flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline truncate max-w-[200px]"
                    >
                      Video {index + 1}
                    </a>
                    <button
                      type="button"
                      onClick={() => handleRemoveVideo(index)}
                      className="w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Categories */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Categories</label>
            <div className="flex flex-wrap gap-2">
              {PRODUCT_CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => handleCategoryToggle(category)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                    formData.categories?.includes(category)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Long Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Long Description
            </label>
            <RichTextEditor
              value={formData.longDescription || ''}
              onChange={(val) => setFormData({ ...formData, longDescription: val })}
              placeholder="Enter detailed product description..."
            />
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="btn-secondary w-full sm:w-auto"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary w-full sm:w-auto"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? 'Saving...'
                : selectedProduct
                ? 'Update Product'
                : 'Add Product'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={handleConfirmDelete}
        title="Delete Product?"
        message={`Are you sure you want to delete "${confirmDialog.productName}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />

      {/* Sales History Modal */}
      <Modal
        isOpen={isSalesModalOpen}
        onClose={() => setIsSalesModalOpen(false)}
        title={`Sold History${salesProduct ? ` • ${salesProduct.name}` : ''}`}
        size="lg"
      >
        {isLoadingSales ? (
          <p className="text-sm text-muted-foreground">Loading sales...</p>
        ) : salesHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No delivered sales yet</p>
        ) : (
          <div className="space-y-2">
            {salesHistory.map((sale, idx) => (
              <div key={`${sale.orderId}-${idx}`} className="p-3 rounded-lg bg-muted/50 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Order {sale.orderId}</p>
                  <p className="text-xs text-muted-foreground">
                    {sale.customerName || 'Customer'} • {new Date(sale.createdAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">Qty {sale.quantity}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(sale.total)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Products;
