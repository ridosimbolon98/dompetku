import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
  addInvestment,
  deleteInvestment,
  Investment,
  InvestmentType,
  listInvestments,
  updateInvestment,
} from "@/lib/db";
import { formatRupiah, toISODate } from "@/lib/format";
import { fetchPrice, refreshAllPrices } from "@/lib/yahoo-finance";

export default function InvestmentsScreen() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [assetType, setAssetType] = useState<InvestmentType>("stock");
  const [symbol, setSymbol] = useState("");
  const [qty, setQty] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [buyDate, setBuyDate] = useState(toISODate(new Date()));
  const [note, setNote] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);

  // Loading state for price refresh
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const rows = await listInvestments();
    setInvestments(rows);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const resetForm = () => {
    setAssetType("stock");
    setSymbol("");
    setQty("");
    setBuyPrice("");
    setCurrentPrice("");
    setBuyDate(toISODate(new Date()));
    setNote("");
    setEditingId(null);
  };

  const onSubmit = async () => {
    const parsedQty = Number(qty.replace(/[^0-9.-]/g, ""));
    const parsedBuy = Number(buyPrice.replace(/[^0-9.-]/g, ""));
    const parsedCurrent = currentPrice
      ? Number(currentPrice.replace(/[^0-9.-]/g, ""))
      : null;

    if (!symbol.trim() || Number.isNaN(parsedQty) || Number.isNaN(parsedBuy)) {
      Alert.alert(
        "Lengkapi data",
        "Symbol, jumlah, dan harga beli harus diisi."
      );
      return;
    }

    try {
      if (editingId) {
        // Update existing investment
        await updateInvestment(editingId, {
          assetType,
          symbol: symbol.trim().toUpperCase(),
          qty: parsedQty,
          buyPrice: parsedBuy,
          currentPrice: parsedCurrent,
          buyDate,
          note: note.trim() || null,
        });
        Alert.alert("Berhasil", "Investasi berhasil diperbarui.");
      } else {
        // Add new investment
        await addInvestment({
          assetType,
          symbol: symbol.trim().toUpperCase(),
          qty: parsedQty,
          buyPrice: parsedBuy,
          currentPrice: parsedCurrent,
          buyDate,
          note: note.trim() || null,
        });
        Alert.alert("Berhasil", "Investasi berhasil disimpan.");
      }

      resetForm();
      loadData();
    } catch (error) {
      console.error("Error saving investment:", error);
      Alert.alert("Error", "Gagal menyimpan investasi. Silakan coba lagi.");
    }
  };

  const handleEdit = (item: Investment) => {
    setEditingId(item.id);
    setAssetType(item.assetType);
    setSymbol(item.symbol);
    setQty(item.qty.toString());
    setBuyPrice(item.buyPrice.toString());
    setCurrentPrice(item.currentPrice?.toString() || "");
    setBuyDate(item.buyDate);
    setNote(item.note || "");
  };

  const handleDelete = (id: number) => {
    Alert.alert(
      "Hapus Investasi",
      "Apakah Anda yakin ingin menghapus investasi ini?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteInvestment(id);
              loadData();
              Alert.alert("Berhasil", "Investasi berhasil dihapus.");
            } catch (error) {
              console.error("Error deleting investment:", error);
              Alert.alert("Error", "Gagal menghapus investasi.");
            }
          },
        },
      ]
    );
  };

  const handleRefreshPrices = async () => {
    if (investments.length === 0) {
      Alert.alert(
        "Tidak ada investasi",
        "Tambahkan investasi terlebih dahulu."
      );
      return;
    }

    setIsRefreshing(true);

    try {
      const priceMap = await refreshAllPrices(
        investments.map((i) => ({ symbol: i.symbol, assetType: i.assetType }))
      );

      // Update investments with new prices
      for (const investment of investments) {
        const newPrice = priceMap.get(investment.symbol);
        if (newPrice !== undefined) {
          await updateInvestment(investment.id, {
            currentPrice: newPrice,
          });
        }
      }

      await loadData();

      // Show results
      const successCount = priceMap.size;
      if (successCount > 0) {
        Alert.alert(
          "Berhasil",
          `Harga berhasil diperbarui untuk ${successCount} aset.`
        );
      } else {
        Alert.alert("Gagal", "Tidak dapat mengambil harga dari Yahoo Finance.");
      }
    } catch (error) {
      Alert.alert("Error", "Terjadi kesalahan saat mengambil harga.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefreshSinglePrice = async (item: Investment) => {
    try {
      const result = await fetchPrice(item.symbol, item.assetType);
      if (result.price !== null) {
        await updateInvestment(item.id, {
          currentPrice: result.price,
        });
        loadData();
      } else {
        Alert.alert(
          "Gagal",
          `Tidak dapat mengambil harga untuk ${item.symbol}.`
        );
      }
    } catch (error) {
      Alert.alert("Error", "Terjadi kesalahan saat mengambil harga.");
    }
  };

  const totals = useMemo(() => {
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

  const gain = totals.current - totals.invested;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <View style={styles.page}>
          <View style={styles.hero}>
            <View style={[styles.orb, styles.orbTop]} />
            <View style={[styles.orb, styles.orbBottom]} />
            <Text style={styles.heroEyebrow}>Aset & Kinerja</Text>
            <Text style={styles.heroTitle}>Dashboard Investasi</Text>
            <Text style={styles.heroCaption}>
              Pantau nilai portofolio saham dan crypto.
            </Text>
          </View>

          <SectionCard title="Ringkasan Investasi">
            <View style={styles.summary}>
              <View style={styles.rowBetween}>
                <Text style={styles.meta}>Total Investasi</Text>
                <Text style={styles.value}>
                  {formatRupiah(totals.invested)}
                </Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.meta}>Nilai Saat Ini</Text>
                <Text style={styles.value}>{formatRupiah(totals.current)}</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.meta}>Gain / Loss</Text>
                <Text
                  style={[
                    styles.value,
                    gain >= 0 ? styles.amountPositive : styles.amountNegative,
                  ]}
                >
                  {formatRupiah(gain)}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={handleRefreshPrices}
              style={[
                styles.refreshButton,
                isRefreshing && styles.refreshButtonDisabled,
              ]}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.refreshButtonText}>
                  Refresh Harga dari Yahoo
                </Text>
              )}
            </Pressable>
          </SectionCard>

          <View style={styles.sectionSpacer} />

          <SectionCard title={editingId ? "Edit Investasi" : "Catat Investasi"}>
            <SegmentedControl
              options={[
                { label: "Saham", value: "stock" },
                { label: "Crypto", value: "crypto" },
              ]}
              value={assetType}
              onChange={(value) => setAssetType(value as InvestmentType)}
            />
            <View style={styles.form}>
              <Field
                label="Symbol"
                value={symbol}
                onChangeText={setSymbol}
                placeholder="contoh: BBCA / BTC"
              />
              <Field
                label="Jumlah"
                value={qty}
                onChangeText={setQty}
                placeholder="contoh: 10"
                keyboardType="numeric"
              />
              <Field
                label="Harga Beli"
                value={buyPrice}
                onChangeText={setBuyPrice}
                placeholder="contoh: 10000"
                keyboardType="numeric"
              />
              <Field
                label="Harga Saat Ini (opsional)"
                value={currentPrice}
                onChangeText={setCurrentPrice}
                placeholder="contoh: 12000"
                keyboardType="numeric"
              />
              <Field
                label="Tanggal Beli (YYYY-MM-DD)"
                value={buyDate}
                onChangeText={setBuyDate}
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
                  {editingId ? "Update Investasi" : "Simpan Investasi"}
                </Text>
              </Pressable>
            </View>
          </SectionCard>

          <View style={styles.sectionSpacer} />

          <SectionCard title="Daftar Aset">
            {investments.length === 0 ? (
              <EmptyState
                title="Belum ada aset"
                subtitle="Tambah catatan saham atau crypto untuk memulai."
              />
            ) : (
              <View style={styles.listGap}>
                {investments.map((item) => {
                  const current =
                    item.qty * (item.currentPrice ?? item.buyPrice);
                  const invested = item.qty * item.buyPrice;
                  const diff = current - invested;
                  return (
                    <View key={item.id} style={styles.listItem}>
                      <View style={styles.itemContent}>
                        <View style={styles.itemHeader}>
                          <Text style={styles.itemTitle}>{item.symbol}</Text>
                          <Text style={styles.assetTypeBadge}>
                            {item.assetType === "stock" ? "Saham" : "Crypto"}
                          </Text>
                        </View>
                        <Text style={styles.itemMeta}>
                          {item.qty} unit · Beli: {formatRupiah(item.buyPrice)}
                        </Text>
                        {item.currentPrice && (
                          <Text style={styles.itemMeta}>
                            Sekarang: {formatRupiah(item.currentPrice)}
                          </Text>
                        )}
                        <Text style={styles.itemMeta}>{item.buyDate}</Text>
                      </View>
                      <View style={styles.itemRight}>
                        <Text style={styles.itemValue}>
                          {formatRupiah(current)}
                        </Text>
                        <Text
                          style={[
                            styles.meta,
                            diff >= 0
                              ? styles.amountPositive
                              : styles.amountNegative,
                          ]}
                        >
                          {formatRupiah(diff)}
                        </Text>
                        <View style={styles.actionButtons}>
                          <TouchableOpacity
                            onPress={() => handleRefreshSinglePrice(item)}
                            style={styles.refreshSingleButton}
                          >
                            <Text style={styles.refreshSingleButtonText}>
                              ⟳
                            </Text>
                          </TouchableOpacity>
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
                  );
                })}
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
    backgroundColor: "#112D2A",
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
    backgroundColor: "rgba(75, 227, 172, 0.22)",
    right: -40,
    top: -40,
  },
  orbBottom: {
    width: 170,
    height: 170,
    backgroundColor: "rgba(255, 209, 102, 0.18)",
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
  summary: {
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
  amountPositive: {
    color: "#1F7A8C",
  },
  amountNegative: {
    color: "#E25555",
  },
  refreshButton: {
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: "#1F7A8C",
    paddingVertical: 12,
    alignItems: "center",
  },
  refreshButtonDisabled: {
    opacity: 0.7,
  },
  refreshButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  sectionSpacer: {
    height: 16,
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
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemTitle: {
    fontSize: 14,
    color: "#0C1B24",
    fontFamily: "Inter_500Medium",
  },
  assetTypeBadge: {
    fontSize: 10,
    color: "#64748B",
    backgroundColor: "#E4E7EC",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: "Inter_400Regular",
  },
  itemMeta: {
    fontSize: 12,
    color: "#64748B",
    fontFamily: "Inter_400Regular",
  },
  itemValue: {
    fontSize: 14,
    color: "#0C1B24",
    fontFamily: "Inter_500Medium",
  },
  itemRight: {
    alignItems: "flex-end",
  },
  alignEnd: {
    alignItems: "flex-end",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  refreshSingleButton: {
    width: 32,
    height: 32,
    backgroundColor: "#1F7A8C",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshSingleButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    paddingVertical: 6,
    backgroundColor: "#E25555",
    borderRadius: 8,
  },
  deleteButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});
