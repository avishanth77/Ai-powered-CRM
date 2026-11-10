import React, { useState, useEffect } from 'react';
import { Package, Check, DollarSign, Plus, X, Search } from 'lucide-react';
import { productApi } from '../api/productApi';
import { formatCurrency } from '../utils/formatters';

export default function ProductSelector({
  selectedProductIds = [],
  onChange,
  onTotalValueChange,
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let isMounted = true;
    productApi
      .getSimpleProducts()
      .then((data) => {
        if (isMounted) {
          setProducts(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleProduct = (productId) => {
    let nextIds;
    if (selectedProductIds.includes(productId)) {
      nextIds = selectedProductIds.filter((id) => id !== productId);
    } else {
      nextIds = [...selectedProductIds, productId];
    }
    if (onChange) onChange(nextIds);

    // Calculate total price
    if (onTotalValueChange) {
      const total = nextIds.reduce((sum, id) => {
        const prod = products.find((p) => p.id === id);
        return sum + (prod ? parseFloat(prod.unit_price) || 0 : 0);
      }, 0);
      onTotalValueChange(total);
    }
  };

  if (loading) {
    return <div className="text-dim font-xs">Loading product catalog...</div>;
  }

  if (products.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
        <Package size={24} style={{ opacity: 0.3, marginBottom: '0.4rem' }} />
        <p style={{ margin: '0 0 0.5rem 0' }}>No products available in the catalog yet.</p>
        <a
          href="/settings?tab=products"
          style={{ color: 'var(--primary)', textDecoration: 'underline', fontWeight: 600 }}
        >
          Open Settings &gt; Products Catalog to create products
        </a>
      </div>
    );
  }

  const selectedCount = selectedProductIds.length;
  const totalValue = selectedProductIds.reduce((sum, id) => {
    const prod = products.find((p) => p.id === id);
    return sum + (prod ? parseFloat(prod.unit_price) || 0 : 0);
  }, 0);

  const filteredProducts = products.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (p.name && p.name.toLowerCase().includes(term)) ||
      (p.code && p.code.toLowerCase().includes(term)) ||
      (p.category && p.category.toLowerCase().includes(term))
    );
  });

  return (
    <div className="product-selector" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span className="text-dim font-xs">
          Select interested products/services for this deal:
        </span>
        {selectedCount > 0 && (
          <span
            className="funnel-prob-chip"
            style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', fontWeight: 600 }}
          >
            {selectedCount} selected • Total: {formatCurrency(totalValue)}
          </span>
        )}
      </div>

      {products.length > 4 && (
        <div style={{ position: 'relative' }}>
          <Search size={14} className="text-dim" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search products by name, code, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2rem', fontSize: '0.8125rem' }}
          />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem', maxHeight: '280px', overflowY: 'auto' }}>
        {filteredProducts.map((p) => {
          const isSelected = selectedProductIds.includes(p.id);
          return (
            <div
              key={p.id}
              onClick={() => handleToggleProduct(p.id)}
              style={{
                border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-subtle)',
                backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-card-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.55rem 0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '0.5rem',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Package size={13} className={isSelected ? 'text-primary' : 'text-dim'} />
                  <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: isSelected ? 'var(--primary)' : 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.name}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                  <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.8125rem', color: 'var(--warning)' }}>
                    {formatCurrency(p.unit_price)}
                  </span>
                  <span className="text-dim font-xs" style={{ fontSize: '0.7rem' }}>
                    ({p.code})
                  </span>
                </div>
              </div>

              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '4px',
                  border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                  backgroundColor: isSelected ? 'var(--primary)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              >
                {isSelected && <Check size={12} strokeWidth={3} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

