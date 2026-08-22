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

  // If no famous merchant found, check first 3 non-empty lines for brand name
  if (!detectedMerchant && lines.length > 0) {
    for (let i = 0; i < Math.min(4, lines.length); i++) {
      const line = lines[i];
      if (line.length > 3 && !line.includes("191") && !line.match(/^\d+$/) && !line.toLowerCase().includes("receipt")) {
        detectedMerchant = line;
        break;
      }
    }
  }

  // 2. Extract Amount
  let detectedAmount: number | undefined;

  // Regex patterns targeting Total amount in Malaysian receipts
  // e.g. "TOTAL 8.90", "TOTAL RM 8.90", "AMOUNT: 250.54", "Grand Total : 45.00", "Nett: 12.50", "RM250.54"
  const totalRegexes = [
    /(?:grand\s*total|total\s*amount|total|jumlah|nett|amount|subtotal|bayar|net\s*total)\s*[:=]?\s*(?:rm|myr)?\s*([0-9]+[.,][0-9]{2})/i,
    /(?:rm|myr)\s*([0-9]+[.,][0-9]{2})/i,
    /([0-9]+[.,][0-9]{2})\s*(?:total|myr|rm)?$/i,
  ];

  for (const regex of totalRegexes) {
    for (let i = lines.length - 1; i >= 0; i--) {
      const match = lines[i].match(regex);
      if (match && match[1]) {
        const parsed = parseFloat(match[1].replace(",", "."));
        if (parsed > 0 && parsed < 100000) {
          detectedAmount = parsed;
          break;
        }
      }
    }
    if (detectedAmount) break;
  }

  // Fallback: look for any number with 2 decimals in the entire text, pick the maximum or most likely total
  if (!detectedAmount) {
    const allDecimals = rawText.match(/([0-9]+[.,][0-9]{2})/g);
    if (allDecimals && allDecimals.length > 0) {
      const validNumbers = allDecimals
        .map((d) => parseFloat(d.replace(",", ".")))
        .filter((n) => n > 0 && n < 50000);
      if (validNumbers.length > 0) {
        detectedAmount = Math.max(...validNumbers);
      }
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
