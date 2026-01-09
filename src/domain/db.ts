// Simple in-memory database implementation for testing purposes.
//
// The real project removed Dexie in the online-only migration. These tests
// require a "db" object with tables that mimic the Dexie API (open, clear,
// where/equals/and/count, toArray, get, put, etc.). This implementation
// provides just enough functionality to satisfy the unit tests without
// persisting anything to IndexedDB. Each table stores its records in an
// array and exposes query helpers that chain filters and counts.

export function generateId(): string {
  // Generate a pseudo‑random identifier. This does not have to be a UUID but
  // should be unique enough for test purposes.
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Query helper returned from Table.where().equals(). It supports chaining
 * additional predicates via .and() or .filter() and can resolve to the first
 * element, count or an array.
 */
class Query<T extends { [key: string]: any }> {
  private list: T[];
  constructor(records: T[]) {
    this.list = records;
  }
  /** Adds an additional predicate to the current query. */
  and(fn: (record: T) => boolean): Query<T> {
    this.list = this.list.filter(fn);
    return this;
  }
  /** Alias for .and() to support filter() in tests. */
  filter(fn: (record: T) => boolean): Query<T> {
    this.list = this.list.filter(fn);
    return this;
  }
  /** Returns the first element of the query or undefined. */
  async first(): Promise<T | undefined> {
    return this.list.length > 0 ? this.list[0] : undefined;
  }
  /** Returns the number of records matching the query. */
  async count(): Promise<number> {
    return this.list.length;
  }
  /** Returns all records in the query as a new array. */
  async toArray(): Promise<T[]> {
    return [...this.list];
  }
}

/**
 * In-memory table. Stores records in an array and provides minimal Dexie-like
 * methods: clear, get, put, delete, where, and toArray.
 */
class Table<T extends { [key: string]: any }> {
  private records: T[] = [];

  /** Removes all records from the table. */
  async clear(): Promise<void> {
    this.records = [];
  }

  /** Retrieves a single record by its id field. */
  async get(id: string): Promise<T | undefined> {
    return this.records.find((r) => r.id === id);
  }

  /**
   * Inserts or updates a record. If a record with the same id already exists
   * it will be replaced; otherwise the record is appended.
   */
  async put(record: T): Promise<T> {
    const idx = this.records.findIndex((r) => r.id === record.id);
    if (idx >= 0) {
      this.records[idx] = record;
    } else {
      this.records.push(record);
    }
    return record;
  }

  /** Deletes a record by id. */
  async delete(id: string): Promise<void> {
    const idx = this.records.findIndex((r) => r.id === id);
    if (idx >= 0) {
      this.records.splice(idx, 1);
    }
  }

  /**
   * Initiates a query on a specific field. Used as
   * db.table.where('field').equals(value).and(predicate).count()
   */
  where(field: string) {
    const table = this;
    return {
      equals(value: any) {
        const filtered = table.records.filter((r) => r[field] === value);
        return new Query<T>(filtered);
      },
    };
  }

  /** Returns all records as a new array. */
  async toArray(): Promise<T[]> {
    return [...this.records];
  }
}

/**
 * Database with a set of tables required by the tests. Tables are created on
 * demand and are simple in-memory stores.
 */
class Database {
  employees = new Table<any>();
  outbox_events = new Table<any>();
  deposits = new Table<any>();
  products = new Table<any>();
  service_orders = new Table<any>();
  service_order_items = new Table<any>();
  stock_movements = new Table<any>();
  stock_balance = new Table<any>();
  work_shifts = new Table<any>();
  cash_flow_entries = new Table<any>();
  shift_stock_audits = new Table<any>();

  /** No-op open function to mirror Dexie's API. */
  async open(): Promise<void> {
    return;
  }
}

/** Singleton database instance used throughout the application. */
export const db = new Database();
