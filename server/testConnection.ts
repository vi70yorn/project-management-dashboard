import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const PGHOST = process.env.PGHOST || 'localhost';
const PGPORT = parseInt(process.env.PGPORT || '5432', 10);
const PGUSER = process.env.PGUSER || 'postgres';
const PGPASSWORD = process.env.PGPASSWORD || 'postgres';
const PGDATABASE = process.env.PGDATABASE || 'project_management';

async function testConnection() {
  console.log('Testing PostgreSQL connection with parameters:');
  console.log(`  Host:     ${PGHOST}`);
  console.log(`  Port:     ${PGPORT}`);
  console.log(`  User:     ${PGUSER}`);
  console.log(`  Password: ${'*'.repeat(PGPASSWORD.length)} (${PGPASSWORD.length} characters)`);
  console.log(`  Database: ${PGDATABASE}`);
  console.log('--------------------------------------------------');

  const client = new Client({
    host: PGHOST,
    port: PGPORT,
    user: PGUSER,
    password: PGPASSWORD,
    database: 'postgres', // Connect to default postgres DB first to test credentials
  });

  try {
    await client.connect();
    console.log('✅ Success: Connected to PostgreSQL server on localhost:5432!');
    const res = await client.query('SELECT version(), current_user;');
    console.log(`  Version: ${res.rows[0].version}`);
    console.log(`  User:    ${res.rows[0].current_user}`);
    await client.end();
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Connection Failed:');
    console.error(`  ${err.message}`);
    if (err.code === '28P01') {
      console.log('\n💡 Hint: Password authentication failed.');
      console.log('  Please open the file ".env" in this project and set:');
      console.log('  PGPASSWORD=your_actual_postgres_password');
    } else if (err.code === 'ECONNREFUSED') {
      console.log('\n💡 Hint: Connection was refused on port 5432.');
      console.log('  Make sure the PostgreSQL service is running in Windows Services.');
    }
    process.exit(1);
  }
}

testConnection();
