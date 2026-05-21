import { InvoiceApprovalService } from "./invoice-approval.service";

describe("InvoiceApprovalService", () => {
  it("approves invoices", () => {
    expect(new InvoiceApprovalService().approve("inv-1").status).toBe("approved");
  });
});
