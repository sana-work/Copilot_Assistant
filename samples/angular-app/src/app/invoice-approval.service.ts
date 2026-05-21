export class InvoiceApprovalService {
  approve(invoiceId: string) {
    return { invoiceId, status: "approved" };
  }
}
