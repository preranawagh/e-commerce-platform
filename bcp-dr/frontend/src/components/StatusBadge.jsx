const STATUS_CLASSES = {
  CONFIRMED: 'badge-theme-success',
  PENDING: 'badge-theme-warning',
  CANCELLED: 'badge-theme-muted',
  UNREAD: 'badge-theme-accent',
  READ: 'badge-theme-muted'
};

const ROLE_VALUES = new Set(['ADMIN', 'CUSTOMER']);

export default function StatusBadge({ value }) {
  if (ROLE_VALUES.has(value)) {
    return <span className={`role-text ${value === 'ADMIN' ? 'role-text-admin' : 'role-text-customer'}`}>{value}</span>;
  }

  const className = STATUS_CLASSES[value] || 'badge-theme-muted';
  return <span className={`badge ${className}`}>{value}</span>;
}
