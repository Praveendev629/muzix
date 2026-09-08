import { Redirect } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useMusicStore } from '@/store/musicStore';

export default function Index() {
  const initialized = useMusicStore((s) => s.initialized);
  const onboardingDone = useMusicStore((s) => s.settings.onboardingDone);

  if (!initialized) {
    return <View style={{ flex: 1, backgroundColor: '#05030A' }} />;
  }
  return <Redirect href={onboardingDone ? '/(tabs)' : '/onboarding'} />;
}
