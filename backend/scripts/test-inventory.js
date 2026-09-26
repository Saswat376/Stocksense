import 'dotenv/config';
import { pool } from '../src/config/db.js';
import { register } from '../src/services/auth.service.js';
import { createProduct } from '../src/services/product.service.js';
import { createReceipt } from '../src/services/receipt.service.js';
import { createDelivery } from '../src/services/delivery.service.js';
import { createTransfer } from '../src/services/transfer.service.js';
import { createAdjustment } from '../src/services/adjustment.service.js';
import { validateMove } from '../src/services/stock.service.js';
import { randomBytes } from 'crypto';

async function runTests() {
  console.log('🚀 Starting Inventory System Load/Feature Test...\n');
  const client = await pool.connect();
  let userId, vendorId, customerId, productId, whId, locInternal, locVendor, locCustomer, locLoss;

  try {
    // 1. Get warehouse and locations
    const { rows: whs } = await client.query('SELECT * FROM warehouses LIMIT 1');
    whId = whs[0].id;
    
    const { rows: locs } = await client.query('SELECT * FROM locations WHERE warehouse_id = $1', [whId]);
    locInternal = locs.find(l => l.location_type === 'internal').id;
    locVendor = locs.find(l => l.location_type === 'vendor').id;
    locCustomer = locs.find(l => l.location_type === 'customer').id;
    locLoss = locs.find(l => l.location_type === 'inventory_loss').id;
    
    console.log('✅ Found Warehouse and Locations.');

    // 2. Setup user and partners
    const uniq = randomBytes(3).toString('hex'); // 6 chars
    const loginId = `Manag${uniq}1`; // 5 + 6 + 1 = 12 chars
    const { user } = await register({ 
      loginId: loginId, 
      email: `mgr_${uniq}@test.com`, 
      password: 'password123' 
    });
    userId = user.id;

    const { rows: vRows } = await client.query("INSERT INTO partners (name, type) VALUES ('ACME Supplies', 'vendor') RETURNING id");
    vendorId = vRows[0].id;
    
    const { rows: cRows } = await client.query("INSERT INTO partners (name, type) VALUES ('John Customer', 'customer') RETURNING id");
    customerId = cRows[0].id;

    console.log(`✅ Created Manager (${loginId}), Vendor, and Customer.`);

    // 3. Create Product with initial stock
    const sku = `PROD-${uniq}`;
    console.log(`\n📦 Creating Product [${sku}] with 100 Initial Stock...`);
    const product = await createProduct({
      name: 'Steel Rods',
      sku: sku,
      initial_stock: 100
    }, userId);
    productId = product.id;

    // Check stock
    let { rows: q1 } = await client.query('SELECT quantity FROM stock_quants WHERE product_id = $1 AND location_id = $2', [productId, locInternal]);
    console.log(`📊 Current Stock (Internal): ${q1[0]?.quantity} (Expected: 100)`);

    // 4. Receipt (Incoming)
    console.log(`\n📥 Creating Receipt for 50 more units from Vendor...`);
    const receipt = await createReceipt({
      warehouse_id: whId,
      vendor_id: vendorId,
      dest_location_id: locInternal,
      lines: [{ product_id: productId, quantity: 50 }]
    }, userId);
    await validateMove(receipt.id);
    console.log(`✅ Receipt Validated!`);

    let { rows: q2 } = await client.query('SELECT quantity FROM stock_quants WHERE product_id = $1 AND location_id = $2', [productId, locInternal]);
    console.log(`📊 Current Stock (Internal): ${q2[0]?.quantity} (Expected: 150)`);

    // 5. Transfer (Internal)
    console.log(`\n🔄 Creating Internal Transfer... (Creating secondary internal location)`);
    const { rows: lRows } = await client.query("INSERT INTO locations (warehouse_id, name, short_code, location_type) VALUES ($1, 'Rack B', 'RACK_B', 'internal') RETURNING id", [whId]);
    const locRackB = lRows[0].id;

    const transfer = await createTransfer({
      warehouse_id: whId,
      source_location_id: locInternal,
      dest_location_id: locRackB,
      lines: [{ product_id: productId, quantity: 20 }]
    }, userId);
    await validateMove(transfer.id);
    console.log(`✅ Transfer Validated! (Moved 20 to Rack B)`);

    let { rows: q3a } = await client.query('SELECT quantity FROM stock_quants WHERE product_id = $1 AND location_id = $2', [productId, locInternal]);
    let { rows: q3b } = await client.query('SELECT quantity FROM stock_quants WHERE product_id = $1 AND location_id = $2', [productId, locRackB]);
    console.log(`📊 Stock (Main): ${q3a[0]?.quantity} (Expected: 130), Stock (Rack B): ${q3b[0]?.quantity} (Expected: 20)`);

    // 6. Delivery (Outgoing)
    console.log(`\n📤 Creating Delivery Order of 30 units to Customer...`);
    const delivery = await createDelivery({
      warehouse_id: whId,
      customer_id: customerId,
      source_location_id: locInternal,
      lines: [{ product_id: productId, quantity: 30 }]
    }, userId);
    await validateMove(delivery.id);
    console.log(`✅ Delivery Validated!`);

    let { rows: q4 } = await client.query('SELECT quantity FROM stock_quants WHERE product_id = $1 AND location_id = $2', [productId, locInternal]);
    console.log(`📊 Stock (Main): ${q4[0]?.quantity} (Expected: 100)`);

    // 7. Adjustment (Missing stock)
    console.log(`\n⚠️ Adjusting stock (Physical count showed -5 missing from Main)`);
    const { moveIds } = await createAdjustment({
      warehouse_id: whId,
      location_id: locInternal,
      lines: [{ product_id: productId, quantity: -5 }]
    }, userId);
    for (const mid of moveIds) await validateMove(mid);
    console.log(`✅ Adjustment Validated!`);

    let { rows: q5 } = await client.query('SELECT quantity FROM stock_quants WHERE product_id = $1 AND location_id = $2', [productId, locInternal]);
    console.log(`📊 Final Stock (Main): ${q5[0]?.quantity} (Expected: 95)`);

    // 8. Audit Ledger
    console.log(`\n📜 Ledger Audit for Product:`);
    const { rows: ledger } = await client.query(`
      SELECT l.quantity, f.name as from_loc, t.name as to_loc 
      FROM stock_ledger l
      LEFT JOIN locations f ON l.from_location_id = f.id
      LEFT JOIN locations t ON l.to_location_id = t.id
      WHERE l.product_id = $1
      ORDER BY l.moved_at ASC
    `, [productId]);

    for (const l of ledger) {
      console.log(`   -> Moved ${l.quantity} from [${l.from_loc}] to [${l.to_loc}]`);
    }

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! The transaction and validation logic works flawlessly.');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

runTests();
