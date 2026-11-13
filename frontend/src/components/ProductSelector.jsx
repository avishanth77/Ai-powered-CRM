import React, { useState, useEffect } from 'react';
import { Package, Check, Plus, Minus, X, Search, Info } from 'lucide-react';
import { productApi } from '../api/productApi';
import { formatCurrency } from '../utils/formatters';

export default function ProductSelector({
  selectedProductIds = [],
  productItems = [],
  onChange,
  onTotalValueChange,
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Map of productId -> quantity (number of product needed)
  const [quantities, setQuantities] = useState(() => {
    const init = {};
    if (Array.isArray(productItems) && productItems.length > 0) {
      productItems.forEach((item) => {
        const pid = item.product_id || item.id;
        if (pid) init[pid] = Math.max(1, parseInt(item.quantity, 10) || 1);
      });
    }
    return init;
  });

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

  // Synchronize incoming productItems if updated from outside (e.g. lead loaded)
  useEffect(() => {
    if (Array.isArray(productItems) && productItems.length > 0) {
      setQuantities((prev) => {
        const next = { ...prev };
        productItems.forEach((item) => {
          const pid = item.product_id || item.id;
          if (pid && (next[pid] === undefined || next[pid] === null)) {
            next[pid] = Math.max(1, parseInt(item.quantity, 10) || 1);
          }
        });
        return next;
      });
    }
  }, [productItems]);

  const emitChanges = (nextIds, nextQuantities) => {
    const items = nextIds.map((id) => ({
      product_id: id,
      quantity: nextQuantities[id] || 1,
    }));

    if (onChange) {
      onChange(nextIds, items);
    }

    if (onTotalValueChange) {
      const total = nextIds.reduce((sum, id) => {
        const prod = products.find((p) => p.id === id);
        const qty = nextQuantities[id] || 1;
        return sum + (prod ? (parseFloat(prod.unit_price) || 0) * qty : 0);
      }, 0);
      onTotalValueChange(total);
    }
  };

  const handleToggleProduct = (productId) => {
    let nextIds;
    const isCurrentlySelected = selectedProductIds.includes(productId);
    if (isCurrentlySelected) {
      nextIds = selectedProductIds.filter((id) => id !== productId);
    } else {
      nextIds = [...selectedProductIds, productId];
    }

    const nextQuantities = {
      ...quantities,
      [productId]: quantities[productId] || 1,
    };
    setQuantities(nextQuantities);
    emitChanges(nextIds, nextQuantities);
  };

  const handleQuantityChange = (productId, newQty) => {
    const validQty = Math.max(1, parseInt(newQty, 10) || 1);
    const nextQuantities = {
      ...quantities,
      [productId]: validQty,
    };
    setQuantities(nextQuantities);
    emitChanges(selectedProductIds, nextQuantities);
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
  const totalUnits = selectedProductIds.reduce((sum, id) => sum + (quantities[id] || 1), 0);
  const totalProductsValue = selectedProductIds.reduce((sum, id) => {
    const prod = products.find((p) => p.id === id);
    const qty = quantities[id] || 1;
    return sum + (prod ? (parseFloat(prod.unit_price) || 0) * qty : 0);
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
    <div className="product-selector" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-main)' }}>
            Product Requirements & Classification
          </span>
          <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: 'var(--text-dim)' }}>
            Select products to classify lead needs and specify the number of units required.
          </p>
        </div>
        {selectedCount > 0 && (
          <span
            className="funnel-prob-chip"
            style={{
              fontSize: '0.76rem',
              padding: '0.25rem 0.65rem',
              background: 'rgba(99, 102, 241, 0.12)',
              color: 'var(--primary)',
              fontWeight: 600,
              borderRadius: '9999px',
              border: '1px solid rgba(99, 102, 241, 0.25)'
            }}
          >
            {selectedCount} Product{selectedCount > 1 ? 's' : ''} • {totalUnits} Unit{totalUnits > 1 ? 's' : ''} Needed • Total: {formatCurrency(totalProductsValue)}
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.65rem', maxHeight: '340px', overflowY: 'auto', padding: '2px' }}>
        {filteredProducts.map((p) => {
          const isSelected = selectedProductIds.includes(p.id);
          const currentQty = quantities[p.id] || 1;
          const lineTotal = (parseFloat(p.unit_price) || 0) * currentQty;

          return (
            <div
              key={p.id}
              onClick={() => handleToggleProduct(p.id)}
              style={{
                border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-subtle)',
                backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.05)' : 'var(--bg-card-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.7rem 0.85rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                transition: 'all 0.15s ease',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Package size={14} className={isSelected ? 'text-primary' : 'text-dim'} />
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: isSelected ? 'var(--primary)' : 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                    <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.8125rem', color: 'var(--warning)' }}>
                      {formatCurrency(p.unit_price)}
                    </span>
                    <span className="text-dim font-xs" style={{ fontSize: '0.7rem' }}>
                      / unit ({p.code})
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '5px',
                    border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                    backgroundColor: isSelected ? 'var(--primary)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    flexShrink: 0,
                  }}
                  title={isSelected ? 'Selected (click to remove)' : 'Click to select product'}
                >
                  {isSelected && <Check size={13} strokeWidth={3} />}
                </div>
              </div>

              {/* Number of Products Needed (Quantity Stepper) */}
              {isSelected && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    marginTop: '0.25rem',
                    paddingTop: '0.5rem',
                    borderTop: '1px dashed var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Qty Needed:
                    </span>
                    <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-subtle)', borderRadius: '6px', background: 'var(--bg-surface)' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuantityChange(p.id, Math.max(1, currentQty - 1));
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '3px 7px',
                          cursor: currentQty <= 1 ? 'not-allowed' : 'pointer',
                          opacity: currentQty <= 1 ? 0.4 : 1,
                          color: 'var(--text-main)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        disabled={currentQty <= 1}
                        title="Decrease quantity"
                        aria-label="Decrease quantity"
                      >
                        <Minus size={12} />
                      </button>

                      <input
                        type="number"
                        min="1"
                        max="99999"
                        value={currentQty}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleQuantityChange(p.id, e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: '44px',
                          textAlign: 'center',
                          border: 'none',
                          background: 'transparent',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          color: 'var(--text-main)',
                          padding: '2px 0',
                          outline: 'none'
                        }}
                        aria-label={`Quantity needed for ${p.name}`}
                      />

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuantityChange(p.id, currentQty + 1);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '3px 7px',
                          cursor: 'pointer',
                          color: 'var(--text-main)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Increase quantity"
                        aria-label="Increase quantity"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '0.73rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      background: 'rgba(0,0,0,0.03)',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}
                  >
                    Subtotal: {formatCurrency(lineTotal)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
