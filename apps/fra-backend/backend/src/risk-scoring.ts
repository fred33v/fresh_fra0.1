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
  // Context, not a risk: how much fraud risk the organisation says it can accept
  riskAppetite?: {
    toleranceLevel?: number; // 1-5, 1 = very risk averse
    acceptableRisk?: string; // Low | Medium | High
    moderateLossImpact?: number;
    reputationalImpact?: number;
  };
  fraudTriangle?: {
    potentialAnnualLoss?: number;
    financialPressure?: number; // 1-5, 5 = very high
    rationalisationLikelihood?: number; // 1-5, 5 = very likely
    controlStrength?: number; // 1-5
    speakUpConfidence?: number; // 1-5
  };
  peopleCulture?: {
    vettingThoroughness?: number;
    whistleblowingRoute?: string;
    leadershipMessaging?: number;
  };
  controlsTechnology?: {
    segregationOfDuties?: number;
    accessManagement?: number;
    automatedMonitoring?: string;
  };
  trainingAwareness?: {
    staffTrainedPercentage?: number;
    specialistTraining?: string;
    boardTrained?: string;
  };
  monitoringEvaluation?: {
    incidentsDetected?: number;
    undetectedLikelihood?: number; // 1-5, 5 = very likely
    registerReviewFrequency?: string; // Never | Annually | Quarterly | Monthly
  };
  complianceMapping?: {
    accountableIndividual?: string;
    boardApprovedPolicy?: string;
    associatedPersonsDueDiligence?: number;
    counterFraudStrategy?: string;
  };
  fraudResponse?: {
    responsePlan?: string;
    responseSpeed?: string; // Within 24 hours | Within a week | Within a month | Longer or ad hoc
    lossesLastThreeYears?: number;
    investigatorAccess?: string;
  };
}

export interface RiskScore {
  overallScore: number; // 0-100
  riskLevel: 'Low' | 'Medium' | 'High';
  /** The organisation's stated appetite, when the Risk Appetite module was answered */
  riskAppetite: 'Low' | 'Medium' | 'High' | null;
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

