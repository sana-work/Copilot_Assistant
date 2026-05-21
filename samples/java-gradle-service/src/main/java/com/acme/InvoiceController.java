package com.acme;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/invoices")
public class InvoiceController {
  @GetMapping("/{id}")
  public Invoice getInvoice() {
    return new Invoice("pending");
  }
}
