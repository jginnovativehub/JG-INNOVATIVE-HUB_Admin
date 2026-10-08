/**
 * ADMIN API - SINGLE POINT OF BACKEND COMMUNICATION
 * 
 * This is the ONLY file that communicates with the backend.
 * No other file should use fetch, axios, or any API calls.
 * All backend communication MUST go through this file.
 */

const API_BASE_URL = (() => {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (typeof apiUrl === 'string' && apiUrl.trim()) {
    const cleanUrl = apiUrl.trim().replace(/\/$/, '');
    return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
  }
  return import.meta.env.VITE_API_BASE_URL || (
    import.meta.env.PROD
      ? 'https://jg-innovative-hub-backend.onrender.com/api'
      : 'http://localhost:5000/api'
  );
})();

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const getRefId = (value: unknown): string => {
  const ref = asRecord(value);
  if (ref) {
    const id = ref._id ?? ref.id;
    return id != null ? String(id) : '';
  }
  return value != null ? String(value) : '';
};

const getRefName = (value: unknown): string => {
  const ref = asRecord(value);
  return ref && typeof ref.name === 'string' ? ref.name : '';
};

// Token management
const getToken = (): string | null => localStorage.getItem('adminToken');
const setToken = (token: string): void => localStorage.setItem('adminToken', token);
const removeToken = (): void => localStorage.removeItem('adminToken');

// Headers configuration
const getHeaders = (includeAuth: boolean = true): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (includeAuth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  
  return headers;
};

/** Skip undefined/null/empty so URLSearchParams does not send literal "undefined" (breaks backend regex filters). */
const buildQueryString = (params: Record<string, string | number | undefined | null>): string => {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    usp.set(key, String(value));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
};

// Generic API request handler - returns full response
const apiRequestRaw = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const config: RequestInit = {
    ...options,
    headers: { ...getHeaders(!options.headers), ...options.headers } as HeadersInit,
  };
  const response = await fetch(url, config);
  if (!response.ok) {
    if (response.status === 401) {
      removeToken();
      localStorage.removeItem('adminData');
    }
    const errorData = await response.json().catch(() => ({ message: 'Network error' }));
    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
};

// Transform backend product to admin Product shape
const toProduct = (p: Record<string, unknown>): Product => ({
  id: (p._id || p.id)?.toString() || '',
  name: (p.name as string) || '',
  shortDescription: (p.shortDescription as string) || '',
  sku: (p.sku as string) || '',
  mrp: Number(p.mrp) || 0,
  sellingPrice: Number(p.sellingPrice) || 0,
  gstMode: (p.gstMode as 'including' | 'excluding') || 'including',
  gstPercentage: Number(p.gstPercentage) || 18,
  longDescription: (p.longDescription as string) || '',
  images: Array.isArray(p.images) ? (p.images as Array<{ url?: string }>).map((i) => (typeof i === 'string' ? i : i?.url || '')).filter(Boolean) : [],
  videos: Array.isArray(p.videos) ? (p.videos as Array<{ url?: string } | string>).map((v) => (typeof v === 'string' ? v : v?.url || '')).filter(Boolean) : [],
  stockStatus: (p.stockStatus as 'in_stock' | 'out_of_stock') || 'in_stock',
  stockQuantity: p.stockQuantity != null ? Number(p.stockQuantity) : undefined,
  categories: Array.isArray(p.categories) ? (p.categories as string[]) : [],
  createdAt: (p.createdAt as string) || '',
  updatedAt: (p.updatedAt as string) || '',
});

// Transform backend user to admin User shape
const toUser = (u: Record<string, unknown>): User => ({
  id: (u._id || u.id)?.toString() || '',
  name: (u.name as string) || '',
  email: (u.email as string) || '',
  mobile: (u.mobile || u.phone || '') as string,
  profileImage: (u.profileImage as string) || '',
  status: (u.status as 'active' | 'blocked') || 'active',
  totalOrders: Number(u.totalOrders) || 0,
  totalAmountSpent: Number(u.totalAmountSpent) || 0,
  joiningDate: (u.createdAt as string) || '',
});

// Transform backend order to admin Order shape
const toOrder = (o: Record<string, unknown>): Order => ({
  id: (o._id || o.id)?.toString() || '',
  customerId: (o.customerId || o.userId)?.toString() || '',
  customerName: (o.customerName as string) || '',
  items: Array.isArray(o.items) ? (o.items as Array<{ productId: unknown; quantity: number; price: number }>).map((i) => ({ productId: getRefId(i.productId), quantity: i.quantity, price: i.price })) : [],
  itemsCount: Number(o.itemsCount) || 0,
  totalAmount: Number(o.totalAmount || (o.pricing as { totalAmount?: number })?.totalAmount) || 0,
  paymentStatus: (o.paymentStatus as Order['paymentStatus']) || 'unpaid',
  orderStatus: (o.orderStatus as Order['orderStatus']) || 'pending',
  trackingLink: (o.trackingLink as string) || '',
  trackingMessage: (o.trackingMessage as string) || '',
  address: (o.addressSnapshot as Order['address']) || undefined,
  deliveryMethod: (o.delivery_method as Order['deliveryMethod']) || 'default',
  deliveryCharge: Number(o.delivery_charge ?? (o.pricing as { deliveryCharge?: number })?.deliveryCharge) || 0,
  deliveryAgreement: Boolean(o.delivery_agreement),
  deliveryMobileNumber: (o.delivery_mobile_number as string) || '',
  deliveryStatus: (o.delivery_status as Order['deliveryStatus']) || 'pending',
  deliveryPlatform: (o.delivery_platform as string) || '',
  state: (o.state as string) || '',
  createdAt: (o.createdAt as string) || '',
  updatedAt: (o.updatedAt as string) || '',
});

// ============ AUTHENTICATION ============

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  admin?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  message?: string;
}

