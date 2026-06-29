import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { SectionCard } from '@/components/SectionCard';
import { SegmentedControl } from '@/components/SegmentedControl';
import { listTransactionsByRange } from '@/lib/db';
import {
  endOfRange,
  formatRupiah,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toISODate,
} from '@/lib/format';

type Period = 'day' | 'week' | 'month';

export default function ReportsScreen() {
  const [period, setPeriod] = useState<Period>('week');
  const [transactions, setTransactions] = useState<
    Awaited<ReturnType<typeof listTransactionsByRange>>
  >([]);

  const range = useMemo(() => {
    const now = new Date();
    if (period === 'day') {
      const start = startOfDay(now);
      return { start, end: endOfRange(start, 1) };
    }
    if (period === 'week') {
      const start = startOfWeek(now);
      return { start, end: endOfRange(start, 7) };
    }
    const start = startOfMonth(now);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start, end };
  }, [period]);

  const loadData = useCallback(async () => {
    const rows = await listTransactionsByRange(toISODate(range.start), toISODate(range.end));
    setTransactions(rows);
  }, [range.end, range.start]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const totals = useMemo(() => {
    return transactions.reduce(
      (acc, item) => {
        if (item.type === 'income') {
          acc.income += item.amount;
        } else {
          acc.expense += item.amount;
        }
        return acc;
      },
      { income: 0, expense: 0 }
    );
  }, [transactions]);

  const net = totals.income - totals.expense;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <View style={styles.page}>
          <View style={styles.hero}>
            <View style={[styles.orb, styles.orbTop]} />
            <View style={[styles.orb, styles.orbBottom]} />
            <Text style={styles.heroEyebrow}>Analisis Periode</Text>
            <Text style={styles.heroTitle}>Laporan Keuangan</Text>
            <Text style={styles.heroCaption}>
              Lihat performa harian, mingguan, dan bulanan.
            </Text>
          </View>

          <SectionCard title="Periode">
            <SegmentedControl
              options={[
                { label: 'Harian', value: 'day' },
                { label: 'Mingguan', value: 'week' },
                { label: 'Bulanan', value: 'month' },
              ]}
              value={period}
              onChange={(value) => setPeriod(value as Period)}
            />

            <View style={styles.summary}>
              <View style={styles.rowBetween}>
                <Text style={styles.meta}>Pemasukan</Text>
                <Text style={styles.value}>{formatRupiah(totals.income)}</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.meta}>Pengeluaran</Text>
                <Text style={styles.value}>{formatRupiah(totals.expense)}</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.meta}>Saldo Bersih</Text>
                <Text style={styles.value}>{formatRupiah(net)}</Text>
              </View>
            </View>
          </SectionCard>

          <View style={styles.sectionSpacer} />

          <SectionCard title="Detail Transaksi">
            {transactions.length === 0 ? (
              <EmptyState
                title="Belum ada transaksi"
                subtitle="Coba ganti periode atau tambahkan transaksi baru."
              />
            ) : (
              <View style={styles.listGap}>
                {transactions.map((item) => (
                  <View key={item.id} style={styles.listItem}>
                    <View>
                      <Text style={styles.itemTitle}>{item.category}</Text>
                      <Text style={styles.itemMeta}>{item.date}</Text>
                    </View>
                    <Text
                      style={[
                        styles.amount,
                        item.type === 'income' ? styles.amountPositive : styles.amountNegative,
                      ]}>
                      {item.type === 'income' ? '+' : '-'}
                      {formatRupiah(item.amount)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </SectionCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingBottom: 140,
  },
  page: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  hero: {
    backgroundColor: '#12212B',
    borderRadius: 26,
    padding: 20,
    marginBottom: 20,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbTop: {
    width: 140,
    height: 140,
    backgroundColor: 'rgba(255, 209, 102, 0.22)',
    right: -40,
    top: -40,
  },
  orbBottom: {
    width: 170,
    height: 170,
    backgroundColor: 'rgba(75, 227, 172, 0.2)',
    left: -50,
    bottom: -60,
  },
  heroEyebrow: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter_400Regular',
  },
  heroTitle: {
    fontSize: 22,
    color: '#FFFFFF',
    marginTop: 6,
    fontFamily: 'SpaceGrotesk_600SemiBold',
  },
  heroCaption: {
    marginTop: 8,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter_400Regular',
  },
  summary: {
    marginTop: 16,
    gap: 10,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meta: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Inter_400Regular',
  },
  value: {
    fontSize: 14,
    color: '#0C1B24',
    fontFamily: 'Inter_500Medium',
  },
  sectionSpacer: {
    height: 16,
  },
  listGap: {
    gap: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    backgroundColor: '#F2F4F7',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  itemTitle: {
    fontSize: 14,
    color: '#0C1B24',
    fontFamily: 'Inter_500Medium',
  },
  itemMeta: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Inter_400Regular',
  },
  amount: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  amountPositive: {
    color: '#1F7A8C',
  },
  amountNegative: {
    color: '#E25555',
  },
});
