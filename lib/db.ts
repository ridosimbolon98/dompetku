import { Platform } from "react-native";

export type TransactionType = "income" | "expense";
export type InvestmentType = "stock" | "crypto";

export type Transaction = {
  id: number;
  type: TransactionType;
  amount: number;
  category: string;
  note: string | null;
  date: string;
};

export type Investment = {
  id: number;
  assetType: InvestmentType;
  symbol: string;
  qty: number;
  buyPrice: number;
  currentPrice: number | null;
  buyDate: string;
  note: string | null;
};

export type DatabaseBackupFile = {
  fileName: string;
  uri: string;
};

type DatabaseBackupPayload = {
  version: 1;
  exportedAt: string;
  transactions: Transaction[];
  investments: Investment[];
};

const isWeb = Platform.OS === "web";

let dbPromise: any = null;
let dbInitialized = false;

const getDbDirectory = async (): Promise<string> => {
  if (isWeb) {
    return "";
  }

  try {
    const FileSystem = getFileSystem();
    const base = FileSystem.documentDirectory ?? "";
    const dir = `${base}dompetku/`;

    const fileInfo = await FileSystem.getInfoAsync(dir);
    if (!fileInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    return dir;
  } catch (error) {
    console.error("Error in getDbDirectory:", error);
    return "";
  }
};

const getDB = async () => {
  if (!dbPromise) {
    try {
      const SQLite = require("expo-sqlite");
      const directory = await getDbDirectory();
      console.log("Opening database at:", directory);

      if (directory) {
        dbPromise = SQLite.openDatabaseAsync(
          "dompetku.db",
          undefined,
          directory,
        );
      } else {
        dbPromise = SQLite.openDatabaseAsync("dompetku.db");
      }
    } catch (error) {
      console.error("Error opening database:", error);
      throw error;
    }
  }
  return dbPromise;
};

const run = async (sql: string, params: (string | number | null)[] = []) => {
  try {
    const db = await getDB();
    const result = await db.runAsync(sql, params);
    return result;
  } catch (error) {
    console.error("Error running SQL:", sql, params, error);
    throw error;
  }
};

const exec = async (sql: string) => {
  try {
    const db = await getDB();
    await db.execAsync(sql);
  } catch (error) {
    console.error("Error executing SQL:", sql, error);
    throw error;
  }
};

const getAll = async (sql: string, params: (string | number | null)[] = []) => {
  try {
    const db = await getDB();
    const result = await db.getAllAsync(sql, params);
    return result ?? [];
  } catch (error) {
    console.error("Error getting all:", sql, params, error);
    return [];
  }
};

const getFileSystem = () => {
  try {
    return require("expo-file-system/legacy");
  } catch {
    return require("expo-file-system");
  }
};

const sanitizeFilePart = (value: string) =>
  value.replace(/[^0-9A-Za-z_-]/g, "");

const getTimestamp = () => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toTimeString().slice(0, 8).replace(/:/g, "");
  return `${date}-${time}`;
};

const ensureDirectory = async (childDirectory: string): Promise<string> => {
  const FileSystem = getFileSystem();
  const baseDirectory = FileSystem.documentDirectory;

  if (!baseDirectory) {
    throw new Error("Direktori dokumen tidak tersedia di perangkat ini.");
  }

  const rootDirectory = `${baseDirectory}dompetku/`;
  const targetDirectory = `${rootDirectory}${childDirectory}/`;

  const rootInfo = await FileSystem.getInfoAsync(rootDirectory);
  if (!rootInfo.exists) {
    await FileSystem.makeDirectoryAsync(rootDirectory, { intermediates: true });
  }

  const targetInfo = await FileSystem.getInfoAsync(targetDirectory);
  if (!targetInfo.exists) {
    await FileSystem.makeDirectoryAsync(targetDirectory, {
      intermediates: true,
    });
  }

  return targetDirectory;
};

