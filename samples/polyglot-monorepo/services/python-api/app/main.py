from fastapi import FastAPI

app = FastAPI()


@app.get("/invoices")
def list_invoices():
    return [{"status": "pending"}]
