// Usage: npm run db:seed -- <customer-firebase-uid>
// Creates fictional, clearly synthetic submitted claims for the officer queue demo.
import "dotenv/config";
import { prisma } from "../src/db/client";

const uid = process.argv[2];
if (!uid) {
  console.error("Usage: seed <customer-firebase-uid>");
  process.exit(1);
}
const customer = await prisma.user.upsert({
  where: { identitySubject: uid },
  update: {},
  create: { identitySubject: uid, role: "CUSTOMER" },
});

const samples = [
  {
    publicReference: "CLM-DEMO-A1B2C3",
    incidentType: "COLLISION",
    incidentLocation: "Demo Street junction, Example City",
    narrative: "SYNTHETIC DEMO: A white hatchback reversed into my parked car outside a shop. No one was hurt.",
    vehicleDescription: "2017 Demo Hatch, silver (fictional)",
  },
  {
    publicReference: "CLM-DEMO-D4E5F6",
    incidentType: "VANDALISM",
    incidentLocation: "Demo Car Park, Example City",
    narrative: "SYNTHETIC DEMO: I returned to the car park and found a scratched door and a broken mirror.",
    vehicleDescription: "2019 Demo Saloon, blue (fictional)",
  },
];

for (const s of samples) {
  await prisma.claimCase.upsert({
    where: { publicReference: s.publicReference },
    update: {},
    create: {
      ...s,
      customerId: customer.id,
      policyReferenceMasked: "****0000",
      incidentAt: new Date(),
      injuriesReported: false,
      otherPartiesInvolved: false,
      contactChannel: "EMAIL",
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
  });
}
console.log("Seeded synthetic claims.");
await prisma.$disconnect();
