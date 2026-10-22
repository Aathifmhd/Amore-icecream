/**
 * Prints a clean, receipt-width slip for an order or refund through a hidden iframe,
 * so only the slip is printed (not the console behind it).
 */
import { OrderRecord } from '../../../types';
import { clockTime, formatLabel, paymentLabel } from './orderMeta';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const lkr = (n: number) => `LKR ${Math.round(n).toLocaleString()}`;

export function printSlip(order: OrderRecord, kind: 'order' | 'refund' = 'order') {
  const date = new Date(order.createdAt);
  const rows = order.items
    .map(
      (i) =>
        `<tr><td>${i.quantity}×</td><td>${esc(i.name)}${i.format ? `<div class="sub">${esc(formatLabel(i.format))}</div>` : ''}</td><td class="r">${lkr(i.priceLKR * i.quantity)}</td></tr>`
    )
    .join('');
  const refund = order.refundAmountLKR ?? order.grandTotalLKR;

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(order.orderReference)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { font: 13px/1.4 system-ui, -apple-system, Segoe UI, sans-serif; color: #000; margin: 0; width: 72mm; }
  h1 { font-size: 18px; margin: 0 0 2px; text-align: center; }
  .c { text-align: center; } .sub { font-size: 11px; color: #444; } .r { text-align: right; white-space: nowrap; }
  .big { font-size: 22px; font-weight: 800; text-align: center; margin: 6px 0; letter-spacing: 1px; }
  hr { border: 0; border-top: 1px dashed #000; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; } td { vertical-align: top; padding: 2px 0; } td:first-child { width: 26px; }
  .tot td { font-weight: 800; font-size: 15px; padding-top: 4px; }
  .note { border: 1px solid #000; padding: 6px; margin-top: 6px; font-weight: 600; }
</style></head><body>
  <h1>Amore</h1>
  <div class="c sub">${esc(order.branchName)}</div>
  <div class="big">${kind === 'refund' ? 'REFUND' : order.orderType === 'pickup' ? 'PICKUP' : 'DELIVERY'}</div>
  <div class="c"><b>${esc(order.orderReference)}</b></div>
  <div class="c sub">${date.toLocaleDateString()} · ${clockTime(order.createdAt)}</div>
  <hr>
  <div><b>${esc(order.customerName)}</b></div>
  <div>${esc(order.contactNumber)}</div>
  ${order.orderType === 'delivery' && order.deliveryAddress ? `<div>${esc(order.deliveryAddress)}${order.city ? ', ' + esc(order.city) : ''}</div>` : ''}
  <hr>
  ${kind === 'refund'
    ? `<div>Reason: ${esc(order.cancellationReason || '-')}</div><table><tr class="tot"><td></td><td>Refund</td><td class="r">${lkr(refund)}</td></tr></table>
       <div class="sub">${order.paymentMethod === 'card' ? 'Back to card' : 'Cash refund'} · ${order.refundStatus === 'completed' ? 'Refunded' : 'Not yet refunded'}</div>`
    : `<table>${rows}
       <tr><td></td><td class="sub">Delivery</td><td class="r sub">${order.deliveryFeeLKR ? lkr(order.deliveryFeeLKR) : 'Free'}</td></tr>
       <tr class="tot"><td></td><td>Total</td><td class="r">${lkr(order.grandTotalLKR)}</td></tr></table>
       <div class="sub">${esc(paymentLabel(order))}</div>
       ${order.specialNote ? `<div class="note">Note: ${esc(order.specialNote)}</div>` : ''}`}
  <hr><div class="c sub">Thank you!</div>
</body></html>`;

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1000);
  }, 150);
}
