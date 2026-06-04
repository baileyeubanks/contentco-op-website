/**
 * Gemini AI client for Content Co-op proposal generation.
 *
 * Uses Google GenAI SDK. Requires GEMINI_API_KEY in .env.local.
 * Falls back to mock mode if key is missing (for development).
 */

import { GoogleGenAI, type GenerateContentConfig } from "@google/genai";
import { formatCurrency } from "./pricing";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MOCK_MODE = !GEMINI_API_KEY;

let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  if (MOCK_MODE) return null;
  if (!_ai) _ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  return _ai;
}

export function isGeminiConfigured(): boolean {
  return !MOCK_MODE;
}

export interface ProposalInput {
  briefId: string;
  contact: {
    name: string;
    email: string;
    company: string;
    role?: string;
  };
  project: {
    projectTypes: string[];
    projectName: string;
    industry?: string;
    audience?: string;
    projectContext: string;
    outcome?: string;
    placements: string[];
    deliverables: string[];
    enhancements: string[];
    targetRuntime?: string;
    shootDayCount?: string;
    filmingLocations?: string;
    travelScope?: string;
    productionNeeds?: string[];
    styleLevel?: string;
    revisionExpectation?: string;
    companyScale?: string;
    quoteConfidence?: string;
    quoteMissingInputs?: string[];
    productionComplexity?: string;
    postComplexity?: string;
    timeline: string;
    budgetRange: string;
    successDefinition?: string;
  };
  estimate: {
    low: number;
    high: number;
    deposit: number;
  };
}

export interface ProposalOutput {
  title: string;
  executiveSummary: string;
  creativeApproach: string;
  productionTimeline: string;
  investmentBreakdown: {
    lineItems: Array<{ item: string; description: string; amount: number }>;
    totalLow: number;
    totalHigh: number;
    deposit: number;
  };
  teamAssignment: string;
  nextSteps: string[];
  disclaimer: string;
}

function buildSystemPrompt(): string {
  return `You are a senior creative producer at Content Co-op, a Houston-based commercial video production company led by Bailey Eubanks. Content Co-op serves industrial, energy, manufacturing, infrastructure, construction, and corporate B2B clients. You write agency-level proposals that win $10K–$50K video projects.

Your proposals are:
- Confident but not arrogant
- Specific to the client's industry and project type
- Grounded in real production constraints
- Written in clear, professional prose
- Structured with concrete deliverables and timelines

Use a Houston production tone: direct, experienced, field-aware, and no fluff. Reference specific production techniques when relevant (interviews, B-roll, motion graphics, sound design).`;
}

function buildUserPrompt(input: ProposalInput): string {
  const { contact, project, estimate } = input;

  return `Write a video production proposal for:

CLIENT: ${contact.name}, ${contact.role || "Stakeholder"} at ${contact.company}
INDUSTRY: ${project.industry || "Corporate"}
PROJECT TYPE: ${project.projectTypes.join(", ")}
PROJECT NAME: ${project.projectName}
CONTEXT: ${project.projectContext}
AUDIENCE: ${project.audience || "Internal and external stakeholders"}
PLACEMENTS: ${project.placements.join(", ")}
DELIVERABLES: ${project.deliverables.join(", ")}
ENHANCEMENTS: ${project.enhancements.join(", ") || "None selected"}
TARGET RUNTIME: ${project.targetRuntime || "Not specified"}
SHOOT DAYS: ${project.shootDayCount || "Not specified"}
FILMING LOCATIONS: ${project.filmingLocations || "Not specified"}
TRAVEL SCOPE: ${project.travelScope || "Not specified"}
PRODUCTION NEEDS: ${(project.productionNeeds || []).join(", ") || "Not specified"}
STYLE LEVEL: ${project.styleLevel || "Not specified"}
REVISION EXPECTATION: ${project.revisionExpectation || "Not specified"}
COMPANY SCALE: ${project.companyScale || "Not specified"}
QUOTE CONFIDENCE: ${project.quoteConfidence || "Not calculated"}
MISSING QUOTE INPUTS: ${(project.quoteMissingInputs || []).join(", ") || "None"}
PRODUCTION COMPLEXITY: ${project.productionComplexity || "Not calculated"}
POST COMPLEXITY: ${project.postComplexity || "Not calculated"}
TIMELINE: ${project.timeline}
BUDGET RANGE: ${project.budgetRange}
SUCCESS DEFINITION: ${project.successDefinition || "Deliver compelling video content"}

RULE-BASED ESTIMATE:
- Low: ${formatCurrency(estimate.low)}
- High: ${formatCurrency(estimate.high)}
- Deposit (50%): ${formatCurrency(estimate.deposit)}

Generate a JSON response with this exact shape:
{
  "title": "Proposal title",
  "executiveSummary": "2-3 paragraphs summarizing the project, client need, and Content Co-op's approach.",
  "creativeApproach": "2-3 paragraphs on creative direction, visual style, and production methodology.",
  "productionTimeline": "A week-by-week timeline as a paragraph or bullet list.",
  "investmentBreakdown": {
    "lineItems": [
      {"item": "Pre-production", "description": "Scripting, storyboard, location scout", "amount": 2500},
      {"item": "Production", "description": "1-day shoot with 2-person crew", "amount": 4500},
      {"item": "Post-production", "description": "Edit, color, sound mix, graphics", "amount": 3500}
    ],
    "totalLow": number,
    "totalHigh": number,
    "deposit": number
  },
  "teamAssignment": "Description of who will work on this project (e.g., 'Led by Bailey Eubanks, Director/Producer, with a dedicated editor and motion graphics specialist').",
  "nextSteps": ["Step 1", "Step 2", "Step 3"],
  "disclaimer": "Standard disclaimer about estimates being subject to final scope confirmation."
}

Make the line items realistic and add up to approximately the low estimate. Before writing the investment language, reason silently about whether the scope fits the business size and budget signal. Do not inflate small-company pricing, and do not under-scope enterprise/public-company work. Keep the tone agency-level and specific to the client's industry.`;
}

