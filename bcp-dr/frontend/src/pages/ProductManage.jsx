import { useEffect, useState } from 'react';
import AlertMessage from '../components/AlertMessage';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import { inventoryApi, productApi } from '../services/api';

const emptyForm = {
  name: '',
  description: '',
  price: '',
  sku: '',
  quantity: ''
};

export default function ProductManage() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadProducts = () => productApi.list().then(setProducts);

  useEffect(() => {
    loadProducts()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleEdit = (product) => {
    setEditingId(product.id);
    setForm({
      name: product.name,
      description: product.description || '',
      price: product.price,
      sku: product.sku,
      quantity: ''
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    const payload = {
      name: form.name,
      description: form.description,
      price: Number(form.price),
      sku: form.sku
    };

    try {
      if (editingId) {
        await productApi.update(editingId, payload);
        setSuccess('Product updated.');
      } else {
        const created = await productApi.create(payload);
        if (form.quantity !== '') {
          await inventoryApi.create({
            productId: created.id,
            quantity: Number(form.quantity)
          });
        }
        setSuccess('Product created.');
      }
      setForm(emptyForm);
      setEditingId(null);
      await loadProducts();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product? This cannot be undone if no related records exist.')) {
      return;
    }
    setError('');
    setSuccess('');
    setDeletingId(id);
    try {
      await productApi.remove(id);
      setSuccess('Product deleted.');
      await loadProducts();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="page-card p-4">
      <p className="page-kicker">Admin</p>
      <h1 className="h3 page-title mb-1">Product Management</h1>
      <p className="text-muted">Admin-only catalog changes. Backend authorization is also enforced.</p>
      <AlertMessage error={error} success={success} />
      <form className="row g-3 mb-4" onSubmit={handleSubmit}>
        <div className="col-md-4">
          <label className="form-label">Name</label>
          <input className="form-control" name="name" value={form.name} onChange={handleChange} required />
        </div>
        <div className="col-md-3">
          <label className="form-label">SKU</label>
          <input className="form-control" name="sku" value={form.sku} onChange={handleChange} required />
        </div>
        <div className="col-md-2">
          <label className="form-label">Price</label>
          <input className="form-control" type="number" min="0.01" step="0.01" name="price" value={form.price} onChange={handleChange} required />
        </div>
        {!editingId && (
          <div className="col-md-3">
            <label className="form-label">Initial stock</label>
            <input className="form-control" type="number" min="0" name="quantity" value={form.quantity} onChange={handleChange} />
          </div>
        )}
        <div className="col-12">
          <label className="form-label">Description</label>
          <textarea className="form-control" name="description" rows="2" value={form.description} onChange={handleChange} />
        </div>
        <div className="col-12">
          <button className="btn btn-theme" type="submit" disabled={saving}>
            {saving ? 'Saving...' : (editingId ? 'Update product' : 'Create product')}
          </button>
          {editingId && (
            <button className="btn btn-theme-outline ms-2" type="button" disabled={saving} onClick={() => { setEditingId(null); setForm(emptyForm); }}>
              Cancel edit
            </button>
          )}
        </div>
      </form>

      {loading && <LoadingState message="Loading products..." />}
      {!loading && products.length === 0 && (
        <EmptyState title="No products" message="Create the first catalog item above." />
      )}
      {!loading && products.length > 0 && (
        <div className="table-responsive">
          <table className="table align-middle app-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{product.sku}</td>
                  <td className="product-price">₹{Number(product.price).toFixed(2)}</td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-theme-outline me-2" onClick={() => handleEdit(product)} disabled={saving || deletingId}>Edit</button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(product.id)} disabled={deletingId === product.id}>
                      {deletingId === product.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
