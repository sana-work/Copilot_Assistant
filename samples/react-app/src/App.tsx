import { Route, Routes } from "react-router-dom";

import { InvoiceApproval } from "./invoices/InvoiceApproval";

export function App() {
  return (
    <Routes>
      <Route path="/invoices/:invoiceId/approval" element={<InvoiceApproval />} />
    </Routes>
  );
}
