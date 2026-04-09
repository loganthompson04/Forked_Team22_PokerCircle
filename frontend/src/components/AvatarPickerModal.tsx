import { FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AvatarDisplay from './AvatarDisplay';
import { AVATAR_PRESETS } from '../constants/avatarPresets';

type Props = {
  visible: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
  currentAvatarId?: string | null;
};

export default function AvatarPickerModal({ visible, onSelect, onClose, currentAvatarId }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Choose Avatar</Text>
          <FlatList
            data={AVATAR_PRESETS}
            numColumns={4}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isSelected = item.id === currentAvatarId;
              return (
                <TouchableOpacity
                  style={[styles.presetCell, isSelected && styles.selectedCell]}
                  onPress={() => onSelect(item.id)}
                  activeOpacity={0.7}
                >
                  <AvatarDisplay avatarId={item.id} size={56} />
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={styles.grid}
          />
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 36,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  grid: {
    paddingBottom: 12,
  },
  presetCell: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
    margin: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedCell: {
    borderColor: '#B22222',
    backgroundColor: 'rgba(178,34,34,0.15)',
  },
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
  },
  cancelText: {
    color: '#888888',
    fontSize: 15,
    fontWeight: '600',
  },
});