const downloadTextOnWeb = (
  fileName: string,
  content: string,
  mimeType: string,
) => {
  const documentRef = (globalThis as any).document;
  const windowRef = (globalThis as any).window;

  if (!documentRef || !windowRef) {
    return;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = windowRef.URL.createObjectURL(blob);
  const anchor = documentRef.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  windowRef.URL.revokeObjectURL(url);
};

const escapeExcelCell = (value: string | number | null) =>
  `${value ?? ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const buildExcelHtml = (
  transactions: Transaction[],
  start: string,
  end: string,
) => {
  const income = transactions
    .filter((item) => item.type === "income")
    .reduce((total, item) => total + item.amount, 0);
  const expense = transactions
    .filter((item) => item.type === "expense")
    .reduce((total, item) => total + item.amount, 0);

  const rows = transactions
    .map(
      (item) => `
        <tr>
          <td>${escapeExcelCell(item.date)}</td>
          <td>${escapeExcelCell(item.type === "income" ? "Pemasukan" : "Pengeluaran")}</td>
          <td>${escapeExcelCell(item.category)}</td>
          <td>${escapeExcelCell(item.note)}</td>
          <td style="mso-number-format:'\\#\\,\\#\\#0';">${item.amount}</td>
        </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <table border="1">
      <tr><th colspan="5">Laporan Keuangan Dompetku</th></tr>
      <tr><td>Periode</td><td colspan="4">${escapeExcelCell(start)} sampai ${escapeExcelCell(end)}</td></tr>
      <tr><td>Total Pemasukan</td><td colspan="4">${income}</td></tr>
      <tr><td>Total Pengeluaran</td><td colspan="4">${expense}</td></tr>
      <tr><td>Saldo Bersih</td><td colspan="4">${income - expense}</td></tr>
      <tr>
        <th>Tanggal</th>
        <th>Tipe</th>
        <th>Kategori</th>
        <th>Catatan</th>
        <th>Nominal</th>
      </tr>
      ${rows}
    </table>
  </body>
</html>`;
};

let memoryTransactions: Transaction[] = [];
let memoryInvestments: Investment[] = [];
let transactionId = 1;
let investmentId = 1;

export const initDB = async () => {
  if (isWeb || dbInitialized) {
    console.log("Web mode or already initialized, skipping DB init");
    return;
  }

  try {
    console.log("Initializing database...");
    const db = await getDB();

    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        note TEXT,
        date TEXT NOT NULL
      );`,
    );
    console.log("Transactions table created");

    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS investments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assetType TEXT NOT NULL,
        symbol TEXT NOT NULL,
        qty REAL NOT NULL,
        buyPrice REAL NOT NULL,
        currentPrice REAL,
        buyDate TEXT NOT NULL,
        note TEXT
      );`,
    );
    console.log("Investments table created");

    dbInitialized = true;
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
    dbInitialized = false;
  }
};

export const addTransaction = async (
  data: Omit<Transaction, "id">,
): Promise<number> => {
  if (isWeb) {
    const item: Transaction = { id: transactionId++, ...data };
    memoryTransactions = [item, ...memoryTransactions];
    return item.id;
  }

  try {
    const result = await run(
      `INSERT INTO transactions (type, amount, category, note, date)
       VALUES (?, ?, ?, ?, ?);`,
      [data.type, data.amount, data.category, data.note ?? null, data.date],
    );
    console.log("Transaction added, ID:", result.lastInsertRowId);
    return result.lastInsertRowId as number;
  } catch (error) {
    console.error("Error adding transaction:", error);
    throw error;
  }
};

export const listTransactions = async (): Promise<Transaction[]> => {
  if (isWeb) {
    return [...memoryTransactions];
  }
  return await getAll(
    `SELECT * FROM transactions ORDER BY date DESC, id DESC;`,
  );
};

export const listTransactionsByRange = async (
  start: string,
  end: string,
): Promise<Transaction[]> => {
  if (isWeb) {
    return memoryTransactions.filter(
      (item) => item.date >= start && item.date < end,
    );
  }
  return await getAll(
    `SELECT * FROM transactions
     WHERE date >= ? AND date < ?
     ORDER BY date DESC, id DESC;`,
    [start, end],
  );
};

export const updateTransaction = async (
  id: number,
  data: Partial<Omit<Transaction, "id">>,
): Promise<void> => {
  if (isWeb) {
    const index = memoryTransactions.findIndex((t) => t.id === id);
    if (index !== -1) {
      memoryTransactions[index] = { ...memoryTransactions[index], ...data };
    }
    return;
  }

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (data.type !== undefined) {
    fields.push("type = ?");
    values.push(data.type);
  }
  if (data.amount !== undefined) {
    fields.push("amount = ?");
    values.push(data.amount);
  }
  if (data.category !== undefined) {
    fields.push("category = ?");
    values.push(data.category);
  }
  if (data.note !== undefined) {
    fields.push("note = ?");
    values.push(data.note);
  }
  if (data.date !== undefined) {
    fields.push("date = ?");
    values.push(data.date);
  }

  if (fields.length === 0) return;

  values.push(id);
  await run(
    `UPDATE transactions SET ${fields.join(", ")} WHERE id = ?;`,
    values,
  );
};

export const deleteTransaction = async (id: number): Promise<void> => {
  if (isWeb) {
    memoryTransactions = memoryTransactions.filter((t) => t.id !== id);
    return;
  }
  await run(`DELETE FROM transactions WHERE id = ?;`, [id]);
};

export const addInvestment = async (
  data: Omit<Investment, "id">,
): Promise<number> => {
  if (isWeb) {
    const item: Investment = { id: investmentId++, ...data };
    memoryInvestments = [item, ...memoryInvestments];
    return item.id;
  }

  try {
    const result = await run(
      `INSERT INTO investments (assetType, symbol, qty, buyPrice, currentPrice, buyDate, note)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        data.assetType,
        data.symbol,
        data.qty,
        data.buyPrice,
        data.currentPrice ?? null,
        data.buyDate,
        data.note ?? null,
      ],
    );
    console.log("Investment added, ID:", result.lastInsertRowId);
    return result.lastInsertRowId as number;
  } catch (error) {
    console.error("Error adding investment:", error);
    throw error;
  }
};

