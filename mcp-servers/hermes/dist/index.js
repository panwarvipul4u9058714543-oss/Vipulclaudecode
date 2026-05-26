"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY || "";
const HERMES_MODEL = "NousResearch/Hermes-3-Llama-3.1-70B-FP8";
const MEMORY_DIR = process.env.MEMORY_DIR || path.join(process.cwd(), ".claude/memory");
// Call Hermes via Together AI API
async function callHermes(systemPrompt, userMessage) {
    if (!TOGETHER_API_KEY) {
        return "ERROR: TOGETHER_API_KEY not set. Add it in Claude Code settings → Environment Variables.";
    }
    try {
        const response = await axios_1.default.post("https://api.together.xyz/v1/chat/completions", {
            model: HERMES_MODEL,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
            ],
            max_tokens: 1024,
            temperature: 0.3,
        }, {
            headers: {
                Authorization: `Bearer ${TOGETHER_API_KEY}`,
                "Content-Type": "application/json",
            },
        });
        return response.data.choices[0]?.message?.content || "No response from Hermes.";
    }
    catch (err) {
        return `Hermes API error: ${err.response?.data?.error || err.message}`;
    }
}
// Read a memory file safely
function readMemory(filename) {
    try {
        const filePath = path.join(MEMORY_DIR, filename);
        return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
    }
    catch {
        return "";
    }
}
// Append to a memory file
function appendMemory(filename, content) {
    const filePath = path.join(MEMORY_DIR, filename);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.appendFileSync(filePath, content);
}
// ── MCP Server ────────────────────────────────────────────
const server = new index_js_1.Server({ name: "hermes-agent", version: "1.0.0" }, { capabilities: { tools: {} } });
// List available tools
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: "hermes_learn",
            description: "After completing a task, send what happened to Hermes. It extracts lessons, patterns, and improvements to store in memory. Hermes learns so future sessions are smarter.",
            inputSchema: {
                type: "object",
                properties: {
                    task: { type: "string", description: "What task was just completed" },
                    outcome: { type: "string", description: "What happened — success, failure, what worked" },
                    context: { type: "string", description: "Any relevant context (errors, decisions made, code written)" },
                },
                required: ["task", "outcome"],
            },
        },
        {
            name: "hermes_recall",
            description: "Ask Hermes what it knows about a topic from past sessions. It searches memory and returns relevant patterns, lessons, and past decisions.",
            inputSchema: {
                type: "object",
                properties: {
                    query: { type: "string", description: "What you want to recall — e.g. 'how did we handle auth before?' or 'what mistakes were made with React?'" },
                },
                required: ["query"],
            },
        },
        {
            name: "hermes_improve",
            description: "Send your current approach or code to Hermes and get improvement suggestions based on past patterns and general best practices.",
            inputSchema: {
                type: "object",
                properties: {
                    approach: { type: "string", description: "Current approach, code snippet, or plan to review" },
                    goal: { type: "string", description: "What you are trying to achieve" },
                },
                required: ["approach", "goal"],
            },
        },
        {
            name: "hermes_analyze_patterns",
            description: "Send Hermes the full activity log and ask it to find deep patterns — what is being worked on most, what keeps going wrong, what to focus on next.",
            inputSchema: {
                type: "object",
                properties: {
                    focus: { type: "string", description: "Optional: what aspect to focus analysis on (e.g. 'mistakes', 'productivity', 'code quality')" },
                },
                required: [],
            },
        },
    ],
}));
// Handle tool calls
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    switch (name) {
        case "hermes_learn": {
            const { task, outcome, context = "" } = args;
            const pastMistakes = readMemory("mistakes.md");
            const pastProgress = readMemory("progress.md").slice(0, 1000);
            const system = `You are Hermes, an AI that specializes in learning from tasks and building persistent memory.
Your job: extract the most valuable lessons from what just happened and format them for storage.
Be specific, actionable, and focused on what will actually help in future sessions.`;
            const prompt = `A task just completed. Extract lessons for memory.

TASK: ${task}
OUTCOME: ${outcome}
CONTEXT: ${context}

PAST MISTAKES (to check if this is a repeat):
${pastMistakes.slice(0, 500)}

Extract:
1. Key lesson learned (1-2 sentences)
2. What to do differently next time (if anything failed)
3. What worked well (to repeat)
4. Any pattern this fits into

Format as concise bullet points.`;
            const lesson = await callHermes(system, prompt);
            // Store what Hermes learned in memory
            const timestamp = new Date().toISOString().split("T")[0];
            appendMemory("hermes-learnings.md", `\n## ${timestamp} — Task: ${task}\n${lesson}\n`);
            return {
                content: [{ type: "text", text: `Hermes learned and stored:\n\n${lesson}` }],
            };
        }
        case "hermes_recall": {
            const { query } = args;
            const allMemory = [
                readMemory("hermes-learnings.md"),
                readMemory("mistakes.md"),
                readMemory("progress.md"),
                readMemory("patterns.md"),
            ].join("\n\n---\n\n");
            const system = `You are Hermes, an AI memory retrieval system.
Given memory files and a query, find the most relevant past experiences, lessons, and patterns.
Be specific and direct. Only return what is actually relevant.`;
            const prompt = `Query: "${query}"

Memory contents:
${allMemory.slice(0, 3000)}

Return the most relevant information from memory for this query.`;
            const recall = await callHermes(system, prompt);
            return {
                content: [{ type: "text", text: recall }],
            };
        }
        case "hermes_improve": {
            const { approach, goal } = args;
            const pastLearnings = readMemory("hermes-learnings.md").slice(0, 1000);
            const mistakes = readMemory("mistakes.md").slice(0, 500);
            const system = `You are Hermes, an expert code and architecture reviewer with memory of past sessions.
Analyze the current approach and suggest concrete improvements based on past patterns and best practices.`;
            const prompt = `Goal: ${goal}

Current approach:
${approach}

Past lessons learned:
${pastLearnings}

Past mistakes to avoid:
${mistakes}

Provide:
1. What looks good (keep doing)
2. Specific improvements (with reasons)
3. Any past mistake this risks repeating
4. Recommended next step`;
            const improvement = await callHermes(system, prompt);
            return {
                content: [{ type: "text", text: improvement }],
            };
        }
        case "hermes_analyze_patterns": {
            const { focus = "overall" } = args;
            const activityLog = readMemory("activity-log.md");
            const progress = readMemory("progress.md");
            const patterns = readMemory("patterns.md");
            const system = `You are Hermes, an AI that specializes in finding deep patterns in developer behavior and learning trajectories.
Analyze activity and provide strategic insights about what to focus on next.`;
            const prompt = `Analyze these records and find patterns. Focus: ${focus}

ACTIVITY LOG (recent file edits):
${activityLog.slice(-2000)}

PROGRESS LOG:
${progress.slice(0, 1000)}

DETECTED PATTERNS SO FAR:
${patterns}

Provide:
1. What is being worked on most (and whether that's the right focus)
2. Hidden patterns or problems
3. What to focus on next for maximum progress
4. One specific recommendation to improve productivity`;
            const analysis = await callHermes(system, prompt);
            // Store the analysis
            const timestamp = new Date().toISOString().split("T")[0];
            appendMemory("hermes-learnings.md", `\n## ${timestamp} — Pattern Analysis (focus: ${focus})\n${analysis}\n`);
            return {
                content: [{ type: "text", text: analysis }],
            };
        }
        default:
            return {
                content: [{ type: "text", text: `Unknown tool: ${name}` }],
                isError: true,
            };
    }
});
// Start the server
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error("Hermes MCP server running");
}
main().catch(console.error);
