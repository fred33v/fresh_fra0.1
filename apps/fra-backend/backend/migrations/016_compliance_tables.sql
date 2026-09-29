-- Migration: 016_compliance_tables.sql
-- Adds compliance tracking tables for Enterprise package

-- Senior management accountability tracking (ECCTA 2023 requirement)
CREATE TABLE IF NOT EXISTS senior_management_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('CEO', 'CFO', 'COO', 'CTO', 'CISO', 'Board Chair', 'Executive Director', 'Other')),
    compliance_score INTEGER CHECK (compliance_score >= 0 AND compliance_score <= 100),
    last_reviewed TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Compliance incidents tracking (GovS-013 requirement)
CREATE TABLE IF NOT EXISTS compliance_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('fraud_incident', 'data_breach', 'non_compliance', 'policy_violation', 'other')),
    description TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Risk controls tracking (for gap analysis)
CREATE TABLE IF NOT EXISTS risk_controls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    risk_area TEXT NOT NULL,
    control_description TEXT NOT NULL,
    control_type TEXT NOT NULL CHECK (control_type IN ('preventive', 'detective', 'corrective')),
    effectiveness_rating INTEGER CHECK (effectiveness_rating >= 1 AND effectiveness_rating <= 5),
    implemented_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_reviewed TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_senior_management_org ON senior_management_tracking(organisation_id);
CREATE INDEX IF NOT EXISTS idx_senior_management_user ON senior_management_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_compliance_incidents_org ON compliance_incidents(organisation_id);
CREATE INDEX IF NOT EXISTS idx_compliance_incidents_type ON compliance_incidents(type);
CREATE INDEX IF NOT EXISTS idx_compliance_incidents_severity ON compliance_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_risk_controls_org ON risk_controls(organisation_id);
CREATE INDEX IF NOT EXISTS idx_risk_controls_risk_area ON risk_controls(risk_area);

-- Add updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_senior_management_updated_at
    BEFORE UPDATE ON senior_management_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compliance_incidents_updated_at
    BEFORE UPDATE ON compliance_incidents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_risk_controls_updated_at
    BEFORE UPDATE ON risk_controls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();