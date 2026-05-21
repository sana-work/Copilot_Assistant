export function approveInvoice(invoiceId: string) {
  return { invoiceId, status: "approved" };
}
