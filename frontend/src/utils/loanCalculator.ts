import { amountToWorkHours } from "../format";

export type LoanCalculationType = "flat" | "reducing";

export interface LoanCalculationResult {
  monthlyInstallment: number;
  monthlyPrincipal: number;
  monthlyInterest: number;
  totalInterest: number;
  totalPayable: number;
  workHoursPerMonth: number;
  estimatedMonthsRemaining?: number;
  calculationType: LoanCalculationType;
}

/**
 * Malaysian Flat Rate Loan Calculation (Car Hire Purchase / Personal Fixed Rate)
 * Formula:
 * Total Interest = Principal * Annual Rate% * (Months / 12)
 * Total Payable = Principal + Total Interest
 * Monthly Installment = Total Payable / Months
 */
export function calculateFlatRateLoan(
  principal: number,
  annualRatePct: number,
  tenureMonths: number,
  hourlyRate: number = 25.96,
  currentBalance?: number
): LoanCalculationResult {
  if (principal <= 0 || tenureMonths <= 0) {
    return {
      monthlyInstallment: 0,
      monthlyPrincipal: 0,
      monthlyInterest: 0,
      totalInterest: 0,
      totalPayable: 0,
      workHoursPerMonth: 0,
      calculationType: "flat",
    };
  }

  const rate = Math.max(0, annualRatePct) / 100;
  const years = tenureMonths / 12;
  const totalInterest = +(principal * rate * years).toFixed(2);
  const totalPayable = +(principal + totalInterest).toFixed(2);
  const monthlyInstallment = +(totalPayable / tenureMonths).toFixed(2);
  const monthlyPrincipal = +(principal / tenureMonths).toFixed(2);
  const monthlyInterest = +(totalInterest / tenureMonths).toFixed(2);
  const workHours = amountToWorkHours(monthlyInstallment, hourlyRate);

  let estimatedMonthsRemaining: number | undefined;
  if (currentBalance !== undefined && currentBalance > 0 && monthlyInstallment > 0) {
    estimatedMonthsRemaining = Math.ceil(currentBalance / monthlyInstallment);
  }

  return {
    monthlyInstallment,
    monthlyPrincipal,
    monthlyInterest,
    totalInterest,
    totalPayable,
    workHoursPerMonth: +workHours.toFixed(1),
    estimatedMonthsRemaining,
    calculationType: "flat",
  };
}

/**
 * Reducing Balance Loan Calculation (Housing Mortgages / Islamic Home Financing / Personal Reducing Loans)
 * Formula:
 * P * [ r(1 + r)^n ] / [ (1 + r)^n – 1]
 */
export function calculateReducingBalanceLoan(
  principal: number,
  annualRatePct: number,
  tenureMonths: number,
  hourlyRate: number = 25.96,
  currentBalance?: number
): LoanCalculationResult {
  if (principal <= 0 || tenureMonths <= 0) {
    return {
      monthlyInstallment: 0,
      monthlyPrincipal: 0,
      monthlyInterest: 0,
      totalInterest: 0,
      totalPayable: 0,
      workHoursPerMonth: 0,
      calculationType: "reducing",
    };
  }

  const monthlyRate = Math.max(0, annualRatePct) / 100 / 12;
  let monthlyInstallment = 0;

  if (monthlyRate === 0) {
    monthlyInstallment = +(principal / tenureMonths).toFixed(2);
  } else {
    const factor = Math.pow(1 + monthlyRate, tenureMonths);
    monthlyInstallment = +(principal * ((monthlyRate * factor) / (factor - 1))).toFixed(2);
  }

  const totalPayable = +(monthlyInstallment * tenureMonths).toFixed(2);
  const totalInterest = Math.max(0, +(totalPayable - principal).toFixed(2));

  // First month breakdown:
  const firstMonthInterest = +(principal * monthlyRate).toFixed(2);
  const firstMonthPrincipal = +(monthlyInstallment - firstMonthInterest).toFixed(2);
  const workHours = amountToWorkHours(monthlyInstallment, hourlyRate);

  let estimatedMonthsRemaining: number | undefined;
  if (currentBalance !== undefined && currentBalance > 0 && monthlyInstallment > 0) {
    estimatedMonthsRemaining = Math.ceil(currentBalance / monthlyInstallment);
  }

  return {
    monthlyInstallment,
    monthlyPrincipal: Math.max(0, firstMonthPrincipal),
    monthlyInterest: firstMonthInterest,
    totalInterest,
    totalPayable,
    workHoursPerMonth: +workHours.toFixed(1),
    estimatedMonthsRemaining,
    calculationType: "reducing",
  };
}

/**
 * Unified deduction calculator helper
 */
export function calculateLoanRepayment({
  principal,
  interestRate = 3.2,
  tenureMonths = 60,
  type = "flat",
  hourlyRate = 25.96,
  currentBalance,
}: {
  principal: number;
  interestRate?: number;
  tenureMonths?: number;
  type?: LoanCalculationType;
  hourlyRate?: number;
  currentBalance?: number;
}): LoanCalculationResult {
  if (type === "reducing") {
    return calculateReducingBalanceLoan(principal, interestRate, tenureMonths, hourlyRate, currentBalance);
  }
  return calculateFlatRateLoan(principal, interestRate, tenureMonths, hourlyRate, currentBalance);
}

/**
 * Format tenure months into readable years + months
 */
export function formatTenure(months: number): string {
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) {
    return `${years} ${years === 1 ? "year" : "years"} (${months} mos)`;
  }
  return `${years}y ${rem}m (${months} mos)`;
}
