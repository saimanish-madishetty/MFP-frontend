# Modules

Specs for each feature module of the Mahadeva Foods Stock & Sales app. All five modules are built (first version). The "Decisions" section at the end of each spec records the choices made where the spec left questions open.

| # | Module | Spec | Depends on | Status |
|---|---|---|---|---|
| 1 | Workers (registry, attendance, pay) | [01-workers.md](01-workers.md) | – | Built (first version) |
| 2 | Stock (raw materials & supplies) | [02-stock.md](02-stock.md) | – | Built (first version) |
| 3 | Products | [03-products.md](03-products.md) | 2 | Built (first version) |
| 4 | Buyers (contacts, ledger, payments) | [04-buyers.md](04-buyers.md) | – | Built (first version) |
| 5 | Sales (invoices, PDF, WhatsApp share) | [05-sales.md](05-sales.md) | 3, 4 | Built (first version) |

Company details for invoices (GSTIN, UPI, bank, prefix, terms) are on the **Settings** page.

Update the Status column as modules are built.

## Conventions (apply to every module)

**Backend (MFP-backend)**
- One NestJS module per feature (`src/workers/`, `src/stock/`, …) with its own controller, service and DTOs.
- Prisma models are added to `prisma/schema.prisma` with a migration per module (`npm run db:migrate`).
- REST endpoints under the module name, e.g. `GET /workers`, `POST /workers/:id/settlements`.
- Business rules (pay calculation, stock deduction, balances) live in services and run inside database transactions where several tables change together.

**Frontend (MFP-frontend)**
- One route per module: `/workers`, `/stock`, `/products`, `/buyers`, `/sales`. Detail pages use query params (`/workers/detail?id=…`) because the app is a static export (no server-rendered dynamic routes).
- Mobile-first: the primary device is the Android app. Lists are cards on mobile and tables on desktop; the main action of each screen is a large button within thumb reach.
- The sidebar entry for a module is switched from "Soon" to active when the module is built (`src/lib/nav.ts`).

**Data**
- The database design for all modules is in [../database.md](../database.md) (full schema: [../database.prisma](../database.prisma)).
- Money: `Decimal(12,2)`, Indian Rupees, displayed with Indian grouping (₹1,23,456.00).
- Quantities: `Decimal(12,3)` with a unit (kg, g, L, ml, pcs, …).
- Dates: business dates (attendance day, sale date) are stored as plain dates in IST (Asia/Kolkata); timestamps (`createdAt`, `updatedAt`) on every table.
- No hard deletes for anything with history (a worker with attendance, a material with movements, a buyer with sales). Use an `active` flag ("Archive") instead; archived items are hidden from pickers but kept in reports.
- Values copied at the time of a transaction (e.g. a product's price and name on an invoice line) are stored on the transaction, so later edits don't change old records.

**Dashboard**
Each module adds a few cards to the dashboard when it is built (listed in each spec).
