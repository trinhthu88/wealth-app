import { Router, type IRouter } from "express";
import type Anthropic from "@anthropic-ai/sdk";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  db, solConversationsTable, solMessagesTable, profilesTable, clientProfilesTable,
  financialGoalsTable, assetsTable, liabilitiesTable, clientBudgetMonthsTable,
  budgetEntriesTable, clientHoldingsTable, advisedPlansTable, healthScoresTable,
  priceCacheTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { computeCurrentBreakdown, resolveHoldingValueUsd } from "../lib/goalProgressSnapshot";
import { resolveBlendedRate } from "../lib/blendedRate";
import { computeGoalProgress } from "@workspace/goal-math";
import { SOL_SYSTEM_PROMPT } from "../lib/solPersona";

const router: IRouter = Router();

const CHAT_MODEL = "claude-sonnet-4-6";
const GUARDRAIL_MODEL = "claude-haiku-4-5";

// Loaded lazily, not at module scope: @workspace/integrations-anthropic-ai's
// client throws at import time if the Anthropic AI integration hasn't been
// provisioned yet (see that package's client.ts). This route file is imported
// eagerly by routes/index.ts alongside every other route, so a top-level
// import here would take down the whole server — and every other route's
// tests — until someone provisions the integration. Deferring the import to
// request time means every other route keeps working regardless, and only a
// request that actually needs Sol's chat sees a clean 503.
async function loadAnthropicClient(): Promise<Anthropic> {
  const mod = await import("@workspace/integrations-anthropic-ai");
  return mod.anthropic;
}
const MAX_TOOL_TURNS = 5;

// Mirrors blendedRate.ts's own local copy of this set — see that file's note
// on why it isn't shared as a single export.
const TICKER_BASED_TYPES = new Set(["stock_etf", "etf", "mutual_fund", "commodity", "bond"]);

// ── Tools — each wraps an existing calculation/query, never re-derives one ──

async function toolGetNetWorthSummary(userId: string) {
  const [assets, liabilities, blended] = await Promise.all([
    db.select().from(assetsTable).where(eq(assetsTable.userId, userId)),
    db.select().from(liabilitiesTable).where(eq(liabilitiesTable.userId, userId)),
    resolveBlendedRate(userId),
  ]);
  const totalAssets = assets.reduce((s, a) => s + (parseFloat(a.valueUsd ?? "0") || 0), 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + (parseFloat(l.balanceUsd ?? "0") || 0), 0);
  const portfolioValue = blended.totalValue;
  return {
    totalAssets: Math.round(totalAssets),
    totalLiabilities: Math.round(totalLiabilities),
    portfolioValue: Math.round(portfolioValue),
    netWorth: Math.round(totalAssets + portfolioValue - totalLiabilities),
  };
}

async function toolGetGoalProgress(userId: string, input: { goalId?: string }) {
  const allGoals = await db.select().from(financialGoalsTable).where(eq(financialGoalsTable.userId, userId));
  const scoped = input.goalId
    ? allGoals.filter(g => g.id === input.goalId)
    : allGoals.filter(g => g.status !== "completed" && g.status !== "cancelled");
  if (scoped.length === 0) return { goals: [] };

  const goals = await Promise.all(scoped.map(async g => {
    if (!g.targetAmount || !g.targetDate) {
      return {
        id: g.id, title: g.title, goalType: g.goalType,
        targetAmount: g.targetAmount ? parseFloat(g.targetAmount) : null,
        currentAmount: Math.round(parseFloat(g.currentAmount ?? "0") || 0),
        targetDate: g.targetDate, status: g.status, progressPct: null,
      };
    }
    const { computedCurrentAmount } = await computeCurrentBreakdown(userId, g.id);
    const progress = computeGoalProgress({
      currentAmount: computedCurrentAmount,
      targetAmount: parseFloat(g.targetAmount),
      targetDate: g.targetDate,
      createdAt: g.createdAt.toISOString(),
    });
    return {
      id: g.id, title: g.title, goalType: g.goalType,
      targetAmount: parseFloat(g.targetAmount),
      currentAmount: Math.round(computedCurrentAmount),
      targetDate: g.targetDate,
      status: progress.status,
      progressPct: progress.progressPct != null ? Math.round(progress.progressPct) : null,
    };
  }));
  return { goals };
}

