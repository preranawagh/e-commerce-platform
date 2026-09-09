import { useEffect, useState } from 'react';
import AlertMessage from '../components/AlertMessage';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import { inventoryApi, productApi } from '../services/api';

export default function Inventory() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [drafts, setDrafts] = useState({});

  const load = async () => {
    const products = await productApi.list();
    const withStock = await Promise.all(products.map(async (product) => {
      try {
        const inventory = await inventoryApi.get(product.id);
        return { product, inventory };
      } catch {
        return { product, inventory: null };
      }
    }));
    setRows(withStock);
    setDrafts(Object.fromEntries(withStock.map(({ product, inventory }) => [
      product.id,
      inventory ? String(inventory.quantity) : '0'
    ])));
  };

  useEffect(() => {
    load()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (product, inventory) => {
    setError('');
    setSuccess('');
    setSavingId(product.id);
    const quantity = Number(drafts[product.id]);
    try {
      if (inventory) {
        await inventoryApi.update(product.id, { quantity });
        setSuccess(`Updated stock for ${product.name}.`);
      } else {
        await inventoryApi.create({ productId: product.id, quantity });
        setSuccess(`Created inventory for ${product.name}.`);
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="page-card p-4">
      <p className="page-kicker">Admin</p>
      <h1 className="h3 page-title mb-1">Inventory</h1>
      <p className="text-muted">Admin-only stock management. Available stock is on hand minus reserved.</p>
      <AlertMessage error={error} success={success} />
      {loading && <LoadingState message="Loading inventory..." />}
      {!loading && rows.length === 0 && (
        <EmptyState title="No products" message="Create products before managing inventory." />
      )}
      {!loading && rows.length > 0 && (
        <div className="table-responsive">
          <table className="table align-middle app-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>On hand</th>
                <th>Reserved</th>
                <th>Available</th>
                <th>Set on hand</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ product, inventory }) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{product.sku}</td>
                  <td>{inventory ? inventory.quantity : '—'}</td>
                  <td>{inventory ? inventory.reservedQuantity : '—'}</td>
                  <td>
                    {inventory ? (
                      <span className={`badge ${inventory.availableQuantity > 0 ? 'badge-theme-success' : 'badge-theme-warning'}`}>
                        {inventory.availableQuantity}
                      </span>
                    ) : <span className="badge badge-theme-muted">No record</span>}
                  </td>
                  <td>
                    <div className="d-flex gap-2">
                      <input
                        className="form-control form-control-sm"
                        style={{ maxWidth: '6rem' }}
                        type="number"
                        min="0"
                        value={drafts[product.id] ?? ''}
                        onChange={(event) => setDrafts((current) => ({ ...current, [product.id]: event.target.value }))}
                      />
                      <button
                        className="btn btn-sm btn-theme"
                        disabled={savingId === product.id}
                        onClick={() => handleSave(product, inventory)}
                      >
                        {savingId === product.id ? 'Saving...' : (inventory ? 'Update' : 'Create')}
                      </button>
                    </div>
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
