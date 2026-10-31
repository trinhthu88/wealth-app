import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { and, eq, inArray, isNull } from "drizzle-orm";
vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

const { default: app } = await import("../../app");
import {
  db,
  advisorAssignmentsTable,
  advisedPlansTable,
  clientProfilesTable,
  conversationsTable,
  documentsTable,
  financialPlansTable,
  milestoneCommentsTable,
  messagesTable,
  planMilestonesTable,
  profilesTable,
} from "@workspace/db";

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const adminId = `p4-admin-${RUN_ID}`;
const advisorAId = `p4-advisor-a-${RUN_ID}`;
const advisorBId = `p4-advisor-b-${RUN_ID}`;
const clientId = `p4-client-${RUN_ID}`;

function asUser(id: string) {
  return { "x-test-user-id": id };
}

let advisedPlanId: string;
let financialPlanId: string;
let milestoneId: string;
let existingConversationId: string;
let adminCreatedPlanId: string;

beforeAll(async () => {
  await db.insert(profilesTable).values([
    { id: adminId, email: `${adminId}@test.local`, fullName: "P4 Admin", role: "super_admin" },
    { id: advisorAId, email: `${advisorAId}@test.local`, fullName: "Advisor A", role: "advisor" },
    { id: advisorBId, email: `${advisorBId}@test.local`, fullName: "Advisor B", role: "advisor" },
    { id: clientId, email: `${clientId}@test.local`, fullName: "P4 Client", role: "investment_client" },
  ]);
  await db.insert(clientProfilesTable).values({ userId: clientId, advisorId: advisorAId });
  await db.insert(advisorAssignmentsTable).values({
    clientUserId: clientId,
    advisorId: advisorAId,
    assignedBy: adminId,
  });
  const [advisedPlan] = await db.insert(advisedPlansTable).values({
    userId: clientId,
    advisorId: adminId,
    providerName: "Admin-created provider",
    productName: "Admin-created plan",
    policyNumber: "P4-POLICY",
    status: "scenario",
  }).returning();
  advisedPlanId = advisedPlan.id;

  const [financialPlan] = await db.insert(financialPlansTable).values({
    clientId,
    advisorId: adminId,
    title: "P4 financial plan",
    status: "draft",
  }).returning();
  financialPlanId = financialPlan.id;

  const [milestone] = await db.insert(planMilestonesTable).values({
    planId: financialPlanId,
    title: "P4 milestone",
    status: "upcoming",
  }).returning();
  milestoneId = milestone.id;

  const [conversation] = await db.insert(conversationsTable).values({
    clientId,
    advisorId: advisorAId,
  }).returning();
  existingConversationId = conversation.id;
});

afterAll(async () => {
  if (existingConversationId) {
    await db.delete(messagesTable).where(eq(messagesTable.conversationId, existingConversationId));
  }
  if (adminCreatedPlanId) {
    await db.delete(advisedPlansTable).where(eq(advisedPlansTable.id, adminCreatedPlanId));
  }
  if (milestoneId) {
    await db.delete(milestoneCommentsTable).where(eq(milestoneCommentsTable.milestoneId, milestoneId));
    await db.delete(planMilestonesTable).where(eq(planMilestonesTable.id, milestoneId));
  }
  if (financialPlanId) {
    await db.delete(financialPlansTable).where(eq(financialPlansTable.id, financialPlanId));
  }
  if (advisedPlanId) {
    await db.delete(advisedPlansTable).where(eq(advisedPlansTable.id, advisedPlanId));
  }
  await db.delete(documentsTable).where(eq(documentsTable.userId, clientId));
  await db.delete(conversationsTable).where(eq(conversationsTable.clientId, clientId));
  await db.delete(advisorAssignmentsTable).where(eq(advisorAssignmentsTable.clientUserId, clientId));
  await db.delete(clientProfilesTable).where(eq(clientProfilesTable.userId, clientId));
  await db.delete(profilesTable).where(inArray(profilesTable.id, [adminId, advisorAId, advisorBId, clientId]));
});

