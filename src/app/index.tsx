import { Redirect } from 'expo-router';
import React, { useEffect } from 'react';
import SplashOverlay from '@/components/SplashOverlay';
import { useMusicStore } from '@/store/musicStore';

export default function Index() {
  const initialized = useMusicStore((s) => s.initialized);
  const onboardingDone = useMusicStore((s) => s.settings.onboardingDone);

  // Safety net: if initialization ever stalls past this point, still let the
  // user into the app instead of leaving them on a blank screen.
  useEffect(() => {
    if (initialized) return;
    const t = setTimeout(() => useMusicStore.setState({ initialized: true }), 10000);
    return () => clearTimeout(t);
  }, [initialized]);

  if (!initialized) {
    return <SplashOverlay />;
  }
  return <Redirect href={onboardingDone ? '/(tabs)' : '/onboarding'} />;
}