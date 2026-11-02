# Module 4 – Buyers

The list of buyers (shops, distributors, customers). Every sale is made to a buyer, so each buyer's page shows all their invoices, payments and what they still owe.

## Fields

- Business/shop name, contact person.
- Phone (used for call and WhatsApp), alternate phone, email (optional).
- Address, city, **state** (decides CGST+SGST vs IGST on invoices), pincode.
- GSTIN (optional; printed on B2B invoices).
- **Credit days** (e.g. 15): how long before an unpaid invoice counts as overdue. Defaults to a global setting.
- **Opening balance**: what the buyer already owed before using this app.
- Notes, active.

## Ledger and balance

- **Sales** (from module 5) increase what the buyer owes.
- **Payments** reduce it. A payment has a date, amount, mode (cash / UPI / bank / cheque) and an optional reference (UTR, cheque number).
- **Balance** = opening balance + sales − payments.

### Payment received on a sale

Each sale has a payment status: **Unpaid → Partly paid → Paid**.

- On a sale: a **Mark as paid** button records a payment for the remaining amount (today, cash by default, editable). Partial amounts are allowed. *(Improvisation: buyers often pay part now and part later; a single yes/no flag can't record that.)*
- On the buyer's page: **Receive payment** for a lump sum, applied to the oldest unpaid sales first. The user can override which sales it settles.

### Alerts

- A sale is **overdue** when it is not fully paid and older than the buyer's credit days.
- Overdue sales show a red badge on the buyer list and the buyer page, and are counted on the dashboard.

## Screens

1. **Buyer list**: name, city, balance outstanding, red "Overdue" badge; search; sort by name or by amount owed.
2. **Buyer detail**
   - Contact card with Call and WhatsApp buttons.
   - Summary: total outstanding, overdue amount, total sales this month.
   - Timeline of sales and payments, newest first, with a filter for unpaid only.
   - Buttons: **New sale** (opens module 5 with this buyer chosen), **Receive payment**.
   - **Share statement** *(improvisation)*: WhatsApp message (or PDF) listing the unpaid invoices and total due, as a polite reminder.
3. **Add / edit buyer** form.

## Data model (draft)

- **Buyer**: fields above.
- **Payment**: buyer, date, amount, mode, reference, note.
- **PaymentAllocation**: payment, sale, amount (how much of a payment went to which sale).
- Sales themselves are defined in module 5.

Before module 5 exists, the buyer page shows only contact info, opening balance and payments.

## Dashboard cards

- Total outstanding from all buyers.
- Overdue: count of sales and amount (tap → list).

## Decisions

- Default credit period: 15 days (Settings), overridable per buyer.
- No per-buyer price lists; the rate is typed on each sale (defaults to the product price).
- Payments are applied automatically to the oldest dues first. Old dues (opening balance) count as the oldest, then invoices by date. Unused money is applied automatically to the next invoice.
- "Mark as paid" on an invoice records a payment for whatever is still due on it.
- Deleting a payment makes the invoices it paid show as due again.
