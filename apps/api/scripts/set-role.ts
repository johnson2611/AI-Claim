// Usage: npm run set-role -w @claims/api -- <firebase-uid> OFFICER
// Roles are assigned here (server side), never by the browser.
import "dotenv/config";
import { ROLES, type Role } from "@claims/shared";
import { prisma } from "../src/db/client";

const [uid, role] = process.argv.slice(2);
if (!uid || !ROLES.includes(role as Role)) {
  console.error("Usage: set-role <firebase-uid> <CUSTOMER|OFFICER|ADMIN>");
  process.exit(1);
}
const user = await prisma.user.upsert({
  where: { identitySubject: uid },
  update: { role: role as Role },
  create: { identitySubject: uid, role: role as Role },
});
console.log(`User ${user.id} is now ${user.role}`);
await prisma.$disconnect();
