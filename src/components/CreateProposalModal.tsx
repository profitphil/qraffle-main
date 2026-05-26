import React, { useState } from "react";
import { motion } from "framer-motion";
import { Plus, AlertCircle, CheckCircle, Coins, User, Hash } from "lucide-react";
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
import { useSubmitTokenRaffleProposal } from "@/hooks/useSubmitTokenRaffleProposal";
import { useQubicConnect } from "@/components/connect/QubicConnectContext";
import ConfirmationModal from "@/components/ConfirmationModal";
import { truncateMiddle } from "@/utils";

const normalizeIdentity = (value: string | null | undefined) => value?.replace(/\0/g, "").trim().toUpperCase() || "";
const normalizeAssetName = (value: string | null | undefined) => value?.replace(/\0/g, "").trim().toUpperCase() || "";

const ASSET_ISSUER_CSV = `AETHER,PJTNSCBQNTCDIBUMQCMUZMWQERABDDMKKLFFVDWWYBAEKQTUCJKXBYADRQZA
AGI,LUCRKUDTXONGDELVTZJUMKQUXVVCXVRKMIVTEGLFGGZGHVCHYGKZVGFGUEJA
AIGARTH,PXMARASAWVLRUABZZOXQYOWAJLMBULKABAPAEXDVECDFPFZJMAMTLTQAQQLG
ANNA,HIFUSWQYNUZTSDRPXZOXXIWUPWTAOVJUTCVLFIHLHARCXSARRTGCJLGGAREO
ARK,ARKMGCWFYEHJFAVSGKEXVWBGGXZAVLZNBDNBZEXTQBKLKRPEYPEIEKFHUPNG
BITE,BITEOFQIWBJXQDVLDFRXYJGYNHGAXVBTCYDIMDLLECFFBEUOMOYKENNBXJCB
BURNER,BIWLXVCUXYLOQDANJVESJVABISGCNURGYTXMEJTCHBBOEMNZUJQKPPECMBDO
CAVIX,OLDZGVBURUJVZBSTWEBJGEPZNRDBTZMCNDVRBZEXBDYEKCJEYZQTDGLARWUO
CFB,CFBMEMZOIDEXQAUXYYSZIURADQLAPWPMNJXQSNVQZAHYVOPYUKKJBJUCTVJL
CODED,CODEDCGWIUUJJBHTXYQWAOKVKJMDBXHOKMNDVAHDUEDNSQKVYYJGLSDAYKHG
ENIGMA,SHRCVUQRMEVVIETHZZHUKOZJLHVBRZQYNPNWNHWZYCJNOMROJZWHXNWEXWEI
EXODUS,HASVHXZKVIHTFHEZUSZIIBPZFVHAGTANVXHBJNHMWCRQZYKULCUBLCTBPONO
FIXED,JSBLFIQGNWZALASSAHSTTCWUIKTACXHEPOMFQKQLQGUIQTSRAEYJZULEULTL
GARTH,PHOENIXCLQOBHDZCHJOCKCPZVTKALQBMXYOEDBUHSDCJRMTUCUBPLSUFNBIE
GENESIS,POCCZYCKTRQGHFIPWGSBLJTEQFDDVVBMNUHNCKMRACBGQOPBLURNRCBAFOBD
GRONK,ENTUBOJZTOCGVAKTSWSJIJWREQPCZBZTHDNXAYZBSEJGQREPPXZISWWGYTEG
HOME,MLLJLIRDKFAGJHUPTXKULZAMYGSDKTVZJBQICVZPKAAMJZEDCBPGSUJFZGMN
HOTEL1,OKYGZNAJGYHRXEUPJCQMOAYEPDVBGPQLDHYIXCDAXBJYMDNFMBKCIXIDNRZK
MATILDA,ZWQHZOEAWYKSGDPWWAQBAOKECCSASFCMLYZOJGBXNABXVZJZXKXOWRTFIQHC
PEPE,PEPELZBBACBJYFZRKGSOVDUWJURCDSKPNFAMXYZTQBGPAVJNTOVGSIBGTQWN
PORTAL,IQUGNVFDQSLTXFJSIOPPNPZINSCDQTJVJWGRPWRTFFXMXSJIAASXOBFFBERK
PUNKS,LUOBHDKFNKJWPDRLDGIEBMZWUXYBWSQEPXAZBGHRMAGELHYDOWAFMLGFUXUC
QCAP,QCAPWMYRSHLBJHSTTZQVCIBARVOASKDENASAKNOBRGPFWWKRCUVUAXYEZVOG
QCITY,CITYVPGKBCGXMETAEXELTJUNRMTCQRVXEKBIHNPXGFSZXVWEPIXICLHGVQGL
QCORE,NXKSLZWWMMNCACIVXRUEVWISCOYCYMTVJXVOITXKQGORXCEZVUDAFEMDURLF
QDOGE,QDOGEEESKYPAICECHEAHOXPULEOADTKGEJHAVYPFKHLEWGXXZQUGIGMBUTZE
QFOF,MBMOAANNZZIXHHFBYWEHUOUBISPCUPCJKIUWWZWNCBTCWRUVKRBEVFUFSNKD
QFRONT,ZROTZCHXDSSHFFEYDZPZNUXBUJLDHWHPBKNHEBADLARYDGHPOCTRAZYBCPPK
QFT,TFUYVBXYIYBVTEMJHAJGEJOOZHJBQFVQLTBBKMEHPEVIZFXZRPEYFUWGTIWG
QGOLD,QGRNNKNCTTKVBAACUANWEGRXGPGDOHXYZNMKGEUZSEXBNBBWUBJHAGDGWCSH
QHEART,SSGXSLSXFEJOOBTZWVDSRCEFGXNDYUVDXMQALXLBXGDCRXTKFZIOTGZFUNXO
QMINE,QMINEQQXYBEGBHNSUPOUYDIQKZPCBPQIIHUUZMCPLBPCCAIARVZBTYKGFCWM
QSILVER,EQZIDZELUKGHICLIEXLBMBMXRNPCXGEAZCGGSQCOFBRJJUOKUWBXDEZBGNKJ
QSMILE,LPWZCSEFJHYWFDTGVIFONWDHUGQBOPELDDNFDXYPMBVHFJFVZPLDBAFAOIJA
QST,QMHJNLMQRIBIREFIWVKYQELBFARBTDNYKIOBOFFYFGJYZSXJBVGBSUQGHSAM
QTC,YCNPBGPGMJYCWGBJKQWLNRNKKJMBKQORLRKOSFUOWAWNXJHBLGTGFRRELGEK
QTREAT,QDOGEEESKYPAICECHEAHOXPULEOADTKGEJHAVYPFKHLEWGXXZQUGIGMBUTZE
QUFC,UFCDHPDCLQOKLDUXWCRSDFPFWWSCELTUKDNINURNUFXEIAZRZXQBRCRCSYCN
QVERSAL,PXJSXWCPWKQGGHXHROMBLUCHJHLBOAHOKUCMJTUQXERSOMTPKRPQYOYBHUHO
QXMR,QXMRTKAIIGLUREPIQPCMHCKWSIPDTUYFCFNYXQLTECSUJVYEMMDELBMDOEYB
QXTRADE,QXTRMABNAJWNQBKYYNUNVYAJAQMDLIKOFXNGTRVYRDQMNZNNMZDGBDNGYMRM
SATOSHI,WZEQKJXIWECRGHSRJJDRGFREYMBCTKQGPWEYGLQMPGMKNRZNCZGPFGMCGANI
SMRT,ARKMGCWFYEHJFAVSGKEXVWBGGXZAVLZNBDNBZEXTQBKLKRPEYPEIEKFHUPNG
STATSY,MLLJLIRDKFAGJHUPTXKULZAMYGSDKTVZJBQICVZPKAAMJZEDCBPGSUJFZGMN
VIP,VDQOPFTANWHKGDTCLRHMMUNTTSCAOJFHTWPDYZPAVFTZGCCDIWQBYRQGIXCD
WP,MLMWPSQNVAIBRFDHWCKSFOVUAZDDWKJGCLRSYZIUEFDURPWIPQXACYOEPMLB`;

