import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

export default function NavTabFace({
  active,
  accent,
  dark,
  children,
}: {
  active: boolean;
  accent: string;
  dark: boolean;
  children: ReactNode;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.face,
        {
          transform: [{ translateY: active ? -3 : 0 }, { scale: active ? 1.025 : 1 }],
        },
      ]}
    >
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.tint, { backgroundColor: active ? `${accent}${dark ? '35' : '20'}` : 'transparent' }]}
      />
      {children}
    </View>
  );
}

export function NavTabIcon({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <View style={{ transform: [{ scale: active ? 1.12 : 1 }] }}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  face: {
    width: '82%',
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 24,
    borderCurve: 'continuous',
  },
  tint: { borderRadius: 24, borderCurve: 'continuous', overflow: 'hidden' },
});
