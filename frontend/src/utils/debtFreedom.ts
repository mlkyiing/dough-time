import { Account, isLiabilityAccount } from "../types";
import { amountToWorkHours } from "../format";

export interface LoanPayoffDetail {
  account: Account;
  balance: number;
  rate: number;
  monthlyInstallment: number;
  monthsRemaining: number;
  totalInterestRemaining: number;
  totalPayableRemaining: number;
  workHoursRemaining: number;
}

export interface DebtFreedomAnalysis {
  totalDebt: number;
  totalDebtWorkHours: number;
  totalMonthlyCommitment: number;
  loans: LoanPayoffDetail[];
  baseMaxMonths: number;
  baseFreedomDate: Date;
  // With extra monthly payment applied
  extraPayment: number;
  acceleratedMonths: number;
  acceleratedFreedomDate: Date;
  monthsSaved: number;
  interestSavedRm: number;
  workHoursSaved: number;
}

/**
 * Calculates debt-free countdown and accelerated payoff projections
 */
export function calculateDebtFreedom(
  accounts: Account[],
  hourlyRate: number = 25.96,
  extraMonthlyPayment: number = 0
): DebtFreedomAnalysis {
  const liabilities = accounts.filter(isLiabilityAccount).filter((a) => a.balance > 0);

  let totalDebt = 0;
  let totalMonthlyCommitment = 0;
  const loanDetails: LoanPayoffDetail[] = [];

  for (const acc of liabilities) {
    const bal = Math.max(0, acc.balance);
    totalDebt += bal;

    const rate = acc.interestRate || (acc.type === "credit_card" ? 15.0 : 4.0);
    const inst = acc.monthlyInstallment || (acc.type === "credit_card" ? Math.max(50, bal * 0.05) : Math.max(100, bal * 0.03));
    totalMonthlyCommitment += inst;

    // Estimate months remaining: n = -log(1 - (r * P) / A) / log(1 + r)
    const monthlyRate = (rate / 100) / 12;
    let months = 0;
    let totalInterest = 0;

    if (monthlyRate <= 0 || inst <= bal * monthlyRate) {
      months = Math.ceil(bal / (inst || 1));
      totalInterest = 0;
    } else {
      const top = Math.log(1 - (monthlyRate * bal) / inst);
      const bottom = Math.log(1 + monthlyRate);
      months = Math.ceil(-top / bottom);
      if (isNaN(months) || months < 0 || months > 600) {
        months = Math.ceil(bal / inst);
      }
      totalInterest = Math.max(0, +(inst * months - bal).toFixed(2));
    }

    const workHours = amountToWorkHours(bal + totalInterest, hourlyRate);

    loanDetails.push({
      account: acc,
      balance: bal,
      rate,
      monthlyInstallment: inst,
      monthsRemaining: months,
      totalInterestRemaining: totalInterest,
      totalPayableRemaining: bal + totalInterest,
      workHoursRemaining: workHours,
    });
  }

  // Sort by smallest balance first (Snowball strategy)
  loanDetails.sort((a, b) => a.balance - b.balance);

  const baseMaxMonths = loanDetails.reduce((max, l) => Math.max(max, l.monthsRemaining), 0);
  const now = new Date();
  const baseFreedomDate = new Date(now.getFullYear(), now.getMonth() + baseMaxMonths, 1);

  // Accelerated calculation with extra monthly payment
  let acceleratedMonths = baseMaxMonths;
  let interestSavedRm = 0;

  if (extraMonthlyPayment > 0 && totalDebt > 0 && totalMonthlyCommitment > 0) {
    const totalAcceleratedCommitment = totalMonthlyCommitment + extraMonthlyPayment;
    // Weighted average interest rate
    const weightedRate =
      loanDetails.reduce((sum, l) => sum + l.rate * l.balance, 0) / (totalDebt || 1);
    const monthlyWeightedRate = (weightedRate / 100) / 12;

    if (totalAcceleratedCommitment > totalDebt * monthlyWeightedRate) {
      const top = Math.log(1 - (monthlyWeightedRate * totalDebt) / totalAcceleratedCommitment);
      const bottom = Math.log(1 + monthlyWeightedRate);
      acceleratedMonths = Math.ceil(-top / bottom);
      if (isNaN(acceleratedMonths) || acceleratedMonths < 1) {
        acceleratedMonths = Math.ceil(totalDebt / totalAcceleratedCommitment);
      }
    } else {
      acceleratedMonths = Math.ceil(totalDebt / totalAcceleratedCommitment);
    }

    acceleratedMonths = Math.min(baseMaxMonths, Math.max(1, acceleratedMonths));
    const baseTotalInterest = loanDetails.reduce((s, l) => s + l.totalInterestRemaining, 0);
    const acceleratedTotalPaid = totalAcceleratedCommitment * acceleratedMonths;
    const acceleratedInterest = Math.max(0, acceleratedTotalPaid - totalDebt);
    interestSavedRm = Math.max(0, +(baseTotalInterest - acceleratedInterest).toFixed(2));
  }

  const monthsSaved = Math.max(0, baseMaxMonths - acceleratedMonths);
  const acceleratedFreedomDate = new Date(now.getFullYear(), now.getMonth() + acceleratedMonths, 1);
  const workHoursSaved = amountToWorkHours(interestSavedRm, hourlyRate);
  const totalDebtWorkHours = amountToWorkHours(totalDebt, hourlyRate);

  return {
    totalDebt,
    totalDebtWorkHours,
    totalMonthlyCommitment,
    loans: loanDetails,
    baseMaxMonths,
    baseFreedomDate,
    extraPayment: extraMonthlyPayment,
    acceleratedMonths,
    acceleratedFreedomDate,
    monthsSaved,
    interestSavedRm,
    workHoursSaved,
  };
}

export function formatFreedomDate(date: Date): string {
  return date.toLocaleDateString("en-MY", { month: "long", year: "numeric" });
}
