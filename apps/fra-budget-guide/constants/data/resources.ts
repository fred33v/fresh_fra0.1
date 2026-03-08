import React from 'react';
import { Phone, ExternalLink, BookOpen } from 'lucide-react-native';

export interface ResourceItem {
  name: string;
  contact: string;
  description?: string;
  editable?: boolean;
}

export interface Resource {
  title: string;
  icon: React.ComponentType<{ color: string; size: number }>;
  items: ResourceItem[];
}

export const resources: Resource[] = [
  {
    title: 'Internal Contacts',
    icon: Phone,
    items: [
      {
        name: 'Fraud Risk Owner',
        contact: 'fraudRiskOwner',
        description: 'Primary contact for fraud concerns',
        editable: true,
      },
      {
        name: 'Whistleblowing Hotline',
        contact: 'whistleblowingHotline',
        description: 'Anonymous reporting channel',
        editable: true,
      },
      {
        name: 'Internal Audit',
        contact: 'internalAudit',
        description: 'Control reviews and investigations',
        editable: true,
      },
      {
        name: 'HR Department',
        contact: 'hrDepartment',
        description: 'Employment and conduct matters',
        editable: true,
      },
    ],
  },
  {
    title: 'External Reporting',
    icon: ExternalLink,
    items: [
      {
        name: 'Action Fraud',
        contact: '0300 123 2040',
        description: 'www.actionfraud.police.uk',
      },
      {
        name: 'Serious Fraud Office',
        contact: 'www.sfo.gov.uk',
        description: 'Major/complex fraud cases',
      },
      {
        name: 'HMRC Fraud Hotline',
        contact: '0800 788 887',
        description: 'Tax-related fraud',
      },
    ],
  },
  {
    title: 'Training & Resources',
    icon: BookOpen,
    items: [
      {
        name: 'ACFE Resources',
        contact: 'www.acfe.com',
        description: 'Global fraud statistics and training',
      },
      {
        name: 'CIPFA Guidance',
        contact: 'www.cipfa.org',
        description: 'Public sector fraud prevention',
      },
      {
        name: 'Stop FRA Platform',
        contact: 'stopFraPlatform',
        description: 'Automated fraud risk assessment tools',
        editable: true,
      },
    ],
  },
];
