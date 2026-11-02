# Module 2 – Stock

Track materials in two groups, record purchases, and at day end record how much of each material was used in production.

## Material types

- **Raw materials**: ingredients, e.g. maida, salt, oil.
- **Supplies**: packaging and consumables, e.g. pouches, cartons, labels, tape.

## Concepts

- **Stock ledger**: every change to a material's quantity is a **movement**. Current stock is the sum of movements. It is also kept as a stored running total for fast display, updated in the same transaction. This gives a full history of why the stock is what it is.
- **Movement types**:
  | Type | Effect | Created by |
  |---|---|---|
  | Opening | + | Setting the starting stock when the material is added |
  | Purchase | + | "Add purchase" (quantity, optional cost and supplier) |
  | Usage | − | Day-end production entry |
  | Adjustment | + / − | Wastage, damage, or a correction after a physical count (reason required) |
- **Day-end production entry**: one entry per date, listing each material used and how much. Editable later; editing replaces that day's usage movements.
- **Negative stock** is allowed (day-end entries record reality and shouldn't be blocked) but is shown in red, which is a prompt to record a missed purchase.

## Formula (future, to be discussed)

Once Products (module 3) exist with their materials list, the day-end entry can ask for "products made" and pre-fill the material usage from the product recipes. Until then, usage is entered by hand. This is deliberately left out of the first version.

## Data model (draft)

- **Material**: name, type (`RAW` / `SUPPLY`), unit (kg, g, L, ml, pcs, rolls, …), current quantity, low-stock level (optional), last purchase cost per unit (optional, used later for product cost estimates), notes, active.
- **StockMovement**: material, date, type, quantity (signed), cost per unit (purchases), supplier (free text, purchases), reason/note, production entry (for usage).
- **ProductionEntry**: date (unique), notes.

## Screens

1. **Stock list**: Raw materials / Supplies / Products tabs (Products shows ready finished-goods stock, which production adds to), search, current quantity with unit, "Low" badge at or below the low-stock level, red when negative.
2. **Production** (`/production`, the main daily action; opened from the **Add production** hot key on the dashboard, not from the Stock page)
   - Date (defaults to today).
   - All active materials with a quantity input; materials used most recently are listed first. Blank means not used.
   - Shows the stock left after this entry next to each material, as a check before saving.
3. **Material detail**: current stock, movement history (date, type, quantity, running balance), buttons for **Add purchase** and **Adjust**.
4. **Add purchase**: material, quantity, cost per unit or total (optional), supplier (free text, remembers past names), date.
5. **Add / edit material** form, including opening stock.

## Dashboard cards

- Low-stock materials count (tap → filtered list).
- Day-end entry done today? (Yes / "Not entered yet" reminder.)

## Decisions

- Supplier is a free-text name on each purchase, with suggestions from past purchases. A separate Suppliers list can be added later.
- No batch or expiry tracking in the first version.
- Supplier payments (paid / pending) are not tracked.
- Opening stock has a "counted on" date (defaults to today).
- "Last cost" comes from the most recent purchase with a price, falling back to the opening cost.
- Purchases, adjustments and opening stock can be deleted if entered by mistake; usage is changed only through the day-end entry.
- A material's unit can't be changed once stock has been recorded.
- The day-end entry is its own **Production** page, reached from the dashboard hot keys (New sale, Add production, View stock, Add buyer). Products made can be entered even before any materials exist.
