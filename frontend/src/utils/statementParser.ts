import { CATEGORIES } from "../constants";
import { todayISO } from "../format";

export interface ParsedStatementTxn {
  amount: number;
  merchant: string;
  category: string;
  date: string;
  note?: string;
  account?: string;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Makan: ["mcdonald", "kfc", "tealive", "chagee", "starbucks", "zus", "foodpanda", "grabfood", "restaurant", "cafe", "kopitiam", "nasi", "bakery"],
  Groceries: ["99 speedmart", "speedmart", "lotus", "tesco", "jaya grocer", "village grocer", "aeon", "econsave", "supermarket", "grocer"],
  Petrol: ["petronas", "shell", "petron", "caltex", "bhpetrol", "fuel", "station"],
  Tolls: ["plus", "tng", "touch n go", "rfid", "toll", "highway"],
  Telco: ["celcom", "digi", "maxis", "hotlink", "u mobile", "unifi", "time dotcom"],
  Shopping: ["shopee", "lazada", "uniqlo", "padini", "decathlon", "watsons", "guardian", "mr diy", "ikea", "mall"],
  Subscriptions: ["netflix", "spotify", "youtube", "apple", "google storage", "disney", "prime"],
  "Loan / Debt": ["loan", "hire purchase", "repayment", "housing", "car loan", "ptptn", "installment", "mortgage", "interest"],
  Bills: ["duitnow", "tnb", "air selangor", "syabas", "indah water", "cimb", "maybank", "bill", "transfer", "trsf"],
};

export function parseStatementTextLocally(rawText: string): ParsedStatementTxn[] {
  const lines = rawText.split("\n").map((l) => l.trim()).filter((l) => l.length > 5);
  const results: ParsedStatementTxn[] = [];
  const currentYear = new Date().getFullYear();

  // Date pattern: e.g. "12/08", "12/08/24", "12/08/2026", "12-08-2026", "12 AUG", "12-AUG-2026"
  const dateRegex = /(?:^|\s)([0-9]{1,2}[/-][0-9]{1,2}(?:[/-][0-9]{2,4})?|[0-9]{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s+[0-9]{2,4})?)/i;

  // Amount pattern: 2 decimal places e.g. "250.54", "15.00"
  const amountRegex = /([0-9]+[.,][0-9]{2})/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();

    // Ignore headers, footers, summary lines
    if (
      lineLower.includes("page ") ||
      lineLower.includes("statement of account") ||
      lineLower.includes("total debit") ||
      lineLower.includes("total credit") ||
      lineLower.includes("beginning balance") ||
      lineLower.includes("closing balance") ||
      lineLower.includes("account number") ||
      lineLower.includes("branch") ||
      lineLower.includes("cheque no")
    ) {
      continue;
    }

    const dateMatch = line.match(dateRegex);
    const amountMatches = line.match(amountRegex);

    if (dateMatch && amountMatches && amountMatches.length > 0) {
      // Clean extracted date
      let parsedDate = todayISO();
      try {
        const rawDate = dateMatch[1].trim();
        const parts = rawDate.replace(/\//g, "-").split("-");
        if (parts.length === 2) {
          // DD-MM -> YYYY-MM-DD
          parsedDate = `${currentYear}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        } else if (parts.length === 3) {
          const yr = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
          parsedDate = `${yr}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        }
      } catch {
        parsedDate = todayISO();
      }

      // Filter out line amounts (often first is transaction amount, last is balance)
      const validAmounts = amountMatches
        .map((a) => parseFloat(a.replace(",", ".")))
        .filter((n) => n > 0.5 && n < 200000);

      if (validAmounts.length === 0) continue;

      // In Malaysian bank statements:
      // Column order is usually: Date | Description | Debit (Expense) | Credit | Balance
      // The transaction amount is typically the first amount in the line
      const txnAmount = validAmounts[0];

      // Extract description: remove date and amounts
      let desc = line
        .replace(dateMatch[0], "")
        .replace(/[0-9]+[.,][0-9]{2}/g, "")
        .replace(/[\/\*\_\|\-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (desc.length < 3) {
        desc = "Bank Transaction";
      }

      // Categorize based on description keywords
      let detectedCategory = "Bills";
      const descLower = desc.toLowerCase();

      for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some((k) => descLower.includes(k))) {
          detectedCategory = cat;
          break;
        }
      }

      results.push({
        amount: txnAmount,
        merchant: desc,
        category: detectedCategory,
        date: parsedDate,
        note: `Statement: ${desc}`,
      });
    }
  }

  // If no strict row matched, try fallback chunking
  if (results.length === 0) {
    const allAmounts = rawText.match(/([0-9]+[.,][0-9]{2})/g) || [];
    const valid = allAmounts
      .map((a) => parseFloat(a.replace(",", ".")))
      .filter((n) => n > 1.0 && n < 5000);

    for (let i = 0; i < Math.min(10, valid.length); i++) {
      results.push({
        amount: valid[i],
        merchant: `Transaction #${i + 1}`,
        category: i % 2 === 0 ? "Makan" : "Bills",
        date: todayISO(),
        note: "Imported Statement Row",
      });
    }
  }

  return results;
}
