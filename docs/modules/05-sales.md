# Module 5 – Sales

Create invoices for buyers, generate a PDF with the company details, and share it on WhatsApp. Each sale appears on the buyer's ledger (module 4) and reduces finished goods stock (module 3).

## Company profile (settings)

A one-time settings page, used on every invoice:

- Business name, logo (`assets/logo.jpg`), address, state, phone, email.
- GSTIN, **FSSAI licence number** (expected for a food business).
- Bank details (account name, number, IFSC) and **UPI ID**. *(Improvisation: a UPI QR code for the invoice amount is printed on the PDF, so buyers can pay by scanning.)*
- Invoice number prefix and terms & conditions text.
- Name for the "Authorised signatory" line.

## Creating a sale

1. Choose a **buyer** (search; or start from the buyer's page).
2. Invoice date (defaults to today) and invoice number (automatic; see below).
3. Add **lines**: pick a product (searched by internal name, so the owner sees "Maida Noodles 1.5mm"), then quantity and rate. The rate defaults to the product price and can be edited.
4. Optional discount (per line or on the total), and notes such as vehicle number or delivery details.
5. Totals are calculated live: subtotal, discount, GST, round-off, **grand total**.
6. **Save** → the sale goes on the buyer's ledger as Unpaid, and finished stock is reduced.
7. Optionally record a payment right away (cash sale).

### Public names only

Each invoice line stores a snapshot of the product's **public name**, HSN, GST rate and rate at the time of sale. The PDF only ever prints the public name ("Mahadeva Noodles"), never the internal name or specs. Editing a product later doesn't change past invoices.

### Invoice number

Sequential per financial year (April–March), e.g. `MF/2026-27/0001`, as GST rules require. Numbers are never reused: a cancelled invoice keeps its number and is marked **Cancelled**, which also reverses its ledger and stock effects.

### GST

- Buyer in the same state as the company → **CGST + SGST** (half each).
- Buyer in another state → **IGST**.
- If the company has no GSTIN set, the document is a plain **Bill** with no tax columns.

## Invoice PDF

A4 portrait, containing:

- Header: logo, business name, address, GSTIN, FSSAI number, phone.
- "Tax Invoice" (or "Bill"), number, date.
- Bill-to: buyer name, address, GSTIN, phone.
- Table: #, item (public name), HSN, quantity, unit, rate, discount, taxable value, GST %, amount.
- Tax summary (CGST/SGST or IGST per rate), round-off, **grand total**, amount in words (Indian style: "Rupees One Lakh Twelve Thousand … Only").
- Previous balance and total due (optional toggle). *(Improvisation: buyers see what they owe in total.)*
- Bank details, UPI QR, terms, signature line.

The PDF is generated **in the app** (no server needed), so it also works in the Android app.

## Sharing on WhatsApp

- **Android app**: **Share** saves the PDF and opens Android's share sheet; pick WhatsApp and then the buyer's chat. (WhatsApp doesn't allow an app to attach a file straight into a specific chat; the share sheet is the standard route.)
- **Also**: **Message on WhatsApp** opens the buyer's chat directly (using their phone number) with a text summary: invoice number, amount, due date.
- **Web**: Share uses the browser's share feature where supported; otherwise the PDF downloads.

## Screens

1. **Sales list**: invoice number, date, buyer, amount, status badge (Unpaid / Partly paid / Paid / Overdue / Cancelled); filter by status and date range; search by buyer or number.
2. **New / edit sale**: the flow above, with a sticky total and Save at the bottom on mobile.
3. **Sale detail**: invoice preview, buttons **Share PDF**, **WhatsApp message**, **Mark as paid**, Edit, Cancel invoice; payments received against it.
4. **Settings → Company profile**.

## Data model (draft)

- **CompanyProfile**: one row with the fields above.
- **Sale**: number, financial year, date, buyer, subtotal, discount, tax totals, round-off, grand total, place of supply (state), notes, status (computed from payments), cancelled at/reason.
- **SaleLine**: sale, product, public name snapshot, HSN, quantity, unit, rate, discount, GST rate, tax amounts, line total.
- Payments and allocations: module 4.

## Dashboard cards

- Sales today and this month.
- Recent invoices.

## Decisions

- GST: a tax invoice when the company has a GSTIN in Settings, otherwise a plain bill without GST.
- Prices exclude GST by default (Settings switch).
- Selling more than the ready stock shows a warning but is allowed.
- Invoices can be edited (same number, same financial year). The total can't drop below what is already paid.
- Cancelling keeps the number, returns the stock, and keeps any payment as buyer credit.
- A4 PDF only; it is made in the app (pdfmake) and includes a UPI QR code for the amount due.
- Thermal-printer receipts: not built.
