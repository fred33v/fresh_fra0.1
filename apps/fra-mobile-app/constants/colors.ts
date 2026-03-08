/**
 * Colors - Re-exported from @stopfra/ui-core for backward compatibility
 *
 * New code should import directly from '@stopfra/ui-core/tokens':
 * import { colors, govColors, statusColors } from '@stopfra/ui-core/tokens';
 */

// Re-export shared colors for existing imports
import { colors as sharedColors, govColors, greyScale, statusColors, riskColors, semanticColors } from '@stopfra/ui-core/tokens';

// Legacy format for backward compatibility with existing components
const colors = {
  // Government colors
  govBlue: govColors.blue,
  govBlueDark: govColors.blueDark,
  govGreen: govColors.green,
  govRed: govColors.red,
  govYellow: govColors.yellow,
  govOrange: govColors.orange,

  // Grey scale
  govGrey1: greyScale.grey1,
  govGrey2: greyScale.grey2,
  govGrey3: greyScale.grey3,
  govGrey4: greyScale.grey4,
  govLightGrey: greyScale.grey5,

  // Base colors
  white: '#ffffff',

  // Semantic colors (legacy names)
  successGreen: semanticColors.success,
  warningOrange: semanticColors.warning,
  errorRed: semanticColors.error,
  lightBlue: semanticColors.backgroundHighlight,

  // Status colors (legacy names)
  statusNotStarted: statusColors.notStarted,
  statusInProgress: statusColors.inProgress,
  statusCompleted: statusColors.completed,
  statusPendingAction: statusColors.pendingAction,

  // Risk colors (legacy names)
  riskHigh: riskColors.high,
  riskMedium: riskColors.medium,
  riskLow: riskColors.low,

  // Background
  backgroundSection: semanticColors.backgroundSection,
} as const;

export default colors;

// Also export the shared colors for new code
export { sharedColors, govColors, greyScale, statusColors, riskColors, semanticColors };
