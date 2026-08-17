import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/alchemy_rotas'
});
async function run() {
  try {
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Tables:', res.rows.map(r => r.table_name).join(', '));
    
    // Check erp_service_orders columns
    const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'erp_service_orders'");
    console.log('erp_service_orders columns:', cols.rows.map(c => c.column_name).join(', '));
  } catch(e) { console.error(e); }
  finally { pool.end(); }
}
run();
