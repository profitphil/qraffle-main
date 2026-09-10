import React, { useState } from "react";
import { AlertCircle, Package, Plus, Ticket, Trophy, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ConfirmationModal from "@/components/ConfirmationModal";
import CreateAssetRaffleModal from "@/components/CreateAssetRaffleModal";
import { useAssetRaffles, type ActiveAssetRaffle } from "@/hooks/useAssetRaffles";
import { useCancelAssetRaffle } from "@/hooks/useCancelAssetRaffle";
import { useQubicConnect } from "@/components/connect/QubicConnectContext";
import {
  QRAFFLE_ASSET_RAFFLE_PROPOSAL_FEE,
  QRAFFLE_MAX_ASSET_RAFFLES_PER_CREATOR,
} from "@/utils/constants";

interface BundleRaffleTabProps {
  isRegistered: boolean;
}

const bundleLabel = (raffle: ActiveAssetRaffle) =>
  raffle.bundleItems.map((item) => `${item.numberOfShares.toLocaleString()} ${item.assetName}`).join(" + ");

const BundleRaffleTab: React.FC<BundleRaffleTabProps> = ({ isRegistered }) => {
  const { wallet } = useQubicConnect();
  const { assetRaffles, assetRaffleAnalytics, isLoading, refetch } = useAssetRaffles();
  const { handleCancel } = useCancelAssetRaffle();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<ActiveAssetRaffle | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const myRaffles = wallet ? assetRaffles.filter((raffle) => raffle.creator === wallet.publicKey) : [];
  const reachedCreatorLimit = myRaffles.length >= QRAFFLE_MAX_ASSET_RAFFLES_PER_CREATOR;
  // The analytics view only answers once the asset raffle contract upgrade is
  // live on the network; until then keep creation disabled so no one sends the
  // 500K fee to a procedure that does not exist yet.
  const contractSupported = assetRaffleAnalytics !== null;

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    try {
      const cancelled = await handleCancel(cancelTarget.index);
      if (cancelled) refetch();
    } finally {
      setIsCancelling(false);
      setCancelTarget(null);
    }
  };

  return (
    <Card className="border-card-border bg-card rounded-tl-none shadow-lg">
      <CardContent className="space-y-6 px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-foreground flex items-center gap-2 text-xl font-semibold">
              <Package className="h-5 w-5" />
              Bundle Raffle (Asset Raffle)
            </h3>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
              Raffle a bundle of asset shares against QUBIC tickets with a reserve price of your choosing. If the
              reserve is met at epoch end, one weighted-random ticket holder wins the bundle and you receive 79% of
              ticket sales; otherwise everyone is refunded and the bundle returns to you.
            </p>
          </div>
          <Button
            onClick={() => setIsCreateOpen(true)}
            disabled={!wallet || !isRegistered || reachedCreatorLimit || !contractSupported}
            className="from-primary to-accent bg-gradient-to-r"
          >
            <Plus className="mr-1 h-4 w-4" />
            Create Asset Raffle
          </Button>
        </div>

        {!isLoading && !contractSupported && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-warning/40 bg-warning/10 flex items-center gap-3 rounded-lg border p-4"
          >
            <AlertCircle className="text-warning h-5 w-5 shrink-0" />
            <p className="text-warning text-sm font-semibold">
              The asset raffle contract upgrade is not live on the network yet. Creation will unlock automatically
              once the upgraded QRaffle contract starts answering.
            </p>
          </motion.div>
        )}

        {assetRaffleAnalytics && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="bg-muted/20 rounded-lg p-3 text-center">
              <div className="text-foreground text-lg font-bold">
                {assetRaffleAnalytics.numberOfActiveAssetRaffles.toLocaleString()}
              </div>
              <div className="text-muted-foreground text-xs">Active This Epoch</div>
            </div>
            <div className="bg-muted/20 rounded-lg p-3 text-center">
              <div className="text-foreground text-lg font-bold">
                {assetRaffleAnalytics.totalAssetRafflesSucceeded.toLocaleString()}
              </div>
              <div className="text-muted-foreground text-xs">Succeeded</div>
            </div>
            <div className="bg-muted/20 rounded-lg p-3 text-center">
              <div className="text-foreground text-lg font-bold">
                {assetRaffleAnalytics.totalAssetRafflesCreated.toLocaleString()}
              </div>
              <div className="text-muted-foreground text-xs">Total Created</div>
            </div>
            <div className="bg-muted/20 rounded-lg p-3 text-center">
              <div className="text-foreground text-lg font-bold">
                {assetRaffleAnalytics.totalAssetRaffleCreatorPaid.toLocaleString()}
              </div>
              <div className="text-muted-foreground text-xs">QUBIC Paid to Creators</div>
            </div>
          </div>
        )}

        {!isRegistered && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-warning/40 bg-warning/10 flex items-center gap-3 rounded-lg border p-4"
          >
            <AlertCircle className="text-warning h-5 w-5 shrink-0" />
            <p className="text-warning font-semibold">Register in the DAO to create asset raffles</p>
          </motion.div>
        )}

        {isRegistered && reachedCreatorLimit && (
          <p className="text-muted-foreground text-sm">
            You have reached the limit of {QRAFFLE_MAX_ASSET_RAFFLES_PER_CREATOR} asset raffles for this epoch.
          </p>
        )}

        <div>
          <h4 className="text-foreground mb-3 flex items-center gap-2 font-semibold">
            <Trophy className="h-4 w-4" />
            Your Active Asset Raffles
          </h4>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            </div>
          ) : myRaffles.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              You have no active asset raffles this epoch. Creating one costs a non-refundable{" "}
              {QRAFFLE_ASSET_RAFFLE_PROPOSAL_FEE.toLocaleString()} QUBIC fee.
            </p>
          ) : (
            <div className="grid gap-2">
              {myRaffles.map((raffle) => (
                <Card key={raffle.index} className="border-gray-700 bg-gray-800">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{bundleLabel(raffle)}</div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-400">
                        <span>Reserve: {raffle.reservePriceQu.toLocaleString()} QUBIC</span>
                        <span>Ticket: {raffle.entryTicketQu.toLocaleString()} QUBIC</span>
                        <span className="flex items-center gap-1">
                          <Ticket className="h-3 w-3" />
                          {raffle.totalTickets.toLocaleString()} sold ({raffle.numberOfBuyers.toLocaleString()} buyers)
                        </span>
                        <span>Raised: {raffle.totalTicketsPaidQu.toLocaleString()} QUBIC</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={raffle.numberOfBuyers > 0 || isCancelling}
                      onClick={() => setCancelTarget(raffle)}
                      title={
                        raffle.numberOfBuyers > 0
                          ? "Raffles with buyers cannot be cancelled"
                          : "Cancel and reclaim the bundle"
                      }
                    >
                      <XCircle className="mr-1 h-4 w-4" />
                      Cancel
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      <CreateAssetRaffleModal open={isCreateOpen} onOpenChange={setIsCreateOpen} onCreated={() => refetch()} />

      <ConfirmationModal
        open={cancelTarget !== null}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        onConfirm={handleConfirmCancel}
        title="Cancel Asset Raffle"
        description="The escrowed bundle will be returned to your wallet. The creation fee is NOT refunded. Cancelling is only possible while no tickets have been sold."
        type="warning"
        isLoading={isCancelling}
        confirmText="Cancel Raffle"
        cancelText="Keep Raffle"
        details={[
          {
            label: "Bundle",
            value: cancelTarget ? bundleLabel(cancelTarget) : "",
            icon: <Package className="text-muted-foreground h-4 w-4" />,
          },
        ]}
        warningMessage={`The ${QRAFFLE_ASSET_RAFFLE_PROPOSAL_FEE.toLocaleString()} QUBIC creation fee will not be refunded.`}
      />
    </Card>
  );
};

export default BundleRaffleTab;