export const listInvestments = async (): Promise<Investment[]> => {
  if (isWeb) {
    return [...memoryInvestments];
  }
  return await getAll(
    `SELECT * FROM investments ORDER BY buyDate DESC, id DESC;`,
  );
};

export const updateInvestment = async (
  id: number,
  data: Partial<Omit<Investment, "id">>,
): Promise<void> => {
  if (isWeb) {
    const index = memoryInvestments.findIndex((i) => i.id === id);
    if (index !== -1) {
      memoryInvestments[index] = { ...memoryInvestments[index], ...data };
    }
    return;
  }

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (data.assetType !== undefined) {
    fields.push("assetType = ?");
    values.push(data.assetType);
  }
  if (data.symbol !== undefined) {
    fields.push("symbol = ?");
    values.push(data.symbol);
  }
  if (data.qty !== undefined) {
    fields.push("qty = ?");
    values.push(data.qty);
  }
  if (data.buyPrice !== undefined) {
    fields.push("buyPrice = ?");
    values.push(data.buyPrice);
  }
  if (data.currentPrice !== undefined) {
    fields.push("currentPrice = ?");
    values.push(data.currentPrice);
  }
  if (data.buyDate !== undefined) {
    fields.push("buyDate = ?");
    values.push(data.buyDate);
  }
  if (data.note !== undefined) {
    fields.push("note = ?");
    values.push(data.note);
  }

  if (fields.length === 0) return;

  values.push(id);
  await run(
    `UPDATE investments SET ${fields.join(", ")} WHERE id = ?;`,
    values,
  );
};

export const deleteInvestment = async (id: number): Promise<void> => {
  if (isWeb) {
    memoryInvestments = memoryInvestments.filter((i) => i.id !== id);
    return;
  }
  await run(`DELETE FROM investments WHERE id = ?;`, [id]);
};

