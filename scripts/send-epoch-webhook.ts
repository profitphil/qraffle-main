import { sendDividendBreakdownToDiscord, sendEpochWinnersToDiscord } from "../src/services/webhook.service";

const [, , epochArg, typeArg] = process.argv;
const epoch = Number(epochArg ?? process.env.EPOCH ?? "");
const type = (typeArg ?? process.env.TYPE ?? "winners").toLowerCase();

if (!Number.isFinite(epoch) || epoch <= 0) {
  console.error("Usage: npx tsx scripts/send-epoch-webhook.ts <epoch> [winners|dividends]");
  process.exit(1);
}

const handlers: Record<string, { label: string; fn: (epoch: number) => Promise<boolean> }> = {
  winners: { label: "winners", fn: sendEpochWinnersToDiscord },
  dividends: { label: "dividends", fn: sendDividendBreakdownToDiscord },
};

const handler = handlers[type];
if (!handler) {
  console.error("Unknown type. Use either 'winners' or 'dividends'.");
  process.exit(1);
}

(async () => {
  console.log(`Sending Discord webhook for epoch ${epoch} ${handler.label}...`);
  const success = await handler.fn(epoch);
  if (success) {
    console.log(`Successfully sent ${handler.label} for epoch ${epoch}.`);
  } else {
    console.error(`Failed to send ${handler.label} for epoch ${epoch}.`);
    process.exit(1);
  }
})();
