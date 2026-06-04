---
title: Finance Control
created: 2026-04-30
updated: 2026-05-01
tags: [root, finance, accounting, tax, reconciliation]
---

## Summary

The finance control system tracks accounts, payables, reconciliation, and tax obligations. It provides a unified view of cash flow across Content Co-op and ACS operations.

## API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/root/finance` | Finance dashboard data |
| GET | `/api/root/finance/overview` | High-level overview |
| GET | `/api/root/finance/accounts` | Chart of accounts |
| GET | `/api/root/finance/payables` | Accounts payable |
| GET | `/api/root/finance/reconciliation` | Bank reconciliation |
| GET | `/api/root/finance/rules` | Automation rules |
| GET | `/api/root/finance/tax` | Tax data and obligations |
| GET | `/api/root/payments` | Payment ledger |
| GET | `/api/root/payments/[id]` | Payment detail |

## Chart of Accounts

The finance system tracks:
- **Revenue**: Video production, editing, scriptwriting, delivery
- **Cost of Goods Sold**: Crew costs, equipment rental, stock media
- **Operating Expenses**: Software, hosting, marketing, insurance
- **Tax**: Sales tax collection, quarterly estimates

## Reconciliation

Bank reconciliation matches Stripe payouts, bank transfers, and recorded payments. Discrepancies are flagged for manual review.

## Tax

Sales tax is calculated based on client location. The system integrates with tax APIs for rate lookup and generates quarterly estimated tax reports.

## Related

- [[quote-invoice-system]] — Revenue source
- [[stripe-integration]] — Payment reconciliation
- [[acs-overview]] — Shared finance across businesses
