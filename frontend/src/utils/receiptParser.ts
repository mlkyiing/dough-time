import { CATEGORIES } from "../constants";

export interface ParsedReceiptResult {
  amount?: number;
  merchant?: string;
  category?: string;
  date?: string;
  note?: string;
  account?: string;
}

const MALAYSIAN_MERCHANTS: { name: string; category: string; aliases: string[] }[] = [
  { name: "McDonald's", category: "Makan", aliases: ["mcdonald", "mcd", "golden arches", "gerbang alaf"] },
  { name: "KFC", category: "Makan", aliases: ["kfc", "kentucky", "qsr brands"] },
  { name: "FamilyMart", category: "Makan", aliases: ["familymart", "ql maxincome"] },
  { name: "CU Mart", category: "Makan", aliases: ["cu mart", "cu convenience"] },
  { name: "Tealive", category: "Makan", aliases: ["tealive", "loob holding"] },
  { name: "Chagee", category: "Makan", aliases: ["chagee", "boba"] },
  { name: "Mixue", category: "Makan", aliases: ["mixue", "ice cream"] },
  { name: "Starbucks", category: "Makan", aliases: ["starbucks", "berjaya starbucks"] },
  { name: "Zus Coffee", category: "Makan", aliases: ["zus coffee", "zus"] },
  { name: "Subway", category: "Makan", aliases: ["subway"] },
  { name: "Texas Chicken", category: "Makan", aliases: ["texas chicken"] },
  { name: "Marrybrown", category: "Makan", aliases: ["marrybrown"] },
  { name: "Pizza Hut", category: "Makan", aliases: ["pizza hut"] },
  { name: "Dominos", category: "Makan", aliases: ["dominos"] },
  { name: "Nando's", category: "Makan", aliases: ["nando", "nandos"] },
  { name: "Sushi King", category: "Makan", aliases: ["sushi king"] },
  { name: "Hai Di Lao", category: "Makan", aliases: ["hai di lao", "haidilao"] },
  { name: "OldTown White Coffee", category: "Makan", aliases: ["oldtown", "kopitiam"] },
  { name: "Secret Recipe", category: "Makan", aliases: ["secret recipe"] },
  { name: "99 Speedmart", category: "Groceries", aliases: ["99 speedmart", "speedmart"] },
  { name: "Lotus's", category: "Groceries", aliases: ["lotus", "tesco", "lotus's"] },
  { name: "Jaya Grocer", category: "Groceries", aliases: ["jaya grocer", "trendcell"] },
  { name: "Village Grocer", category: "Groceries", aliases: ["village grocer", "tmy market"] },
  { name: "AEON Supermarket", category: "Groceries", aliases: ["aeon co", "aeon big", "aeon"] },
  { name: "NSK Trade City", category: "Groceries", aliases: ["nsk trade", "nsk"] },
  { name: "Econsave", category: "Groceries", aliases: ["econsave"] },
  { name: "Giant Hypermarket", category: "Groceries", aliases: ["giant", "gch retail"] },
  { name: "HeroMarket", category: "Groceries", aliases: ["heromarket", "hero market"] },
  { name: "Petronas", category: "Petrol", aliases: ["petronas", "mesra", "petronas dagangan"] },
  { name: "Shell", category: "Petrol", aliases: ["shell", "shell malaysia"] },
  { name: "Petron", category: "Petrol", aliases: ["petron"] },
  { name: "Caltex", category: "Petrol", aliases: ["caltex", "chevron"] },
  { name: "BHPetrol", category: "Petrol", aliases: ["bhp", "bhpetrol", "boustead"] },
  { name: "Touch 'n Go", category: "Tolls", aliases: ["touch n go", "tng", "plus rfid", "tng digital"] },
  { name: "PLUS Expressway", category: "Tolls", aliases: ["plus highway", "plus expressway", "lebuhraya"] },
  { name: "Uniqlo", category: "Shopping", aliases: ["uniqlo", "fast retailing"] },
  { name: "Padini", category: "Shopping", aliases: ["padini", "brands outlet", "vincci"] },
  { name: "Decathlon", category: "Shopping", aliases: ["decathlon"] },
  { name: "Watsons", category: "Health", aliases: ["watson", "watsons"] },
  { name: "Guardian", category: "Health", aliases: ["guardian"] },
  { name: "Caring Pharmacy", category: "Health", aliases: ["caring pharmacy", "caring"] },
  { name: "Shopee", category: "Shopping", aliases: ["shopee", "shopeepay"] },
  { name: "Lazada", category: "Shopping", aliases: ["lazada"] },
  { name: "Grab", category: "Transport", aliases: ["grab", "grabpay", "grabcar"] },
  { name: "Foodpanda", category: "Makan", aliases: ["foodpanda", "delivery hero"] },
  { name: "Maybank DuitNow", category: "Bills", aliases: ["maybank", "duitnow", "mae"] },
  { name: "CIMB Clicks", category: "Bills", aliases: ["cimb", "cimb clicks"] },
  { name: "TNB (Electricity)", category: "Bills", aliases: ["tenaga nasional", "tnb"] },
  { name: "Air Selangor", category: "Bills", aliases: ["air selangor", "syabas"] },
  { name: "CelcomDigi", category: "Telco", aliases: ["celcom", "digi", "celcomdigi"] },
  { name: "Maxis", category: "Telco", aliases: ["maxis", "hotlink"] },
  { name: "U Mobile", category: "Telco", aliases: ["u mobile", "umobile"] },
  { name: "Netflix", category: "Subscriptions", aliases: ["netflix"] },
  { name: "Spotify", category: "Subscriptions", aliases: ["spotify"] },
];

