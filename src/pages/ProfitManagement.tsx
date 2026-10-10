import React, { useEffect, useMemo, useState } from 'react';
import { exportToExcel } from '@/utils/exportToExcel';
import { Save, Download } from 'lucide-react';
import SearchBar from '@/components/admin/SearchBar';
import Table from '@/components/admin/Table';
import { formatCurrency } from '@/utils/gstCalculator';
import { profitApi, ProfitProduct } from '@/services/adminApi';
import { useToast } from '@/hooks/use-toast';

const ProfitManagement: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<ProfitProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editing, setEditing] = useState<Record<string, { buyingPrice: number; sellingPrice: number }>>({});
  const { toast } = useToast();

  const fetchData = async (search?: string) => {
    setIsLoading(true);
    try {
      const data = await profitApi.getProducts(search ? { search } : undefined);
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchData(searchQuery.trim());
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleSave = async (product: ProfitProduct) => {
    const current = editing[product.productId];
    if (!current) return;
    try {
      await profitApi.updatePricing(product.productId, {
        buyingPrice: current.buyingPrice,
        sellingPrice: current.sellingPrice,
      });
      toast({ title: 'Pricing Updated', description: `${product.name} prices updated` });
      setEditing((prev) => {
        const next = { ...prev };
        delete next[product.productId];
        return next;
      });
      await fetchData(searchQuery.trim());
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  };

  const columns = useMemo(
    () => [
      {
        key: 'sku',
        header: 'SKU',
        render: (product: ProfitProduct) => <span className="text-sm text-muted-foreground">{product.sku}</span>,
      },
      {
        key: 'name',
        header: 'Product',
        render: (product: ProfitProduct) => <span className="font-medium text-foreground">{product.name}</span>,
      },
      {
        key: 'buyingPrice',
        header: 'Buying Price',
        render: (product: ProfitProduct) => {
          const value = editing[product.productId]?.buyingPrice ?? product.buyingPrice;
          return (
            <input
              type="number"
              className="input-field w-28"
              value={value}
              min="0"
              step="0.01"
              onChange={(e) =>
                setEditing((prev) => ({
                  ...prev,
                  [product.productId]: {
                    buyingPrice: Number(e.target.value) || 0,
                    sellingPrice: prev[product.productId]?.sellingPrice ?? product.sellingPrice,
                  },
                }))
              }
            />
          );
        },
      },
      {
        key: 'sellingPrice',
        header: 'Selling Price',
        render: (product: ProfitProduct) => {
          const value = editing[product.productId]?.sellingPrice ?? product.sellingPrice;
          return (
            <input
              type="number"
              className="input-field w-28"
              value={value}
              min="0"
              step="0.01"
              onChange={(e) =>
                setEditing((prev) => ({
                  ...prev,
                  [product.productId]: {
                    buyingPrice: prev[product.productId]?.buyingPrice ?? product.buyingPrice,
                    sellingPrice: Number(e.target.value) || 0,
                  },
                }))
              }
            />
          );
        },
      },
      {
        key: 'profitPerUnit',
        header: 'Profit / Unit',
        render: (product: ProfitProduct) => (
          <span className="font-medium">{formatCurrency(product.profitPerUnit)}</span>
        ),
      },
      {
        key: 'soldQuantity',
        header: 'Sold Qty',
        render: (product: ProfitProduct) => (
          <span className="text-sm text-muted-foreground">{product.soldQuantity}</span>
        ),
      },
      {
        key: 'totalProfit',
        header: 'Total Profit',
        render: (product: ProfitProduct) => (
          <span className="font-semibold text-success">{formatCurrency(product.totalProfit)}</span>
        ),
      },
      {
        key: 'actions',
        header: 'Action',
        render: (product: ProfitProduct) => (
          <button
            type="button"
            onClick={() => handleSave(product)}
            className="btn-secondary flex items-center gap-2"
            disabled={!editing[product.productId]}
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        ),
      },
    ],
    [editing]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header">Profit Management</h1>
          <p className="page-description">Track profit per product based on delivered orders.</p>
        </div>
        <button onClick={() => exportToExcel(state.payments || [], 'profits')} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"><Download className="w-4 h-4" /> Export to Excel</button>
            <SearchBar
          placeholder="Search by SKU or product..."
          value={searchQuery}
          onChange={setSearchQuery}
          className="w-full sm:w-72"
        />
      </div>

      {isLoading ? (
        <div className="card-elevated p-6 text-muted-foreground">Loading profit data...</div>
      ) : (
        <div className="overflow-x-auto">
          <Table
            columns={columns}
            data={products}
            keyExtractor={(row) => row.productId}
            emptyMessage="No products found"
          />
        </div>
      )}
    </div>
  );
};

export default ProfitManagement;
