const {
  getProjectedCommissionForTransaction,
} = require("../controllers/commissionService");

async function run() {
  try {
    for (const id of [24, 25, 26, 27]) {
      const res1 = await getProjectedCommissionForTransaction(id, 1);
      const res2 = await getProjectedCommissionForTransaction(id, 2);
      const res3 = await getProjectedCommissionForTransaction(id, 3);
      console.log("txn", id, "stg1", res1, "stg2", res2, "stg3", res3);
    }
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