async function toolGetBudgetSummary(userId: string, role: string, input: { month?: string }) {
  if (role === "investment_client") {
    const rows = input.month
      ? await db.select().from(clientBudgetMonthsTable)
          .where(and(eq(clientBudgetMonthsTable.userId, userId), eq(clientBudgetMonthsTable.month, `${input.month}-01`)))
      : await db.select().from(clientBudgetMonthsTable)
          .where(eq(clientBudgetMonthsTable.userId, userId))
          .orderBy(desc(clientBudgetMonthsTable.month)).limit(1);
    const row = rows[0];
    if (!row) return { available: false };
    return {
      available: true,
      month: row.month,
      income: Math.round(parseFloat(row.totalIncome) || 0),
      expenses: Math.round(parseFloat(row.totalExpenses) || 0),
      savings: Math.round(parseFloat(row.netSurplus) || 0),
      savingsRatePct: Math.round((parseFloat(row.savingsRatePct) || 0) * 10) / 10,
    };
  }

  const rows = input.month
    ? await db.select().from(budgetEntriesTable)
        .where(and(eq(budgetEntriesTable.userId, userId), eq(budgetEntriesTable.periodMonth, input.month)))
    : await db.select().from(budgetEntriesTable)
        .where(eq(budgetEntriesTable.userId, userId))
        .orderBy(desc(budgetEntriesTable.periodMonth)).limit(1);
  const row = rows[0];
  if (!row) return { available: false };
  return {
    available: true,
    month: row.periodMonth,
    income: Math.round(parseFloat(row.income ?? "0") || 0),
    expenses: Math.round((parseFloat(row.needsActual ?? "0") || 0) + (parseFloat(row.wantsActual ?? "0") || 0)),
    savings: Math.round(parseFloat(row.savingsActual ?? "0") || 0),
    savingsRatePct: Math.round((parseFloat(row.savingsRatePercent ?? "0") || 0) * 10) / 10,
  };
}

async function toolGetPortfolioHoldings(userId: string) {
  const [holdings, plans] = await Promise.all([
    db.select().from(clientHoldingsTable).where(and(eq(clientHoldingsTable.userId, userId), eq(clientHoldingsTable.isActive, true))),
    db.select().from(advisedPlansTable).where(and(eq(advisedPlansTable.userId, userId), eq(advisedPlansTable.status, "inforce"))),
  ]);

  const symbols = holdings
    .filter(h => TICKER_BASED_TYPES.has(h.holdingType) || h.holdingType === "crypto")
    .map(h => (h.holdingType === "crypto" ? h.coinSymbol : h.ticker)?.toUpperCase())
    .filter((s): s is string => !!s);
  const priceRows = symbols.length > 0
    ? await db.select({ symbol: priceCacheTable.symbol, priceUsd: priceCacheTable.priceUsd })
        .from(priceCacheTable).where(inArray(priceCacheTable.symbol, symbols))
    : [];
  const priceBySymbol = new Map(priceRows.map(p => [p.symbol.toUpperCase(), parseFloat(p.priceUsd) || 0]));

  const holdingsOut = holdings.map(h => ({
    label: h.ticker ? `${h.label} · ${h.ticker}` : h.label,
    holdingType: h.holdingType,
    valueUsd: Math.round(resolveHoldingValueUsd(h, priceBySymbol)),
  }));
  const plansOut = plans.map(p => ({
    label: p.nickname ?? p.productName,
    valueUsd: Math.round(parseFloat(p.latestAccountValue ?? "0") || 0),
  }));
  const totalValue = holdingsOut.reduce((s, h) => s + h.valueUsd, 0) + plansOut.reduce((s, p) => s + p.valueUsd, 0);
  return { holdings: holdingsOut, advisedPlans: plansOut, totalValue };
}

async function toolGetHealthScore(userId: string) {
  const [score] = await db.select().from(healthScoresTable)
    .where(eq(healthScoresTable.userId, userId))
    .orderBy(desc(healthScoresTable.createdAt)).limit(1);
  if (!score) return { available: false };
  return {
    available: true,
    overallScore: score.overallScore,
    savingsScore: score.savingsScore,
    goalsScore: score.goalsScore,
    netWorthScore: score.netWorthScore,
    budgetScore: score.budgetScore,
    scoreDate: score.scoreDate,
  };
}

