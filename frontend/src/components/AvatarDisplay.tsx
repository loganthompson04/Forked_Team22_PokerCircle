import { StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { PRESET_MAP } from '../constants/avatarPresets';

type Props = {
  avatarId?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export default function AvatarDisplay({ avatarId, size = 44, style }: Props) {
  const preset = avatarId ? PRESET_MAP.get(avatarId) : undefined;
  const bgColor = preset?.color ?? '#444444';
  const icon = preset?.icon ?? '?';

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor },
        style,
      ]}
    >
      <Text style={[styles.icon, { fontSize: size * 0.45 }]}>{icon}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    color: '#FFFFFF',
    includeFontPadding: false,
  },
});
