import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { Field } from "@/components/Field";
import { SectionCard } from "@/components/SectionCard";
import { SegmentedControl } from "@/components/SegmentedControl";
import {
  addTransaction,
  deleteTransaction,
  listTransactions,
  Transaction,
  TransactionType,
  updateTransaction,
} from "@/lib/db";
import { formatRupiah, toISODate } from "@/lib/format";

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [type, setType] = useState<TransactionType>("income");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(toISODate(new Date()));
  const [note, setNote] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    const rows = await listTransactions();
    setTransactions(rows);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const resetForm = () => {
    setAmount("");
    setCategory("");
    setNote("");
    setDate(toISODate(new Date()));
    setType("income");
    setEditingId(null);
  };

  const onSubmit = async () => {
    const parsedAmount = Number(amount.replace(/[^0-9.-]/g, ""));
    if (!category.trim() || !amount || Number.isNaN(parsedAmount)) {
      Alert.alert("Lengkapi data", "Kategori dan nominal harus diisi.");
      return;
    }

    try {
      if (editingId) {
        // Update existing transaction
        await updateTransaction(editingId, {
          type,
          amount: parsedAmount,
          category: category.trim(),
          note: note.trim() || null,
          date,
        });
        Alert.alert("Berhasil", "Transaksi berhasil diperbarui.");
      } else {
        // Add new transaction
        await addTransaction({
          type,
          amount: parsedAmount,
          category: category.trim(),
          note: note.trim() || null,
          date,
        });
        Alert.alert("Berhasil", "Transaksi berhasil disimpan.");
      }

      resetForm();
      loadData();
    } catch (error) {
      console.error("Error saving transaction:", error);
      Alert.alert("Error", "Gagal menyimpan transaksi. Silakan coba lagi.");
    }
  };

  const handleEdit = (item: Transaction) => {
    setEditingId(item.id);
    setType(item.type);
    setAmount(item.amount.toString());
    setCategory(item.category);
    setDate(item.date);
    setNote(item.note || "");
  };

  const handleDelete = (id: number) => {
    Alert.alert(
      "Hapus Transaksi",
      "Apakah Anda yakin ingin menghapus transaksi ini?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTransaction(id);
              loadData();
              Alert.alert("Berhasil", "Transaksi berhasil dihapus.");
            } catch (error) {
              console.error("Error deleting transaction:", error);
              Alert.alert("Error", "Gagal menghapus transaksi.");
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <View style={styles.page}>
          <View style={styles.hero}>
            <View style={[styles.orb, styles.orbTop]} />
            <View style={[styles.orb, styles.orbBottom]} />
            <Text style={styles.heroEyebrow}>Pemasukan & Pengeluaran</Text>
            <Text style={styles.heroTitle}>Kelola Transaksi</Text>
            <Text style={styles.heroCaption}>
              Catat setiap arus kas agar laporan selalu akurat.
            </Text>
          </View>

          <SectionCard
            title={editingId ? "Edit Transaksi" : "Tambah Transaksi"}
          >
            <SegmentedControl
              options={[
                { label: "Pemasukan", value: "income" },
                { label: "Pengeluaran", value: "expense" },
              ]}
              value={type}
              onChange={(value) => setType(value as TransactionType)}
            />

            <View style={styles.form}>
              <Field
                label="Nominal"
                value={amount}
                onChangeText={setAmount}
                placeholder="contoh: 250000"
                keyboardType="numeric"
              />
              <Field
                label="Kategori"
                value={category}
                onChangeText={setCategory}
                placeholder="contoh: Gaji, Belanja"
              />
              <Field
                label="Tanggal (YYYY-MM-DD)"
                value={date}
                onChangeText={setDate}
                placeholder="2026-03-10"
              />
              <Field
                label="Catatan"
                value={note}
                onChangeText={setNote}
                placeholder="Opsional"
              />
            </View>

            <View style={styles.buttonRow}>
              {editingId && (
                <Pressable onPress={resetForm} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Batal</Text>
                </Pressable>
              )}
              <Pressable onPress={onSubmit} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>
                  {editingId ? "Update Transaksi" : "Simpan Transaksi"}
                </Text>
              </Pressable>
            </View>
          </SectionCard>

          <View style={styles.sectionSpacer} />

          <SectionCard title="Riwayat Transaksi">
            {transactions.length === 0 ? (
              <EmptyState
                title="Belum ada transaksi"
                subtitle="Data transaksi akan muncul di sini."
              />
            ) : (
              <View style={styles.listGap}>
                {transactions.map((item) => (
                  <View key={item.id} style={styles.listItem}>
                    <View style={styles.itemContent}>
                      <Text style={styles.itemTitle}>{item.category}</Text>
                      <Text style={styles.itemMeta}>{item.date}</Text>
                      {item.note ? (
                        <Text style={styles.itemMeta}>{item.note}</Text>
                      ) : null}
                    </View>
                    <View style={styles.itemRight}>
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
                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          onPress={() => handleEdit(item)}
                          style={styles.editButton}
                        >
                          <Text style={styles.editButtonText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDelete(item.id)}
                          style={styles.deleteButton}
                        >
                          <Text style={styles.deleteButtonText}>Hapus</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
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
    backgroundColor: "#0F2A36",
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
    width: 130,
    height: 130,
    backgroundColor: "rgba(75, 227, 172, 0.2)",
    right: -40,
    top: -30,
  },
  orbBottom: {
    width: 150,
    height: 150,
    backgroundColor: "rgba(226, 85, 85, 0.18)",
    left: -40,
    bottom: -50,
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
    marginTop: 16,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    marginTop: 8,
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
    marginTop: 8,
    borderRadius: 18,
    backgroundColor: "#E4E7EC",
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#64748B",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  sectionSpacer: {
    height: 16,
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
  itemContent: {
    flex: 1,
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
  itemRight: {
    alignItems: "flex-end",
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
  actionButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "#0C1B24",
    borderRadius: 8,
  },
  editButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "#E25555",
    borderRadius: 8,
  },
  deleteButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});
