const {
  syncAllCompanies
} = require('../services/jobImporter');

async function main() {

  console.log('');
  console.log('==========================================');
  console.log(' PLACEMENT READINESS JOB SYNC');
  console.log('==========================================');
  console.log('');

  try {

    const results = await syncAllCompanies();

    console.log('');
    console.log('==========================================');
    console.log(' SYNC COMPLETE');
    console.log('==========================================');

    let totalInserted = 0;
    let totalUpdated = 0;

    for (const result of results) {

      console.log(result);

      totalInserted += result.inserted || 0;
      totalUpdated += result.updated || 0;
    }

    console.log('');
    console.log(`Inserted: ${totalInserted}`);
    console.log(`Updated: ${totalUpdated}`);

  } catch (error) {

    console.error('JOB SYNC FAILED:', error);

    process.exitCode = 1;

  } finally {

    process.exit();
  }
}

main();