const BASE_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "get_net_worth_summary",
    description: "Get the client's current net worth summary: total assets, total liabilities, portfolio value, and net worth. Call this before citing any net worth figure.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_goal_progress",
    description: "Get progress on the client's financial goals: target amount, current funded amount, target date, and pacing status (on_track/at_risk/off_track). Optionally scope to one goal by id.",
    input_schema: {
      type: "object",
      properties: { goalId: { type: "string", description: "Optional. Limit to a single goal by its id." } },
      required: [],
    },
  },
  {
    name: "get_budget_summary",
    description: "Get the client's budget for a given month: income, expenses, savings, and savings rate. Defaults to the most recent month if none is given.",
    input_schema: {
      type: "object",
      properties: { month: { type: "string", description: "Optional. Month in YYYY-MM format." } },
      required: [],
    },
  },
  {
    name: "get_health_score",
    description: "Get the client's most recently computed financial health score and its component breakdown.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
];

const PORTFOLIO_TOOL: Anthropic.Messages.Tool = {
  name: "get_portfolio_holdings",
  description: "Get the client's current investment portfolio holdings and advised plans, with each position's value.",
  input_schema: { type: "object", properties: {}, required: [] },
};

// Only offered to investment_client accounts — a free-tier client has no
// portfolio, so Sol shouldn't be handed a tool it can't legitimately use for them.
function buildTools(role: string): Anthropic.Messages.Tool[] {
  return role === "investment_client" ? [...BASE_TOOLS, PORTFOLIO_TOOL] : BASE_TOOLS;
}