function generateMockProposal(input: ProposalInput): ProposalOutput {
  const { contact, project, estimate } = input;

  const lineItems = [
    { item: "Pre-production", description: "Creative development, scripting, and shot planning", amount: Math.round(estimate.low * 0.2) },
    { item: "Production", description: "Field shoot with director, DP, and audio", amount: Math.round(estimate.low * 0.35) },
    { item: "Post-production", description: "Edit, color grade, sound design, and delivery", amount: Math.round(estimate.low * 0.3) },
    { item: "Project management", description: "Scheduling, client communication, and revisions", amount: Math.round(estimate.low * 0.15) },
  ];

  return {
    title: `${project.projectName || project.projectTypes[0] || "Video Project"} — Creative Proposal`,
    executiveSummary: `Content Co-op is excited to partner with ${contact.company} on ${project.projectName || "this video project"}. Based on your brief, we understand you need ${project.projectTypes.join(" and ")} content that will ${project.placements.join(" and ") === "Website" ? "live on your website and support your sales process" : `reach audiences across ${project.placements.join(", ")}`}.\n\nOur approach combines industrial storytelling expertise with Houston-based production values: real crews, real sites, clear interviews, and polished delivery. We've produced similar work for clients in ${project.industry || "corporate"} and understand the visual language that resonates with your audience.`,
    creativeApproach: `We recommend a ${project.projectTypes[0] || "documentary-style"} approach grounded in authentic interviews and cinematic B-roll. The visual style will be clean, confident, and industry-appropriate — no gimmicks, just strong visuals that support your message.\n\n${project.enhancements.includes("motiongfx") ? "Motion graphics will be used selectively to reinforce key data points and brand identity." : ""}${project.enhancements.includes("sound") ? "Custom sound design will add depth and polish to the final piece." : ""}`,
    productionTimeline: `Week 1: Creative development and script approval. Week 2: Pre-production (location scout, talent prep, shot list). Week 3: Production (1–2 shoot days). Weeks 4–5: Post-production (edit, graphics, sound, color). Week 6: Revisions and final delivery.`,
    investmentBreakdown: {
      lineItems,
      totalLow: estimate.low,
      totalHigh: estimate.high,
      deposit: estimate.deposit,
    },
    teamAssignment: `Led by Bailey Eubanks, Director/Producer, with a dedicated editor${project.enhancements.includes("motiongfx") ? " and motion graphics specialist" : ""}. Crew scaled to project scope — never more than needed, never less than the work demands.`,
    nextSteps: [
      "Review this proposal and confirm scope",
      "Schedule a 20-minute discovery call to finalize details",
      `Submit ${formatCurrency(estimate.deposit)} deposit to lock production dates`,
      "Receive production schedule and pre-production packet",
    ],
    disclaimer: "This estimate is based on the information provided in your creative brief. Final pricing may vary based on shoot location, talent requirements, and revision rounds. A formal Statement of Work will be issued upon deposit.",
  };
}

export async function generateProposal(input: ProposalInput): Promise<ProposalOutput> {
  const ai = getAI();

  if (!ai) {
    console.warn("[gemini] MOCK_MODE: returning mock proposal (GEMINI_API_KEY not set)");
    return generateMockProposal(input);
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      config: {
        systemInstruction: buildSystemPrompt(),
        responseMimeType: "application/json",
      } as GenerateContentConfig,
      contents: buildUserPrompt(input),
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini");

    const parsed = JSON.parse(text) as ProposalOutput;

    // Ensure estimate values match the rule-based calculation
    parsed.investmentBreakdown.totalLow = input.estimate.low;
    parsed.investmentBreakdown.totalHigh = input.estimate.high;
    parsed.investmentBreakdown.deposit = input.estimate.deposit;

    return parsed;
  } catch (err) {
    console.error("[gemini] Generation failed, falling back to mock:", err);
    return generateMockProposal(input);
  }
}
