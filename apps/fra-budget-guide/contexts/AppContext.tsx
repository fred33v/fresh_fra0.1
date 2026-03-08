import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { createLogger } from '@/utils/logger';
const logger = createLogger('AppContext');

export type UserRole = 
  | 'procurement'
  | 'invoices'
  | 'payroll'
  | 'expenses'
  | 'contracts';

interface WatchItem {
  id: string;
  category: 'people' | 'transactions';
  text: string;
}

interface PledgeData {
  timestamp: string;
  signature: string;
}

interface CompletedChannel {
  channelId: string;
  timestamp: string;
}

interface ContactDetails {
  fraudRiskOwner: string;
  whistleblowingHotline: string;
  internalAudit: string;
  hrDepartment: string;
  stopFraPlatform: string;
}

export const [AppContext, useApp] = createContextHook(() => {
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);
  const [watchItems, setWatchItems] = useState<WatchItem[]>([]);
  const [pledge, setPledge] = useState<PledgeData | null>(null);
  const [completedChannels, setCompletedChannels] = useState<CompletedChannel[]>([]);
  const [contactDetails, setContactDetails] = useState<ContactDetails>({
    fraudRiskOwner: '',
    whistleblowingHotline: '',
    internalAudit: '',
    hrDepartment: '',
    stopFraPlatform: '',
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const rolesData = await AsyncStorage.getItem('selectedRoles');
      const watchData = await AsyncStorage.getItem('watchItems');
      const pledgeData = await AsyncStorage.getItem('pledge');
      const channelsData = await AsyncStorage.getItem('completedChannels');
      const contactsData = await AsyncStorage.getItem('contactDetails');

      if (rolesData) {
        setSelectedRoles(JSON.parse(rolesData));
      }
      if (watchData) {
        setWatchItems(JSON.parse(watchData));
      }
      if (pledgeData) {
        setPledge(JSON.parse(pledgeData));
      }
      if (channelsData) {
        setCompletedChannels(JSON.parse(channelsData));
      }
      if (contactsData) {
        setContactDetails(JSON.parse(contactsData));
      }
    } catch (error: unknown) {
      logger.error('Failed to load data', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateRoles = async (roles: UserRole[]) => {
    setSelectedRoles(roles);
    try {
      await AsyncStorage.setItem('selectedRoles', JSON.stringify(roles));
    } catch (error: unknown) {
      logger.error('Failed to save roles', error);
    }
  };

  const toggleWatchItem = async (item: WatchItem) => {
    const exists = watchItems.some(w => w.id === item.id);
    const newItems = exists
      ? watchItems.filter(w => w.id !== item.id)
      : [...watchItems, item];
    
    setWatchItems(newItems);
    try {
      await AsyncStorage.setItem('watchItems', JSON.stringify(newItems));
    } catch (error: unknown) {
      logger.error('Failed to save watch items', error);
    }
  };

  const isWatched = (id: string) => {
    return watchItems.some(w => w.id === id);
  };

  const savePledge = async (signature: string) => {
    const pledgeData = {
      timestamp: new Date().toISOString(),
      signature,
    };
    setPledge(pledgeData);
    try {
      await AsyncStorage.setItem('pledge', JSON.stringify(pledgeData));
    } catch (error: unknown) {
      logger.error('Failed to save pledge', error);
    }
  };

  const toggleCompletedChannel = async (channelId: string) => {
    const exists = completedChannels.some(c => c.channelId === channelId);
    const newChannels = exists
      ? completedChannels.filter(c => c.channelId !== channelId)
      : [...completedChannels, { channelId, timestamp: new Date().toISOString() }];
    
    setCompletedChannels(newChannels);
    try {
      await AsyncStorage.setItem('completedChannels', JSON.stringify(newChannels));
    } catch (error: unknown) {
      logger.error('Failed to save completed channels', error);
    }
  };

  const isChannelCompleted = (channelId: string) => {
    return completedChannels.some(c => c.channelId === channelId);
  };

  const updateContactDetail = async (key: keyof ContactDetails, value: string) => {
    const newDetails = { ...contactDetails, [key]: value };
    setContactDetails(newDetails);
    try {
      await AsyncStorage.setItem('contactDetails', JSON.stringify(newDetails));
    } catch (error: unknown) {
      logger.error('Failed to save contact details', error);
    }
  };

  return {
    selectedRoles,
    updateRoles,
    watchItems,
    toggleWatchItem,
    isWatched,
    pledge,
    savePledge,
    completedChannels,
    toggleCompletedChannel,
    isChannelCompleted,
    contactDetails,
    updateContactDetail,
    isLoading,
  };
});