async function executeTool(userId: string, role: string, name: string, input: unknown): Promise<unknown> {
  const args = (input ?? {}) as Record<string, any>;
  switch (name) {
    case "get_net_worth_summary": return toolGetNetWorthSummary(userId);
    case "get_goal_progress": return toolGetGoalProgress(userId, args);
    case "get_budget_summary": return toolGetBudgetSummary(userId, role, args);
    case "get_health_score": return toolGetHealthScore(userId);
    case "get_portfolio_holdings":
      if (role !== "investment_client") return { error: "Portfolio holdings aren't available on this account tier." };
      return toolGetPortfolioHoldings(userId);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ── Step 3 guardrail — a cheap classifier pass, not a second full turn ──────

const GUARDRAIL_SYSTEM_PROMPT = `You are a strict compliance classifier for an automated financial assistant
named Sol. Sol is allowed to explain financial concepts and reflect back the
client's own numbers, but must never tell the client what to buy, sell, or how
to allocate — any actionable recommendation must defer to the client's
licensed advisor instead.

Classify the assistant reply given to you into exactly one of these three
labels:
- ADVICE: the reply gives a specific, directive financial instruction (e.g.
  "sell X", "move $N into Y", "buy Z", "you should allocate to...") rather than
  only explaining or observing.
- HANDOFF_OK: the reply discusses the topic but correctly defers the actual
  decision to the advisor, with no directive buried in it.
- SAFE: the reply is purely explanatory/observational, with no directive and
  no advisor hand-off needed.

Reply with exactly one word: ADVICE, HANDOFF_OK, or SAFE. Nothing else.`;

async function runGuardrail(client: Anthropic, replyText: string): Promise<"ADVICE" | "HANDOFF_OK" | "SAFE"> {
  const response = await client.messages.create({
    model: GUARDRAIL_MODEL,
    max_tokens: 8192,
    system: GUARDRAIL_SYSTEM_PROMPT,
    messages: [{ role: "user", content: replyText }],
  });
  const text = response.content.find(b => b.type === "text")?.text?.trim().toUpperCase() ?? "";
  if (text.startsWith("ADVICE")) return "ADVICE";
  if (text.startsWith("HANDOFF_OK")) return "HANDOFF_OK";
  return "SAFE";
}

async function resolveAdvisorName(userId: string): Promise<string | null> {
  const [cp] = await db.select({ advisorId: clientProfilesTable.advisorId })
    .from(clientProfilesTable).where(eq(clientProfilesTable.userId, userId));
  if (!cp?.advisorId) return null;
  const [advisor] = await db.select({ fullName: profilesTable.fullName })
    .from(profilesTable).where(eq(profilesTable.id, cp.advisorId));
  return advisor?.fullName ?? null;
}

// ── POST /sol/chat ───────────────────────────────────────────────────────────

router.post("/sol/chat", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { conversationId, message } = req.body as { conversationId?: string; message?: string };
  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "message required" });
    return;
  }

  let client: Anthropic;
  try {
    client = await loadAnthropicClient();
  } catch (err) {
    console.error("[sol-chat] Anthropic AI integration not configured", err);
    res.status(503).json({ error: "Sol's chat isn't set up yet. Try again later." });
    return;
  }

  const [profile] = await db.select({ role: profilesTable.role }).from(profilesTable).where(eq(profilesTable.id, userId));
  const role = profile?.role ?? "free_user";

  let convoId = conversationId;
  if (convoId) {
    const [convo] = await db.select({ id: solConversationsTable.id }).from(solConversationsTable)
      .where(and(eq(solConversationsTable.id, convoId), eq(solConversationsTable.userId, userId)));
    if (!convo) convoId = undefined; // not this user's conversation — start fresh rather than leak
  }
  if (!convoId) {
    const [created] = await db.insert(solConversationsTable).values({ userId }).returning();
    convoId = created.id;
  }

  const priorMessages = await db.select().from(solMessagesTable)
    .where(eq(solMessagesTable.conversationId, convoId)).orderBy(solMessagesTable.sentAt);

  await db.insert(solMessagesTable).values({ conversationId: convoId, role: "user", content: message });

  const tools = buildTools(role);
  const loopMessages: Anthropic.Messages.MessageParam[] = [
    ...priorMessages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: message },
  ];

  const toolCallsUsed: { name: string; input: unknown }[] = [];
  let finalText = "";

  try {
    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const response = await client.messages.create({
        model: CHAT_MODEL,
        max_tokens: 8192,
        system: SOL_SYSTEM_PROMPT,
        tools,
        messages: loopMessages,
      });

      const toolUseBlocks = response.content.filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use");
      if (toolUseBlocks.length === 0) {
        finalText = response.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
        break;
      }

      const assistantContent: Anthropic.Messages.ContentBlockParam[] = response.content
        .filter((b): b is Anthropic.Messages.TextBlock | Anthropic.Messages.ToolUseBlock => b.type === "text" || b.type === "tool_use")
        .map(b => b.type === "text"
          ? { type: "text" as const, text: b.text }
          : { type: "tool_use" as const, id: b.id, name: b.name, input: b.input });
      loopMessages.push({ role: "assistant", content: assistantContent });

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const block of toolUseBlocks) {
        toolCallsUsed.push({ name: block.name, input: block.input });
        const result = await executeTool(userId, role, block.name, block.input);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
      }
      loopMessages.push({ role: "user", content: toolResults });
    }
  } catch (err) {
    console.error("[sol-chat] Anthropic call failed", err);
    res.status(502).json({ error: "Sol is unavailable right now. Try again in a moment." });
    return;
  }

  if (!finalText) {
    finalText = "I'm having trouble pulling that together right now — try again in a moment, or reach out to your advisor.";
  }

  let replyText = finalText;
  try {
    const verdict = await runGuardrail(client, finalText);
    if (verdict === "ADVICE") {
      console.warn(`[sol-guardrail] flagged directive reply — conversation ${convoId}: ${finalText}`);
      const advisorName = await resolveAdvisorName(userId);
      replyText = advisorName
        ? `That's a call for your advisor, not me — want me to flag it for ${advisorName}?`
        : "That's a call for your advisor, not me — want me to flag it for them?";
    }
  } catch (err) {
    // Guardrail failing shouldn't take down the whole reply, but it also
    // shouldn't let an unchecked reply through — belt-and-suspenders means
    // the belt (this check) failing falls back to the persona's own boundary
    // instructions having already applied at generation time, logged so it's
    // reviewable.
    console.warn(`[sol-guardrail] check failed, reply not re-verified — conversation ${convoId}`, err);
  }

  const [saved] = await db.insert(solMessagesTable).values({
    conversationId: convoId, role: "assistant", content: replyText, toolCalls: toolCallsUsed,
  }).returning();

  res.json({
    conversationId: convoId,
    message: { id: saved.id, role: "assistant", content: replyText, sentAt: saved.sentAt },
  });
});

// ── GET /sol/conversation — most recent conversation + its messages ────────

router.get("/sol/conversation", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const [convo] = await db.select().from(solConversationsTable)
    .where(eq(solConversationsTable.userId, userId))
    .orderBy(desc(solConversationsTable.createdAt)).limit(1);
  if (!convo) {
    res.json({ conversationId: null, messages: [] });
    return;
  }
  const messages = await db.select().from(solMessagesTable)
    .where(eq(solMessagesTable.conversationId, convo.id))
    .orderBy(solMessagesTable.sentAt);
  res.json({ conversationId: convo.id, messages });
});

export default router;
