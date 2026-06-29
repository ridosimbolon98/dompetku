import { StyleSheet, Text, View } from 'react-native';

type StatCardProps = {
  label: string;
  value: string;
  tone?: 'mint' | 'sun' | 'coral' | 'ocean';
};

export const StatCard = ({ label, value, tone = 'mint' }: StatCardProps) => {
  const toneStyle = toneStyles[tone];
  return (
    <View style={[styles.container, toneStyle.background]}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.dot} />
      </View>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
};

const toneStyles: Record<NonNullable<StatCardProps['tone']>, { background: object }> = {
  mint: { background: { backgroundColor: '#E8F6F1' } },
  sun: { background: { backgroundColor: '#FFF6E1' } },
  coral: { background: { backgroundColor: '#FFE9E9' } },
  ocean: { background: { backgroundColor: '#EAF5F7' } },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 22,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Inter_400Regular',
  },
  dot: {
    height: 10,
    width: 10,
    borderRadius: 999,
    backgroundColor: '#0C1B24',
    opacity: 0.18,
  },
  value: {
    marginTop: 8,
    fontSize: 18,
    color: '#0C1B24',
    fontFamily: 'SpaceGrotesk_600SemiBold',
  },
});
