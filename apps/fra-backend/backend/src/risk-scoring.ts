/**
 * Enhanced Risk Scoring Engine
 *
 * Calculates fraud risk scores based on quantitative assessment data
 * Uses impact, likelihood, and control effectiveness to produce risk bands
 */

export interface RiskScoringInput {
  procurement?: {
    dueDiligenceLevel?: number; // 1-5 scale
    monthlySpend?: number; // currency
    recentFraud?: string; // yes/no
    controlMaturity?: number; // 1-5 scale
  };
  cashBanking?: {
    dailyCashVolume?: number;
    bankAccountCount?: number;
    fraudIncidents?: string;
    controlEffectiveness?: number;
  };
  payrollHR?: {
    totalEmployeeCount?: number;
    payrollFrequency?: string; // frequency enum
    unauthorizedChangesDetected?: string;
    controlMaturity?: number;
  };
  revenue?: {
    monthlyRevenueVolume?: number;
    unpaidInvoicesPercentage?: number;
    writeOffsOccurred?: string;
    collectionEffectiveness?: number;
  };
  itSystems?: {
    cybersecurityMaturity?: number;
    securityIncidentsCount?: number;
    hasCriticalSystems?: string;
    backupTestingFrequency?: number;
    mfaAdoption?: number;
  };
}

export interface RiskScore {
  overallScore: number; // 0-100
  riskLevel: 'Low' | 'Medium' | 'High';
  moduleScores: {
    [key: string]: {
      score: number;
      level: 'Low' | 'Medium' | 'High';
      impactFactors: string[];
    };
  };
  topRisks: Array<{
    module: string;
    risk: string;
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
  }>;
}

/**
 * Calculate risk score for procurement module
 */
function scoreProcurement(data?: RiskScoringInput['procurement']): { score: number; factors: string[] } {
  let score = 20; // Base score
  const factors: string[] = [];

  if (!data) return { score, factors };

  // Due diligence weakness
  if (data.dueDiligenceLevel && data.dueDiligenceLevel < 3) {
    score += 15;
    factors.push(`Low due diligence level (${data.dueDiligenceLevel}/5)`);
  }

  // High spend volume increases risk exposure
  if (data.monthlySpend && data.monthlySpend > 500000) {
    score += 20;
    factors.push(`Very high monthly spend (£${data.monthlySpend?.toLocaleString()})`);
  } else if (data.monthlySpend && data.monthlySpend > 100000) {
    score += 10;
    factors.push(`High monthly spend (£${data.monthlySpend?.toLocaleString()})`);
  }

  // Recent fraud incidents
  if (data.recentFraud === 'yes') {
    score += 25;
    factors.push('Recent procurement fraud incidents');
  }

  // Weak controls
  if (data.controlMaturity && data.controlMaturity < 3) {
    score += 15;
    factors.push(`Weak control maturity (${data.controlMaturity}/5)`);
  }

  return { score: Math.min(score, 100), factors };
}

/**
 * Calculate risk score for cash and banking module
 */
function scoreCashBanking(data?: RiskScoringInput['cashBanking']): { score: number; factors: string[] } {
  let score = 18; // Base score
  const factors: string[] = [];

  if (!data) return { score, factors };

  // High daily cash volume
  if (data.dailyCashVolume && data.dailyCashVolume > 100000) {
    score += 15;
    factors.push(`High daily cash volume (£${data.dailyCashVolume?.toLocaleString()})`);
  }

  // Multiple bank accounts increase complexity
  if (data.bankAccountCount && data.bankAccountCount > 5) {
    score += 10;
    factors.push(`Multiple bank accounts (${data.bankAccountCount})`);
  }

  // Fraud incidents
  if (data.fraudIncidents === 'yes') {
    score += 20;
    factors.push('Recent cash/banking fraud incidents');
  }

  // Weak controls
  if (data.controlEffectiveness && data.controlEffectiveness < 3) {
    score += 15;
    factors.push(`Weak control effectiveness (${data.controlEffectiveness}/5)`);
  }

  return { score: Math.min(score, 100), factors };
}

/**
 * Calculate risk score for payroll and HR module
 */
function scorePayrollHR(data?: RiskScoringInput['payrollHR']): { score: number; factors: string[] } {
  let score = 25; // Base score (payroll is inherently higher risk)
  const factors: string[] = [];

  if (!data) return { score, factors };

  // Large employee count
  if (data.totalEmployeeCount && data.totalEmployeeCount > 500) {
    score += 15;
    factors.push(`Large workforce (${data.totalEmployeeCount} employees)`);
  } else if (data.totalEmployeeCount && data.totalEmployeeCount > 100) {
    score += 8;
    factors.push(`Medium workforce (${data.totalEmployeeCount} employees)`);
  }

  // Unauthorized changes
  if (data.unauthorizedChangesDetected === 'yes') {
    score += 25;
    factors.push('Unauthorized payroll changes detected');
  }

  // Weak controls
  if (data.controlMaturity && data.controlMaturity < 3) {
    score += 15;
    factors.push(`Weak control maturity (${data.controlMaturity}/5)`);
  }

  return { score: Math.min(score, 100), factors };
}

/**
 * Calculate risk score for revenue module
 */
