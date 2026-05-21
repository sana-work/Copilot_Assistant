import { approveInvoice } from "../src/services/invoices";

test("approves invoices", () => {
  expect(approveInvoice("inv-1").status).toBe("approved");
});
