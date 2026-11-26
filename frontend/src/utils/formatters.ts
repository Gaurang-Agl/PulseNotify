import { format, parseISO } from 'date-fns';

export function formatCurrencyINR(amount: number | string): string {
  const numeric = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numeric)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(numeric);
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  try {
    return format(parseISO(dateString), 'dd MMM yyyy, hh:mm a');
  } catch {
    return dateString;
  }
}

export function formatTimeAgo(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  try {
    const date = parseISO(dateString);
    const now = new Date();
    const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSecs < 60) return `${diffSecs}s ago`;
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return format(date, 'dd MMM yyyy');
  } catch {
    return dateString;
  }
}
