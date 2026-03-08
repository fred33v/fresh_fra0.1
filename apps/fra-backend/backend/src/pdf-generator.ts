import puppeteer from 'puppeteer';
import type { Assessment } from './types.js';
import { createLogger } from './logger.js';

const logger = createLogger('pdf-generator');

export interface PDFGenerationOptions {
  title: string;
  assessment: Assessment;
  riskSummary?: {
    overallRisk: 'high' | 'medium' | 'low' | 'none';
    totalAssessments: number;
    completedCount: number;
  };
  organizationName?: string;
  enhancedData?: {
    procurement?: {
      dueDiligenceLevel?: number;
      monthlySpend?: number;
      recentFraud?: string;
      controlMaturity?: number;
    };
    cashBanking?: {
      dailyCashVolume?: number;
      bankAccountCount?: number;
      fraudIncidents?: string;
      controlEffectiveness?: number;
    };
    payrollHR?: {
      totalEmployeeCount?: number;
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
  };
}

/**
 * Generate PDF report from assessment data
 * Uses Puppeteer to render HTML as PDF
 */
export async function generateAssessmentPdf(options: PDFGenerationOptions): Promise<Buffer> {
  let browser = null;
  
  try {
    // Launch browser in headless mode
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();

    // Create HTML content for the report
    const htmlContent = createReportHTML(options);

    // Load HTML and render to PDF
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm',
      },
      printBackground: true,
    });

    await page.close();
    return pdfBuffer;
  } catch (error) {
    logger.error('PDF generation failed', { error: error instanceof Error ? error.message : String(error) });
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function createReportHTML(options: PDFGenerationOptions): string {
  const { assessment, riskSummary, organizationName, title, enhancedData } = options;
  const answerCount = Object.keys(assessment.answers ?? {}).length;

  // Determine risk level based on answer count and enhanced data
  let riskLevel = 'Low';
  let riskScore = 0;

  if (answerCount >= 50) {
    riskLevel = 'High';
    riskScore = 75;
  } else if (answerCount >= 25) {
    riskLevel = 'Medium';
    riskScore = 45;
  } else {
    riskLevel = 'Low';
    riskScore = 25;
  }

  // Adjust risk score based on enhanced procurement data
  if (enhancedData?.procurement) {
    const { dueDiligenceLevel, monthlySpend, recentFraud, controlMaturity } = enhancedData.procurement;

    if (dueDiligenceLevel && dueDiligenceLevel < 3) riskScore += 10;
    if (monthlySpend && monthlySpend > 100000) riskScore += 15; // High spend increases risk
    if (recentFraud === 'yes') riskScore += 20;
    if (controlMaturity && controlMaturity < 3) riskScore += 10;

    // Recalculate risk level based on enhanced score
    if (riskScore >= 70) riskLevel = 'High';
    else if (riskScore >= 40) riskLevel = 'Medium';
    else riskLevel = 'Low';
  }

  // Adjust risk score based on enhanced IT systems data
  if (enhancedData?.itSystems) {
    const { cybersecurityMaturity, securityIncidentsCount, hasCriticalSystems, backupTestingFrequency, mfaAdoption } = enhancedData.itSystems;

    if (cybersecurityMaturity && cybersecurityMaturity < 3) riskScore += 15;
    if (securityIncidentsCount && securityIncidentsCount > 5) riskScore += 20;
    if (hasCriticalSystems === 'yes') riskScore += 10; // Critical systems increase risk exposure
    if (backupTestingFrequency && backupTestingFrequency < 3) riskScore += 10;
    if (mfaAdoption && mfaAdoption < 3) riskScore += 15;

    // Recalculate risk level based on enhanced score
    if (riskScore >= 70) riskLevel = 'High';
    else if (riskScore >= 40) riskLevel = 'Medium';
    else riskLevel = 'Low';
  }

  const generatedDate = new Date().toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Generate recommendations based on risk analysis
  const recommendations = generateRecommendations(riskLevel, enhancedData);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #333;
            line-height: 1.6;
          }

          .page {
            page-break-after: always;
            padding: 20px;
          }

          .header {
            border-bottom: 3px solid #1e40af;
            margin-bottom: 30px;
            padding-bottom: 20px;
          }

          .header h1 {
            color: #1e40af;
            font-size: 28px;
            margin-bottom: 10px;
          }

          .header .subtitle {
            color: #666;
            font-size: 14px;
          }

          .metadata {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            font-size: 13px;
          }

          .metadata-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
          }

          .metadata-label {
            font-weight: 600;
            color: #555;
          }

          .metadata-value {
            color: #333;
          }

          .section {
            margin-bottom: 30px;
          }

          .section-title {
            color: #1e40af;
            font-size: 18px;
            font-weight: 600;
            border-left: 4px solid #1e40af;
            padding-left: 12px;
            margin-bottom: 15px;
          }

          .risk-indicator {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 14px;
          }

          .risk-high {
            background-color: #fee2e2;
            color: #991b1b;
          }

          .risk-medium {
            background-color: #fef3c7;
            color: #92400e;
          }

          .risk-low {
            background-color: #dbeafe;
            color: #0c4a6e;
          }

          .stats {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
          }

          .stat-box {
            flex: 1;
            background: #f9fafb;
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid #1e40af;
          }

          .stat-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            font-weight: 600;
            margin-bottom: 8px;
          }

          .stat-value {
            font-size: 24px;
            font-weight: 700;
            color: #1e40af;
          }

          .recommendations {
            margin-top: 20px;
          }

          .recommendation-item {
            background: #f0f9ff;
            border-left: 4px solid #0ea5e9;
            padding: 12px 16px;
            margin-bottom: 10px;
            border-radius: 4px;
          }

          .recommendation-priority {
            font-weight: 600;
            color: #0ea5e9;
            margin-bottom: 4px;
          }

          .recommendation-text {
            font-size: 14px;
            color: #374151;
          }

          .answers-section {
            margin-top: 15px;
          }

          .answer-count {
            font-size: 14px;
            color: #666;
            margin-bottom: 10px;
          }

          .footer {
            border-top: 1px solid #ddd;
            padding-top: 15px;
            margin-top: 30px;
            font-size: 11px;
            color: #999;
            text-align: center;
          }

          .risk-heatmap {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-top: 15px;
          }

          .heatmap-item {
            background: #f3f4f6;
            padding: 10px;
            border-radius: 4px;
            text-align: center;
          }

          .heatmap-label {
            font-size: 12px;
            color: #6b7280;
            margin-bottom: 4px;
          }

          .heatmap-value {
            font-size: 16px;
            font-weight: 600;
            color: #1f2937;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <h1>${title}</h1>
            <div class="subtitle">Fraud Risk Assessment Report</div>
          </div>

          <div class="metadata">
            <div class="metadata-row">
              <span class="metadata-label">Assessment ID:</span>
              <span class="metadata-value">${assessment.id}</span>
            </div>
            <div class="metadata-row">
              <span class="metadata-label">Generated:</span>
              <span class="metadata-value">${generatedDate}</span>
            </div>
            ${organizationName ? `
            <div class="metadata-row">
              <span class="metadata-label">Organisation:</span>
              <span class="metadata-value">${organizationName}</span>
            </div>
            ` : ''}
            <div class="metadata-row">
              <span class="metadata-label">Status:</span>
              <span class="metadata-value">${assessment.status}</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Risk Assessment Summary</div>
            <div class="stats">
              <div class="stat-box">
                <div class="stat-label">Overall Risk Level</div>
                <div class="stat-value">
                  <span class="risk-indicator risk-${riskLevel.toLowerCase()}">
                    ${riskLevel}
                  </span>
                </div>
              </div>
              <div class="stat-box">
                <div class="stat-label">Risk Score</div>
                <div class="stat-value">${riskScore}%</div>
              </div>
              <div class="stat-box">
                <div class="stat-label">Questions Answered</div>
                <div class="stat-value">${answerCount}</div>
              </div>
            </div>
          </div>

          ${enhancedData?.procurement ? `
          <div class="section">
            <div class="section-title">Procurement Risk Analysis</div>
            <div class="risk-heatmap">
              <div class="heatmap-item">
                <div class="heatmap-label">Due Diligence</div>
                <div class="heatmap-value">${enhancedData.procurement.dueDiligenceLevel || 'N/A'}/5</div>
              </div>
              <div class="heatmap-item">
                <div class="heatmap-label">Monthly Spend</div>
                <div class="heatmap-value">£${enhancedData.procurement.monthlySpend?.toLocaleString() || 'N/A'}</div>
              </div>
              <div class="heatmap-item">
                <div class="heatmap-label">Control Maturity</div>
                <div class="heatmap-value">${enhancedData.procurement.controlMaturity || 'N/A'}/5</div>
              </div>
            </div>
            ${enhancedData.procurement.recentFraud === 'yes' ? `
            <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; margin-top: 15px; border-radius: 4px;">
              <div style="font-weight: 600; color: #dc2626; margin-bottom: 4px;">⚠️ Recent Fraud Incident</div>
              <div style="font-size: 14px; color: #991b1b;">This organization has experienced procurement fraud in the last 2 years, indicating heightened risk.</div>
            </div>
            ` : ''}
          </div>
          ` : ''}

          ${enhancedData?.itSystems ? `
          <div class="section">
            <div class="section-title">IT Systems Risk Analysis</div>
            <div class="risk-heatmap">
              <div class="heatmap-item">
                <div class="heatmap-label">Cybersecurity Maturity</div>
                <div class="heatmap-value">${enhancedData.itSystems.cybersecurityMaturity || 'N/A'}/5</div>
              </div>
              <div class="heatmap-item">
                <div class="heatmap-label">Security Incidents</div>
                <div class="heatmap-value">${enhancedData.itSystems.securityIncidentsCount || 'N/A'}</div>
              </div>
              <div class="heatmap-item">
                <div class="heatmap-label">MFA Adoption</div>
                <div class="heatmap-value">${enhancedData.itSystems.mfaAdoption || 'N/A'}/5</div>
              </div>
            </div>
            ${enhancedData.itSystems.securityIncidentsCount && enhancedData.itSystems.securityIncidentsCount > 0 ? `
            <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; margin-top: 15px; border-radius: 4px;">
              <div style="font-weight: 600; color: #dc2626; margin-bottom: 4px;">⚠️ Security Incidents Detected</div>
              <div style="font-size: 14px; color: #991b1b;">${enhancedData.itSystems.securityIncidentsCount} security incident(s) reported in the last 12 months, indicating potential vulnerabilities.</div>
            </div>
            ` : ''}
            ${enhancedData.itSystems.hasCriticalSystems === 'yes' ? `
            <div style="background: #fef3c7; border-left: 4px solid #d97706; padding: 12px 16px; margin-top: 15px; border-radius: 4px;">
              <div style="font-weight: 600; color: #d97706; margin-bottom: 4px;">⚠️ Critical Systems Identified</div>
              <div style="font-size: 14px; color: #92400e;">Organization has critical systems that could cause significant business disruption if compromised.</div>
            </div>
            ` : ''}
          </div>
          ` : ''}

          ${enhancedData?.cashBanking ? `
          <div class="section">
            <div class="section-title">Cash & Banking Risk Analysis</div>
            <div class="risk-heatmap">
              <div class="heatmap-item">
                <div class="heatmap-label">Daily Cash Volume</div>
                <div class="heatmap-value">£${enhancedData.cashBanking.dailyCashVolume?.toLocaleString() || 'N/A'}</div>
              </div>
              <div class="heatmap-item">
                <div class="heatmap-label">Bank Accounts</div>
                <div class="heatmap-value">${enhancedData.cashBanking.bankAccountCount || 'N/A'}</div>
              </div>
              <div class="heatmap-item">
                <div class="heatmap-label">Control Effectiveness</div>
                <div class="heatmap-value">${enhancedData.cashBanking.controlEffectiveness || 'N/A'}/5</div>
              </div>
            </div>
            ${enhancedData.cashBanking.fraudIncidents === 'yes' ? `
            <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; margin-top: 15px; border-radius: 4px;">
              <div style="font-weight: 600; color: #dc2626; margin-bottom: 4px;">⚠️ Cash/Banking Fraud</div>
              <div style="font-size: 14px; color: #991b1b;">Recent cash or banking fraud incidents detected. Enhanced controls should be implemented.</div>
            </div>
            ` : ''}
          </div>
          ` : ''}

          ${enhancedData?.payrollHR ? `
          <div class="section">
            <div class="section-title">Payroll & HR Risk Analysis</div>
            <div class="risk-heatmap">
              <div class="heatmap-item">
                <div class="heatmap-label">Total Employees</div>
                <div class="heatmap-value">${enhancedData.payrollHR.totalEmployeeCount || 'N/A'}</div>
              </div>
              <div class="heatmap-item">
                <div class="heatmap-label">Unauthorized Changes</div>
                <div class="heatmap-value">${enhancedData.payrollHR.unauthorizedChangesDetected === 'yes' ? '⚠️ Yes' : 'No'}</div>
              </div>
              <div class="heatmap-item">
                <div class="heatmap-label">Control Maturity</div>
                <div class="heatmap-value">${enhancedData.payrollHR.controlMaturity || 'N/A'}/5</div>
              </div>
            </div>
            ${enhancedData.payrollHR.unauthorizedChangesDetected === 'yes' ? `
            <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; margin-top: 15px; border-radius: 4px;">
              <div style="font-weight: 600; color: #dc2626; margin-bottom: 4px;">🚨 CRITICAL - Unauthorized Payroll Changes</div>
              <div style="font-size: 14px; color: #991b1b;">Unauthorized payroll changes have been detected. Immediate investigation and remediation required.</div>
            </div>
            ` : ''}
          </div>
          ` : ''}

          ${enhancedData?.revenue ? `
          <div class="section">
            <div class="section-title">Revenue & Receivables Risk Analysis</div>
            <div class="risk-heatmap">
              <div class="heatmap-item">
                <div class="heatmap-label">Monthly Revenue</div>
                <div class="heatmap-value">£${enhancedData.revenue.monthlyRevenueVolume?.toLocaleString() || 'N/A'}</div>
              </div>
              <div class="heatmap-item">
                <div class="heatmap-label">Unpaid Invoices</div>
                <div class="heatmap-value">${enhancedData.revenue.unpaidInvoicesPercentage || 'N/A'}%</div>
              </div>
              <div class="heatmap-item">
                <div class="heatmap-label">Collection Rate</div>
                <div class="heatmap-value">${enhancedData.revenue.collectionEffectiveness || 'N/A'}/5</div>
              </div>
            </div>
            ${enhancedData.revenue.writeOffsOccurred === 'yes' ? `
            <div style="background: #fef3c7; border-left: 4px solid #d97706; padding: 12px 16px; margin-top: 15px; border-radius: 4px;">
              <div style="font-weight: 600; color: #d97706; margin-bottom: 4px;">⚠️ Significant Write-Offs</div>
              <div style="font-size: 14px; color: #92400e;">Significant bad debt write-offs detected. Review procedures for revenue recognition and collectibility assessment.</div>
            </div>
            ` : ''}
          </div>
          ` : ''}

          <div class="section recommendations">
            <div class="section-title">Priority Recommendations</div>
            ${recommendations.map(rec => `
            <div class="recommendation-item">
              <div class="recommendation-priority">${rec.priority}</div>
              <div class="recommendation-text">${rec.text}</div>
            </div>
            `).join('')}
          </div>

          <div class="section answers-section">
            <div class="section-title">Assessment Details</div>
            <div class="answer-count">
              Assessment ID: <strong>${assessment.id}</strong>
            </div>
            <div class="answer-count">
              Total responses recorded: <strong>${answerCount}</strong>
            </div>
            <div style="margin-top: 15px; font-size: 13px; color: #666;">
              <p>This assessment was conducted to evaluate fraud risk across the organisation. The responses provided have been analyzed to determine the overall risk level and identify areas for improvement.</p>
              <p style="margin-top: 10px;">For detailed findings and recommendations, please review the full assessment results in the dashboard.</p>
            </div>
          </div>

          <div class="footer">
            <p>This report was automatically generated by the Stop FRA platform. | Confidential</p>
            <p>Generated on ${new Date().toISOString()}</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function generateRecommendations(riskLevel: string, enhancedData?: any): Array<{priority: string, text: string}> {
  const recommendations = [];

  if (riskLevel === 'High') {
    recommendations.push({
      priority: 'CRITICAL - Immediate Action Required',
      text: 'High fraud risk detected. Implement immediate controls including segregation of duties, enhanced monitoring, and management oversight.'
    });
  } else if (riskLevel === 'Medium') {
    recommendations.push({
      priority: 'HIGH - Address Within 30 Days',
      text: 'Moderate fraud risk identified. Review and strengthen key controls, particularly in high-risk areas.'
    });
  } else {
    recommendations.push({
      priority: 'MEDIUM - Plan for Implementation',
      text: 'Low fraud risk detected. Maintain current controls and consider enhancements for continuous improvement.'
    });
  }

  // Procurement-specific recommendations
  if (enhancedData?.procurement) {
    const { dueDiligenceLevel, monthlySpend, recentFraud, controlMaturity } = enhancedData.procurement;

    if (dueDiligenceLevel && dueDiligenceLevel < 3) {
      recommendations.push({
        priority: 'HIGH - Procurement Controls',
        text: 'Strengthen supplier due diligence processes. Implement comprehensive background checks and reference verification.'
      });
    }

    if (monthlySpend && monthlySpend > 50000) {
      recommendations.push({
        priority: 'MEDIUM - Procurement Monitoring',
        text: 'High procurement spend detected. Implement enhanced monitoring and approval processes for large transactions.'
      });
    }

    if (recentFraud === 'yes') {
      recommendations.push({
        priority: 'CRITICAL - Incident Response',
        text: 'Recent fraud incident reported. Conduct thorough investigation and implement corrective actions immediately.'
      });
    }

    if (controlMaturity && controlMaturity < 3) {
      recommendations.push({
        priority: 'HIGH - Control Enhancement',
        text: 'Procurement controls need improvement. Consider implementing automated approval workflows and enhanced documentation.'
      });
    }
  }

  // Cash and banking-specific recommendations
  if (enhancedData?.cashBanking) {
    const { dailyCashVolume, bankAccountCount, fraudIncidents, controlEffectiveness } = enhancedData.cashBanking;

    if (dailyCashVolume && dailyCashVolume > 100000) {
      recommendations.push({
        priority: 'HIGH - Cash Handling Controls',
        text: 'High daily cash volumes detected. Implement daily cash management procedures including counting, recording, and secure storage controls.'
      });
    }

    if (bankAccountCount && bankAccountCount > 5) {
      recommendations.push({
        priority: 'MEDIUM - Bank Account Rationalization',
        text: 'Multiple bank accounts increase operational complexity. Consider consolidating to reduce reconciliation burden and oversight requirements.'
      });
    }

    if (fraudIncidents === 'yes') {
      recommendations.push({
        priority: 'CRITICAL - Fraud Incident Review',
        text: 'Recent cash/banking fraud detected. Conduct thorough investigation and strengthen preventive controls.'
      });
    }

    if (controlEffectiveness && controlEffectiveness < 3) {
      recommendations.push({
        priority: 'HIGH - Cash and Banking Controls',
        text: 'Strengthen cash and banking controls through enhanced segregation of duties and monitoring procedures.'
      });
    }
  }

  // Payroll and HR-specific recommendations
  if (enhancedData?.payrollHR) {
    const { totalEmployeeCount, unauthorizedChangesDetected, controlMaturity } = enhancedData.payrollHR;

    if (unauthorizedChangesDetected === 'yes') {
      recommendations.push({
        priority: 'CRITICAL - Payroll Fraud Investigation',
        text: 'Unauthorized payroll changes detected. Initiate immediate investigation and implement multi-level approval controls.'
      });
    }

    if (totalEmployeeCount && totalEmployeeCount > 200) {
      recommendations.push({
        priority: 'HIGH - Payroll Governance',
        text: 'Large payroll population detected. Implement automated controls and exception reporting to manage fraud risk.'
      });
    }

    if (controlMaturity && controlMaturity < 3) {
      recommendations.push({
        priority: 'HIGH - Payroll Control Enhancement',
        text: 'Implement robust payroll controls including automated leave tracking, approval workflows, and monthly payroll audits.'
      });
    }
  }

  // Revenue and receivables-specific recommendations
  if (enhancedData?.revenue) {
    const { monthlyRevenueVolume, unpaidInvoicesPercentage, writeOffsOccurred, collectionEffectiveness } = enhancedData.revenue;

    if (monthlyRevenueVolume && monthlyRevenueVolume > 100000) {
      recommendations.push({
        priority: 'MEDIUM - Revenue Monitoring',
        text: 'Significant revenue volume detected. Implement automated revenue recognition controls and regular reconciliation procedures.'
      });
    }

    if (unpaidInvoicesPercentage && unpaidInvoicesPercentage > 15) {
      recommendations.push({
        priority: 'HIGH - Receivables Management',
        text: `High proportion of unpaid invoices (${unpaidInvoicesPercentage}%). Strengthen collection procedures and credit review processes.`
      });
    }

    if (writeOffsOccurred === 'yes') {
      recommendations.push({
        priority: 'HIGH - Bad Debt Review',
        text: 'Significant bad debt write-offs indicate weak collections or potential fraud. Review credit criteria and collection procedures.'
      });
    }

    if (collectionEffectiveness && collectionEffectiveness < 3) {
      recommendations.push({
        priority: 'MEDIUM - Collection Effectiveness',
        text: 'Improve revenue collection processes through enhanced customer creditworthiness assessment and follow-up procedures.'
      });
    }
  }
  if (enhancedData?.itSystems) {
    const { cybersecurityMaturity, securityIncidentsCount, hasCriticalSystems, backupTestingFrequency, mfaAdoption } = enhancedData.itSystems;

    if (cybersecurityMaturity && cybersecurityMaturity < 3) {
      recommendations.push({
        priority: 'CRITICAL - Cybersecurity Enhancement',
        text: 'Implement comprehensive cybersecurity framework. Conduct security assessment and develop incident response plan.'
      });
    }

    if (securityIncidentsCount && securityIncidentsCount > 0) {
      recommendations.push({
        priority: 'HIGH - Incident Investigation',
        text: 'Investigate recent security incidents thoroughly. Identify root causes and implement corrective measures.'
      });
    }

    if (hasCriticalSystems === 'yes') {
      recommendations.push({
        priority: 'HIGH - Critical Systems Protection',
        text: 'Enhance protection for critical systems. Implement redundancy, regular backups, and disaster recovery procedures.'
      });
    }

    if (backupTestingFrequency && backupTestingFrequency < 3) {
      recommendations.push({
        priority: 'MEDIUM - Backup Procedures',
        text: 'Improve backup testing frequency. Ensure backups are tested regularly and restoration procedures are documented.'
      });
    }

    if (mfaAdoption && mfaAdoption < 3) {
      recommendations.push({
        priority: 'HIGH - Access Security',
        text: 'Increase multi-factor authentication adoption across all systems and user accounts.'
      });
    }
  }
  // General recommendations
  recommendations.push({
    priority: "ONGOING - Training & Awareness",
    text: "Implement regular fraud awareness training for all staff, with specific focus on high-risk areas."
  });

  recommendations.push({
    priority: "QUARTERLY - Monitoring & Review",
    text: "Establish regular review of fraud controls and incident monitoring to ensure ongoing effectiveness."
  });

  return recommendations;
}
