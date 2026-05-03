require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('../db');

const adminKey = process.argv[2];
if (adminKey !== process.env.ADMIN_KEY) {
  console.error('Wrong admin key.');
  process.exit(1);
}

// Generate a human-readable code like CALC-A3FX-9K2M-BVTZ
function makeCode() {
  const seg = () => Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CALC-${seg()}-${seg()}-${seg()}`;
}

const code = makeCode();
const hash = bcrypt.hashSync(code, 10);

db.prepare(`
  INSERT INTO licenses (code, code_hash) VALUES (?, ?)
`).run(code, hash);

console.log('\n✅ New license code generated:');
console.log(`   ${code}`);
console.log('\nGive this code to your customer. It activates for 30 days on first use.\n');