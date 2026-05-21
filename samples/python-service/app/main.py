from fastapi import FastAPI

from app.services.invoices import approve_invoice

app = FastAPI()


@app.post("/invoices/{invoice_id}/approve")
def approve(invoice_id: str):
    return approve_invoice(invoice_id)
