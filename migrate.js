require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('[Migration Error] DATABASE_URL is missing in .env!');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function migrate() {
  console.log('[Migration] Connecting to Neon Database for Expense Plus...');
  
  // 1. Expenses Table
  await sql`
    CREATE TABLE IF NOT EXISTS expenses (
      id VARCHAR(64) PRIMARY KEY,
      user_name VARCHAR(64) NOT NULL DEFAULT 'SARAVANA',
      amount NUMERIC(12, 2) NOT NULL,
      category VARCHAR(64) NOT NULL,
      payment_method VARCHAR(64) NOT NULL DEFAULT 'UPI',
      notes TEXT DEFAULT '',
      date DATE NOT NULL,
      time VARCHAR(16) DEFAULT '12:00',
      quantity INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  // Ensure quantity column exists if table was created previously
  await sql`
    ALTER TABLE expenses ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
  `;
  console.log('[Migration] expenses table ready with quantity support.');

  // Indexes for query performance
  await sql`
    CREATE INDEX IF NOT EXISTS idx_expenses_user_date 
    ON expenses (user_name, date DESC);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_expenses_category 
    ON expenses (category);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_expenses_created_at 
    ON expenses (created_at DESC);
  `;
  console.log('[Migration] expenses indexes ready.');

  // 2. User Settings Table
  await sql`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_name VARCHAR(64) PRIMARY KEY DEFAULT 'SARAVANA',
      currency VARCHAR(10) NOT NULL DEFAULT '₹',
      daily_budget NUMERIC(12, 2) NOT NULL DEFAULT 1500.00,
      monthly_budget NUMERIC(12, 2) NOT NULL DEFAULT 35000.00,
      sound_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  console.log('[Migration] user_settings table ready.');

  // Initialize Default Settings for SARAVANA
  await sql`
    INSERT INTO user_settings (user_name, currency, daily_budget, monthly_budget, sound_enabled)
    VALUES ('SARAVANA', '₹', 1500.00, 35000.00, TRUE)
    ON CONFLICT (user_name) DO NOTHING;
  `;
  console.log('[Migration] Default settings initialized for SARAVANA.');

  // Verify
  const settings = await sql`SELECT * FROM user_settings WHERE user_name = 'SARAVANA'`;
  const expenseCount = await sql`SELECT COUNT(*)::int as count FROM expenses WHERE user_name = 'SARAVANA'`;
  
  console.log('[Migration] Neon PostgreSQL Migration completed successfully!');
  console.log('Settings:', settings[0]);
  console.log('Current expenses count:', expenseCount[0].count);
}

migrate().catch(err => {
  console.error('[Migration Error]', err);
  process.exit(1);
});
