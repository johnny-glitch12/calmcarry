import AsyncStorage from '@react-native-async-storage/async-storage';

export const ONBOARDED_KEY = 'cc.onboarded';

export const markOnboarded = () => AsyncStorage.setItem(ONBOARDED_KEY, '1').catch(() => {});

export const getOnboarded = () =>
  AsyncStorage.getItem(ONBOARDED_KEY)
    .then((v) => v === '1')
    .catch(() => false);