export const exportTransactionsToExcel = async (
  transactions: Transaction[],
  start: string,
  end: string,
): Promise<DatabaseBackupFile> => {
  const safeStart = sanitizeFilePart(start);
  const safeEnd = sanitizeFilePart(end);
  const fileName = `laporan-transaksi-${safeStart}-${safeEnd}.xls`;
  const content = buildExcelHtml(transactions, start, end);
  const mimeType = "application/vnd.ms-excel;charset=utf-8";

  if (isWeb) {
    downloadTextOnWeb(fileName, content, mimeType);
    return { fileName, uri: fileName };
  }

  const FileSystem = getFileSystem();
  const directory = await ensureDirectory("exports");
  const uri = `${directory}${fileName}`;

  await FileSystem.writeAsStringAsync(uri, content);

  return { fileName, uri };
};

export const createDatabaseBackup = async (): Promise<DatabaseBackupFile> => {
  const payload: DatabaseBackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions: await listTransactions(),
    investments: await listInvestments(),
  };
  const fileName = `dompetku-backup-${getTimestamp()}.json`;
  const content = JSON.stringify(payload, null, 2);

  if (isWeb) {
    downloadTextOnWeb(fileName, content, "application/json;charset=utf-8");
    return { fileName, uri: fileName };
  }

  const FileSystem = getFileSystem();
  const directory = await ensureDirectory("backups");
  const uri = `${directory}${fileName}`;

  await FileSystem.writeAsStringAsync(uri, content);

  return { fileName, uri };
};

export const listDatabaseBackups = async (): Promise<DatabaseBackupFile[]> => {
  if (isWeb) {
    return [];
  }

  const FileSystem = getFileSystem();
  const directory = await ensureDirectory("backups");
  const files = await FileSystem.readDirectoryAsync(directory);

  return files
    .filter((fileName: string) => fileName.endsWith(".json"))
    .sort()
    .reverse()
    .map((fileName: string) => ({
      fileName,
      uri: `${directory}${fileName}`,
    }));
};

export const restoreDatabaseBackup = async (uri: string): Promise<void> => {
  const FileSystem = getFileSystem();
  const content = await FileSystem.readAsStringAsync(uri);
  const payload = JSON.parse(content) as Partial<DatabaseBackupPayload>;

  if (
    payload.version !== 1 ||
    !Array.isArray(payload.transactions) ||
    !Array.isArray(payload.investments)
  ) {
    throw new Error("Format file backup tidak valid.");
  }

  if (isWeb) {
    memoryTransactions = payload.transactions.map((item) => ({
      id: Number(item.id),
      type: item.type,
      amount: Number(item.amount),
      category: item.category,
      note: item.note ?? null,
      date: item.date,
    }));
    memoryInvestments = payload.investments.map((item) => ({
      id: Number(item.id),
      assetType: item.assetType,
      symbol: item.symbol,
      qty: Number(item.qty),
      buyPrice: Number(item.buyPrice),
      currentPrice:
        item.currentPrice == null ? null : Number(item.currentPrice),
      buyDate: item.buyDate,
      note: item.note ?? null,
    }));
    transactionId =
      Math.max(0, ...memoryTransactions.map((item) => item.id)) + 1;
    investmentId = Math.max(0, ...memoryInvestments.map((item) => item.id)) + 1;
    return;
  }

  await exec("BEGIN TRANSACTION;");

  try {
    await run(`DELETE FROM transactions;`);
    await run(`DELETE FROM investments;`);

    for (const item of payload.transactions) {
      await run(
        `INSERT INTO transactions (id, type, amount, category, note, date)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [
          Number(item.id),
          item.type,
          Number(item.amount),
          item.category,
          item.note ?? null,
          item.date,
        ],
      );
    }

    for (const item of payload.investments) {
      await run(
        `INSERT INTO investments (id, assetType, symbol, qty, buyPrice, currentPrice, buyDate, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          Number(item.id),
          item.assetType,
          item.symbol,
          Number(item.qty),
          Number(item.buyPrice),
          item.currentPrice == null ? null : Number(item.currentPrice),
          item.buyDate,
          item.note ?? null,
        ],
      );
    }

    await exec("COMMIT;");
  } catch (error) {
    await exec("ROLLBACK;");
    throw error;
  }
};
