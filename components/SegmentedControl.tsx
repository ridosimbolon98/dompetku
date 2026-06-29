import { Pressable, StyleSheet, Text, View } from 'react-native';

type Option = {
  label: string;
  value: string;
};

type SegmentedControlProps = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
};

export const SegmentedControl = ({ options, value, onChange }: SegmentedControlProps) => {
  return (
    <View style={styles.container}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.button, active && styles.buttonActive]}>
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#F2F4F7',
    borderRadius: 999,
    padding: 4,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 8,
  },
  buttonActive: {
    backgroundColor: '#0C1B24',
  },
  label: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Inter_500Medium',
  },
  labelActive: {
    color: '#FFFFFF',
  },
});