export function parseReceiptTextLocally(rawText: string): ParsedReceiptResult {
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  const textLower = rawText.toLowerCase();

  // 1. Extract Merchant & Category
  let detectedMerchant = "";
  let detectedCategory = "Makan";

  for (const m of MALAYSIAN_MERCHANTS) {
    for (const alias of m.aliases) {
      if (textLower.includes(alias)) {
        detectedMerchant = m.name;
        detectedCategory = m.category;
        break;
      }
    }
    if (detectedMerchant) break;
  }

  // If no famous merchant found, check first 4 non-empty lines for brand name
  if (!detectedMerchant && lines.length > 0) {
    for (let i = 0; i < Math.min(4, lines.length); i++) {
      const line = lines[i];
      if (line.length > 3 && !line.includes("191") && !line.match(/^\d+$/) && !line.toLowerCase().includes("receipt")) {
        detectedMerchant = line;
        break;
      }
    }
  }

  // 2. High-Precision Amount Extraction
  let detectedAmount: number | undefined;

  // Patterns to exclude (tax lines, change, invoice IDs, quantities, tel numbers)
  const excludePattern = /(?:service\s*tax|6%|8%|sst|gst|tax\s*amount|change|baki|rounding|round\s*adj|inv#|tel|orderkey|qty|reg|table)/i;

  // Target lines that represent final bill total or payment amount
  const totalLineKeywords = /(?:takeout\s*total|dine\s*in\s*total|grand\s*total|total\s*amount|subtotal|total|jumlah|nett|net\s*total|mobile\s*order|amount|bayar|paid|mastercard|visa|tng|duitnow|cash)/i;

  const candidateAmounts: { amount: number; priority: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();

    // Skip lines that are specifically tax or change
    if (excludePattern.test(lineLower) && !lineLower.includes("takeout") && !lineLower.includes("grand total")) {
      continue;
    }

    // Check if line contains total keyword
    if (totalLineKeywords.test(lineLower)) {
      // Find all decimal numbers in this line (e.g. 8.90, 8.40)
      const matches = line.match(/([0-9]+[.,][0-9]{2})/g);
      if (matches) {
        for (const m of matches) {
          const val = parseFloat(m.replace(",", "."));
          if (val > 0.40 && val < 50000) {
            let priority = 1;
            if (lineLower.includes("takeout total") || lineLower.includes("grand total") || lineLower.includes("dine in total")) {
              priority = 5;
            } else if (lineLower.includes("total") && !lineLower.includes("tax")) {
              priority = 4;
            } else if (lineLower.includes("mobile order") || lineLower.includes("paid") || lineLower.includes("bayar")) {
              priority = 3;
            } else if (lineLower.includes("subtotal")) {
              priority = 2;
            }
            candidateAmounts.push({ amount: val, priority });
          }
        }
      }
    }
  }

  // Sort candidates by priority (highest priority first), then by amount
  if (candidateAmounts.length > 0) {
    candidateAmounts.sort((a, b) => b.priority - a.priority || b.amount - a.amount);
    detectedAmount = candidateAmounts[0].amount;
  }

  // Fallback: If no candidate line found, scan all non-excluded lines for the maximum reasonable price
  if (!detectedAmount) {
    const validNumbers: number[] = [];
    for (const line of lines) {
      if (excludePattern.test(line)) continue;
      const matches = line.match(/([0-9]+[.,][0-9]{2})/g);
      if (matches) {
        for (const m of matches) {
          const val = parseFloat(m.replace(",", "."));
          if (val > 0.40 && val < 10000) {
            validNumbers.push(val);
          }
        }
      }
    }
    if (validNumbers.length > 0) {
      detectedAmount = Math.max(...validNumbers);
    }
  }

  // 3. Extract Date
  let detectedDate: string | undefined;
  const dateRegex = /(?:date|tarikh)?\s*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}|[0-9]{4}[/-][0-9]{1,2}[/-][0-9]{1,2})/i;
  const dateMatch = rawText.match(dateRegex);
  if (dateMatch && dateMatch[1]) {
    try {
      const rawDateStr = dateMatch[1].replace(/\//g, "-");
      const parts = rawDateStr.split("-");
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY-MM-DD
          detectedDate = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
        } else if (parts[2].length === 4 || parts[2].length === 2) {
          // DD-MM-YYYY
          const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
          detectedDate = `${year}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        }
      }
    } catch {
      // ignore
    }
  }

  return {
    amount: detectedAmount,
    merchant: detectedMerchant || "Scanned Receipt",
    category: detectedCategory,
    date: detectedDate,
    note: detectedMerchant ? `${detectedMerchant} Purchase` : undefined,
  };
}
