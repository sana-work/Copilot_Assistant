package com.acme;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/invoices")
public class InvoiceController {
  @PostMapping("/{id}/approve")
  public Invoice approve() {
    return new Invoice("approved");
  }
}
