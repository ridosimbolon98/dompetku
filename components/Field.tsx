import { StyleSheet, Text, TextInput, View } from 'react-native';

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
};

export const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
}: FieldProps) => (
  <View style={styles.container}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      keyboardType={keyboardType}
      style={styles.input}
      placeholderTextColor="#9AA4AE"
    />
  </View>
);

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Inter_400Regular',
    marginBottom: 8,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    backgroundColor: '#FAFBFC',
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#0C1B24',
    fontFamily: 'Inter_400Regular',
  },
});
