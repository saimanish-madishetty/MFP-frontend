import type { Content, TDocumentDefinitions, TableCell } from "pdfmake/interfaces";
import { formatDay } from "./format";
import { amountInWords, type CompanyProfile, type SaleDetail } from "./sales";
import { formatQty, unitShort } from "./stock";

const MONEY = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rs = (v: string | number) => `₹${MONEY.format(Number(v))}`;
const BRAND = "#b45309";
const MUTED = "#6b7280";
const LINE = "#d1d5db";

async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch("/mahadeva_icon.jpeg");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Invoice PDF content. Only public product names are printed. */
function definition(sale: SaleDetail, company: CompanyProfile, logo: string | null): TDocumentDefinitions {
  const taxed = sale.type === "TAX_INVOICE";
  const due = Number(sale.grandTotal) - Number(sale.amountPaid);
  const companyAddress = [company.address, company.city, company.state, company.pincode].filter(Boolean).join(", ");
  const contact = [company.phone && `Ph: ${company.phone}`, company.email].filter(Boolean).join(" · ");
  const ids = [company.gstin && `GSTIN: ${company.gstin}`, company.fssaiNumber && `FSSAI: ${company.fssaiNumber}`]
    .filter(Boolean)
    .join("   ");

  const header: Content = {
    columnGap: 12,
    columns: [
      ...(logo ? [{ image: logo, width: 64 }] : []),
      {
        width: "*",
        stack: [
          { text: company.businessName, style: "company" },
          companyAddress && { text: companyAddress, style: "small" },
          contact && { text: contact, style: "small" },
          ids && { text: ids, style: "small", bold: true },
        ].filter(Boolean) as Content[],
      },
      {
        width: "auto",
        alignment: "right",
        stack: [
          { text: taxed ? "TAX INVOICE" : "BILL", style: "docTitle" },
          { text: sale.invoiceNumber, bold: true, margin: [0, 4, 0, 0] },
          { text: `Date: ${formatDay(sale.date, { weekday: false })}`, style: "small" },
          { text: `Due: ${formatDay(sale.dueDate, { weekday: false })}`, style: "small" },
        ],
      },
    ],
  };

  const billTo: Content = {
    margin: [0, 14, 0, 10],
    table: {
      widths: ["*", "auto"],
      body: [
        [
          {
            stack: [
              { text: "BILL TO", style: "label" },
              { text: sale.buyerName, bold: true, fontSize: 11 },
              sale.buyerAddress && { text: sale.buyerAddress, style: "small" },
              sale.buyerPhone && { text: `Ph: ${sale.buyerPhone}`, style: "small" },
              sale.buyerGstin && { text: `GSTIN: ${sale.buyerGstin}`, style: "small", bold: true },
            ].filter(Boolean) as Content[],
          },
          taxed
            ? {
                alignment: "right",
                stack: [
                  { text: "PLACE OF SUPPLY", style: "label" },
                  { text: sale.placeOfSupply ?? "—" },
                ],
              }
            : { text: "" },
        ],
      ],
    },
    layout: {
      hLineColor: () => LINE,
      vLineColor: () => LINE,
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 6,
      paddingBottom: () => 6,
    },
  };

  const head = (taxed
    ? ["#", "Item", "HSN", "Qty", "Rate", "Disc.", "Taxable", "GST", "Amount"]
    : ["#", "Item", "Qty", "Rate", "Disc.", "Amount"]
  ).map((t, i) => ({ text: t, style: "th", alignment: i >= (taxed ? 3 : 2) ? "right" : "left" }) as TableCell);

  const rows: TableCell[][] = sale.lines.map((l) => {
    const qty = `${formatQty(l.quantity)} ${unitShort(l.unit)}`;
    const disc = Number(l.discount) > 0 ? MONEY.format(Number(l.discount)) : "—";
    const right = (text: string) => ({ text, alignment: "right" }) as TableCell;
    return taxed
      ? [
          String(l.lineNo),
          l.publicName,
          l.hsnCode ?? "",
          right(qty),
          right(MONEY.format(Number(l.rate))),
          right(disc),
          right(MONEY.format(Number(l.taxableValue))),
          right(`${Number(l.gstRate)}%`),
          right(MONEY.format(Number(l.lineTotal))),
        ]
      : [
          String(l.lineNo),
          l.publicName,
          right(qty),
          right(MONEY.format(Number(l.rate))),
          right(disc),
          right(MONEY.format(Number(l.lineTotal))),
        ];
  });

  const items: Content = {
    table: {
      headerRows: 1,
      widths: taxed ? [14, "*", 34, 46, 44, 34, 52, 28, 56] : [14, "*", 60, 60, 50, 70],
      body: [head, ...rows],
    },
    layout: {
      fillColor: (row: number) => (row === 0 ? "#f3f4f6" : null),
      hLineColor: () => LINE,
      vLineWidth: () => 0,
      hLineWidth: (i: number, node: { table: { body: unknown[] } }) => (i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5),
      paddingTop: () => 5,
      paddingBottom: () => 5,
    },
    fontSize: 8.5,
  };

  const totalsRows: [string, string, boolean?][] = [
    [taxed ? "Taxable value" : "Subtotal", rs(taxed ? sale.taxableTotal : Number(sale.subtotal) - Number(sale.discountTotal))],
  ];
  if (taxed && Number(sale.discountTotal) > 0) totalsRows.unshift(["Discount", `− ${rs(sale.discountTotal)}`]);
  if (!taxed && Number(sale.discountTotal) > 0) totalsRows.unshift(["Discount", `− ${rs(sale.discountTotal)}`]);
  if (Number(sale.cgstTotal) > 0) totalsRows.push(["CGST", rs(sale.cgstTotal)], ["SGST", rs(sale.sgstTotal)]);
  if (Number(sale.igstTotal) > 0) totalsRows.push(["IGST", rs(sale.igstTotal)]);
  if (Number(sale.roundOff) !== 0) totalsRows.push(["Round off", rs(sale.roundOff)]);
  totalsRows.push(["TOTAL", rs(sale.grandTotal), true]);
  if (Number(sale.amountPaid) > 0) totalsRows.push(["Paid", `− ${rs(sale.amountPaid)}`], ["Balance on this invoice", rs(due), true]);

  const prev = Number(sale.previousBalance);
  const totals: Content = {
    margin: [0, 10, 0, 0],
    columns: [
      {
        width: "*",
        stack: [
          { text: "Amount in words", style: "label" },
          { text: amountInWords(Number(sale.grandTotal)), italics: true, margin: [0, 2, 0, 0] },
          ...(prev !== 0 && !sale.cancelledAt
            ? [
                {
                  margin: [0, 10, 0, 0] as [number, number, number, number],
                  text: [
                    { text: prev > 0 ? "Previous balance: " : "Advance with us: ", color: MUTED },
                    rs(Math.abs(prev)),
                    { text: "   Total due now: ", color: MUTED },
                    { text: rs(Math.max(prev + due, 0)), bold: true },
                  ],
                },
              ]
            : []),
          ...(sale.notes ? [{ text: sale.notes, style: "small", margin: [0, 8, 0, 0] as [number, number, number, number] }] : []),
        ],
      },
      {
        width: 210,
        table: {
          widths: ["*", "auto"],
          body: totalsRows.map(([label, value, bold]) => [
            { text: label, bold, color: bold ? "#111827" : MUTED },
            { text: value, bold, alignment: "right", fontSize: bold ? 11 : 9 },
          ]),
        },
        layout: "noBorders",
      },
    ],
  };

  const upiAmount = due > 0 ? due.toFixed(2) : undefined;
  const upi =
    company.upiId && upiAmount && !sale.cancelledAt
      ? `upi://pay?pa=${encodeURIComponent(company.upiId)}&pn=${encodeURIComponent(company.businessName)}&am=${upiAmount}&cu=INR&tn=${encodeURIComponent(sale.invoiceNumber)}`
      : null;
  const bank = [
    company.bankName && `Bank: ${company.bankName}`,
    company.bankAccountName && `A/c name: ${company.bankAccountName}`,
    company.bankAccountNumber && `A/c no: ${company.bankAccountNumber}`,
    company.bankIfsc && `IFSC: ${company.bankIfsc}`,
    company.upiId && `UPI: ${company.upiId}`,
  ].filter(Boolean) as string[];

  const footer: Content = {
    margin: [0, 18, 0, 0],
    columns: [
      ...(upi
        ? [
            {
              width: 92,
              stack: [
                { qr: upi, fit: 84 },
                { text: "Scan to pay", style: "small", alignment: "center" as const, margin: [0, 2, 0, 0] as [number, number, number, number] },
              ],
            },
          ]
        : []),
      {
        width: "*",
        stack: [
          ...(bank.length ? [{ text: "Payment details", style: "label" }, ...bank.map((b) => ({ text: b, style: "small" }))] : []),
          ...(company.termsText
            ? [{ text: "Terms", style: "label", margin: [0, 8, 0, 0] as [number, number, number, number] }, { text: company.termsText, style: "small" }]
            : []),
        ],
      },
      {
        width: 150,
        alignment: "right",
        stack: [
          { text: `For ${company.businessName}`, bold: true },
          { text: " ", margin: [0, 26, 0, 0] },
          { canvas: [{ type: "line", x1: 20, y1: 0, x2: 150, y2: 0, lineWidth: 0.5, lineColor: LINE }] },
          { text: company.signatoryName || "Authorised signatory", style: "small", margin: [0, 2, 0, 0] },
        ],
      },
    ],
  };

  return {
    pageSize: "A4",
    pageMargins: [36, 36, 36, 40],
    info: { title: `${sale.invoiceNumber} - ${sale.buyerName}` },
    defaultStyle: { font: "Roboto", fontSize: 9, color: "#111827" },
    watermark: sale.cancelledAt ? { text: "CANCELLED", color: "red", opacity: 0.15, bold: true } : undefined,
    content: [header, billTo, items, totals, footer],
    footer: (page: number, count: number) => ({
      text: count > 1 ? `Page ${page} of ${count}` : "",
      alignment: "center",
      fontSize: 7,
      color: MUTED,
    }),
    styles: {
      company: { fontSize: 16, bold: true, color: BRAND },
      docTitle: { fontSize: 14, bold: true, color: BRAND },
      small: { fontSize: 8, color: "#374151" },
      label: { fontSize: 7, bold: true, color: MUTED, characterSpacing: 0.5 },
      th: { bold: true, fontSize: 8 },
    },
  };
}

type PdfMake = typeof import("pdfmake/build/pdfmake");

async function pdfMake(): Promise<PdfMake> {
  const mod = (await import("pdfmake/build/pdfmake")) as PdfMake & { default?: PdfMake };
  const lib = mod.default ?? mod;
  const fonts = (await import("pdfmake/build/vfs_fonts")) as unknown as { default?: Record<string, string> };
  lib.addVirtualFileSystem((fonts.default ?? fonts) as Record<string, string>);
  return lib;
}

export function invoiceFileName(sale: Pick<SaleDetail, "invoiceNumber" | "buyerName">) {
  const safe = (s: string) => s.replace(/[^\w-]+/g, "_").replace(/_+/g, "_");
  return `${safe(sale.invoiceNumber)}_${safe(sale.buyerName)}.pdf`;
}

export async function invoicePdf(sale: SaleDetail, company: CompanyProfile) {
  const [lib, logo] = await Promise.all([pdfMake(), loadLogo()]);
  return lib.createPdf(definition(sale, company, logo));
}