function scoreRevenue(data?: RiskScoringInput['revenue']): { score: number; factors: string[] } {
  let score = 22; // Base score
  const factors: string[] = [];

  if (!data) return { score, factors };

  // High revenue volume
  if (data.monthlyRevenueVolume && data.monthlyRevenueVolume > 1000000) {
    score += 20;
    factors.push(`Very high monthly revenue (£${data.monthlyRevenueVolume?.toLocaleString()})`);
  } else if (data.monthlyRevenueVolume && data.monthlyRevenueVolume > 100000) {
    score += 10;
    factors.push(`High monthly revenue (£${data.monthlyRevenueVolume?.toLocaleString()})`);
  }

  // High unpaid invoices percentage
  if (data.unpaidInvoicesPercentage && data.unpaidInvoicesPercentage > 20) {
    score += 15;
    factors.push(`High unpaid invoices (${data.unpaidInvoicesPercentage}% overdue)`);
  }

  // Write-offs indicate potential fraud
  if (data.writeOffsOccurred === 'yes') {
    score += 18;
    factors.push('Significant bad debt write-offs');
  }

  // Weak collection effectiveness
  if (data.collectionEffectiveness && data.collectionEffectiveness < 3) {
    score += 12;
    factors.push(`Weak collection effectiveness (${data.collectionEffectiveness}/5)`);
  }

  return { score: Math.min(score, 100), factors };
}

/**
 * Calculate risk score for IT systems and cybersecurity
 */
function scoreITSystems(data?: RiskScoringInput['itSystems']): { score: number; factors: string[] } {
  let score = 20; // Base score
  const factors: string[] = [];

  if (!data) return { score, factors };

  // Low cybersecurity maturity
  if (data.cybersecurityMaturity && data.cybersecurityMaturity < 3) {
    score += 20;
    factors.push(`Low cybersecurity maturity (${data.cybersecurityMaturity}/5)`);
  }

  // Security incidents
  if (data.securityIncidentsCount && data.securityIncidentsCount > 5) {
    score += 20;
    factors.push(`Multiple security incidents (${data.securityIncidentsCount})`);
  } else if (data.securityIncidentsCount && data.securityIncidentsCount > 0) {
    score += 10;
    factors.push(`Security incidents detected (${data.securityIncidentsCount})`);
  }

  // Critical systems at risk
  if (data.hasCriticalSystems === 'yes') {
    score += 15;
    factors.push('Critical systems vulnerable to disruption');
  }

  // Weak backup testing
  if (data.backupTestingFrequency && data.backupTestingFrequency < 2) {
    score += 10;
    factors.push(`Inadequate backup testing (${data.backupTestingFrequency}/5)`);
  }

  // Low MFA adoption
  if (data.mfaAdoption && data.mfaAdoption < 3) {
    score += 15;
    factors.push(`Low MFA adoption (${data.mfaAdoption}/5)`);
  }

  return { score: Math.min(score, 100), factors };
}

/**
 * Calculate overall risk score from all modules
 */
export function calculateRiskScore(input: RiskScoringInput): RiskScore {
  const moduleScores: RiskScore['moduleScores'] = {};

  // Calculate individual module scores
  const procurementResult = scoreProcurement(input.procurement);
  moduleScores.procurement = {
    score: procurementResult.score,
    level: getRiskLevel(procurementResult.score),
    impactFactors: procurementResult.factors
  };

  const cashBankingResult = scoreCashBanking(input.cashBanking);
  moduleScores.cashBanking = {
    score: cashBankingResult.score,
    level: getRiskLevel(cashBankingResult.score),
    impactFactors: cashBankingResult.factors
  };

  const payrollHRResult = scorePayrollHR(input.payrollHR);
  moduleScores.payrollHR = {
    score: payrollHRResult.score,
    level: getRiskLevel(payrollHRResult.score),
    impactFactors: payrollHRResult.factors
  };

  const revenueResult = scoreRevenue(input.revenue);
  moduleScores.revenue = {
    score: revenueResult.score,
    level: getRiskLevel(revenueResult.score),
    impactFactors: revenueResult.factors
  };

  const itSystemsResult = scoreITSystems(input.itSystems);
  moduleScores.itSystems = {
    score: itSystemsResult.score,
    level: getRiskLevel(itSystemsResult.score),
    impactFactors: itSystemsResult.factors
  };

  // Calculate overall score (weighted average)
  const scores = [
    procurementResult.score * 0.25, // Procurement heavily weighted
    cashBankingResult.score * 0.25,
    payrollHRResult.score * 0.25,
    revenueResult.score * 0.15,
    itSystemsResult.score * 0.10
  ];
  const overallScore = Math.round(scores.reduce((a, b) => a + b, 0));

  // Collect all risk factors and sort by severity
  const allFactors: Array<{ module: string; risk: string; severity: 'Low' | 'Medium' | 'High' | 'Critical'; score: number }> = [];

  Object.entries(moduleScores).forEach(([module, data]) => {
    data.impactFactors.forEach(factor => {
      let severity: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
      if (data.score >= 80) severity = 'Critical';
      else if (data.score >= 60) severity = 'High';
      else if (data.score >= 40) severity = 'Medium';

      allFactors.push({
        module,
        risk: factor,
        severity,
        score: data.score
      });
    });
  });

  const topRisks = allFactors
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(({ module, risk, severity }) => ({ module, risk, severity }));

  return {
    overallScore,
    riskLevel: getRiskLevel(overallScore),
    moduleScores,
    topRisks
  };
}

function getRiskLevel(score: number): 'Low' | 'Medium' | 'High' {
  if (score >= 70) return 'High';
  if (score >= 45) return 'Medium';
  return 'Low';
}
