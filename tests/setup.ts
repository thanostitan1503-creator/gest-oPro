/**
 * 🔧 SETUP PARA TESTES EM NODE.JS
 * 
 * Configura o ambiente fake do IndexedDB para permitir
 * testes do Dexie fora do navegador.
 */

import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';

// Forçar Dexie a usar o fake-indexeddb
(globalThis as any).indexedDB = (global as any).indexedDB;
(globalThis as any).IDBKeyRange = (global as any).IDBKeyRange;

// Garantir que o Dexie use o IndexedDB fake
Dexie.dependencies.indexedDB = (global as any).indexedDB;
Dexie.dependencies.IDBKeyRange = (global as any).IDBKeyRange;

console.log('✅ Ambiente de testes configurado (fake-indexeddb)');
