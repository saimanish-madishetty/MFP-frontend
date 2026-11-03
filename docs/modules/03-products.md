# Module 3 – Products

A catalogue of the products Mahadeva Foods makes. For each product, the materials it uses (ingredients and packaging) are listed, and each product has an **internal name** for the owner and a **public name** for invoices.

## Internal vs public name

| | Internal name | Public name |
|---|---|---|
| Example | Mahadeva Maida Noodles 1.5mm | Mahadeva Noodles |
| Shown in | Everywhere inside the app | Invoices, PDFs, anything shared with buyers |

Internal details such as thickness or recipe notes are kept in **internal specs** and are never shown to buyers. Module 5 (Sales) uses only the public name on invoices.

## Fields

- Internal name, **public name**, product code/SKU (short, e.g. `MN-15`).
- Pack size + unit (e.g. 500 g, 1 kg, 20 pcs per carton) and the unit sold in (pack, carton, kg).
- Default selling price (per sold unit), MRP (optional).
- GST: HSN code and GST rate (%), both needed for GST invoices.
- Internal specs: free-form key–value list (e.g. Thickness → 1.5 mm, Cooking time → 3 min). Internal only.
- Photo (optional, later; stored in Supabase Storage once hosted).
- Active flag.

## Materials used (recipe / bill of materials)

Two sections on the product form:

- **Ingredients** (raw materials from module 2): material + quantity **per sold unit**, e.g. 0.48 kg maida per 500 g pack.
- **Packaging & supplies** (supplies from module 2): e.g. 1 pouch, 1 label, 1/24 carton per pack.

Quantities can be left blank at first and filled in later. They're needed for:

- **Cost estimate** *(improvisation)*: using each material's last purchase cost, show the estimated cost per unit and margin against the selling price. Internal only.
- **Formula for day-end entry** (future, see module 2): products made × recipe = material usage.

## Finished goods stock *(improvisation, to confirm)*

Track how many packs of each product are in stock:

- **+** when the day-end entry records "products made" (adds a "Products made" section to the module 2 day-end screen).
- **−** when a sale is made (module 5).
- **±** manual adjustment (damaged, samples, count correction).

This lets the app warn when selling more than is in stock, and shows finished stock on the dashboard.

## Data model (draft)

- **Product**: internal name, public name, code, pack size, pack unit, sale unit, price, MRP, HSN, GST rate, specs (JSON key–value), current finished quantity, active.
- **ProductMaterial**: product, material, quantity per sold unit.
- **ProductStockMovement**: product, date, type (`PRODUCED` / `SOLD` / `ADJUSTMENT`), quantity, link to production entry or sale.

## Screens

1. **Product list**: internal name, public name underneath, price, finished stock.
2. **Product detail**: all fields, the materials list split into ingredients and packaging, cost estimate, stock history.
3. **Add / edit product**: the form above, with the materials list picked from module 2 (search, add a row, quantity).

## Dashboard cards

- Finished goods in stock (top products).

## Decisions

- Finished goods stock is tracked: "Products made" on the day-end entry adds stock, sales remove it, cancelled sales return it, and manual adjustments are possible.
- Each pack size is a separate product.
- **Packing** (Nov 2026): a product is "sold as" a pack/bag/box, with optional **pieces inside** (e.g. 10 × 500 g) or a single size (e.g. 25 kg bag). Stock is kept in the smallest sellable unit: pieces for pieced products, kg/L for weighed ones, so loose pieces or kilos can be sold. Production is entered in packs/bags; each invoice line picks pack or piece (bag or kg) and the rate converts. The price can be per pack, per piece or per kg. Recipe lines can be per piece or per pack. Invoices print the packing (e.g. "10 × 500 g pack (5 kg)") under the public name. Rules: `MFP-backend/src/products/packaging.ts`. Once stock exists, a product can't switch between pieces, weight and whole units; use **Duplicate** to add another size.
- Whether prices include GST is a company setting (Settings → "My prices include GST"), not per product.
- Material quantities in the recipe can be left blank; the cost estimate says when it is incomplete.
- Auto-filling material usage from recipes ("formula") is still to be discussed.
