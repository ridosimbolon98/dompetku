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

const isWeb = Platform.OS === "web";

let dbPromise: any = null;
let dbInitialized = false;

// Import from legacy to avoid deprecated warnings
const getDbDirectory = async (): Promise<string> => {
  if (isWeb) {
    return "";
  }

  try {
    // Use legacy import to avoid deprecated warnings
    const FileSystem = require("expo-file-system");
    const base = FileSystem.documentDirectory ?? "";
    const dir = `${base}dompetku/`;

    const fileInfo = await FileSystem.getInfoAsync(dir);
    if (!fileInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    return dir;
  } catch (error) {
    console.error("Error in getDbDirectory:", error);
    // Let expo-sqlite handle default directory
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
          directory
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
      );`
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
      );`
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
  data: Omit<Transaction, "id">
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
      [data.type, data.amount, data.category, data.note ?? null, data.date]
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
    `SELECT * FROM transactions ORDER BY date DESC, id DESC;`
  );
};

export const listTransactionsByRange = async (
  start: string,
  end: string
): Promise<Transaction[]> => {
  if (isWeb) {
    return memoryTransactions.filter(
      (item) => item.date >= start && item.date < end
    );
  }
  return await getAll(
    `SELECT * FROM transactions
     WHERE date >= ? AND date < ?
     ORDER BY date DESC, id DESC;`,
    [start, end]
  );
};

export const updateTransaction = async (
  id: number,
  data: Partial<Omit<Transaction, "id">>
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
    values
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
  data: Omit<Investment, "id">
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
      ]
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
    `SELECT * FROM investments ORDER BY buyDate DESC, id DESC;`
  );
};

export const updateInvestment = async (
  id: number,
  data: Partial<Omit<Investment, "id">>
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
    values
  );
};

export const deleteInvestment = async (id: number): Promise<void> => {
  if (isWeb) {
    memoryInvestments = memoryInvestments.filter((i) => i.id !== id);
    return;
  }
  await run(`DELETE FROM investments WHERE id = ?;`, [id]);
};
