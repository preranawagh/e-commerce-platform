import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AlertMessage from '../components/AlertMessage';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import { orderApi, productApi } from '../services/api';

export default function CreateOrder() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    productApi.list()
      .then((items) => {
        setProducts(items);
        if (items[0]) {
          setProductId(String(items[0].id));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const selected = products.find((product) => String(product.id) === String(productId));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!window.confirm(`Place an order for ${quantity} × ${selected?.name || 'this product'}?`)) {
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await orderApi.create({
        items: [{ productId: Number(productId), quantity: Number(quantity) }]
      });
      navigate('/orders');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-card p-4">
      <p className="page-kicker">Checkout</p>
      <h1 className="h3 page-title mb-1">Create Order</h1>
      <p className="text-muted">Choose a product and quantity, then place the order.</p>
      <AlertMessage error={error} />
      {loading && <LoadingState message="Loading products..." />}
      {!loading && products.length === 0 && (
        <EmptyState title="No products available" message="Ask an administrator to add catalog items." />
      )}
      {!loading && products.length > 0 && (
        <form className="row g-3" onSubmit={handleSubmit}>
          <div className="col-md-8">
            <label className="form-label">Product</label>
            <select className="form-select" value={productId} onChange={(event) => setProductId(event.target.value)}>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} — ₹{Number(product.price).toFixed(2)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Quantity</label>
            <input className="form-control" type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
          </div>
          <div className="col-12">
            <button className="btn btn-theme" type="submit" disabled={submitting || !productId}>
              {submitting ? 'Placing order...' : 'Place order'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