  // Unauthorised changes
  if (data.unauthorizedChangesDetected === 'yes') {
    score += 25;
    factors.push('Unauthorised payroll changes detected');
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

type ModuleResult = { score: number; factors: string[] };
const weak = (v: number | undefined) => v !== undefined && v < 3;
const high = (v: number | undefined) => v !== undefined && v >= 4;
const gbp = (n: number) => `£${n.toLocaleString('en-GB')}`;

/** Pressure, opportunity and rationalisation (the fraud triangle) */
function scoreFraudTriangle(data?: RiskScoringInput['fraudTriangle']): ModuleResult {
  let score = 20;
  const factors: string[] = [];
  if (!data) return { score, factors };
  if (high(data.financialPressure)) { score += 15; factors.push(`High financial or operational pressure (${data.financialPressure}/5)`); }
  if (high(data.rationalisationLikelihood)) { score += 15; factors.push(`Culture where staff could rationalise fraud (${data.rationalisationLikelihood}/5)`); }
  if (weak(data.controlStrength)) { score += 20; factors.push(`Weak fraud prevention controls (${data.controlStrength}/5)`); }
  if (weak(data.speakUpConfidence)) { score += 10; factors.push(`Low confidence that staff would speak up (${data.speakUpConfidence}/5)`); }
  if (data.potentialAnnualLoss && data.potentialAnnualLoss > 100000) { score += 10; factors.push(`High potential undetected loss (${gbp(data.potentialAnnualLoss)} a year)`); }
  return { score: Math.min(score, 100), factors };
}

function scorePeopleCulture(data?: RiskScoringInput['peopleCulture']): ModuleResult {
  let score = 20;
  const factors: string[] = [];
  if (!data) return { score, factors };
  if (weak(data.vettingThoroughness)) { score += 15; factors.push(`Limited vetting of new staff (${data.vettingThoroughness}/5)`); }
  if (data.whistleblowingRoute === 'no') { score += 25; factors.push('No confidential route for reporting concerns'); }
  if (weak(data.leadershipMessaging)) { score += 15; factors.push(`Leadership rarely communicates expectations on fraud (${data.leadershipMessaging}/5)`); }
  return { score: Math.min(score, 100), factors };
}

function scoreControlsTechnology(data?: RiskScoringInput['controlsTechnology']): ModuleResult {
  let score = 20;
  const factors: string[] = [];
  if (!data) return { score, factors };
  if (weak(data.segregationOfDuties)) { score += 25; factors.push(`Weak segregation of duties (${data.segregationOfDuties}/5)`); }
  if (weak(data.accessManagement)) { score += 15; factors.push(`Immature system access management (${data.accessManagement}/5)`); }
  if (data.automatedMonitoring === 'no') { score += 15; factors.push('No automated monitoring of unusual transactions'); }
  return { score: Math.min(score, 100), factors };
}

function scoreTrainingAwareness(data?: RiskScoringInput['trainingAwareness']): ModuleResult {
  let score = 15;
  const factors: string[] = [];
  if (!data) return { score, factors };
  // Staff training is a core "reasonable procedure" under ECCTA 2023, so near-zero coverage weighs more
  if (data.staffTrainedPercentage !== undefined && data.staffTrainedPercentage < 25) { score += 30; factors.push(`Only ${data.staffTrainedPercentage}% of staff trained in fraud awareness`); }
  else if (data.staffTrainedPercentage !== undefined && data.staffTrainedPercentage < 50) { score += 20; factors.push(`Only ${data.staffTrainedPercentage}% of staff trained in fraud awareness`); }
  else if (data.staffTrainedPercentage !== undefined && data.staffTrainedPercentage < 80) { score += 10; factors.push(`${data.staffTrainedPercentage}% of staff trained, below 80%`); }
  if (data.specialistTraining === 'no') { score += 15; factors.push('No role-specific training for high-risk roles'); }
  if (data.boardTrained === 'no') { score += 10; factors.push('Board not trained in fraud risk in the last 12 months'); }
  return { score: Math.min(score, 100), factors };
}

function scoreMonitoringEvaluation(data?: RiskScoringInput['monitoringEvaluation']): ModuleResult {
  let score = 15;
  const factors: string[] = [];
  if (!data) return { score, factors };
  if (data.incidentsDetected && data.incidentsDetected > 5) { score += 20; factors.push(`Many fraud incidents detected (${data.incidentsDetected} in 12 months)`); }
  else if (data.incidentsDetected && data.incidentsDetected > 0) { score += 10; factors.push(`Fraud incidents detected (${data.incidentsDetected} in 12 months)`); }
  if (high(data.undetectedLikelihood)) { score += 20; factors.push(`Fraud likely to go undetected (${data.undetectedLikelihood}/5)`); }
  if (data.registerReviewFrequency === 'Never') { score += 25; factors.push('Fraud risk register never reviewed'); }
  else if (data.registerReviewFrequency === 'Annually') { score += 10; factors.push('Fraud risk register reviewed only annually'); }
  return { score: Math.min(score, 100), factors };
}

/** ECCTA 2023 reasonable procedures and GovS 013 basics */
function scoreComplianceMapping(data?: RiskScoringInput['complianceMapping']): ModuleResult {
  let score = 15;
  const factors: string[] = [];
  if (!data) return { score, factors };
  if (data.accountableIndividual === 'no') { score += 20; factors.push('No named person accountable for fraud prevention'); }
  if (data.boardApprovedPolicy === 'no') { score += 15; factors.push('No board-approved fraud prevention policy in the last 12 months'); }
  if (weak(data.associatedPersonsDueDiligence)) { score += 15; factors.push(`Limited due diligence on people acting for you (${data.associatedPersonsDueDiligence}/5)`); }
  if (data.counterFraudStrategy === 'no') { score += 10; factors.push('No current counter fraud strategy'); }
  return { score: Math.min(score, 100), factors };
}

function scoreFraudResponse(data?: RiskScoringInput['fraudResponse']): ModuleResult {
  let score = 15;
  const factors: string[] = [];
  if (!data) return { score, factors };
  if (data.responsePlan === 'no') { score += 20; factors.push('No documented fraud response plan'); }
  if (data.responseSpeed === 'Longer or ad hoc') { score += 15; factors.push('Slow or ad hoc response to suspected fraud'); }
  else if (data.responseSpeed === 'Within a month') { score += 8; factors.push('Suspected fraud takes up to a month to act on'); }
  if (data.lossesLastThreeYears && data.lossesLastThreeYears > 100000) { score += 15; factors.push(`Significant fraud losses in 3 years (${gbp(data.lossesLastThreeYears)})`); }
  else if (data.lossesLastThreeYears && data.lossesLastThreeYears > 0) { score += 8; factors.push(`Fraud losses in 3 years (${gbp(data.lossesLastThreeYears)})`); }
  if (data.investigatorAccess === 'no') { score += 15; factors.push('No access to trained fraud investigators'); }
  return { score: Math.min(score, 100), factors };
}

/** Each scored module and its weight in the overall score (weights sum to 1). */
const MODULE_SCORERS: Array<{ id: Exclude<keyof RiskScoringInput, 'riskAppetite'>; weight: number; score: (input: RiskScoringInput) => ModuleResult }> = [
  { id: 'procurement', weight: 0.12, score: (i) => scoreProcurement(i.procurement) },
  { id: 'cashBanking', weight: 0.12, score: (i) => scoreCashBanking(i.cashBanking) },
  { id: 'payrollHR', weight: 0.12, score: (i) => scorePayrollHR(i.payrollHR) },
  { id: 'revenue', weight: 0.08, score: (i) => scoreRevenue(i.revenue) },
  { id: 'itSystems', weight: 0.08, score: (i) => scoreITSystems(i.itSystems) },
  { id: 'fraudTriangle', weight: 0.08, score: (i) => scoreFraudTriangle(i.fraudTriangle) },
  { id: 'peopleCulture', weight: 0.07, score: (i) => scorePeopleCulture(i.peopleCulture) },
  { id: 'controlsTechnology', weight: 0.09, score: (i) => scoreControlsTechnology(i.controlsTechnology) },
  { id: 'trainingAwareness', weight: 0.05, score: (i) => scoreTrainingAwareness(i.trainingAwareness) },
  { id: 'monitoringEvaluation', weight: 0.06, score: (i) => scoreMonitoringEvaluation(i.monitoringEvaluation) },
  { id: 'complianceMapping', weight: 0.07, score: (i) => scoreComplianceMapping(i.complianceMapping) },
  { id: 'fraudResponse', weight: 0.06, score: (i) => scoreFraudResponse(i.fraudResponse) },
];

function statedAppetite(data?: RiskScoringInput['riskAppetite']): RiskScore['riskAppetite'] {
  if (!data) return null;
  if (data.acceptableRisk === 'Low' || data.acceptableRisk === 'Medium' || data.acceptableRisk === 'High') return data.acceptableRisk;
  if (data.toleranceLevel === undefined) return null;
  return data.toleranceLevel <= 2 ? 'Low' : data.toleranceLevel >= 4 ? 'High' : 'Medium';
}

/**
 * Calculate overall risk score from all modules.
 * Only answered modules count, with their weights rescaled to sum to 1, so a partly
 * answered or older assessment is scored on what it covers rather than on default scores.
 * With nothing answered every module counts at its base score.
 */
export function calculateRiskScore(input: RiskScoringInput): RiskScore {
  const answered = MODULE_SCORERS.filter((m) => input[m.id] && Object.keys(input[m.id] as object).length > 0);
  const counted = answered.length > 0 ? answered : MODULE_SCORERS;

  const moduleScores: RiskScore['moduleScores'] = {};
  let weighted = 0;
  const totalWeight = counted.reduce((s, m) => s + m.weight, 0);
  for (const m of counted) {
    const result = m.score(input);
    moduleScores[m.id] = { score: result.score, level: getRiskLevel(result.score), impactFactors: result.factors };
    weighted += result.score * m.weight;
  }
  const overallScore = Math.round(weighted / totalWeight);

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
    riskAppetite: statedAppetite(input.riskAppetite),
    moduleScores,
    topRisks
  };
}

function getRiskLevel(score: number): 'Low' | 'Medium' | 'High' {
  if (score >= 70) return 'High';
  if (score >= 45) return 'Medium';
  return 'Low';
}
