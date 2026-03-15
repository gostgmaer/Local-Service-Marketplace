const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '../.env' });

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DB || 'marketplace',
});

async function verifySeeding() {
  console.log('🔍 Verifying database seeding...\n');

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful\n');

    // Count all tables
    const tables = [
      'users',
      'sessions',
      'login_attempts',
      'providers',
      'service_categories',
      'provider_services',
      'provider_availability',
      'locations',
      'service_requests',
      'proposals',
      'jobs',
      'payments',
      'refunds',
      'reviews',
      'messages',
      'attachments',
      'notifications',
      'notification_deliveries',
      'favorites',
      'coupons',
      'coupon_usage',
      'disputes',
      'audit_logs',
      'user_activity_logs',
      'events',
      'background_jobs',
      'feature_flags',
      'system_settings',
      'admin_actions',
      'contact_messages',
      'daily_metrics',
      'pricing_plans',
      'subscriptions',
      'saved_payment_methods',
      'notification_preferences',
      'unsubscribes',
    ];

    console.log('📊 Record Counts:\n');
    let totalRecords = 0;
    
    for (const table of tables) {
      try {
        const result = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        const count = parseInt(result.rows[0].count);
        totalRecords += count;
        
        const emoji = count > 0 ? '✅' : '⚠️';
        console.log(`${emoji} ${table.padEnd(30)} ${count.toString().padStart(6)}`);
      } catch (error) {
        console.log(`❌ ${table.padEnd(30)} ERROR: ${error.message.substring(0, 50)}`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`📈 Total Records: ${totalRecords}\n`);

    // Check for data integrity issues
    console.log('🔍 Data Integrity Checks:\n');

    // Check for orphaned providers (providers without users)
    const orphanedProviders = await pool.query(`
      SELECT COUNT(*) FROM providers p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE u.id IS NULL
    `);
    console.log(`${orphanedProviders.rows[0].count === '0' ? '✅' : '❌'} Orphaned providers: ${orphanedProviders.rows[0].count}`);

    // Check for jobs with invalid customer_id
    const orphanedJobs = await pool.query(`
      SELECT COUNT(*) FROM jobs j
      LEFT JOIN users u ON j.customer_id = u.id
      WHERE u.id IS NULL
    `);
    console.log(`${orphanedJobs.rows[0].count === '0' ? '✅' : '❌'} Jobs with invalid customer: ${orphanedJobs.rows[0].count}`);

    // Check for proposals with invalid request_id
    const orphanedProposals = await pool.query(`
      SELECT COUNT(*) FROM proposals pr
      LEFT JOIN service_requests sr ON pr.request_id = sr.id
      WHERE sr.id IS NULL
    `);
    console.log(`${orphanedProposals.rows[0].count === '0' ? '✅' : '❌'} Proposals with invalid request: ${orphanedProposals.rows[0].count}`);

    // Check for duplicate emails
    const duplicateEmails = await pool.query(`
      SELECT email, COUNT(*) as count
      FROM users
      GROUP BY email
      HAVING COUNT(*) > 1
    `);
    console.log(`${duplicateEmails.rows.length === 0 ? '✅' : '❌'} Duplicate emails: ${duplicateEmails.rows.length}`);
    if (duplicateEmails.rows.length > 0) {
      duplicateEmails.rows.slice(0, 5).forEach(row => {
        console.log(`   → ${row.email} (${row.count} times)`);
      });
    }

    // Check user role distribution
    console.log('\n👥 User Role Distribution:\n');
    const roleDistribution = await pool.query(`
      SELECT role, COUNT(*) as count
      FROM users
      GROUP BY role
      ORDER BY count DESC
    `);
    roleDistribution.rows.forEach(row => {
      console.log(`   ${row.role.padEnd(15)} ${row.count}`);
    });

    // Check request status distribution
    console.log('\n📝 Request Status Distribution:\n');
    const requestStatus = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM service_requests
      GROUP BY status
      ORDER BY count DESC
    `);
    requestStatus.rows.forEach(row => {
      console.log(`   ${row.status.padEnd(15)} ${row.count}`);
    });

    // Check job status distribution
    console.log('\n👷 Job Status Distribution:\n');
    const jobStatus = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM jobs
      GROUP BY status
      ORDER BY count DESC
    `);
    jobStatus.rows.forEach(row => {
      console.log(`   ${row.status.padEnd(15)} ${row.count}`);
    });

    // Check provider verification status
    console.log('\n🏢 Provider Verification Status:\n');
    const providerStatus = await pool.query(`
      SELECT verification_status, COUNT(*) as count
      FROM providers
      GROUP BY verification_status
      ORDER BY count DESC
    `);
    providerStatus.rows.forEach(row => {
      console.log(`   ${row.verification_status.padEnd(15)} ${row.count}`);
    });

    // Sample data queries
    console.log('\n📋 Sample Data:\n');

    const sampleUser = await pool.query('SELECT id, email, name, role FROM users LIMIT 1');
    if (sampleUser.rows.length > 0) {
      console.log('Sample User:');
      console.log(`   ID: ${sampleUser.rows[0].id}`);
      console.log(`   Email: ${sampleUser.rows[0].email}`);
      console.log(`   Name: ${sampleUser.rows[0].name}`);
      console.log(`   Role: ${sampleUser.rows[0].role}\n`);
    }

    const sampleRequest = await pool.query('SELECT id, description, status FROM service_requests LIMIT 1');
    if (sampleRequest.rows.length > 0) {
      console.log('Sample Service Request:');
      console.log(`   ID: ${sampleRequest.rows[0].id}`);
      console.log(`   Description: ${sampleRequest.rows[0].description.substring(0, 60)}...`);
      console.log(`   Status: ${sampleRequest.rows[0].status}\n`);
    }

    console.log('✅ Verification completed!\n');

  } catch (error) {
    console.error('❌ Verification error:', error.message);
  } finally {
    await pool.end();
  }
}

// Run verification
verifySeeding().catch(console.error);
