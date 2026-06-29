import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { Field } from "@/components/Field";
import { SectionCard } from "@/components/SectionCard";
import {
  createDatabaseBackup,
  DatabaseBackupFile,
  exportTransactionsToExcel,
  listDatabaseBackups,
  listTransactionsByRange,
  restoreDatabaseBackup,
} from "@/lib/db";
import { formatRupiah, toISODate } from "@/lib/format";

const getDefaultDateRange = () => {
  const now = new Date();
  return {
    start: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
};

const parseISODate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

const formatDisplayDate = (value: string) => {
  const date = parseISODate(value);

  if (!date) {
    return value;
  }

  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
};

export default function ReportsScreen() {
  const defaultRange = useMemo(() => getDefaultDateRange(), []);
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [transactions, setTransactions] = useState<
    Awaited<ReturnType<typeof listTransactionsByRange>>
  >([]);
  const [backupFiles, setBackupFiles] = useState<DatabaseBackupFile[]>([]);
  const [backupPath, setBackupPath] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const getValidatedRange = useCallback(() => {
    const start = parseISODate(startDate);
    const end = parseISODate(endDate);

    if (!start || !end) {
      Alert.alert("Format tanggal salah", "Gunakan format tanggal YYYY-MM-DD.");
      return null;
    }

    if (start > end) {
      Alert.alert(
        "Periode tidak valid",
        "Tanggal mulai tidak boleh melewati tanggal akhir.",
      );
      return null;
    }

    const exclusiveEnd = new Date(end);
    exclusiveEnd.setDate(exclusiveEnd.getDate() + 1);

    return {
      start: toISODate(start),
      end: toISODate(end),
      exclusiveEnd: toISODate(exclusiveEnd),
    };
  }, [endDate, startDate]);

  const loadData = useCallback(async () => {
    const range = getValidatedRange();

    if (!range) {
      return;
    }

    const rows = await listTransactionsByRange(range.start, range.exclusiveEnd);
    setTransactions(rows);
  }, [getValidatedRange]);

  const loadBackups = useCallback(async () => {
    try {
      const rows = await listDatabaseBackups();
      setBackupFiles(rows);
      setBackupPath((current) => current || rows[0]?.uri || "");
    } catch (error) {
      console.error("Error loading backups:", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
      loadBackups();
    }, [loadBackups, loadData]),
  );

  const totals = useMemo(() => {
    return transactions.reduce(
      (acc, item) => {
        if (item.type === "income") {
          acc.income += item.amount;
        } else {
          acc.expense += item.amount;
        }
        return acc;
      },
      { income: 0, expense: 0 },
    );
  }, [transactions]);

  const net = totals.income - totals.expense;
  const periodLabel = `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;

  const handleExportExcel = async () => {
    const range = getValidatedRange();

    if (!range) {
      return;
    }

    try {
      setIsProcessing(true);
      const rows = await listTransactionsByRange(
        range.start,
        range.exclusiveEnd,
      );
      setTransactions(rows);

      if (rows.length === 0) {
        Alert.alert(
          "Tidak ada data",
          "Tidak ada transaksi pada periode ini untuk diexport.",
        );
        return;
      }

      const file = await exportTransactionsToExcel(
        rows,
        range.start,
        range.end,
      );
      Alert.alert("Export berhasil", `File Excel tersimpan:\n${file.uri}`);
    } catch (error) {
      console.error("Error exporting report:", error);
      Alert.alert(
        "Export gagal",
        "Gagal membuat file Excel. Silakan coba lagi.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setIsProcessing(true);
      const file = await createDatabaseBackup();
      await loadBackups();
      setBackupPath(file.uri);
      Alert.alert("Backup berhasil", `File backup tersimpan:\n${file.uri}`);
    } catch (error) {
      console.error("Error creating backup:", error);
      Alert.alert(
        "Backup gagal",
        "Gagal membuat backup database. Silakan coba lagi.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestoreBackup = (uri = backupPath.trim()) => {
    if (!uri) {
      Alert.alert(
        "Pilih file backup",
        "Isi path file backup atau pilih backup yang tersedia.",
      );
      return;
    }

    Alert.alert(
      "Restore Database",
      "Data saat ini akan diganti dengan isi file backup. Lanjutkan?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Restore",
          style: "destructive",
          onPress: async () => {
            try {
              setIsProcessing(true);
              await restoreDatabaseBackup(uri);
              await loadData();
              await loadBackups();
              Alert.alert(
                "Restore berhasil",
                "Database berhasil dipulihkan dari backup.",
              );
            } catch (error) {
              console.error("Error restoring backup:", error);
              Alert.alert(
                "Restore gagal",
                "File backup tidak valid atau tidak dapat dibaca.",
              );
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <View style={styles.page}>
          <View style={styles.hero}>
            <View style={[styles.orb, styles.orbTop]} />
            <View style={[styles.orb, styles.orbBottom]} />
            <Text style={styles.heroEyebrow}>Analisis Periode</Text>
            <Text style={styles.heroTitle}>Laporan Keuangan</Text>
            <Text style={styles.heroCaption}>
              Lihat transaksi berdasarkan periode tanggal yang dipilih.
            </Text>
          </View>

          <SectionCard title="Periode">
            <View style={styles.form}>
              <Field
                label="Tanggal Mulai (YYYY-MM-DD)"
                value={startDate}
                onChangeText={setStartDate}
                placeholder="2026-06-01"
              />
              <Field
                label="Tanggal Akhir (YYYY-MM-DD)"
                value={endDate}
                onChangeText={setEndDate}
                placeholder="2026-06-30"
              />
              <Text style={styles.periodHint}>
                Periode aktif: {periodLabel}
              </Text>
              <View style={styles.buttonRow}>
                <Pressable
                  onPress={loadData}
                  style={[
                    styles.primaryButton,
                    isProcessing && styles.buttonDisabled,
                  ]}
                  disabled={isProcessing}
                >
                  <Text style={styles.primaryButtonText}>Terapkan Filter</Text>
                </Pressable>
                <Pressable
                  onPress={handleExportExcel}
                  style={[
                    styles.secondaryButton,
                    isProcessing && styles.buttonDisabled,
                  ]}
                  disabled={isProcessing}
                >
                  <Text style={styles.secondaryButtonText}>Export Excel</Text>
                </Pressable>
              </View>
            </View>

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
                        item.type === "income"
                          ? styles.amountPositive
                          : styles.amountNegative,
                      ]}
                    >
                      {item.type === "income" ? "+" : "-"}
                      {formatRupiah(item.amount)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </SectionCard>

          <View style={styles.sectionSpacer} />

          <SectionCard title="Backup & Restore Database">
            <View style={styles.buttonRow}>
              <Pressable
                onPress={handleCreateBackup}
                style={[
                  styles.primaryButton,
                  isProcessing && styles.buttonDisabled,
                ]}
                disabled={isProcessing}
              >
                <Text style={styles.primaryButtonText}>Backup Database</Text>
              </Pressable>
              <Pressable
                onPress={() => handleRestoreBackup()}
                style={[
                  styles.dangerButton,
                  isProcessing && styles.buttonDisabled,
                ]}
                disabled={isProcessing}
              >
                <Text style={styles.dangerButtonText}>Import / Restore</Text>
              </Pressable>
            </View>
            <View style={styles.form}>
              <Field
                label="Path File Backup (.json)"
                value={backupPath}
                onChangeText={setBackupPath}
                placeholder="file:///.../dompetku-backup.json"
              />
            </View>
            {backupFiles.length > 0 ? (
              <View style={styles.backupList}>
                <Text style={styles.meta}>Backup tersedia</Text>
                {backupFiles.slice(0, 3).map((item) => (
                  <Pressable
                    key={item.uri}
                    onPress={() => setBackupPath(item.uri)}
                    style={styles.backupItem}
                  >
                    <Text style={styles.backupName}>{item.fileName}</Text>
                    <Text style={styles.backupUri} numberOfLines={1}>
                      {item.uri}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.periodHint}>
                Belum ada backup lokal. Tekan Backup Database untuk membuat file
                restore.
              </Text>
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
    backgroundColor: "#F5F6FA",
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
    backgroundColor: "#12212B",
    borderRadius: 26,
    padding: 20,
    marginBottom: 20,
    overflow: "hidden",
  },
  orb: {
    position: "absolute",
    borderRadius: 999,
  },
  orbTop: {
    width: 140,
    height: 140,
    backgroundColor: "rgba(255, 209, 102, 0.22)",
    right: -40,
    top: -40,
  },
  orbBottom: {
    width: 170,
    height: 170,
    backgroundColor: "rgba(75, 227, 172, 0.2)",
    left: -50,
    bottom: -60,
  },
  heroEyebrow: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    fontFamily: "Inter_400Regular",
  },
  heroTitle: {
    fontSize: 22,
    color: "#FFFFFF",
    marginTop: 6,
    fontFamily: "SpaceGrotesk_600SemiBold",
  },
  heroCaption: {
    marginTop: 8,
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    fontFamily: "Inter_400Regular",
  },
  form: {
    marginTop: 4,
  },
  periodHint: {
    fontSize: 12,
    color: "#64748B",
    fontFamily: "Inter_400Regular",
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#0C1B24",
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#E4E7EC",
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#0C1B24",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  dangerButton: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#E25555",
    paddingVertical: 12,
    alignItems: "center",
  },
  dangerButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  summary: {
    marginTop: 16,
    gap: 10,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  meta: {
    fontSize: 12,
    color: "#64748B",
    fontFamily: "Inter_400Regular",
  },
  value: {
    fontSize: 14,
    color: "#0C1B24",
    fontFamily: "Inter_500Medium",
  },
  sectionSpacer: {
    height: 16,
  },
  backupList: {
    gap: 10,
    marginTop: 4,
  },
  backupItem: {
    borderRadius: 14,
    backgroundColor: "#F2F4F7",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backupName: {
    fontSize: 13,
    color: "#0C1B24",
    fontFamily: "Inter_500Medium",
  },
  backupUri: {
    marginTop: 4,
    fontSize: 11,
    color: "#64748B",
    fontFamily: "Inter_400Regular",
  },
  listGap: {
    gap: 12,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    backgroundColor: "#F2F4F7",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  itemTitle: {
    fontSize: 14,
    color: "#0C1B24",
    fontFamily: "Inter_500Medium",
  },
  itemMeta: {
    fontSize: 12,
    color: "#64748B",
    fontFamily: "Inter_400Regular",
  },
  amount: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  amountPositive: {
    color: "#1F7A8C",
  },
  amountNegative: {
    color: "#E25555",
  },
});
