import React, { useState } from "react";
import { AlertCircle, Coins, Package, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ConfirmationModal from "@/components/ConfirmationModal";
import { useCreateAssetRaffle } from "@/hooks/useCreateAssetRaffle";
import { useQubicConnect } from "@/components/connect/QubicConnectContext";
import { BUNDLE_ASSET_OPTIONS, BUNDLE_EXCLUDED_ASSETS, ASSET_TO_ISSUER, normalizeAssetName } from "@/utils/assetList";
import {
  QRAFFLE_ASSET_RAFFLE_PROPOSAL_FEE,
  QRAFFLE_MAX_ASSETS_PER_BUNDLE,
  QRAFFLE_MAX_ASSET_RAFFLES_PER_CREATOR,
  QRAFFLE_MAX_ASSET_TICKET_AMOUNT,
  QRAFFLE_MIN_ASSET_TICKET_AMOUNT,
} from "@/utils/constants";

interface BundleItemForm {
  assetName: string;
  numberOfShares: string;
}

interface CreateAssetRaffleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

const emptyItem = (): BundleItemForm => ({ assetName: "", numberOfShares: "" });

const formatWithCommas = (value: string) => (value ? value.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "");
const digitsOnly = (value: string) => value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

const CreateAssetRaffleModal: React.FC<CreateAssetRaffleModalProps> = ({ open, onOpenChange, onCreated }) => {
  const [items, setItems] = useState<BundleItemForm[]>([emptyItem()]);
  const [reservePrice, setReservePrice] = useState("");
  const [ticketPrice, setTicketPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { handleCreate } = useCreateAssetRaffle();
  const { wallet } = useQubicConnect();

  const updateItem = (index: number, patch: Partial<BundleItemForm>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const itemIsValid = (item: BundleItemForm) =>
    ASSET_TO_ISSUER.has(normalizeAssetName(item.assetName)) &&
    !BUNDLE_EXCLUDED_ASSETS.has(normalizeAssetName(item.assetName)) &&
    parseInt(item.numberOfShares) > 0;

  const hasDuplicateAssets = new Set(items.map((i) => normalizeAssetName(i.assetName))).size !== items.length;

  const reservePriceNum = parseInt(reservePrice) || 0;
  const ticketPriceNum = parseInt(ticketPrice) || 0;
  const ticketPriceValid =
    ticketPriceNum >= QRAFFLE_MIN_ASSET_TICKET_AMOUNT && ticketPriceNum <= QRAFFLE_MAX_ASSET_TICKET_AMOUNT;
  const reservePriceValid = reservePriceNum > 0;

  const isFormValid =
    !!wallet &&
    items.length > 0 &&
    items.every(itemIsValid) &&
    !hasDuplicateAssets &&
    reservePriceValid &&
    ticketPriceValid &&
    !isSubmitting;

  // Gross ticket revenue must reach 125% of the reserve (creator receives 79%).
  const requiredGross = Math.ceil((reservePriceNum * 100) / 80);
  const minTicketsToMeetReserve = ticketPriceNum > 0 ? Math.ceil(requiredGross / ticketPriceNum) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    setShowConfirmation(true);
  };

  const handleConfirm = async () => {
    setShowConfirmation(false);
    setIsSubmitting(true);
    try {
      const bundleItems = items.map((item) => {
        const assetName = normalizeAssetName(item.assetName);
        return {
          assetName,
          issuer: ASSET_TO_ISSUER.get(assetName) || "",
          numberOfShares: parseInt(item.numberOfShares),
        };
      });
      const created = await handleCreate(bundleItems, reservePriceNum, ticketPriceNum);
      if (created) {
        setItems([emptyItem()]);
        setReservePrice("");
        setTicketPrice("");
        onOpenChange(false);
        onCreated?.();
      }
    } catch (error) {
      console.error("Failed to create asset raffle:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <div className="bg-primary/10 rounded-lg p-1.5">
              <Package className="text-primary h-4 w-4" />
            </div>
            <span>Create Bundle (Asset) Raffle</span>
          </DialogTitle>
          <DialogDescription>
            Raffle a bundle of up to {QRAFFLE_MAX_ASSETS_PER_BUNDLE} assets against QUBIC tickets. The bundle is
            escrowed until epoch end; if the reserve is not met, all buyers are refunded and the bundle returns to
            you.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 p-6 pt-0">
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Bundle Items</Label>
            {items.map((item, index) => (
              <div key={index} className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  {index === 0 && <span className="text-muted-foreground text-xs">Asset</span>}
                  <Select value={item.assetName} onValueChange={(v) => updateItem(index, { assetName: v })}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select asset..." />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card text-card-foreground max-h-72 shadow-xl">
                      {BUNDLE_ASSET_OPTIONS.map((option) => (
                        <SelectItem key={option.asset} value={option.asset} className="bg-card text-card-foreground">
                          {option.asset}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 space-y-1">
                  {index === 0 && <span className="text-muted-foreground text-xs">Shares</span>}
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formatWithCommas(item.numberOfShares)}
                    onChange={(e) => updateItem(index, { numberOfShares: digitsOnly(e.target.value) })}
                    placeholder="Number of shares"
                    className="h-10"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  disabled={items.length === 1}
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {hasDuplicateAssets && (
              <p className="text-destructive flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4" />
                Each asset can only appear once in a bundle
              </p>
            )}
            {items.length < QRAFFLE_MAX_ASSETS_PER_BUNDLE && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItems((prev) => [...prev, emptyItem()])}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Asset
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reservePrice" className="text-sm font-semibold">
              Reserve Price (QUBIC)
            </Label>
            <Input
              id="reservePrice"
              type="text"
              inputMode="numeric"
              value={formatWithCommas(reservePrice)}
              onChange={(e) => setReservePrice(digitsOnly(e.target.value))}
              placeholder="Minimum QUBIC you want to receive"
              className="h-10"
            />
            <p className="text-muted-foreground text-xs">
              The amount you want after the 21% fee split. Ticket sales must gross at least 125% of this or everyone
              is refunded.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ticketPrice" className="text-sm font-semibold">
              Ticket Price (QUBIC)
            </Label>
            <Input
              id="ticketPrice"
              type="text"
              inputMode="numeric"
              value={formatWithCommas(ticketPrice)}
              onChange={(e) => setTicketPrice(digitsOnly(e.target.value))}
              placeholder={`${QRAFFLE_MIN_ASSET_TICKET_AMOUNT.toLocaleString()} minimum`}
              className="h-10"
            />
            {ticketPrice && !ticketPriceValid && (
              <p className="text-destructive flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4" />
                Ticket price must be between {QRAFFLE_MIN_ASSET_TICKET_AMOUNT.toLocaleString()} and{" "}
                {QRAFFLE_MAX_ASSET_TICKET_AMOUNT.toLocaleString()} QUBIC
              </p>
            )}
            {reservePriceValid && ticketPriceValid && (
              <p className="text-muted-foreground text-xs">
                At this price, at least {minTicketsToMeetReserve.toLocaleString()} ticket
                {minTicketsToMeetReserve === 1 ? "" : "s"} must sell for the reserve to be met.
              </p>
            )}
          </div>

          <div className="from-muted/30 to-muted/10 border-muted/50 rounded-lg border bg-gradient-to-r p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="text-muted-foreground mt-0.5 h-4 w-4" />
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm font-medium">Important Notes:</p>
                <ul className="text-muted-foreground space-y-1 text-xs">
                  <li>
                    • A non-refundable {QRAFFLE_ASSET_RAFFLE_PROPOSAL_FEE.toLocaleString()} QUBIC creation fee applies
                  </li>
                  <li>• You must be a registered DAO member to create a raffle</li>
                  <li>• Max {QRAFFLE_MAX_ASSET_RAFFLES_PER_CREATOR} raffles per creator per epoch</li>
                  <li>• Bundle assets are escrowed by the contract until epoch end</li>
                  <li>• If the reserve is met, you receive 79% of ticket sales; the winner gets the bundle</li>
                  <li>• You can cancel (bundle returned, fee not refunded) only while there are no buyers</li>
                </ul>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isFormValid}
              className="from-primary to-accent hover:from-primary/90 hover:to-accent/90 bg-gradient-to-r font-semibold shadow-lg disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Raffle
                </>
              )}
            </Button>
          </DialogFooter>
        </form>

        <DialogClose onClick={() => onOpenChange(false)} />
      </DialogContent>

      <ConfirmationModal
        open={showConfirmation}
        onOpenChange={setShowConfirmation}
        onConfirm={handleConfirm}
        title="Confirm Asset Raffle Creation"
        description="Your bundle will be escrowed by the QRaffle contract and raffled at the end of this epoch."
        type="info"
        isLoading={isSubmitting}
        confirmText="Create Raffle"
        cancelText="Review Details"
        details={[
          {
            label: "Bundle",
            value: items
              .filter(itemIsValid)
              .map((i) => `${parseInt(i.numberOfShares).toLocaleString()} ${normalizeAssetName(i.assetName)}`)
              .join(" + "),
            icon: <Package className="text-muted-foreground h-4 w-4" />,
          },
          {
            label: "Reserve Price",
            value: `${reservePriceNum.toLocaleString()} QUBIC`,
            icon: <Coins className="text-muted-foreground h-4 w-4" />,
          },
          {
            label: "Ticket Price",
            value: `${ticketPriceNum.toLocaleString()} QUBIC`,
            icon: <Coins className="text-muted-foreground h-4 w-4" />,
          },
          {
            label: "Creation Fee",
            value: `${QRAFFLE_ASSET_RAFFLE_PROPOSAL_FEE.toLocaleString()} QUBIC (non-refundable)`,
            icon: <AlertCircle className="text-muted-foreground h-4 w-4" />,
          },
        ]}
        warningMessage="The creation fee is not refunded even if you cancel or the reserve is not met. Bundle shares may first be transferred to QRaffle management (one extra transaction per asset)."
      />
    </Dialog>
  );
};

export default CreateAssetRaffleModal;
