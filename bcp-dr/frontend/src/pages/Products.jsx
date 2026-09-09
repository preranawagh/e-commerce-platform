import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AlertMessage from '../components/AlertMessage';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import { useAuth } from '../context/AuthContext';
import { productApi } from '../services/api';

export default function Products() {
  const { isAdmin, isCustomer } = useAuth();
  const [params] = useSearchParams();
  const query = (params.get('q') || '').trim().toLowerCase();
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    productApi.list()
      .then(setProducts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const visible = query
    ? products.filter((product) => [product.name, product.sku, product.description].join(' ').toLowerCase().includes(query))
    : products;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <p className="page-kicker">Catalog</p>
          <h1 className="h3 page-title mb-1">Products</h1>
          <p className="text-muted mb-0">
            {query ? `Showing results for “${params.get('q')}”.` : 'Browse the catalog before placing an order.'}
          </p>
        </div>
        {isAdmin && <Link className="btn btn-theme btn-sm" to="/products/manage">Manage products</Link>}
      </div>
      <AlertMessage error={error} />
      {loading && <LoadingState message="Loading products..." />}
      {!loading && !error && visible.length === 0 && (
        <div className="page-card">
          <EmptyState title="No products yet" message={query ? 'Try a different search.' : 'An administrator can add items from Product Management.'} />
        </div>
      )}
      <div className="row g-3">
        {visible.map((product) => (
          <div className="col-md-6 col-lg-4" key={product.id}>
            <div className="card product-card h-100">
              <div className="card-body d-flex flex-column">
                <h2 className="h5">{product.name}</h2>
                <p className="small text-muted mb-2">{product.sku}</p>
                <p className="flex-grow-1">{product.description || 'No description provided.'}</p>
                <div className="d-flex justify-content-between align-items-center">
                  <span className="product-price">₹{Number(product.price).toFixed(2)}</span>
                  <Link className="btn btn-theme-outline btn-sm" to={`/products/${product.id}`}>Details</Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {isCustomer && visible.length > 0 && (
        <div className="mt-3">
          <Link className="btn btn-theme" to="/orders/create">Create order</Link>
        </div>
      )}
    </div>
  );
}
