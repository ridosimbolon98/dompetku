import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { SectionCard } from '@/components/SectionCard';
import { StatCard } from '@/components/StatCard';
import { listInvestments, listTransactions } from '@/lib/db';
import { formatRupiah, startOfMonth, toISODate } from '@/lib/format';

export default function DashboardScreen() {
  const [transactions, setTransactions] = useState<Awaited<ReturnType<typeof listTransactions>>>([]);
  const [investments, setInvestments] = useState<Awaited<ReturnType<typeof listInvestments>>>([]);

  const loadData = useCallback(async () => {
    const [transactionRows, investmentRows] = await Promise.all([
      listTransactions(),
      listInvestments(),
    ]);
    setTransactions(transactionRows);
    setInvestments(investmentRows);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const currentMonth = useMemo(() => {
    const start = startOfMonth(new Date());
    return toISODate(start);
  }, []);

  const monthTransactions = useMemo(
    () => transactions.filter((item) => item.date >= currentMonth),
    [transactions, currentMonth]
  );

  const totals = useMemo(() => {
    return monthTransactions.reduce(
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
  }, [monthTransactions]);

  const net = totals.income - totals.expense;

  const investmentTotals = useMemo(() => {
    return investments.reduce(
      (acc, item) => {
        const invested = item.qty * item.buyPrice;
        const current = item.qty * (item.currentPrice ?? item.buyPrice);
        acc.invested += invested;
        acc.current += current;
        return acc;
      },
      { invested: 0, current: 0 }
    );
  }, [investments]);

  const gain = investmentTotals.current - investmentTotals.invested;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <View style={styles.page}>
          <View style={styles.hero}>
            <View style={[styles.orb, styles.orbTop]} />
            <View style={[styles.orb, styles.orbBottom]} />
            <Text style={styles.heroEyebrow}>Ringkasan Bulan Ini</Text>
            <Text style={styles.heroTitle}>Dashboard Keuangan</Text>
            <View style={styles.heroRow}>
              <View>
                <Text style={styles.heroLabel}>Saldo Bersih</Text>
                <Text style={styles.heroValue}>{formatRupiah(net)}</Text>
              </View>
              <View style={styles.heroRight}>
                <Text style={styles.heroLabel}>Aset Investasi</Text>
                <Text style={styles.heroValue}>{formatRupiah(investmentTotals.current)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.rowGap}>
            <StatCard label="Pemasukan" value={formatRupiah(totals.income)} tone="mint" />
            <StatCard label="Pengeluaran" value={formatRupiah(totals.expense)} tone="coral" />
          </View>

          <SectionCard title="Transaksi Terbaru">
            {transactions.length === 0 ? (
              <EmptyState
                title="Belum ada transaksi"
                subtitle="Mulai catat pemasukan atau pengeluaran pertama kamu."
              />
            ) : (
              <View style={styles.listGap}>
                {transactions.slice(0, 5).map((item) => (
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

          <View style={styles.sectionSpacer} />

          <SectionCard title="Ringkasan Investasi">
            {investments.length === 0 ? (
              <EmptyState
                title="Belum ada aset investasi"
                subtitle="Catat saham atau crypto untuk melihat performanya."
              />
            ) : (
              <View style={styles.listGap}>
                <View style={styles.rowBetween}>
                  <Text style={styles.itemMeta}>Total Investasi</Text>
                  <Text style={styles.itemValue}>{formatRupiah(investmentTotals.invested)}</Text>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.itemMeta}>Nilai Saat Ini</Text>
                  <Text style={styles.itemValue}>{formatRupiah(investmentTotals.current)}</Text>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.itemMeta}>Gain / Loss</Text>
                  <Text
                    style={[
                      styles.itemValue,
                      gain >= 0 ? styles.amountPositive : styles.amountNegative,
                    ]}>
                    {formatRupiah(gain)}
                  </Text>
                </View>
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
    backgroundColor: '#0C1B24',
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
    backgroundColor: 'rgba(75, 227, 172, 0.25)',
    right: -40,
    top: -50,
  },
  orbBottom: {
    width: 160,
    height: 160,
    backgroundColor: 'rgba(255, 209, 102, 0.2)',
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
  heroRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter_400Regular',
  },
  heroValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'SpaceGrotesk_600SemiBold',
    marginTop: 4,
  },
  heroRight: {
    alignItems: 'flex-end',
  },
  rowGap: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
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
  itemValue: {
    fontSize: 14,
    color: '#0C1B24',
    fontFamily: 'Inter_500Medium',
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
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionSpacer: {
    height: 16,
  },
});
