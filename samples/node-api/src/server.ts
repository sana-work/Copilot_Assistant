import express from "express";

import { approveInvoice } from "./services/invoices";

const app = express();

app.get("/health", health);
app.post("/invoices/:invoiceId/approve", approve);

function health() {
  return { ok: true };
}

function approve() {
  return approveInvoice("inv-1");
}

export { app };