describe("Phase 4 current advisor ownership", () => {
  it("reassigns history and moves plan, document, conversation, and review-request access", async () => {
    await request(app)
      .put(`/api/admin/users/${clientId}`)
      .set(asUser(adminId))
      .send({ advisorId: advisorBId })
      .expect(200);

    const [clientProfile] = await db.select().from(clientProfilesTable)
      .where(eq(clientProfilesTable.userId, clientId));
    expect(clientProfile.advisorId).toBe(advisorBId);

    const assignments = await db.select().from(advisorAssignmentsTable)
      .where(eq(advisorAssignmentsTable.clientUserId, clientId));
    expect(assignments).toHaveLength(2);
    expect(assignments.find((assignment) => assignment.advisorId === advisorAId)?.endedAt).toBeInstanceOf(Date);
    expect(assignments.find((assignment) => assignment.advisorId === advisorBId)?.assignedBy).toBe(adminId);
    const openAssignments = await db.select().from(advisorAssignmentsTable).where(and(
      eq(advisorAssignmentsTable.clientUserId, clientId),
      isNull(advisorAssignmentsTable.endedAt),
    ));
    expect(openAssignments.map((assignment) => assignment.advisorId)).toEqual([advisorBId]);

    await request(app)
      .put(`/api/advised-plans/${advisedPlanId}/status`)
      .set(asUser(advisorBId))
      .send({ status: "inforce" })
      .expect(200);
    await request(app)
      .put(`/api/advised-plans/${advisedPlanId}/status`)
      .set(asUser(advisorAId))
      .send({ status: "inforce" })
      .expect(403);

    await request(app)
      .put(`/api/plans/${financialPlanId}`)
      .set(asUser(advisorBId))
      .send({ title: "Updated by current advisor" })
      .expect(200);
    await request(app)
      .put(`/api/plans/${financialPlanId}`)
      .set(asUser(advisorAId))
      .send({ title: "Old advisor must be blocked" })
      .expect(403);
    await request(app)
      .get(`/api/plans/${financialPlanId}/milestones`)
      .set(asUser(advisorBId))
      .expect(200);
    await request(app)
      .post(`/api/plans/${financialPlanId}/milestones`)
      .set(asUser(advisorAId))
      .send({ title: "Blocked milestone" })
      .expect(403);

    await request(app)
      .get(`/api/advisor/clients/${clientId}/documents`)
      .set(asUser(advisorBId))
      .expect(200);
    await request(app)
      .get(`/api/advisor/clients/${clientId}/documents`)
      .set(asUser(advisorAId))
      .expect(403);

    await request(app)
      .post(`/api/conversations/${existingConversationId}/messages`)
      .set(asUser(advisorBId))
      .send({ content: "Reply from the reassigned advisor" })
      .expect(201);
    await request(app)
      .post(`/api/conversations/${existingConversationId}/messages`)
      .set(asUser(advisorAId))
      .send({ content: "Reply from the previous advisor" })
      .expect(403);

    const review = await request(app)
      .post("/api/client/plan/review-request")
      .set(asUser(clientId))
      .send({ advisorId: advisorAId, message: "Please review my plan" })
      .expect(201);
    const [reviewConversation] = await db.select().from(conversationsTable)
      .where(eq(conversationsTable.id, review.body.conversationId));
    expect(reviewConversation.advisorId).toBe(advisorBId);
    const [reviewMessage] = await db.select().from(messagesTable)
      .where(eq(messagesTable.id, review.body.message.id));
    expect(reviewMessage.senderRole).toBe("investment_client");
  });

  it("stores the real milestone commenter role and restricts comments to the current parties", async () => {
    const advisorComment = await request(app)
      .post(`/api/client/plan/milestones/${milestoneId}/comments`)
      .set(asUser(advisorBId))
      .send({ content: "Advisor note", authorRole: "client" })
      .expect(201);
    expect(advisorComment.body.authorRole).toBe("advisor");

    const clientComment = await request(app)
      .post(`/api/client/plan/milestones/${milestoneId}/comments`)
      .set(asUser(clientId))
      .send({ content: "Client note" })
      .expect(201);
    expect(clientComment.body.authorRole).toBe("investment_client");

    await request(app)
      .post(`/api/client/plan/milestones/${milestoneId}/comments`)
      .set(asUser(advisorAId))
      .send({ content: "Old advisor note" })
      .expect(403);
    await request(app)
      .get(`/api/client/plan/milestones/${milestoneId}/comments`)
      .set(asUser(advisorAId))
      .expect(403);
    await request(app)
      .get(`/api/client/plan/milestones/${milestoneId}/comments`)
      .set(asUser(advisorBId))
      .expect(200);
  });

  it("does not let an admin-created advised plan lock out the current advisor", async () => {
    const created = await request(app)
      .post(`/api/advisor/clients/${clientId}/advised-plans`)
      .set(asUser(adminId))
      .send({
        providerName: "Admin provider",
        productName: "Admin scenario",
        policyNumber: "P4-ADMIN-POLICY",
      })
      .expect(201);
    adminCreatedPlanId = created.body.id;

    await request(app)
      .put(`/api/advised-plans/${adminCreatedPlanId}/status`)
      .set(asUser(advisorBId))
      .send({ status: "inforce" })
      .expect(200);
    await request(app)
      .put(`/api/advised-plans/${adminCreatedPlanId}/status`)
      .set(asUser(advisorAId))
      .send({ status: "inforce" })
      .expect(403);
  });
});
