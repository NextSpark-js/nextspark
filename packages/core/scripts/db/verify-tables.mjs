import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env manually to avoid cache issues
const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');

let DATABASE_URL = null;
envLines.forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    if (key?.trim() === 'DATABASE_URL' && valueParts.length > 0) {
      DATABASE_URL = valueParts.join('=').replace(/^["']|["']$/g, '').trim();
    }
  }
});

async function verifyTables() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log("✅ Connected to database\n");
    
    // Check Better Auth tables
    const result = await client.query(`
      SELECT 
        table_name, 
        column_name, 
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name IN ('user', 'session', 'account', 'verification')
      ORDER BY table_name, ordinal_position
    `);
    
    if (result.rows.length === 0) {
      console.log("❌ No Better Auth tables found!");
      return;
    }
    
    // Group by table
    const tables = {};
    result.rows.forEach(row => {
      if (!tables[row.table_name]) {
        tables[row.table_name] = [];
      }
      tables[row.table_name].push({
        column: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable,
        default: row.column_default
      });
    });
    
    // Display table structure
    console.log("📊 Better Auth Tables Schema:\n");
    for (const [tableName, columns] of Object.entries(tables)) {
      console.log(`Table: ${tableName}`);
      console.log("─".repeat(50));
      columns.forEach(col => {
        const nullable = col.nullable === 'NO' ? ' NOT NULL' : '';
        const defaultVal = col.default ? ` DEFAULT ${col.default}` : '';
        console.log(`  ${col.column.padEnd(25)} ${col.type}${nullable}${defaultVal}`);
      });
      console.log();
    }
    
    // Check row counts
    console.log("📈 Row Counts:\n");
    for (const tableName of Object.keys(tables)) {
      const countResult = await client.query(`SELECT COUNT(*) FROM "${tableName}"`);
      console.log(`  ${tableName.padEnd(15)} ${countResult.rows[0].count} rows`);
    }
    
    // Check indexes
    const indexResult = await client.query(`
      SELECT 
        indexname,
        tablename
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND tablename IN ('user', 'session', 'account', 'verification')
      ORDER BY tablename, indexname
    `);
    
    if (indexResult.rows.length > 0) {
      console.log("\n🔍 Indexes:\n");
      let currentTable = '';
      indexResult.rows.forEach(row => {
        if (currentTable !== row.tablename) {
          currentTable = row.tablename;
          console.log(`  ${row.tablename}:`);
        }
        console.log(`    - ${row.indexname}`);
      });
    }
    
    // Check triggers
    const triggerResult = await client.query(`
      SELECT 
        trigger_name,
        event_object_table
      FROM information_schema.triggers 
      WHERE trigger_schema = 'public' 
      AND event_object_table IN ('user', 'session', 'account', 'verification')
      ORDER BY event_object_table, trigger_name
    `);
    
    if (triggerResult.rows.length > 0) {
      console.log("\n⚡ Triggers:\n");
      let currentTable = '';
      triggerResult.rows.forEach(row => {
        if (currentTable !== row.event_object_table) {
          currentTable = row.event_object_table;
          console.log(`  ${row.event_object_table}:`);
        }
        console.log(`    - ${row.trigger_name}`);
      });
    }
    
    await client.end();
    console.log("\n✅ Verification complete!");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

verifyTables();