const normalizeLoginAdmin = (raw: unknown): LoginResponse['admin'] | undefined => {
  const a = asRecord(raw);
  if (!a) return undefined;
  const id = a.id ?? a._id;
  if (id == null) return undefined;
  return {
    id: String(id),
    name: typeof a.name === 'string' ? a.name : '',
    email: typeof a.email === 'string' ? a.email : '',
    role: typeof a.role === 'string' ? a.role : 'admin',
  };
};

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const res = await apiRequestRaw('/admin/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    const merged = { ...res, ...(asRecord(res.data) || {}) } as Record<string, unknown>;
    const token = typeof merged.token === 'string' ? merged.token : undefined;
    if (merged.success && token) setToken(token);
    const admin = normalizeLoginAdmin(merged.admin);
    return {
      success: Boolean(merged.success),
      token,
      admin,
      message: typeof merged.message === 'string' ? merged.message : undefined,
    };
  },
  
  logout: async (): Promise<void> => {
    removeToken();
  },
  
  verifyToken: async (): Promise<boolean> => {
    return !!getToken();
  },
  
  getAdminProfile: async () => {
    return apiRequestRaw('/admin/profile');
  },
};

// ============ DASHBOARD ============

export interface DashboardStats {
  totalUsers: number;
  newUsers: number;
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  totalDeliveredOrders: number;
  totalProfit: number;
  activeProducts: number;
  online?: {
    totalOrders: number;
    deliveredOrders: number;
    totalRevenue: number;
    totalProfit: number;
  };
  offline?: {
    totalOrders: number;
    pendingOrders: number;
    deliveredOrders: number;
    totalRevenue: number;
    totalProfit: number;
  };
}

export const dashboardApi = {
  getStats: async (period: 'all' | 'today' | 'week' | 'month' | 'year' | 'custom-year', year?: number): Promise<DashboardStats> => {
    const query = new URLSearchParams({ period, ...(year ? { year: String(year) } : {}) }).toString();
    const res = await apiRequestRaw(`/dashboard/stats?${query}`);
    const d = res.data || res;
    return {
      totalUsers: d.totalUsers ?? 0,
      newUsers: d.newUsers ?? 0,
      totalOrders: d.totalOrders ?? 0,
      pendingOrders: d.pendingOrders ?? 0,
      totalRevenue: d.totalRevenue ?? 0,
      totalDeliveredOrders: d.totalDeliveredOrders ?? 0,
      totalProfit: d.totalProfit ?? 0,
      activeProducts: d.activeProducts ?? 0,
      online: d.online,
      offline: d.offline,
    };
  },
  getRecentOrders: async (limit: number = 10) => {
    const res = await apiRequestRaw(`/dashboard/recent-orders?limit=${limit}`);
    const arr = res.data || res;
    return Array.isArray(arr) ? arr.map(toOrder) : [];
  },
  getActivityAlerts: async () => {
    const res = await apiRequestRaw('/dashboard/activity-alerts');
    return res.data || res || [];
  },
  getMostDemandingProducts: async (limit: number = 5, period: 'all' | 'today' | 'week' | 'month' | 'year' | 'custom-year' = 'today', year?: number) => {
    const query = new URLSearchParams({ limit: String(limit), period, ...(year ? { year: String(year) } : {}) }).toString();
    const res = await apiRequestRaw(`/dashboard/top-products?${query}`);
    const arr = res.data || res;
    return Array.isArray(arr) ? arr.map((x: Record<string, unknown>) => ({ _id: x._id, name: x.name, totalQuantity: x.totalQuantity, totalRevenue: x.totalRevenue, image: x.image })) : [];
  },
  getProfitInsights: async (period: 'all' | 'today' | 'week' | 'month' | 'year' | 'custom-year', year?: number) => {
    const query = new URLSearchParams({ period, ...(year ? { year: String(year) } : {}) }).toString();
    const res = await apiRequestRaw(`/dashboard/profit-insights?${query}`);
    return res.data || res;
  },
  getRoboticsSales: async (): Promise<{
    success: boolean;
    data: {
      totalCourseRevenue: number;
      totalSessionRevenue: number;
      totalRevenue: number;
      courseEnrollmentsCount: number;
      bookedSessionsCount: number;
    }
  }> => {
    const res = await apiRequestRaw('/admin/sales/robotics');
    const d = res.data || {};
    return {
      success: !!res.success,
      data: {
        totalCourseRevenue: Number(d.totalCourseSales) || 0,
        totalSessionRevenue: Number(d.totalSessionSales) || 0,
        totalRevenue: Number(d.totalSales) || 0,
        courseEnrollmentsCount: Number(d.enrollmentsCount) || 0,
        bookedSessionsCount: Number(d.bookedSessionsCount) || 0,
      }
    };
  },
};

// ============ USERS ============

export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  profileImage: string;
  status: 'active' | 'blocked';
  totalOrders: number;
  totalAmountSpent: number;
  joiningDate: string;
}

