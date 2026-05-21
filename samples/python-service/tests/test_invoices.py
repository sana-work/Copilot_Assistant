from app.services.invoices import approve_invoice


def test_approve_invoice():
    assert approve_invoice("inv-1")["status"] == "approved"
