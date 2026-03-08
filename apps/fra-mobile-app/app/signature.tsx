import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput, PanResponder, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useAuth } from '@/contexts/AuthContext';
import { PenTool, Check, X, AlertCircle, Shield } from 'lucide-react-native';
import colors from '@/constants/colors';

export default function SignatureScreen() {
  const router = useRouter();
  const { assessment, updateAssessment } = useAssessment();
  const { user, organisation } = useAuth();
  const [signatoryName] = useState(user?.name || '');
  const [signatoryRole, setSignatoryRole] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>('draw');
  const [typedSignature, setTypedSignature] = useState('');
  
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const isDrawing = useRef(false);
  const currentPathRef = useRef<string>('');
  const hasSignature = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        isDrawing.current = true;
        const { locationX, locationY } = evt.nativeEvent;
        const newPath = `M${locationX},${locationY}`;
        currentPathRef.current = newPath;
        setCurrentPath(newPath);
      },
      onPanResponderMove: (evt) => {
        if (!isDrawing.current) return;
        const { locationX, locationY } = evt.nativeEvent;
        const updatedPath = `${currentPathRef.current} L${locationX},${locationY}`;
        currentPathRef.current = updatedPath;
        setCurrentPath(updatedPath);
      },
      onPanResponderRelease: () => {
        isDrawing.current = false;
        if (currentPathRef.current !== '') {
          setPaths((prev) => {
            const newPaths = [...prev, currentPathRef.current];
            hasSignature.current = true;
            return newPaths;
          });
          currentPathRef.current = '';
          setCurrentPath('');
        }
      },
      onPanResponderTerminate: () => {
        isDrawing.current = false;
        if (currentPathRef.current !== '') {
          setPaths((prev) => {
            const newPaths = [...prev, currentPathRef.current];
            hasSignature.current = true;
            return newPaths;
          });
          currentPathRef.current = '';
          setCurrentPath('');
        }
      },
    })
  ).current;

  const handleClearSignature = () => {
    setPaths([]);
    setCurrentPath('');
    currentPathRef.current = '';
    hasSignature.current = false;
    setTypedSignature('');
  };

  const handleSignAndConfirm = () => {
    if (!signatoryName.trim()) {
      Alert.alert('Missing Information', 'Please enter your name');
      return;
    }

    if (!signatoryRole.trim()) {
      Alert.alert('Missing Information', 'Please enter your role/job title');
      return;
    }

    if (!consentChecked) {
      Alert.alert('Consent Required', 'Please confirm you are authorised to sign this assessment');
      return;
    }

    const hasDrawnSignature = hasSignature.current || paths.length > 0 || currentPath !== '';
    const hasTypedSignature = typedSignature.trim().length > 0;
    
    if (!hasDrawnSignature && !hasTypedSignature) {
      Alert.alert('Signature Required', 'Please draw or type your signature');
      return;
    }

    if (!user?.userId) {
      Alert.alert('Authentication Error', 'Unable to sign: user session not found. Please sign out and sign back in.');
      return;
    }

    const signatureData = {
      id: `sig-${Date.now()}`,
      assessmentId: assessment.id,
      signedByUserId: user.userId,
      signatoryName: signatoryName.trim(),
      signatoryRole: signatoryRole.trim(),
      signatureImage: 'data:signature/base64',
      signedAt: new Date().toISOString(),
    };

    updateAssessment({
      status: 'signed',
      signature: signatureData,
    });

    router.push('/feedback');
  };

  const packageName = assessment.payment.packageType === 'health-check'
    ? 'Health Check FRA'
    : assessment.payment.packageType === 'with-awareness'
    ? 'FRA + Awareness Briefing'
    : 'FRA + Dashboard (12 months)';

  const overallRiskLevel = assessment.riskRegister.length > 0
    ? assessment.riskRegister.filter(r => r.priority === 'high').length > 0
      ? 'High'
      : assessment.riskRegister.filter(r => r.priority === 'medium').length > 0
      ? 'Medium'
      : 'Low'
    : 'Low';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.validationBanner}>
            <AlertCircle size={20} color={colors.warningOrange} />
            <Text style={styles.validationBannerText}>Signature Required for Validation</Text>
          </View>
          <Text style={styles.title} accessibilityRole="header">Sign your FRA assessment</Text>
          <Text style={styles.subtitle}>
            Your employer signature is required to validate this assessment. Please review the summary below and sign to confirm that you have received, reviewed, and authorize this Fraud Risk Assessment.
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Assessment Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Organisation</Text>
            <Text style={styles.summaryValue}>{organisation?.name || assessment.organisation.name}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Date of assessment</Text>
            <Text style={styles.summaryValue}>
              {new Date(assessment.createdAt).toLocaleDateString('en-GB')}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Package purchased</Text>
            <Text style={styles.summaryValue}>{packageName}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Overall risk level</Text>
            <View style={[
              styles.riskBadge,
              overallRiskLevel === 'High' && styles.riskBadgeHigh,
              overallRiskLevel === 'Medium' && styles.riskBadgeMedium,
              overallRiskLevel === 'Low' && styles.riskBadgeLow,
            ]}>
              <Text style={styles.riskBadgeText}>{overallRiskLevel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.signatureSection}>
          <Text style={styles.sectionTitle}>Signatory Details</Text>
          
          <View style={styles.field}>
            <Text style={styles.label}>Name of signatory</Text>
            <Text style={styles.staticValue}>{signatoryName}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Role / Job title *</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={signatoryRole}
                onChangeText={setSignatoryRole}
                placeholder="e.g. Finance Director, CEO"
                placeholderTextColor={colors.govGrey3}
                accessibilityLabel="Role or Job title"
              />
            </View>
          </View>
        </View>

        <View style={styles.signatureBox}>
          <View style={styles.signatureHeader}>
            <PenTool size={20} color={colors.govBlue} />
            <Text style={styles.signatureTitle}>Your Signature</Text>
          </View>

          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeButton, signatureMode === 'draw' && styles.modeButtonActive]}
              onPress={() => setSignatureMode('draw')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Draw signature"
              accessibilityState={{ selected: signatureMode === 'draw' }}
            >
              <Text style={[styles.modeButtonText, signatureMode === 'draw' && styles.modeButtonTextActive]}>
                Draw
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, signatureMode === 'type' && styles.modeButtonActive]}
              onPress={() => setSignatureMode('type')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Type signature"
              accessibilityState={{ selected: signatureMode === 'type' }}
            >
              <Text style={[styles.modeButtonText, signatureMode === 'type' && styles.modeButtonTextActive]}>
                Type
              </Text>
            </TouchableOpacity>
          </View>

          {signatureMode === 'draw' ? (
            <>
              <Text style={styles.signatureInstructions}>
                Draw your signature with your finger or stylus in the box below
              </Text>
              
              <View style={styles.canvasContainer} {...panResponder.panHandlers} accessibilityLabel="Signature drawing area" accessibilityHint="Draw your signature with your finger or stylus">
                {paths.length === 0 && currentPath === '' && (
                  <View style={styles.placeholder} pointerEvents="none">
                    <PenTool size={48} color={colors.govGrey3} />
                    <Text style={styles.placeholderText}>Sign here with your finger</Text>
                  </View>
                )}
                
                <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
                  {paths.map((path, index) => (
                    <Path
                      key={`path-${index}`}
                      d={path}
                      stroke={colors.govBlue}
                      strokeWidth={3}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                  {currentPath !== '' && (
                    <Path
                      key="current-path"
                      d={currentPath}
                      stroke={colors.govBlue}
                      strokeWidth={3}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </Svg>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.signatureInstructions}>
                Type your full name below - it will appear as your signature
              </Text>
              
              <View style={styles.typeContainer}>
                <TextInput
                  style={styles.typeInput}
                  value={typedSignature}
                  onChangeText={setTypedSignature}
                  placeholder="Type your full name"
                  placeholderTextColor={colors.govGrey3}
                  autoCapitalize="words"
                  accessibilityLabel="Type your signature"
                />
                {typedSignature.trim().length > 0 && (
                  <View style={styles.typedPreview}>
                    <Text style={styles.typedSignatureText}>{typedSignature}</Text>
                    <Text style={styles.signHereText}>Sign here</Text>
                  </View>
                )}
              </View>
            </>
          )}

          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearSignature}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Clear signature"
          >
            <X size={16} color={colors.govBlue} />
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.consentRow}
          onPress={() => setConsentChecked(!consentChecked)}
          activeOpacity={0.7}
          accessibilityRole="checkbox"
          accessibilityLabel="I confirm that I am authorised to sign this assessment on behalf of my organisation"
          accessibilityState={{ checked: consentChecked }}
        >
          <View style={[styles.checkbox, consentChecked && styles.checkboxChecked]}>
            {consentChecked && <Check size={16} color={colors.white} strokeWidth={3} />}
          </View>
          <Text style={styles.consentText}>
            I confirm that I am authorised to sign this assessment on behalf of my organisation and that I have reviewed the content of the FRA report. This signature validates the assessment and confirms my understanding of the identified risks.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signButton}
          onPress={handleSignAndConfirm}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Sign and Validate Assessment"
        >
          <Shield size={20} color={colors.white} />
          <Text style={styles.signButtonText}>Sign and Validate Assessment</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.viewReportButton}
          onPress={() => Alert.alert('FRA Report', 'Full report preview would open here')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="View full FRA report"
        >
          <Text style={styles.viewReportButtonText}>View full FRA report</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.govGrey1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.govGrey2,
    lineHeight: 22,
  },
  summaryCard: {
    backgroundColor: colors.govGrey4,
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.govGrey2,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    textAlign: 'right' as const,
    flex: 1,
    marginLeft: 12,
  },
  riskBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  riskBadgeHigh: {
    backgroundColor: colors.errorRed,
  },
  riskBadgeMedium: {
    backgroundColor: colors.warningOrange,
  },
  riskBadgeLow: {
    backgroundColor: colors.govGreen,
  },
  riskBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: colors.white,
  },
  signatureSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 6,
  },
  staticValue: {
    fontSize: 16,
    color: colors.govGrey1,
    padding: 12,
    backgroundColor: colors.govGrey4,
    borderRadius: 4,
  },
  inputContainer: {
    borderWidth: 2,
    borderColor: colors.govGrey1,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
  input: {
    padding: 12,
    fontSize: 16,
    color: colors.govGrey1,
  },
  signatureBox: {
    marginBottom: 24,
  },
  signatureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  signatureTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.govGrey1,
  },
  signatureInstructions: {
    fontSize: 13,
    color: colors.govGrey2,
    marginBottom: 12,
  },
  canvasContainer: {
    height: 250,
    minHeight: 250,
    borderWidth: 3,
    borderColor: colors.govBlue,
    borderRadius: 8,
    backgroundColor: colors.white,
    marginBottom: 16,
    position: 'relative' as const,
  },
  placeholder: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 17,
    color: colors.govGrey3,
    marginTop: 12,
    fontWeight: '500' as const,
  },

  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    gap: 8,
    borderWidth: 2,
    borderColor: colors.govBlue,
    borderRadius: 6,
    backgroundColor: colors.white,
  },
  clearButtonText: {
    fontSize: 16,
    color: colors.govBlue,
    fontWeight: '600' as const,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    padding: 16,
    backgroundColor: colors.lightBlue,
    borderRadius: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.govGrey1,
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: colors.govBlue,
    borderColor: colors.govBlue,
  },
  consentText: {
    flex: 1,
    fontSize: 14,
    color: colors.govGrey1,
    lineHeight: 20,
  },
  signButton: {
    flexDirection: 'row',
    backgroundColor: colors.govGreen,
    borderRadius: 4,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  signButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.white,
  },
  viewReportButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  viewReportButtonText: {
    fontSize: 15,
    color: colors.govBlue,
    textDecorationLine: 'underline' as const,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.govGrey4,
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonActive: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  modeButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.govGrey2,
  },
  modeButtonTextActive: {
    color: colors.govBlue,
  },
  typeContainer: {
    minHeight: 250,
    borderWidth: 3,
    borderColor: colors.govBlue,
    borderRadius: 8,
    backgroundColor: colors.white,
    marginBottom: 16,
    padding: 20,
  },
  typeInput: {
    fontSize: 16,
    color: colors.govGrey1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 2,
    borderBottomColor: colors.govGrey3,
  },
  typedPreview: {
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  typedSignatureText: {
    fontSize: 42,
    color: colors.govBlue,
    fontWeight: '300' as const,
    fontStyle: 'italic' as const,
    letterSpacing: 1,
    ...(Platform.OS === 'ios' ? { fontFamily: 'Snell Roundhand' } : {}),
  },
  signHereText: {
    fontSize: 16,
    color: colors.govGrey3,
    marginTop: 8,
    fontWeight: '400' as const,
  },
  validationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningOrange,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  validationBannerText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.white,
    flex: 1,
  },
});
