import { and, eq } from "drizzle-orm";
import { db, kycDocumentsTable, documentsTable } from "@workspace/db";

// One-off (and re-runnable) copy of kyc_documents rows into the single
// documents surface, tagged category: "kyc". kycDocumentsTable is left in
// place (not dropped) — its verify/reject workflow is being retired because it
// implied an internal approval that doesn't reflect reality (verification
// happens on the external investment platform), not because the historical
// records are worthless.
//
// isAdminUploaded is set from whether verifiedBy was populated — the closest
// available signal, since kyc_documents never separately tracked who uploaded
// a file versus who reviewed it. uploadedBy prefers verifiedBy for the same
// reason, falling back to the document's own owner (self-uploaded) otherwise.
//
// Idempotent: skips a kyc_documents row if a documents row with the same
// userId + fileUrl + category "kyc" already exists, so re-running after a
// partial run (or after new kyc_documents rows appear) doesn't duplicate.

async function run() {
  console.log("\nCopying kyc_documents rows into documents (category: \"kyc\")...\n");

  const kycRows = await db.select().from(kycDocumentsTable);
  if (kycRows.length === 0) {
    console.log("No kyc_documents rows — nothing to do.\n");
    process.exit(0);
  }

  let copied = 0;
  let skipped = 0;

  for (const doc of kycRows) {
    const [existing] = await db.select({ id: documentsTable.id }).from(documentsTable).where(and(
      eq(documentsTable.userId, doc.userId),
      eq(documentsTable.fileUrl, doc.fileUrl),
      eq(documentsTable.category, "kyc"),
    ));
    if (existing) {
      skipped++;
      continue;
    }

    await db.insert(documentsTable).values({
      userId: doc.userId,
      uploadedBy: doc.verifiedBy ?? doc.userId,
      title: doc.documentType,
      category: "kyc",
      fileUrl: doc.fileUrl,
      fileName: doc.fileName ?? null,
      fileSizeBytes: null,
      isAdminUploaded: !!doc.verifiedBy,
      uploadedAt: doc.uploadedAt,
    });
    console.log(`  ✓ ${doc.id} (${doc.userId}, ${doc.documentType}) → documents`);
    copied++;
  }

  console.log(`\nDone. ${copied} row(s) copied, ${skipped} already present (skipped).\n`);
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
