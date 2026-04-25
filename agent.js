// agent.js
// Claude AI agent simulating an LLM wrapper (e.g., InnerAI, Adapta)
// that uses Bido's x402 protocol to monetize API calls

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk').default;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const API_BASE = 'http://localhost:3000';

// ========== TOOL: search flights via Bido x402 ==========
async function searchFlights(from, to) {
  console.log(`\n[AGENT] 🔍 Calling /flights?from=${from}&to=${to}...`);

  // Step 1: Try the API
  const initialRes = await fetch(`${API_BASE}/flights?from=${from}&to=${to}`);

  if (initialRes.status === 402) {
    const paymentInfo = await initialRes.json();
    console.log(`[AGENT] 💸 Got 402 Payment Required`);
    console.log(`[AGENT]    Protocol: ${paymentInfo.payment.protocol}`);
    console.log(`[AGENT]    Price range: ${paymentInfo.payment.price_range_usdc} USDC`);
    console.log(`[AGENT] ⚡ Triggering Bido auction to pay for this call...`);

    // Step 2: Pay via Bido
    const payRes = await fetch(`${API_BASE}/pay-via-bido`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, query: paymentInfo.payment.query_intent })
    });

    if (payRes.status === 200) {
      const result = await payRes.json();
      console.log(`[AGENT] ✓ Auction settled — ${result.bido_receipt.winner} paid $${result.bido_receipt.winningBid}`);
      console.log(`[AGENT] ✓ Got ${result.data.flights.length} flights`);
      return result.data.flights;
    } else {
      throw new Error(`Payment failed: ${payRes.status}`);
    }
  } else if (initialRes.status === 200) {
    const data = await initialRes.json();
    return data.flights;
  } else {
    throw new Error(`Unexpected status: ${initialRes.status}`);
  }
}

// ========== CLAUDE AGENT ==========
const TOOLS = [
  {
    name: "search_flights",
    description: "Search for flights between two cities. Returns a list of available flights with airline, price, and times. This API requires payment via Bido protocol.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Origin airport code, e.g. LAX" },
        to:   { type: "string", description: "Destination airport code, e.g. NYC" }
      },
      required: ["from", "to"]
    }
  }
];

async function runAgent(userQuery) {
  console.log("\n╔════════════════════════════════════════════════╗");
  console.log("║       AGENT (LLM Wrapper Simulation)           ║");
  console.log("║   Powered by Claude + Bido x402                ║");
  console.log("╚════════════════════════════════════════════════╝");
  console.log(`\n👤 User: "${userQuery}"\n`);

  const messages = [{ role: "user", content: userQuery }];

  let finalResponse = null;
  let iterations = 0;
  const maxIterations = 5;

  while (iterations < maxIterations) {
    iterations++;
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      tools: TOOLS,
      messages: messages
    });

    // If Claude wants to use a tool
    if (response.stop_reason === "tool_use") {
      const toolUse = response.content.find(c => c.type === "tool_use");
      console.log(`[AGENT] 🛠  Claude wants to use: ${toolUse.name}(${JSON.stringify(toolUse.input)})`);

      let toolResult;
      try {
        if (toolUse.name === "search_flights") {
          const flights = await searchFlights(toolUse.input.from, toolUse.input.to);
          toolResult = JSON.stringify(flights);
        }
      } catch (err) {
        toolResult = `Error: ${err.message}`;
      }

      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: toolUse.id, content: toolResult }]
      });
    } else {
      // Claude finished — extract text response
      const textBlock = response.content.find(c => c.type === "text");
      finalResponse = textBlock ? textBlock.text : "(no response)";
      break;
    }
  }

  console.log("\n╔════════════════════════════════════════════════╗");
  console.log("║              AGENT RESPONSE                    ║");
  console.log("╚════════════════════════════════════════════════╝");
  console.log(`\n🤖 ${finalResponse}\n`);
}

// ========== MAIN ==========
const userQuery = process.argv.slice(2).join(' ') || "Find me the cheapest flight from LAX to NYC";
runAgent(userQuery).catch(err => {
  console.error("[ERROR]", err);
  process.exit(1);
});