export const usersApi = {
  getAll: async (params?: { search?: string; status?: string; page?: number; limit?: number }) => {
    const queryParams = new URLSearchParams(params as Record<string, string>).toString();
    const res = await apiRequestRaw(`/users?${queryParams}`);
    const arr = res.data || res;
    return Array.isArray(arr) ? arr.map(toUser) : [];
  },
  getById: async (userId: string) => {
    const res = await apiRequestRaw(`/users/${userId}`);
    return toUser(res.data || res);
  },
  updateStatus: async (userId: string, status: 'active' | 'blocked') => {
    return apiRequestRaw(`/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
  delete: async (userId: string) => {
    return apiRequestRaw(`/users/${userId}`, { method: 'DELETE' });
  },
};

// ============ PRODUCTS ============

export interface Product {
  id: string;
  name: string;
  shortDescription: string;
  sku: string;
  mrp: number;
  sellingPrice: number;
  gstMode: 'including' | 'excluding';
  gstPercentage: number;
  longDescription: string;
  images: string[];
  videos?: string[];
  stockStatus: 'in_stock' | 'out_of_stock';
  stockQuantity?: number;
  categories: string[];
  createdAt: string;
  updatedAt: string;
}

export const productsApi = {
  getAll: async (params?: { search?: string; category?: string; status?: string; page?: number; limit?: number }) => {
    const queryParams = new URLSearchParams(params as Record<string, string>).toString();
    const res = await apiRequestRaw(`/products?${queryParams}`);
    const arr = res.data || res;
    return Array.isArray(arr) ? arr.map(toProduct) : [];
  },
  getById: async (productId: string) => {
    const res = await apiRequestRaw(`/products/${productId}`);
    return toProduct(res.data || res);
  },
  create: async (productData: Partial<Product>) => {
    const res = await apiRequestRaw('/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    });
    return toProduct(res.data || res);
  },
  update: async (productId: string, productData: Partial<Product>) => {
    const res = await apiRequestRaw(`/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    });
    return toProduct(res.data || res);
  },
  updateStock: async (productId: string, stockStatus: 'in_stock' | 'out_of_stock') => {
    const res = await apiRequestRaw(`/products/${productId}/stock`, {
      method: 'PATCH',
      body: JSON.stringify({ stockStatus }),
    });
    return toProduct(res.data || res);
  },
  delete: async (productId: string) => {
    return apiRequestRaw(`/products/${productId}`, { method: 'DELETE' });
  },
  uploadImage: async (file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch(`${API_BASE_URL}/admin/upload/image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` } as HeadersInit,
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Upload failed');
    }
    const data = await res.json();
    return data.data?.url || data.url;
  },
  uploadEditorImage: async (file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch(`${API_BASE_URL}/admin/upload/editor-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` } as HeadersInit,
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Upload failed');
    }
    const data = await res.json();
    return data.data?.url || data.url;
  },
  uploadVideo: async (file: File) => {
    const fd = new FormData();
    fd.append('video', file);
    const res = await fetch(`${API_BASE_URL}/admin/upload/video`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` } as HeadersInit,
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Video upload failed');
    }
    const data = await res.json();
    return data.data?.url || data.url;
  },
};

// ============ ORDERS ============

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  items: Array<{ productId: string; quantity: number; price: number }>;
  itemsCount: number;
  totalAmount: number;
  paymentStatus: 'paid' | 'unpaid' | 'failed';
  orderStatus: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  trackingLink?: string;
  trackingMessage?: string;
  address?: {
    fullName?: string;
    mobile?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  deliveryMethod?: 'default' | 'manual';
  deliveryCharge?: number;
  deliveryAgreement?: boolean;
  deliveryMobileNumber?: string;
  deliveryStatus?: 'pending' | 'processing' | 'shipped' | 'delivered';
  deliveryPlatform?: string;
  state?: string;
  createdAt: string;
  updatedAt: string;
}

export const ordersApi = {
  getAll: async (params?: { status?: string; paymentStatus?: string; page?: number; limit?: number }) => {
    const queryParams = new URLSearchParams(params as Record<string, string>).toString();
    const res = await apiRequestRaw(`/orders?${queryParams}`);
    const arr = res.data || res;
    return Array.isArray(arr) ? arr.map(toOrder) : [];
  },
  getById: async (orderId: string) => {
    const res = await apiRequestRaw(`/orders/${orderId}`);
    return toOrder(res.data || res);
  },
  updateStatus: async (orderId: string, status: Order['orderStatus']) => {
    const res = await apiRequestRaw(`/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return toOrder(res.data || res);
  },
  updatePaymentStatus: async (orderId: string, status: Order['paymentStatus']) => {
    return apiRequestRaw(`/orders/${orderId}/payment-status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
  updateTracking: async (orderId: string, data: { trackingLink?: string; trackingMessage?: string }) => {
    return apiRequestRaw(`/orders/${orderId}/tracking`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  updateDeliveryPlatform: async (orderId: string, deliveryPlatform: string) => {
    return apiRequestRaw(`/orders/${orderId}/delivery-platform`, {
      method: 'PATCH',
      body: JSON.stringify({ deliveryPlatform }),
    });
  },
  getProductSales: async (productId: string) => {
    const res = await apiRequestRaw(`/orders/product/${productId}/sales`);
    return res.data || res || [];
  },
};

// ============ OFFLINE ORDERS ============

export interface OfflineOrder {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone?: string;
  totalAmount: number;
  profitAmount: number;
  paymentStatus: 'paid' | 'unpaid' | 'failed';
  orderStatus: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  billImageUrl?: string;
  billPdfUrl?: string;
  billDocUrl?: string;
  notes?: string;
  orderDate: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

const toOfflineOrder = (o: Record<string, unknown>): OfflineOrder => ({
  id: (o._id || o.id)?.toString() || '',
  invoiceNumber: (o.invoiceNumber as string) || '',
  customerName: (o.customerName as string) || '',
  customerPhone: (o.customerPhone as string) || '',
  totalAmount: Number(o.totalAmount) || 0,
  profitAmount: Number(o.profitAmount) || 0,
  paymentStatus: (o.paymentStatus as OfflineOrder['paymentStatus']) || 'paid',
  orderStatus: (o.orderStatus as OfflineOrder['orderStatus']) || 'delivered',
  billImageUrl: (o.billImageUrl as string) || '',
  billPdfUrl: (o.billPdfUrl as string) || '',
  billDocUrl: (o.billDocUrl as string) || '',
  notes: (o.notes as string) || '',
  orderDate: (o.orderDate as string) || (o.createdAt as string) || '',
  deliveredAt: (o.deliveredAt as string) || '',
  createdAt: (o.createdAt as string) || '',
  updatedAt: (o.updatedAt as string) || '',
});

export const offlineOrdersApi = {
  getAll: async (params?: { search?: string; status?: string; paymentStatus?: string; period?: 'today' | 'week' | 'month' | 'year' | 'custom-year'; year?: number }) => {
    const qs = buildQueryString({
      search: params?.search,
      status: params?.status,
      paymentStatus: params?.paymentStatus,
      period: params?.period,
      year: params?.year,
    });
    const res = await apiRequestRaw(`/offline-orders${qs}`);
    const arr = res.data || res;
    return Array.isArray(arr) ? arr.map(toOfflineOrder) : [];
  },
  create: async (payload: Partial<OfflineOrder>) => {
    const res = await apiRequestRaw('/offline-orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return toOfflineOrder(res.data || res);
  },
  update: async (id: string, payload: Partial<OfflineOrder>) => {
    const res = await apiRequestRaw(`/offline-orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return toOfflineOrder(res.data || res);
  },
  delete: async (id: string) => {
    return apiRequestRaw(`/offline-orders/${id}`, { method: 'DELETE' });
  },
  /** Upload a PDF bill (Cloudinary raw). */
  uploadBillPdf: async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${API_BASE_URL}/admin/upload/offline-bill-pdf`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` } as HeadersInit,
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || 'PDF upload failed');
    }
    const data = await res.json();
    return (data.data?.url || data.url) as string;
  },
  /** Upload a Word .doc / .docx bill (Cloudinary raw). */
  uploadBillDoc: async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${API_BASE_URL}/admin/upload/offline-bill-doc`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` } as HeadersInit,
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || 'Document upload failed');
    }
    const data = await res.json();
    return (data.data?.url || data.url) as string;
  },
  /** Download generated receipt (PDF) or Word-openable HTML (.doc). */
  downloadBill: async (id: string, format: 'pdf' | 'doc') => {
    const url = `${API_BASE_URL}/offline-orders/${encodeURIComponent(id)}/bill?format=${format}`;
    const token = getToken();
    const response = await fetch(url, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      if (response.status === 401) {
        removeToken();
        localStorage.removeItem('adminData');
      }
      const err = await response.json().catch(() => ({ message: 'Download failed' }));
      throw new Error((err as { message?: string }).message || `HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const ext = format === 'doc' ? 'doc' : 'pdf';
    let filename = `offline-receipt.${ext}`;
    const cd = response.headers.get('Content-Disposition');
    if (cd) {
      const utf8 = cd.match(/filename\*=UTF-8''([^;]+)/i);
      if (utf8?.[1]) {
        filename = decodeURIComponent(utf8[1].trim());
      } else {
        const quoted = cd.match(/filename="([^"]+)"/i);
        if (quoted?.[1]) filename = quoted[1];
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  },
  /** Download uploaded Cloudinary file through backend attachment endpoint. */
  downloadUploadedBill: async (id: string, type: 'image' | 'pdf' | 'doc') => {
    const url = `${API_BASE_URL}/offline-orders/${encodeURIComponent(id)}/uploaded-bill/${type}`;
    const token = getToken();
    const response = await fetch(url, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      if (response.status === 401) {
        removeToken();
        localStorage.removeItem('adminData');
      }
      const err = await response.json().catch(() => ({ message: 'Download failed' }));
      throw new Error((err as { message?: string }).message || `HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const fallbackExt = type === 'image' ? 'jpg' : type;
    let filename = `uploaded-${type}-bill.${fallbackExt}`;
    const cd = response.headers.get('Content-Disposition');
    if (cd) {
      const utf8 = cd.match(/filename\*=UTF-8''([^;]+)/i);
      if (utf8?.[1]) {
        filename = decodeURIComponent(utf8[1].trim());
      } else {
        const quoted = cd.match(/filename="([^"]+)"/i);
        if (quoted?.[1]) filename = quoted[1];
      }
    }
    if (!/\.[a-z0-9]{2,8}$/i.test(filename)) {
      filename = `${filename}.${fallbackExt}`;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  },
};

// ============ PAYMENTS ============

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  status: 'success' | 'pending' | 'failed';
  method: string;
  transactionId: string;
  createdAt: string;
}

