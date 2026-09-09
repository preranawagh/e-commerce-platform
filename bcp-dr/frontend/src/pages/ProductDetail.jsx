import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AlertMessage from '../components/AlertMessage';
import LoadingState from '../components/LoadingState';
import { useAuth } from '../context/AuthContext';
import { inventoryApi, productApi } from '../services/api';

export default function ProductDetail() {
  const { id } = useParams();
  const { isAdmin, isCustomer } = useAuth();
  const [product, setProduct] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const requests = [productApi.get(id)];
    if (isAdmin) {
      requests.push(inventoryApi.get(id).catch(() => null));
    }

    Promise.all(requests)
      .then(([nextProduct, nextInventory]) => {
        setProduct(nextProduct);
        setInventory(nextInventory || null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isAdmin]);

  return (
    <div className="page-card p-4">
      <AlertMessage error={error} />
      {loading && <LoadingState message="Loading product..." />}
      {product && (
        <>
          <p className="page-kicker">Catalog</p>
          <h1 className="h3 page-title">{product.name}</h1>
          <p className="text-muted">{product.description || 'No description provided.'}</p>
          <dl className="row mb-3">
            <dt className="col-sm-3">SKU</dt>
            <dd className="col-sm-9">{product.sku}</dd>
            <dt className="col-sm-3">Price</dt>
            <dd className="col-sm-9 product-price">₹{Number(product.price).toFixed(2)}</dd>
            {isAdmin && (
              <>
                <dt className="col-sm-3">Available stock</dt>
                <dd className="col-sm-9">
                  {inventory ? (
                    <span className={`badge ${inventory.availableQuantity > 0 ? 'badge-theme-success' : 'badge-theme-accent'}`}>
                      {inventory.availableQuantity} available
                    </span>
                  ) : 'No inventory record'}
                </dd>
              </>
            )}
          </dl>
          {isCustomer && (
            <Link className="btn btn-theme btn-sm" to="/orders/create">Create order</Link>
          )}
        </>
      )}
    </div>
  );
}
