require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { neon, neonConfig } = require('@neondatabase/serverless');

// WebSocket setup for serverless driver if needed in Node.js
try {
  const ws = require('ws');
  neonConfig.webSocketConstructor = ws;
} catch (e) {
  // Optional in standard HTTP fetch environments
}

const app = express();
const PORT = process.env.PORT || 3000;
const USER_NAME = 'SARAVANA';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// Pre-load index.html for instant Vercel serverless response
let indexHtml = '';
try {
  indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
} catch (e) {
  console.warn('Could not pre-read index.html:', e.message);
}

// Explicit Root Routes (Prevents "Cannot GET /" error on Vercel)
app.get(['/', '/index.html'], (req, res) => {
  if (indexHtml) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(indexHtml);
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// PWA Manifest & Service Worker Routes
app.get('/manifest.json', (req, res) => {
  const manifestPath = path.join(__dirname, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    res.setHeader('Content-Type', 'application/json');
    return res.sendFile(manifestPath);
  }
  res.status(404).json({ error: 'Not found' });
});

app.get('/sw.js', (req, res) => {
  const swPath = path.join(__dirname, 'sw.js');
  if (fs.existsSync(swPath)) {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Service-Worker-Allowed', '/');
    return res.sendFile(swPath);
  }
  res.status(404).send('Service worker not found');
});

// App Icon & Logo Routes
app.get('/icon-192.png', (req, res) => {
  const p = path.join(__dirname, 'icon-192.png');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.status(404).send('Icon not found');
});

app.get('/icon-512.png', (req, res) => {
  const p = path.join(__dirname, 'icon-512.png');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.status(404).send('Icon not found');
});

app.get(['/EP_logo.webp', '/logo.webp'], (req, res) => {
  const p = path.join(__dirname, 'EP_logo.webp');
  if (fs.existsSync(p)) {
    res.setHeader('Content-Type', 'image/webp');
    return res.sendFile(p);
  }
  res.status(404).send('Logo not found');
});

app.get('/logo.png', (req, res) => {
  const p = path.join(__dirname, 'logo.png');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.status(404).send('Logo not found');
});

app.get('/logo.svg', (req, res) => {
  const p = path.join(__dirname, 'logo.svg');
  if (fs.existsSync(p)) {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.sendFile(p);
  }
  res.status(404).send('Logo not found');
});

app.get('/favicon.png', (req, res) => {
  const p = path.join(__dirname, 'favicon.png');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.status(404).send('Favicon not found');
});

// -------------------------------------------------------------
// NEON DATABASE INITIALIZATION
// -------------------------------------------------------------
const databaseUrl = process.env.DATABASE_URL;
let sql = null;
let isDbConnected = false;
let isDbInitialized = false;

if (databaseUrl) {
  try {
    sql = neon(databaseUrl);
    isDbConnected = true;
    console.log('[Neon DB] Initialized Neon Serverless client.');
  } catch (err) {
    console.error('[Neon DB] Initialization error:', err.message);
  }
}

// Auto-migration & Schema Check
async function ensureDatabase() {
  if (!sql || isDbInitialized) return;
  try {
    await sql`SELECT 1`;
    isDbConnected = true;

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
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;

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

    await sql`
      INSERT INTO user_settings (user_name, currency, daily_budget, monthly_budget, sound_enabled)
      VALUES ('SARAVANA', '₹', 1500.00, 35000.00, TRUE)
      ON CONFLICT (user_name) DO NOTHING;
    `;

    isDbInitialized = true;
    console.log('[Neon DB] Database schema verified and ready.');
  } catch (err) {
    console.error('[Neon DB] Database setup error:', err.message);
  }
}

// Middleware to ensure DB is initialized on demand
app.use(async (req, res, next) => {
  if (sql && !isDbInitialized) {
    await ensureDatabase();
  }
  next();
});

// -------------------------------------------------------------
// REST API ROUTES
// -------------------------------------------------------------

// 1. Health & Connection Status
app.get('/api/health', async (req, res) => {
  try {
    if (!sql) throw new Error('Database connection URL not configured');
    await sql`SELECT 1`;
    res.json({
      status: 'online',
      database: 'connected',
      user: USER_NAME,
      serverTime: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      status: 'offline',
      database: 'disconnected',
      error: err.message,
      user: USER_NAME,
      serverTime: new Date().toISOString()
    });
  }
});

// 2. User Settings
app.get('/api/settings', async (req, res) => {
  try {
    if (!sql) throw new Error('DB offline');
    const rows = await sql`
      SELECT user_name, currency, daily_budget, monthly_budget, sound_enabled, updated_at
      FROM user_settings
      WHERE user_name = ${USER_NAME}
      LIMIT 1
    `;
    if (rows.length > 0) {
      return res.json({
        userName: rows[0].user_name,
        currency: rows[0].currency,
        dailyBudget: parseFloat(rows[0].daily_budget) || 1500,
        monthlyBudget: parseFloat(rows[0].monthly_budget) || 35000,
        soundEnabled: rows[0].sound_enabled ?? true,
        updatedAt: rows[0].updated_at
      });
    }
    res.json({
      userName: USER_NAME,
      currency: '₹',
      dailyBudget: 1500,
      monthlyBudget: 35000,
      soundEnabled: true
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    if (!sql) throw new Error('DB offline');
    const { currency, dailyBudget, monthlyBudget, soundEnabled } = req.body;
    
    await sql`
      INSERT INTO user_settings (user_name, currency, daily_budget, monthly_budget, sound_enabled, updated_at)
      VALUES (
        ${USER_NAME},
        ${currency || '₹'},
        ${parseFloat(dailyBudget) || 1500},
        ${parseFloat(monthlyBudget) || 35000},
        ${soundEnabled !== false},
        NOW()
      )
      ON CONFLICT (user_name) DO UPDATE SET
        currency = EXCLUDED.currency,
        daily_budget = EXCLUDED.daily_budget,
        monthly_budget = EXCLUDED.monthly_budget,
        sound_enabled = EXCLUDED.sound_enabled,
        updated_at = NOW()
    `;

    res.json({
      success: true,
      settings: {
        userName: USER_NAME,
        currency: currency || '₹',
        dailyBudget: parseFloat(dailyBudget) || 1500,
        monthlyBudget: parseFloat(monthlyBudget) || 35000,
        soundEnabled: soundEnabled !== false
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get Expenses (with date/period/category/search filters)
app.get('/api/expenses', async (req, res) => {
  try {
    if (!sql) throw new Error('DB offline');

    const { period, date, startDate, endDate, category, search, limit } = req.query;

    let query = sql`
      SELECT 
        id, 
        user_name AS "userName", 
        amount, 
        category, 
        payment_method AS "paymentMethod", 
        notes, 
        TO_CHAR(date, 'YYYY-MM-DD') AS "date", 
        time, 
        COALESCE(quantity, 1)::int AS "quantity",
        created_at AS "createdAt", 
        updated_at AS "updatedAt"
      FROM expenses
      WHERE user_name = ${USER_NAME}
    `;

    // Fetch all for local calculation or filtered
    const rows = await sql`
      SELECT 
        id, 
        user_name AS "userName", 
        amount::float AS "amount", 
        category, 
        payment_method AS "paymentMethod", 
        notes, 
        TO_CHAR(date, 'YYYY-MM-DD') AS "date", 
        time, 
        COALESCE(quantity, 1)::int AS "quantity",
        created_at AS "createdAt", 
        updated_at AS "updatedAt"
      FROM expenses
      WHERE user_name = ${USER_NAME}
      ORDER BY date DESC, created_at DESC
    `;

    // Filter in JS or SQL for maximum flexibility and clean formatting
    let filtered = rows;

    if (period === 'day' && date) {
      filtered = filtered.filter(item => item.date === date);
    } else if (startDate && endDate) {
      filtered = filtered.filter(item => item.date >= startDate && item.date <= endDate);
    }

    if (category && category !== 'All') {
      filtered = filtered.filter(item => item.category.toLowerCase() === category.toLowerCase());
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(item => 
        (item.notes && item.notes.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        (item.paymentMethod && item.paymentMethod.toLowerCase().includes(q)) ||
        item.amount.toString().includes(q)
      );
    }

    const totalAmount = filtered.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

    const maxLimit = parseInt(limit) || 2000;
    const paginated = filtered.slice(0, maxLimit);

    res.json({
      expenses: paginated,
      totalCount: filtered.length,
      totalAmount: Math.round(totalAmount * 100) / 100
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Aggregated Summary (Day, Week, Month, Year metrics + category breakdown + charts)
app.get('/api/expenses/summary', async (req, res) => {
  try {
    if (!sql) throw new Error('DB offline');

    const clientDateStr = req.query.date || new Date().toISOString().split('T')[0];
    
    // Fetch all records for SARAVANA to produce rich analytics
    const allExpenses = await sql`
      SELECT 
        id, 
        amount::float AS "amount", 
        category, 
        payment_method AS "paymentMethod", 
        notes, 
        TO_CHAR(date, 'YYYY-MM-DD') AS "date", 
        time, 
        created_at AS "createdAt"
      FROM expenses
      WHERE user_name = ${USER_NAME}
      ORDER BY date DESC, created_at DESC
    `;

    // Compute metrics
    const now = new Date(clientDateStr + 'T12:00:00Z');
    const todayStr = clientDateStr;
    
    // Start of week (Monday)
    const dayOfWeek = (now.getUTCDay() + 6) % 7; // 0 = Mon, 6 = Sun
    const startOfWeek = new Date(now);
    startOfWeek.setUTCDate(now.getUTCDate() - dayOfWeek);
    const startOfWeekStr = startOfWeek.toISOString().split('T')[0];

    // Start of month (YYYY-MM-01)
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const startOfMonthStr = `${year}-${month}-01`;

    // Start of year (YYYY-01-01)
    const startOfYearStr = `${year}-01-01`;

    let todayTotal = 0;
    let weekTotal = 0;
    let monthTotal = 0;
    let yearTotal = 0;
    let allTimeTotal = 0;

    const categoryMap = {};
    const paymentMap = {};
    const dailyMap = {};
    const monthlyMap = {};

    allExpenses.forEach(exp => {
      const amt = parseFloat(exp.amount) || 0;
      const d = exp.date;
      allTimeTotal += amt;

      if (d === todayStr) {
        todayTotal += amt;
      }
      if (d >= startOfWeekStr && d <= todayStr) {
        weekTotal += amt;
      }
      if (d >= startOfMonthStr && d.startsWith(`${year}-${month}`)) {
        monthTotal += amt;
      }
      if (d >= startOfYearStr && d.startsWith(`${year}`)) {
        yearTotal += amt;
      }

      // Category breakdown (for current month by default)
      if (d >= startOfMonthStr && d.startsWith(`${year}-${month}`)) {
        categoryMap[exp.category] = (categoryMap[exp.category] || 0) + amt;
      }

      // Payment method breakdown
      paymentMap[exp.paymentMethod] = (paymentMap[exp.paymentMethod] || 0) + amt;

      // Daily totals for current month chart
      if (d >= startOfMonthStr && d.startsWith(`${year}-${month}`)) {
        dailyMap[d] = (dailyMap[d] || 0) + amt;
      }

      // Monthly totals for current year chart
      if (d.startsWith(`${year}`)) {
        const mKey = d.substring(0, 7); // YYYY-MM
        monthlyMap[mKey] = (monthlyMap[mKey] || 0) + amt;
      }
    });

    res.json({
      todayTotal: Math.round(todayTotal * 100) / 100,
      weekTotal: Math.round(weekTotal * 100) / 100,
      monthTotal: Math.round(monthTotal * 100) / 100,
      yearTotal: Math.round(yearTotal * 100) / 100,
      allTimeTotal: Math.round(allTimeTotal * 100) / 100,
      totalCount: allExpenses.length,
      categoryBreakdown: categoryMap,
      paymentBreakdown: paymentMap,
      dailyTrend: dailyMap,
      monthlyTrend: monthlyMap,
      computedAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Create Single Expense
app.post('/api/expenses', async (req, res) => {
  try {
    if (!sql) throw new Error('DB offline');

    const { id, amount, category, payment_method, paymentMethod, notes, date, time, quantity } = req.body;
    
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const expId = id || `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const cat = category || 'Other';
    const payMode = paymentMethod || payment_method || 'UPI';
    const noteText = notes || '';
    const expDate = date || new Date().toISOString().split('T')[0];
    const expTime = time || new Date().toTimeString().substring(0, 5);
    const expQty = parseInt(quantity) > 0 ? parseInt(quantity) : 1;

    await sql`
      INSERT INTO expenses (id, user_name, amount, category, payment_method, notes, date, time, quantity, created_at, updated_at)
      VALUES (
        ${expId},
        ${USER_NAME},
        ${parseFloat(amount)},
        ${cat},
        ${payMode},
        ${noteText},
        ${expDate},
        ${expTime},
        ${expQty},
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        amount = EXCLUDED.amount,
        category = EXCLUDED.category,
        payment_method = EXCLUDED.payment_method,
        notes = EXCLUDED.notes,
        date = EXCLUDED.date,
        time = EXCLUDED.time,
        quantity = EXCLUDED.quantity,
        updated_at = NOW()
    `;

    res.status(201).json({
      success: true,
      expense: {
        id: expId,
        userName: USER_NAME,
        amount: parseFloat(amount),
        category: cat,
        paymentMethod: payMode,
        notes: noteText,
        date: expDate,
        time: expTime,
        quantity: expQty,
        createdAt: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Update Expense
app.put('/api/expenses/:id', async (req, res) => {
  try {
    if (!sql) throw new Error('DB offline');

    const { id } = req.params;
    const { amount, category, payment_method, paymentMethod, notes, date, time, quantity } = req.body;

    const cat = category || 'Other';
    const payMode = paymentMethod || payment_method || 'UPI';
    const noteText = notes || '';
    const expDate = date || new Date().toISOString().split('T')[0];
    const expTime = time || new Date().toTimeString().substring(0, 5);
    const expQty = parseInt(quantity) > 0 ? parseInt(quantity) : 1;

    await sql`
      UPDATE expenses
      SET 
        amount = ${parseFloat(amount)},
        category = ${cat},
        payment_method = ${payMode},
        notes = ${noteText},
        date = ${expDate},
        time = ${expTime},
        quantity = ${expQty},
        updated_at = NOW()
      WHERE id = ${id} AND user_name = ${USER_NAME}
    `;

    res.json({
      success: true,
      expense: {
        id,
        userName: USER_NAME,
        amount: parseFloat(amount),
        category: cat,
        paymentMethod: payMode,
        notes: noteText,
        date: expDate,
        time: expTime
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Delete Expense
app.delete('/api/expenses/:id', async (req, res) => {
  try {
    if (!sql) throw new Error('DB offline');
    const { id } = req.params;

    await sql`
      DELETE FROM expenses 
      WHERE id = ${id} AND user_name = ${USER_NAME}
    `;

    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. BATCH SYNC ENDPOINT (Offline Queue Sync)
app.post('/api/expenses/sync', async (req, res) => {
  try {
    if (!sql) throw new Error('DB offline');

    const { batch } = req.body;
    if (!Array.isArray(batch) || batch.length === 0) {
      return res.json({ success: true, count: 0, message: 'No items to sync' });
    }

    let syncedCount = 0;

    for (const item of batch) {
      if (item.deleted || item.isDeleted) {
        // Execute deletion
        await sql`
          DELETE FROM expenses 
          WHERE id = ${item.id} AND user_name = ${USER_NAME}
        `;
        syncedCount++;
      } else {
        // Upsert expense
        const expId = item.id || `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const amount = parseFloat(item.amount) || 0;
        const cat = item.category || 'Other';
        const payMode = item.paymentMethod || item.payment_method || 'UPI';
        const noteText = item.notes || '';
        const expDate = item.date || new Date().toISOString().split('T')[0];
        const expTime = item.time || '12:00';
        const expQty = parseInt(item.quantity) > 0 ? parseInt(item.quantity) : 1;

        await sql`
          INSERT INTO expenses (id, user_name, amount, category, payment_method, notes, date, time, quantity, created_at, updated_at)
          VALUES (
            ${expId},
            ${USER_NAME},
            ${amount},
            ${cat},
            ${payMode},
            ${noteText},
            ${expDate},
            ${expTime},
            ${expQty},
            NOW(),
            NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            amount = EXCLUDED.amount,
            category = EXCLUDED.category,
            payment_method = EXCLUDED.payment_method,
            notes = EXCLUDED.notes,
            date = EXCLUDED.date,
            time = EXCLUDED.time,
            quantity = EXCLUDED.quantity,
            updated_at = NOW()
        `;
        syncedCount++;
      }
    }

    res.json({
      success: true,
      syncedCount,
      serverTime: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Clear All Expenses (Protected with username check)
app.post('/api/expenses/clear', async (req, res) => {
  try {
    if (!sql) throw new Error('DB offline');
    await sql`DELETE FROM expenses WHERE user_name = ${USER_NAME}`;
    res.json({ success: true, message: 'All expenses cleared for ' + USER_NAME });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback route for SPA pages
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  if (indexHtml) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(indexHtml);
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server when run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[Server] Expense Plus server running at http://localhost:${PORT}`);
    console.log(`[User] Active User: ${USER_NAME}`);
  });
}

module.exports = app;