const toPayment = (p: Record<string, unknown>): Payment => ({
  id: (p._id || p.id)?.toString() || '',
  orderId: getRefId(p.orderId),
  amount: Number(p.amount) || 0,
  status: (p.status as Payment['status']) || 'pending',
  method: (p.method as string) || '',
  transactionId: (p.transactionId as string) || '',
  createdAt: (p.createdAt as string) || '',
});

export const paymentsApi = {
  getAll: async (params?: { status?: string; page?: number; limit?: number }) => {
    const queryParams = new URLSearchParams(params as Record<string, string>).toString();
    const res = await apiRequestRaw(`/payments?${queryParams}`);
    const arr = res.data || res;
    return Array.isArray(arr) ? arr.map(toPayment) : [];
  },
  getById: async (paymentId: string) => {
    const res = await apiRequestRaw(`/payments/${paymentId}`);
    return toPayment(res.data || res);
  },
};

// ============ REVIEWS ============

export interface Review {
  id: string;
  productId: string;
  productName: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

const toReview = (r: Record<string, unknown>): Review => ({
  id: (r._id || r.id)?.toString() || '',
  productId: getRefId(r.productId),
  productName: getRefName(r.productId),
  userId: getRefId(r.userId),
  userName: getRefName(r.userId),
  rating: Number(r.rating) || 0,
  comment: (r.comment as string) || '',
  status: (r.status as Review['status']) || 'pending',
  createdAt: (r.createdAt as string) || '',
});

export const reviewsApi = {
  getAll: async (params?: { status?: string; page?: number; limit?: number }) => {
    const queryParams = new URLSearchParams(params as Record<string, string>).toString();
    const res = await apiRequestRaw(`/reviews?${queryParams}`);
    const arr = res.data || res;
    return Array.isArray(arr) ? arr.map(toReview) : [];
  },
  getMode: async () => {
    const res = await apiRequestRaw('/reviews/mode');
    return res.data || res;
  },
  updateMode: async (payload: { mode?: 'any-user' | 'delivered-only'; autoApprove?: boolean }) => {
    const res = await apiRequestRaw('/reviews/mode', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res.data || res;
  },
  updateStatus: async (reviewId: string, status: Review['status']) => {
    return apiRequestRaw(`/reviews/${reviewId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
  delete: async (reviewId: string) => {
    return apiRequestRaw(`/reviews/${reviewId}`, { method: 'DELETE' });
  },
};

// ============ NOTIFICATIONS ============

export interface Notification {
  id: string;
  type: 'order' | 'user' | 'review' | 'system';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const toNotification = (n: Record<string, unknown>): Notification => ({
  id: (n._id || n.id)?.toString() || '',
  type: (n.type as Notification['type']) || 'system',
  title: (n.title as string) || '',
  message: (n.message as string) || '',
  read: Boolean(n.read),
  createdAt: (n.createdAt as string) || '',
});

export const notificationsApi = {
  getAll: async (params?: { read?: boolean; page?: number; limit?: number }) => {
    const queryParams = new URLSearchParams(params as Record<string, string>).toString();
    const res = await apiRequestRaw(`/notifications?${queryParams}`);
    const arr = res.data || res;
    return Array.isArray(arr) ? arr.map(toNotification) : [];
  },
  markAsRead: async (notificationId: string) => {
    return apiRequestRaw(`/notifications/${notificationId}/read`, { method: 'PATCH' });
  },
  markAllAsRead: async () => {
    return apiRequestRaw('/notifications/read-all', { method: 'PATCH' });
  },
  delete: async (notificationId: string) => {
    return apiRequestRaw(`/notifications/${notificationId}`, { method: 'DELETE' });
  },
};

// ============ PROFIT ============

export interface ProfitProduct {
  productId: string;
  sku: string;
  name: string;
  buyingPrice: number;
  sellingPrice: number;
  profitPerUnit: number;
  soldQuantity: number;
  totalProfit: number;
}

export const profitApi = {
  getProducts: async (params?: { search?: string }) => {
    const queryParams = new URLSearchParams(params as Record<string, string>).toString();
    const res = await apiRequestRaw(`/profit/products?${queryParams}`);
    return res.data || res || [];
  },
  updatePricing: async (productId: string, data: { buyingPrice?: number; sellingPrice?: number }) => {
    return apiRequestRaw(`/profit/products/${productId}/pricing`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};

// ============ DELIVERY MANAGEMENT ============

export interface DeliveryStateRow {
  id: string;
  state: string;
  defaultShippingCharge: number;
  manualBaseCharge: number;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeliveryDashboard {
  totalOrders: number;
  ordersByDeliveryMethod: { default: number; manual: number };
  ordersByState: Record<string, number>;
  totalShippingCollected: number;
  pendingDeliveries: number;
  completedDeliveries: number;
}

export const deliveryApi = {
  getStateCharges: async (state: string) => {
    const res = await apiRequestRaw(`/delivery/state-charges?state=${encodeURIComponent(state)}`);
    return res.data || res;
  },
  getAllStates: async () => {
    const res = await apiRequestRaw('/delivery/states');
    const arr = res.data || res;
    return (Array.isArray(arr) ? arr : []).map((x: Record<string, unknown>) => ({
      id: (x._id || x.id)?.toString() || '',
      state: (x.state as string) || '',
      defaultShippingCharge: Number(x.defaultShippingCharge) || 0,
      manualBaseCharge: Number(x.manualBaseCharge) || 0,
      enabled: x.enabled !== false,
      createdAt: (x.createdAt as string) || '',
      updatedAt: (x.updatedAt as string) || '',
    })) as DeliveryStateRow[];
  },
  createState: async (data: { state: string; defaultShippingCharge: number; manualBaseCharge: number; enabled?: boolean }) => {
    const res = await apiRequestRaw('/delivery/states', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data || res;
  },
  updateState: async (stateId: string, data: Partial<{ state: string; defaultShippingCharge: number; manualBaseCharge: number; enabled: boolean }>) => {
    const res = await apiRequestRaw(`/delivery/states/${stateId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.data || res;
  },
  deleteState: async (stateId: string) => {
    return apiRequestRaw(`/delivery/states/${stateId}`, { method: 'DELETE' });
  },
  getDashboard: async (): Promise<DeliveryDashboard> => {
    const res = await apiRequestRaw('/delivery/dashboard');
    return res.data || res;
  },
  getDefaultPlatform: async () => {
    const res = await apiRequestRaw('/delivery/settings/platform');
    return (res.data || res) as { defaultPlatform: string };
  },
  setDefaultPlatform: async (defaultPlatform: string) => {
    const res = await apiRequestRaw('/delivery/settings/platform', {
      method: 'PUT',
      body: JSON.stringify({ defaultPlatform }),
    });
    return (res.data || res) as { defaultPlatform: string };
  },
};

// ============ COUPONS ============

export interface AdminCoupon {
  id: string;
  coupon_code: string;
  discount_type: 'flat' | 'percentage';
  discount_value: number;
  creation_date: string;
  expiry_date: string;
  usage_limit: number;
  used_count: number;
  min_order_value: number | null;
  active_status: boolean;
  createdAt: string;
  updatedAt: string;
}

const toCoupon = (c: Record<string, unknown>): AdminCoupon => ({
  id: (c._id || c.id)?.toString() || '',
  coupon_code: (c.coupon_code as string) || '',
  discount_type: (c.discount_type as 'flat' | 'percentage') || 'flat',
  discount_value: Number(c.discount_value) || 0,
  creation_date: (c.creation_date as string) || '',
  expiry_date: (c.expiry_date as string) || '',
  usage_limit: Number(c.usage_limit) || 0,
  used_count: Number(c.used_count) || 0,
  min_order_value: c.min_order_value != null && c.min_order_value !== '' ? Number(c.min_order_value) : null,
  active_status: c.active_status !== false,
  createdAt: (c.createdAt as string) || '',
  updatedAt: (c.updatedAt as string) || '',
});

export const couponsApi = {
  getAll: async (): Promise<AdminCoupon[]> => {
    const res = await apiRequestRaw('/coupons/all');
    const arr = res.data || res;
    return Array.isArray(arr) ? arr.map((x: Record<string, unknown>) => toCoupon(x)) : [];
  },
  create: async (payload: {
    coupon_code: string;
    discount_type: 'flat' | 'percentage';
    discount_value: number;
    creation_date: string;
    expiry_date: string;
    usage_limit: number;
    min_order_value?: number | null;
    active_status?: boolean;
  }) => {
    const res = await apiRequestRaw('/coupons/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return toCoupon((res.data || res) as Record<string, unknown>);
  },
  update: async (
    id: string,
    payload: Partial<{
      coupon_code: string;
      discount_type: 'flat' | 'percentage';
      discount_value: number;
      creation_date: string;
      expiry_date: string;
      usage_limit: number;
      min_order_value: number | null;
      active_status: boolean;
    }>
  ) => {
    const res = await apiRequestRaw(`/coupons/update/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return toCoupon((res.data || res) as Record<string, unknown>);
  },
  delete: async (id: string) => {
    return apiRequestRaw(`/coupons/delete/${id}`, { method: 'DELETE' });
  },
};

// ============ SETTINGS ============

export const settingsApi = {
  changePassword: async (currentPassword: string, newPassword: string) => {
    return apiRequestRaw('/settings/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
  
  getSettings: async () => {
    return apiRequestRaw('/settings');
  },
  
  updateSettings: async (settings: Record<string, unknown>) => {
    return apiRequestRaw('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },
};

// ============ TUTORS ============

export interface Tutor {
  id: string;
  name: string;
  email: string;
  mobile?: string;
  role: 'student' | 'tutor' | 'admin';
  tutorStatus: 'pending' | 'approved' | 'rejected';
  bio?: string;
  expertise?: string[];
  createdAt?: string;
  socials?: {
    linkedin?: string;
    googleScholar?: string;
    orcid?: string;
    medium?: string;
  };
  education?: {
    college?: string;
    graduationYear?: number;
    course?: string;
  };
}

export const tutorsApi = {
  getAll: async (): Promise<Tutor[]> => {
    const res = await apiRequestRaw('/admin/tutors');
    const arr = res.data || res;
    return (Array.isArray(arr) ? arr : []).map((t: Record<string, unknown>) => ({
      id: (t._id || t.id)?.toString() || '',
      name: (t.name as string) || '',
      email: (t.email as string) || '',
      mobile: (t.mobile as string) || '',
      role: (t.role as any) || 'student',
      tutorStatus: (t.tutorStatus as any) || 'pending',
      bio: (t.bio as string) || '',
      expertise: Array.isArray(t.expertise) ? (t.expertise as string[]) : [],
      createdAt: (t.createdAt as string) || '',
      socials: t.socials as any,
      education: t.education as any,
    }));
  },
  updateStatus: async (tutorId: string, status: 'approved' | 'rejected'): Promise<any> => {
    return apiRequestRaw(`/admin/tutors/${tutorId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
};

// ============ WORKSHOPS ============

export interface Workshop {
  id: string;
  title: string;
  description: string;
  hostName: string;
  hostEmail?: string;
  hostId?: string | { id: string; name: string; email: string };
  hostLinkedIn?: string;
  thumbnail?: string;
  date: string;
  time: string;
  duration: string;
  meetingLink: string;
  googleFormLink: string;
  showOnHomepage: boolean;
  status: 'pending' | 'approved' | 'rejected';
  enrolledStudentsCount: number;
  createdAt: string;
}

const toWorkshop = (w: Record<string, unknown>): Workshop => {
  const host = w.hostId && typeof w.hostId === 'object' ? (w.hostId as Record<string, unknown>) : null;
  return {
    id: (w._id || w.id)?.toString() || '',
    title: (w.title as string) || '',
    description: (w.description as string) || '',
    hostName: (w.hostName as string) || (host ? (host.name as string) : '') || '',
    hostEmail: (w.hostEmail as string) || (host ? (host.email as string) : '') || '',
    hostId: host ? { id: (host._id || host.id)?.toString() || '', name: (host.name as string) || '', email: (host.email as string) || '' } : String(w.hostId || ''),
    hostLinkedIn: (w.hostLinkedIn as string) || '',
    thumbnail: (w.thumbnail as string) || '',
    date: (w.date as string) || '',
    time: (w.time as string) || '',
    duration: (w.duration as string) || '',
    meetingLink: (w.meetingLink as string) || '',
    googleFormLink: (w.googleFormLink as string) || '',
    showOnHomepage: Boolean(w.showOnHomepage),
    status: (w.status as 'pending' | 'approved' | 'rejected') || 'pending',
    enrolledStudentsCount: Array.isArray(w.enrolledStudents) ? w.enrolledStudents.length : 0,
    createdAt: (w.createdAt as string) || '',
  };
};

export const workshopsApi = {
  getAll: async (status?: 'pending' | 'approved' | 'rejected'): Promise<Workshop[]> => {
    const qs = status ? `?status=${status}` : '';
    const res = await apiRequestRaw(`/admin/workshops${qs}`);
    const arr = res.data || res;
    return (Array.isArray(arr) ? arr : []).map((w: Record<string, unknown>) => toWorkshop(w));
  },
  create: async (payload: {
    title: string;
    description: string;
    hostName: string;
    hostLinkedIn?: string;
    thumbnail?: string;
    date: string;
    time: string;
    duration: string;
    meetingLink: string;
    googleFormLink: string;
  }): Promise<Workshop> => {
    const res = await apiRequestRaw('/admin/workshops', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return toWorkshop((res.data || res) as Record<string, unknown>);
  },
      delete: async (workshopId: string): Promise<any> => {
      return apiRequestRaw(`/admin/workshops/${workshopId}`, {
        method: 'DELETE',
      });
    },
    update: async (workshopId: string, payload: Partial<Workshop>): Promise<Workshop> => {
    const res = await apiRequestRaw(`/admin/workshops/${workshopId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return toWorkshop((res.data || res) as Record<string, unknown>);
  },
  updateStatus: async (workshopId: string, status: 'approved' | 'rejected'): Promise<any> => {
    return apiRequestRaw(`/admin/workshops/${workshopId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
};

// ============ INTERNSHIPS ============


export interface InternshipPost {
  _id?: string;
  id?: string;
  title: string;
  description: string;
  category: 'paid' | 'self-funded';
  tier?: string;
  skills: string[];
  isActive: boolean;
  image?: string;
  startDate?: string;
  deadline?: string;
  location?: string;
  stipend?: string;
  createdAt?: string;
}

export interface InternshipApplication {
  id: string;
  studentId: string | { id: string; name: string; email: string };
  name: string;
  email: string;
  mobile: string;
  skills: string[];
  resumeUrl: string;
  coverLetter: string;
  portfolioUrl?: string;
  category?: 'paid' | 'self-funded';
  tier?: string;
  yearOfStudy?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  personalPortfolioUrl?: string;
  paymentStatus?: 'free' | 'pending' | 'paid' | 'failed';
  paymentId?: string;
  razorpayOrderId?: string;
  status: 'pending' | 'under-review' | 'shortlisted' | 'rejected';
  createdAt: string;
}

const toInternshipApplication = (i: Record<string, unknown>): InternshipApplication => {
  const student = i.studentId && typeof i.studentId === 'object' ? (i.studentId as Record<string, unknown>) : null;
  return {
    id: (i._id || i.id)?.toString() || '',
    studentId: student ? { id: (student._id || student.id)?.toString() || '', name: (student.name as string) || '', email: (student.email as string) || '' } : String(i.studentId || ''),
    name: (i.name as string) || '',
    email: (i.email as string) || '',
    mobile: (i.mobile as string) || '',
    skills: Array.isArray(i.skills) ? (i.skills as string[]) : typeof i.skills === 'string' ? [i.skills] : [],
    resumeUrl: (i.resumeUrl as string) || '',
    coverLetter: (i.coverLetter as string) || '',
    portfolioUrl: (i.portfolioUrl as string) || '',
    category: (i.category as 'paid' | 'self-funded'),
    tier: (i.tier as string),
    yearOfStudy: (i.yearOfStudy as string),
    githubUrl: (i.githubUrl as string),
    linkedinUrl: (i.linkedinUrl as string),
    personalPortfolioUrl: (i.personalPortfolioUrl as string),
    paymentStatus: (i.paymentStatus as 'free' | 'pending' | 'paid' | 'failed'),
    paymentId: (i.paymentId as string),
    razorpayOrderId: (i.razorpayOrderId as string),
    status: (i.status as 'pending' | 'under-review' | 'shortlisted' | 'rejected') || 'pending',
    createdAt: (i.createdAt as string) || new Date().toISOString(),
  };
};


export const internshipPostsApi = {
  getAll: async (): Promise<InternshipPost[]> => {
    const res = await apiRequestRaw('/admin/internship-posts');
    return (res.data || res).map((i: any) => ({ ...i, id: i._id })) as InternshipPost[];
  },
  create: async (payload: Partial<InternshipPost>): Promise<InternshipPost> => {
    const res = await apiRequestRaw('/admin/internship-posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return { ...(res.data || res), id: (res.data || res)._id } as InternshipPost;
  },
  update: async (id: string, payload: Partial<InternshipPost>): Promise<InternshipPost> => {
    const res = await apiRequestRaw(`/admin/internship-posts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return { ...(res.data || res), id: (res.data || res)._id } as InternshipPost;
  },
  delete: async (id: string) => {
    return apiRequestRaw(`/admin/internship-posts/${id}`, {
      method: 'DELETE',
    });
  },
};

export const internshipsApi = {

  create: async (payload: Partial<InternshipApplication>): Promise<InternshipApplication> => {
    const res = await apiRequestRaw('/admin/internships', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return toInternshipApplication((res.data || res) as Record<string, unknown>);
  },
  delete: async (applicationId: string): Promise<any> => {
    return apiRequestRaw('/admin/internships/' + applicationId, {
      method: 'DELETE',
    });
  },
  getAll: async (): Promise<InternshipApplication[]> => {
    const res = await apiRequestRaw('/admin/internships');
    const arr = res.data || res;
    return (Array.isArray(arr) ? arr : []).map((i: Record<string, unknown>) => toInternshipApplication(i));
  },
  update: async (applicationId: string, payload: Partial<InternshipApplication>): Promise<InternshipApplication> => {
      const res = await apiRequestRaw('/admin/internships/' + applicationId, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      return toInternshipApplication((res.data || res) as Record<string, unknown>);
    },
    updateStatus: async (applicationId: string, status: InternshipApplication['status']): Promise<any> => {
    return apiRequestRaw(`/admin/internships/${applicationId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
};

export interface GalleryItem {
  id: string;
  title: string;
  category: 'workshops' | 'projects' | 'lab' | 'events';
  image: string;
  description: string;
  createdAt: string;
}

const toGalleryItem = (g: Record<string, unknown>): GalleryItem => ({
  id: (g._id || g.id)?.toString() || '',
  title: (g.title as string) || '',
  category: (g.category as GalleryItem['category']) || 'workshops',
  image: (g.image as string) || '',
  description: (g.description as string) || '',
  createdAt: (g.createdAt as string) || '',
});

export const galleryApi = {
  getAll: async (): Promise<GalleryItem[]> => {
    const res = await apiRequestRaw('/gallery');
    const arr = res.data || res;
    return (Array.isArray(arr) ? arr : []).map((g: Record<string, unknown>) => toGalleryItem(g));
  },
  create: async (payload: Partial<GalleryItem>): Promise<GalleryItem> => {
    const res = await apiRequestRaw('/gallery', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return toGalleryItem(res.data || res);
  },
  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiRequestRaw(`/gallery/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============ PROJECTS ============

export interface Project {
  id: string;
  name: string;
  sku: string;
  shortDescription: string;
  longDescription: string;
  mrp: number;
  sellingPrice: number;
  gstMode: 'including' | 'excluding';
  gstPercentage: number;
  images: string[];
  videos?: string[];
  stockStatus: 'in_stock' | 'out_of_stock';
  stockQuantity?: number;
  projectType: 'combo_components' | 'ready_made';
  components: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedBuildTime: string;
  documentation: string;
  status: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
}

const toProject = (p: Record<string, unknown>): Project => ({
  id: (p._id || p.id)?.toString() || '',
  name: (p.name as string) || '',
  sku: (p.sku as string) || '',
  shortDescription: (p.shortDescription as string) || '',
  longDescription: (p.longDescription as string) || '',
  mrp: Number(p.mrp) || 0,
  sellingPrice: Number(p.sellingPrice ?? p.price) || 0,
  gstMode: (p.gstMode as 'including' | 'excluding') || 'including',
  gstPercentage: Number(p.gstPercentage) || 18,
  images: Array.isArray(p.images) ? (p.images as Array<{ url?: string } | string>).map((i) => (typeof i === 'string' ? i : i?.url || '')).filter(Boolean) : [],
  videos: Array.isArray(p.videos) ? (p.videos as Array<{ url?: string } | string>).map((v) => (typeof v === 'string' ? v : v?.url || '')).filter(Boolean) : [],
  stockStatus: (p.stockStatus as 'in_stock' | 'out_of_stock') || 'in_stock',
  stockQuantity: p.stockQuantity != null ? Number(p.stockQuantity) : undefined,
  projectType: (p.projectType as 'combo_components' | 'ready_made') || 'combo_components',
  components: Array.isArray(p.components) ? (p.components as string[]) : [],
  difficulty: (p.difficulty as 'beginner' | 'intermediate' | 'advanced') || 'beginner',
  estimatedBuildTime: (p.estimatedBuildTime as string) || '',
  documentation: (p.documentation as string) || '',
  status: (p.status as 'active' | 'inactive') || 'active',
  createdAt: (p.createdAt as string) || '',
  updatedAt: (p.updatedAt as string) || '',
});

export const projectsApi = {
  getAll: async (params?: { search?: string; projectType?: string; difficulty?: string }) => {
    const q = buildQueryString(params || {});
    const res = await apiRequestRaw(`/projects/admin/all${q}`);
    const arr = res.data || res;
    return Array.isArray(arr) ? arr.map(toProject) : [];
  },
  getById: async (id: string) => {
    const res = await apiRequestRaw(`/projects/${id}`);
    return toProject(res.data || res);
  },
  create: async (data: Partial<Project>) => {
    const res = await apiRequestRaw('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return toProject(res.data || res);
  },
  update: async (id: string, data: Partial<Project>) => {
    const res = await apiRequestRaw(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return toProject(res.data || res);
  },
  delete: async (id: string) => {
    return apiRequestRaw(`/projects/${id}`, { method: 'DELETE' });
  },
};

// ============ DEVELOPED PRODUCTS ============

export interface DevelopedProduct {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  tag: string;
  category: string;
  images: string[];
  features: string[];
  status: 'Available' | 'Coming Soon' | 'Under Research';
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const toDevelopedProduct = (p: Record<string, unknown>): DevelopedProduct => ({
  id: (p._id || p.id)?.toString() || '',
  name: (p.name as string) || '',
  description: (p.description as string) || '',
  longDescription: (p.longDescription as string) || '',
  tag: (p.tag as string) || '',
  category: (p.category as string) || '',
  images: Array.isArray(p.images) ? (p.images as Array<{ url?: string } | string>).map((i) => (typeof i === 'string' ? i : i?.url || '')).filter(Boolean) : [],
  features: Array.isArray(p.features) ? (p.features as string[]) : [],
  status: (p.status as 'Available' | 'Coming Soon' | 'Under Research') || 'Available',
  isActive: p.isActive !== false,
  createdAt: (p.createdAt as string) || '',
  updatedAt: (p.updatedAt as string) || '',
});

export const developedProductsApi = {
  getAll: async () => {
    const res = await apiRequestRaw('/developed-products?admin=true');
    const arr = res.data || res;
    return Array.isArray(arr) ? arr.map(toDevelopedProduct) : [];
  },
  getById: async (id: string) => {
    const res = await apiRequestRaw('/developed-products/' + id);
    return toDevelopedProduct(res.data || res);
  },
  create: async (data: Partial<DevelopedProduct>) => {
    const res = await apiRequestRaw('/developed-products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return toDevelopedProduct(res.data || res);
  },
  update: async (id: string, data: Partial<DevelopedProduct>) => {
    const res = await apiRequestRaw('/developed-products/' + id, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return toDevelopedProduct(res.data || res);
  },
  delete: async (id: string) => {
    return apiRequestRaw('/developed-products/' + id, { method: 'DELETE' });
  },
};

// Export all APIs
// ============ CONSULTATIONS (PRODUCT DEVELOPMENT) API ============
export interface ConsultationBooking {
  _id: string;
  id: string;
  user: { _id: string; name: string; email: string };
  name: string;
  email: string;
  phone: string;
  message: string;
  company?: string;
  productName?: string;
  productCategory?: string;
  currentStage?: string;
  estimatedBudget?: string;
  expectedTimeline?: string;
  problemStatement?: string;
  detailedDescription?: string;
  attachments?: Array<{ url: string; publicId: string; filename: string }>;
  processStage: 'Idea Submitted' | 'Requirement Discussion' | 'Project Confirmation' | 'Design & Development' | 'Testing & Delivery' | 'Completed';
  amount: number;
  status: string;
  createdAt: string;
}

export const consultationsApi = {
  getAll: async (): Promise<ConsultationBooking[]> => {
    const res = await apiRequestRaw('/admin/consultations');
    const arr = res.data || res;
    return (Array.isArray(arr) ? arr : []).map((c: any) => ({
      ...c,
      id: c._id
    })) as ConsultationBooking[];
  },
  updateStage: async (id: string, processStage: string): Promise<ConsultationBooking> => {
    const res = await apiRequestRaw(`/admin/consultations/${id}/stage`, {
      method: 'PATCH',
      body: JSON.stringify({ processStage })
    });
    return { ...(res.data || res), id: (res.data || res)._id } as ConsultationBooking;
  },
  update: async (id: string, payload: any): Promise<ConsultationBooking> => {
    const res = await apiRequestRaw(`/admin/consultations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    return { ...(res.data || res), id: (res.data || res)._id } as ConsultationBooking;
  },
  delete: async (id: string): Promise<any> => {
    return apiRequestRaw(`/admin/consultations/${id}`, {
      method: 'DELETE'
    });
  }
};

export interface Feedback {
  _id: string;
  user?: { _id: string; name: string; email: string };
  rating: number;
  message: string;
  device?: string;
  createdAt: string;
}

const feedbackApi = {
  getAll: async (): Promise<Feedback[]> => {
    const res = await apiRequestRaw('/feedback');
    return res.data || res;
  }
};

export const projectBookingsApi = {
  getAll: async (): Promise<any[]> => {
    const res = await apiRequestRaw('/admin/project-bookings');
    const arr = res.data || res;
    return (Array.isArray(arr) ? arr : []).map((c: any) => ({
      ...c,
      id: c._id
    })) as any[];
  },
  updateStage: async (id: string, processStage: string): Promise<any> => {
    const res = await apiRequestRaw(`/admin/project-bookings/${id}/stage`, {
      method: 'PATCH',
      body: JSON.stringify({ processStage })
    });
    return { ...(res.data || res), id: (res.data || res)._id } as any;
  },
  update: async (id: string, payload: any): Promise<any> => {
    const res = await apiRequestRaw(`/admin/project-bookings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    return { ...(res.data || res), id: (res.data || res)._id } as any;
  },
  delete: async (id: string): Promise<any> => {
    return apiRequestRaw(`/admin/project-bookings/${id}`, {
      method: 'DELETE'
    });
  }
};

export const adminApi = {
  auth: authApi,
  dashboard: dashboardApi,
  users: usersApi,
  products: productsApi,
  orders: ordersApi,
  offlineOrders: offlineOrdersApi,
  payments: paymentsApi,
  reviews: reviewsApi,
  notifications: notificationsApi,
  profit: profitApi,
  coupons: couponsApi,
  settings: settingsApi,
  tutors: tutorsApi,
  workshops: workshopsApi,
  internships: internshipsApi,
  internshipPosts: internshipPostsApi,
  gallery: galleryApi,
  projects: projectsApi,
    developedProducts: developedProductsApi,
  consultations: consultationsApi,
  feedback: feedbackApi,
  projectBookings: projectBookingsApi,
};

export default adminApi;
