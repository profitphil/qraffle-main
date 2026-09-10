import React, { useState } from "react";
import { Package, Ticket, Coins, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import ConfirmationModal from "@/components/ConfirmationModal";
import NewBadge from "@/components/ui/new-badge";
import { useAssetRaffles, type ActiveAssetRaffle } from "@/hooks/useAssetRaffles";
import { useBuyAssetRaffleTicket } from "@/hooks/useBuyAssetRaffleTicket";
import { useQubicConnect } from "@/components/connect/QubicConnectContext";
import { truncateMiddle } from "@/utils";
import { QRAFFLE_MAX_TICKETS_PER_BUYER } from "@/utils/constants";

// The reserve is met when gross ticket revenue reaches 125% of the reserve
// price (creator receives 79% of gross).
const reserveProgressPercent = (raffle: ActiveAssetRaffle) => {
  const requiredGross = Math.ceil((raffle.reservePriceQu * 100) / 80);
  if (requiredGross <= 0) return 100;
  return Math.min(100, Math.floor((raffle.totalTicketsPaidQu * 100) / requiredGross));
};

const bundleLabel = (raffle: ActiveAssetRaffle) =>
  raffle.bundleItems.map((item) => `${item.numberOfShares.toLocaleString()} ${item.assetName}`).join(" + ");

const ActiveAssetRaffles: React.FC = () => {
  const { assetRaffles, isLoading, refetch } = useAssetRaffles();
  const { handleBuy } = useBuyAssetRaffleTicket();
  const { wallet } = useQubicConnect();

  const [buyTarget, setBuyTarget] = useState<ActiveAssetRaffle | null>(null);
  const [ticketCount, setTicketCount] = useState("1");
  const [showConfirm, setShowConfirm] = useState(false);
  const [isBuying, setIsBuying] = useState(false);

  const ticketCountNum = parseInt(ticketCount) || 0;
  const ticketCountValid = ticketCountNum >= 1 && ticketCountNum <= QRAFFLE_MAX_TICKETS_PER_BUYER;
  const totalCost = buyTarget ? ticketCountNum * buyTarget.entryTicketQu : 0;

  const openBuyDialog = (raffle: ActiveAssetRaffle) => {
    setBuyTarget(raffle);
    setTicketCount("1");
  };

  const handleConfirmBuy = async () => {
    if (!buyTarget || !ticketCountValid) return;
    setShowConfirm(false);
    setIsBuying(true);
    try {
      const bought = await handleBuy(buyTarget.index, ticketCountNum, buyTarget.entryTicketQu);
      if (bought) {
        setBuyTarget(null);
        refetch();
      }
    } finally {
      setIsBuying(false);
    }
  };

  if (!isLoading && assetRaffles.length === 0) return null;

  return (
    <div className="bg-card border-card-border w-full rounded-xl border p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="relative">
          <h2 className="text-2xl font-bold text-white">Bundle Raffles (Asset Raffles)</h2>
          <NewBadge show />
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <p className="text-muted-foreground">Loading bundle raffles...</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {assetRaffles.map((raffle) => {
            const progress = reserveProgressPercent(raffle);
            return (
              <Card key={raffle.index} className="overflow-hidden border-gray-700 bg-gray-800">
                <CardContent className="px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-r from-[#8B5CF6] to-[#6366F1]">
                        <Package className="h-3 w-3 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{bundleLabel(raffle)}</h3>
                        <p className="text-xs text-gray-400">
                          {raffle.entryTicketQu.toLocaleString()} QUBIC per ticket
                        </p>
                        <p className="text-xs text-gray-400">
                          Creator: {truncateMiddle(raffle.creator, 20)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[#8B5CF6]/10 px-2 py-1 text-xs text-[#A78BFA]">
                        Bundle Raffle
                      </span>
                      <Button size="sm" onClick={() => openBuyDialog(raffle)}>
                        <Ticket className="mr-1 h-3 w-3" />
                        Buy Tickets
                      </Button>
                    </div>
                  </div>

                  <div className="my-2 rounded-lg bg-gradient-to-r from-[#374151]/60 to-[#4B5563]/60 px-2 py-1">
                    <div className="mb-1 flex items-center justify-between text-xs text-[#9CA3AF]">
                      <span>Reserve progress</span>
                      <span>
                        {raffle.totalTicketsPaidQu.toLocaleString()} QUBIC raised · {progress}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-700">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#6366F1]"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {raffle.numberOfBuyers.toLocaleString()} buyers
                    </span>
                    <span className="flex items-center gap-1">
                      <Ticket className="h-3 w-3" />
                      {raffle.totalTickets.toLocaleString()} tickets sold
                    </span>
                    <span className="flex items-center gap-1">
                      <Coins className="h-3 w-3" />
                      Reserve: {raffle.reservePriceQu.toLocaleString()} QUBIC
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Buy tickets dialog */}
      <Dialog open={buyTarget !== null} onOpenChange={(open) => !open && setBuyTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <div className="bg-primary/10 rounded-lg p-1.5">
                <Ticket className="text-primary h-4 w-4" />
              </div>
              <span>Buy Raffle Tickets</span>
            </DialogTitle>
            <DialogDescription>
              {buyTarget ? `Bundle: ${bundleLabel(buyTarget)}` : ""} — the winner is drawn at epoch end, weighted by
              tickets held. If the reserve is not met, all ticket purchases are fully refunded.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 p-6 pt-0">
            <div className="space-y-2">
              <Label htmlFor="ticketCount" className="text-sm font-semibold">
                Number of Tickets (max {QRAFFLE_MAX_TICKETS_PER_BUYER} per buyer)
              </Label>
              <Input
                id="ticketCount"
                type="number"
                min={1}
                max={QRAFFLE_MAX_TICKETS_PER_BUYER}
                value={ticketCount}
                onChange={(e) => setTicketCount(e.target.value)}
                className="h-10"
              />
            </div>

            {buyTarget && ticketCountValid && (
              <div className="from-muted/30 to-muted/10 border-muted/50 rounded-lg border bg-gradient-to-r p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total cost</span>
                  <span className="font-semibold">{totalCost.toLocaleString()} QUBIC</span>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBuyTarget(null)} disabled={isBuying}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!wallet || !ticketCountValid || isBuying}
                onClick={() => setShowConfirm(true)}
                className="from-primary to-accent hover:from-primary/90 hover:to-accent/90 bg-gradient-to-r font-semibold shadow-lg disabled:opacity-50"
              >
                {isBuying ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Buying...
                  </>
                ) : !wallet ? (
                  "Connect Wallet First"
                ) : (
                  <>
                    <Ticket className="mr-2 h-4 w-4" />
                    Buy Tickets
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>

          <DialogClose onClick={() => setBuyTarget(null)} />
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={handleConfirmBuy}
        title="Confirm Ticket Purchase"
        description="You are about to buy tickets for this bundle raffle. If the reserve is not met at epoch end, you are refunded in full."
        type="info"
        isLoading={isBuying}
        confirmText="Buy Tickets"
        cancelText="Review"
        details={[
          {
            label: "Bundle",
            value: buyTarget ? bundleLabel(buyTarget) : "",
            icon: <Package className="text-muted-foreground h-4 w-4" />,
          },
          {
            label: "Tickets",
            value: ticketCountNum.toLocaleString(),
            icon: <Ticket className="text-muted-foreground h-4 w-4" />,
          },
          {
            label: "Total Cost",
            value: `${totalCost.toLocaleString()} QUBIC`,
            icon: <Coins className="text-muted-foreground h-4 w-4" />,
          },
        ]}
      />
    </div>
  );
};

export default ActiveAssetRaffles;