type AssetIssuerOption = {
  asset: string;
  issuer: string;
};

const ASSET_ISSUER_OPTIONS: AssetIssuerOption[] = ASSET_ISSUER_CSV.trim()
  .split("\n")
  .map((line) => {
    const [asset, issuer] = line.split(",");
    return {
      asset: normalizeAssetName(asset),
      issuer: normalizeIdentity(issuer),
    };
  })
  .filter((option) => option.asset && option.issuer);

const ASSET_TO_ISSUER = new Map(ASSET_ISSUER_OPTIONS.map((option) => [option.asset, option.issuer]));

interface CreateProposalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CreateProposalModal: React.FC<CreateProposalModalProps> = ({ open, onOpenChange }) => {
  const [issuer, setIssuer] = useState("");
  const [assetName, setAssetName] = useState<string>("");
  const [entryAmount, setEntryAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { handleSubmitProposal } = useSubmitTokenRaffleProposal();
  const { wallet } = useQubicConnect();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet || !issuer.trim() || !assetName.trim() || !entryAmount.trim()) return;

    setShowConfirmation(true);
  };

  const handleConfirmSubmission = async () => {
    setIsSubmitting(true);
    setShowConfirmation(false);

    try {
      const normalizedIssuer = normalizeIdentity(issuer);

      const submitted = await handleSubmitProposal(
        normalizedIssuer,
        assetName,
        parseInt(entryAmount),
      );
      if (submitted) {
        setIssuer("");
        setAssetName("");
        setEntryAmount("");
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Failed to submit proposal:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValidIssuer = (issuer: string) => {
    // Basic validation for Qubic identity format
    return issuer.length >= 60 && /^[A-Za-z0-9]+$/.test(issuer);
  };

  const isValidAssetName = (assetName: string) => {
    return ASSET_TO_ISSUER.has(normalizeAssetName(assetName));
  };

  const isValidEntryAmount = (entryAmount: string) => {
    const num = parseInt(entryAmount);
    return !isNaN(num) && num > 0;
  };

  const handleAssetChange = (nextAsset: string) => {
    const normalizedAsset = normalizeAssetName(nextAsset);
    const mappedIssuer = ASSET_TO_ISSUER.get(normalizedAsset) || "";
    setAssetName(normalizedAsset);
    setIssuer(mappedIssuer);
  };

  const formatWithCommas = (value: string) => {
    if (!value) return "";
    return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const handleEntryAmountChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "");
    const normalizedDigits = digitsOnly.replace(/^0+(?=\d)/, "");
    setEntryAmount(normalizedDigits);
  };

  const isFormValid = isValidIssuer(issuer) && isValidAssetName(assetName) && isValidEntryAmount(entryAmount) && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <div className="bg-primary/10 rounded-lg p-1.5">
              <Plus className="text-primary h-4 w-4" />
            </div>
            <span>Create Token Raffle Proposal</span>
          </DialogTitle>
          <DialogDescription>
            Submit a proposal for a new token raffle. The proposal will be voted on by DAO members.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 p-6 pt-0">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assetName" className="text-sm font-semibold">
                Asset Name
              </Label>
              <Select value={assetName} onValueChange={handleAssetChange}>
                <SelectTrigger id="assetName" className="h-10 w-full text-base font-medium">
                  <SelectValue placeholder="Select asset name..." />
                </SelectTrigger>
                <SelectContent className="border-border max-h-72 bg-card text-card-foreground shadow-xl">
                  {ASSET_ISSUER_OPTIONS.map((option) => (
                    <SelectItem key={option.asset} value={option.asset} className="bg-card text-card-foreground">
                      {option.asset}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {assetName && !isValidAssetName(assetName) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-destructive flex items-center space-x-2 text-sm"
                >
                  <AlertCircle className="h-4 w-4" />
                  <span>Please choose a valid asset from the list</span>
                </motion.div>
              )}
              {assetName && isValidAssetName(assetName) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-success flex items-center space-x-2 text-sm"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>Selected asset: {assetName}</span>
                </motion.div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="issuer" className="text-sm font-semibold">
                Token Issuer ID
              </Label>
              <div className="relative">
                <Input
                  id="issuer"
                  type="text"
                  value={issuer}
                  readOnly
                  placeholder="Auto-filled from selected asset"
                  className={`h-10 pr-10 text-base font-medium ${
                    issuer && !isValidIssuer(issuer) ? "border-destructive" : ""
                  }`}
                />
                <div className="absolute top-1/2 right-3 -translate-y-1/2">
                  <User className="text-muted-foreground h-4 w-4" />
                </div>
              </div>
              {issuer && !isValidIssuer(issuer) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-destructive flex items-center space-x-2 text-sm"
                >
                  <AlertCircle className="h-4 w-4" />
                  <span>Invalid issuer ID format</span>
                </motion.div>
              )}
              {issuer && isValidIssuer(issuer) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-success flex items-center space-x-2 text-sm"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>Valid issuer ID</span>
                </motion.div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="entryAmount" className="text-sm font-semibold">
                Entry Amount ({assetName})
              </Label>
              <div className="relative">
                <Input
                  id="entryAmount"
                  type="text"
                  inputMode="numeric"
                  value={formatWithCommas(entryAmount)}
                  onChange={(e) => handleEntryAmountChange(e.target.value)}
                  placeholder={`Enter entry amount in ${assetName}...`}
                  className={`h-10 pr-10 text-base font-medium ${
                    entryAmount && !isValidEntryAmount(entryAmount) ? "border-destructive" : ""
                  }`}
                />
                <div className="absolute top-1/2 right-3 -translate-y-1/2">
                  <Coins className="text-muted-foreground h-4 w-4" />
                </div>
              </div>
              {entryAmount && !isValidEntryAmount(entryAmount) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-destructive flex items-center space-x-2 text-sm"
                >
                  <AlertCircle className="h-4 w-4" />
                  <span>Entry amount must be a positive number</span>
                </motion.div>
              )}
              {entryAmount && isValidEntryAmount(entryAmount) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-success flex items-center space-x-2 text-sm"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>Valid entry amount</span>
                </motion.div>
              )}
            </div>
          </div>

          <div className="from-muted/30 to-muted/10 border-muted/50 rounded-lg border bg-gradient-to-r p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="text-muted-foreground mt-0.5 h-4 w-4" />
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm font-medium">Important Notes:</p>
                <ul className="text-muted-foreground space-y-1 text-xs">
                  <li>• Proposals will be voted on by registered DAO members</li>
                  <li>• Approved proposals become token raffles in the next epoch</li>
                  <li>• You must be registered in the DAO to submit proposals</li>
                  <li>• Choose asset names from the provided list</li>
                  <li>• Token issuer ID is auto-filled from selected asset</li>
                  <li>• Entry amount is the cost to participate in the token raffle</li>
                </ul>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                type="submit"
                disabled={!isFormValid}
                className="from-primary to-accent hover:from-primary/90 hover:to-accent/90 bg-gradient-to-r font-semibold shadow-lg disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Submit Proposal
                  </>
                )}
              </Button>
            </motion.div>
          </DialogFooter>
        </form>

        <DialogClose onClick={() => onOpenChange(false)} />
      </DialogContent>

      {/* Confirmation Modal */}
      <ConfirmationModal
        open={showConfirmation}
        onOpenChange={setShowConfirmation}
        onConfirm={handleConfirmSubmission}
        title="Confirm Proposal Submission"
        description="Please review the proposal details before submitting. This action will create a new token raffle proposal that DAO members can vote on."
        type="info"
        isLoading={isSubmitting}
        confirmText="Submit Proposal"
        cancelText="Review Details"
        details={[
          {
            label: "Token Issuer",
            value: truncateMiddle(issuer, 40),
            icon: <User className="text-muted-foreground h-4 w-4" />,
          },
          {
            label: "Asset Name",
            value: assetName,
            icon: <Hash className="text-muted-foreground h-4 w-4" />,
          },
          {
            label: "Entry Amount",
            value: `${parseInt(entryAmount).toLocaleString()} ${assetName}`,
            icon: <Coins className="text-muted-foreground h-4 w-4" />,
          },
        ]}
        warningMessage="Once submitted, this proposal cannot be modified. Make sure all details are correct before proceeding."
      />
    </Dialog>
  );
};

export default CreateProposalModal;
