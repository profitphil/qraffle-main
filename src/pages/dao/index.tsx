import React, { useEffect, useState } from "react";
import {
  Users,
  Vote,
  TrendingUp,
  Clock,
  CheckCircle,
  Check,
  AlertCircle,
  Coins,
  Zap,
  Shield,
  BarChart3,
  Activity,
  Plus,
  Hash,
  Package,
} from "lucide-react";
import { getTimeToNewEpoch } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PageTransition,
  FadeInWhenVisible,
  StaggerChildren,
  StaggerItem,
  AnimatedProgressBar,
} from "@/components/animations";
import { motion } from "framer-motion";
import SEO from "@/components/SEO";
import { useAtom } from "jotai";
import { tickInfoAtom } from "@/store/rpc";
import { useQubicConnect } from "@/components/connect/QubicConnectContext";
import { useAllRegisters } from "@/hooks/useAllRegisters";
import { useSubmitEntryAmount } from "@/hooks/useSubmitEntryAmount";
import { useVoteInProposal } from "@/hooks/useVoteInProposal";
import CreateProposalModal from "@/components/CreateProposalModal";
import ConfirmationModal from "@/components/ConfirmationModal";
import { useProposals } from "@/hooks/useProposals";
import { getAnalytics, getQuRaffleEntryAverageAmount } from "@/services/sc.service";
import { useQuRaffleEntryAmountPerUser } from "@/hooks/useQuRaffleEntryAmount";
import { useQuery } from "@tanstack/react-query";
import { useTxMonitor } from "@/store/txMonitor";

const RAFFLE_TABS = [
  { key: "qu", label: "Qu Raffle" },
  { key: "token", label: "Token Raffle" },
  { key: "bundle", label: "Bundle Raffle (Asset Raffle)" },
] as const;

type RaffleTabKey = (typeof RAFFLE_TABS)[number]["key"];

const DAO: React.FC = () => {
  const [activeRaffleTab, setActiveRaffleTab] = useState<RaffleTabKey>("qu");
  const [submittedEntryAmount] = useState<number | null>(null);
  const [entryAmountInput, setEntryAmountInput] = useState(1000000);
  const [timeLeft, setTimeLeft] = useState(getTimeToNewEpoch());
  const [isCreateProposalModalOpen, setIsCreateProposalModalOpen] = useState(false);
  const [entryAverageAmount, setEntryAverageAmount] = useState<number | null>(null);
  const [userVotesByProposalId, setUserVotesByProposalId] = useState<Record<number, boolean>>({});
  // Confirmation modal states
  const [showEntryAmountConfirm, setShowEntryAmountConfirm] = useState(false);
  const [showVoteConfirm, setShowVoteConfirm] = useState(false);
  const [voteData, setVoteData] = useState<{
    proposalId: number;
    vote: boolean;
    baseline?: { nYes: number; nNo: number };
  } | null>(null);
  const { handleSubmitEntryAmount } = useSubmitEntryAmount();
  const { handleVote } = useVoteInProposal();
  const { wallet } = useQubicConnect();
  const [tickInfo] = useAtom(tickInfoAtom);
  const { registers, refetch: refetchRegisters } = useAllRegisters();
  const isRegistered = registers?.includes(wallet?.publicKey || "");
  const { proposals, isLoading: isProposalsLoading, refetch: refetchProposals } = useProposals();

  const getVoteStorageKey = (publicKey: string) => `qraffle:dao:votes:${publicKey}`;

  useEffect(() => {
    if (!wallet?.publicKey) {
      setUserVotesByProposalId({});
      return;
    }
    if (typeof window === "undefined") return;

    try {
      const raw = localStorage.getItem(getVoteStorageKey(wallet.publicKey));
      if (!raw) {
        setUserVotesByProposalId({});
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      const normalized: Record<number, boolean> = {};
      for (const [key, value] of Object.entries(parsed)) {
        const id = Number(key);
        if (!Number.isNaN(id)) normalized[id] = value;
      }
      setUserVotesByProposalId(normalized);
    } catch {
      setUserVotesByProposalId({});
    }
  }, [wallet?.publicKey]);

  const { result } = useTxMonitor();

  const fetchEntryAverageAmount = async () => {
    const data = await getQuRaffleEntryAverageAmount();
    if (data) {
      setEntryAverageAmount(data.entryAverageAmount);
    }
  };

  useEffect(() => {
    if (result) {
      refetchProposals();
      refetchRegisters();
      fetchEntryAverageAmount();
    }
  }, [result]);

  useEffect(() => {
    if (wallet?.publicKey) {
      fetchEntryAverageAmount();
    }
  }, []);

  const { entryAmount } = useQuRaffleEntryAmountPerUser(wallet?.publicKey || "");

  // Confirmation handlers
  const handleEntryAmountConfirm = () => {
    setShowEntryAmountConfirm(false);
    handleSubmitEntryAmount(entryAmountInput);
  };

  const handleVoteConfirm = async () => {
    if (voteData) {
      setShowVoteConfirm(false);
      const { proposalId, vote, baseline } = voteData;

      await handleVote(proposalId, vote, () => {
        if (!wallet?.publicKey || typeof window === "undefined") return;

        setUserVotesByProposalId((prev) => {
          const next = { ...prev, [proposalId]: vote };
          try {
            localStorage.setItem(getVoteStorageKey(wallet.publicKey), JSON.stringify(next));
          } catch {
            // ignore persistence errors
          }
          return next;
        });
      }, baseline);

      setVoteData(null);
    }
  };

  const handleVoteClick = (proposalId: number, vote: boolean, baseline?: { nYes: number; nNo: number }) => {
    setVoteData({ proposalId, vote, baseline });
    setShowVoteConfirm(true);
  };

  const { data: analytics } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => getAnalytics(),
  });

  useEffect(() => {
    setTimeout(() => {
      setTimeLeft(getTimeToNewEpoch());
    }, 1000);
  }, [setTimeLeft]);

  const daoStructuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Qraffle DAO",
    description: "Decentralized Autonomous Organization governing the Qraffle platform",
    url: "https://qraffle.com/dao",
    foundingDate: "2024",
    memberOf: {
      "@type": "Organization",
      name: "Qubic Ecosystem",
    },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "DAO Membership Benefits",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Governance Voting Rights",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Revenue Share Distribution",
          },
        },
      ],
    },
  };

  return (
    <>
      <SEO
        title="Qraffle DAO - Governance & Revenue Sharing | Vote on Proposals"
        description="Join the Qraffle DAO to participate in governance, vote on token raffle proposals, submit entry amounts, and receive revenue share. 1,247 registered members earning rewards."
        keywords="qraffle DAO, governance, voting, revenue share, token proposals, qubic DAO, decentralized governance, blockchain voting"
        url="/dao"
        structuredData={daoStructuredData}
      />
      <PageTransition className="px-4 py-6">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <FadeInWhenVisible delay={0.2}>
            <div className="mb-8 text-center">
              <div className="relative">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="from-primary/10 to-accent/10 mb-6 inline-flex items-center space-x-2 rounded-full bg-gradient-to-r px-4 py-2"
                >
                  <Shield className="text-primary h-4 w-4" />
                  <span className="text-primary text-sm font-medium">Decentralized Governance</span>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="text-foreground from-foreground to-foreground/80 mb-4 bg-gradient-to-r bg-clip-text text-4xl font-bold"
                >
                  Qraffle DAO
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="text-muted-foreground mx-auto max-w-3xl text-base leading-relaxed"
                >
                  Join the Qraffle DAO to participate in governance, receive revenue share, and help shape the future of
                  the platform.
                  <br />
                  <span className="text-foreground font-medium">
                    Register to vote on proposals and submit entry amounts for standard raffles.
                  </span>
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mt-8 flex justify-center"
              >
                <Card className="from-card to-card/50 border-primary/20 transform bg-gradient-to-r p-4 shadow-lg transition-all duration-300 hover:scale-105">
                  <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
                    <div className="flex items-center space-x-3">
                      <div className="bg-primary/10 rounded-lg p-2">
                        <Clock className="text-primary h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-muted-foreground">Current Epoch</div>
                        <div className="text-foreground text-lg font-semibold">#{tickInfo.epoch}</div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="bg-accent/10 rounded-lg p-2">
                        <Activity className="text-accent h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-muted-foreground">Time Remaining</div>
                        <div className="text-foreground font-semibold">
                          {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="bg-success/10 rounded-lg p-2">
                        <Users className="text-success h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-muted-foreground">Total Registers</div>
                        <div className="text-foreground text-lg font-semibold">
                          {registers?.length?.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </div>
          </FadeInWhenVisible>

          {/* Revenue Stats Cards - Top Horizontal Layout */}
          <FadeInWhenVisible delay={0.4}>
            <div className="mx-auto mb-4 grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-3">
              <Card className="from-card to-card/80 border-primary/10 transform bg-gradient-to-br shadow-lg transition-all duration-300 hover:scale-105">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="bg-primary/10 rounded-lg p-2">
                        <TrendingUp className="text-primary h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-muted-foreground text-sm font-medium">Total Revenue Distributed</div>
                        <div className="text-foreground text-2xl font-bold">
                          {analytics?.totalRegisterAmount?.toLocaleString()}
                        </div>
                        <div className="text-muted-foreground text-sm font-medium">Total distibuted to Registers</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="from-card to-card/80 border-accent/10 transform bg-gradient-to-br shadow-lg transition-all duration-300 hover:scale-105">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="bg-accent/10 rounded-lg p-2">
                        <Users className="text-accent h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-muted-foreground text-sm font-medium">Your Revenue Share</div>
                        <div className="text-accent text-2xl font-bold">
                          {analytics?.totalRegisterAmount && analytics?.numberOfRegisters
                            ? Math.floor(analytics?.totalRegisterAmount / analytics?.numberOfRegisters).toLocaleString()
                            : "0"}
                        </div>
                        <div className="text-muted-foreground text-sm font-medium">
                          {isRegistered ? "Total Earned" : "Register to earn"}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="from-card to-card/80 border-success/10 transform bg-gradient-to-br shadow-lg transition-all duration-300 hover:scale-105">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="bg-success/10 rounded-lg p-2">
                        <BarChart3 className="text-success h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-muted-foreground text-sm font-medium">Revenue Distribution</div>
                        <div className="text-success text-2xl font-bold">
                          {(100 / (analytics?.numberOfRegisters || 1)).toFixed(2)}%
                        </div>
                        <div className="text-muted-foreground text-sm font-medium">of DAO dividends</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </FadeInWhenVisible>

          <FadeInWhenVisible delay={0.15}>
            {/* Raffle type folder tabs */}
            <div className="folder-tabs">
              {RAFFLE_TABS.map((tab) => {
                const active = activeRaffleTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveRaffleTab(tab.key)}
                    className={`folder-tab${active ? " folder-tab--active" : ""}`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {activeRaffleTab === "qu" && (
              <div className="grid gap-4">
                {/* Standard Qubic Raffle */}
                <Card className="border-card-border bg-card rounded-tl-none shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center space-x-2">
                      <div className="bg-primary/10 rounded-lg p-1.5">
                        <Coins className="text-primary h-4 w-4" />
                      </div>
                      <span className="text-lg">Standard Qubic Raffle</span>
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      For DAO Members: submit your suggested entry amount for the next epoch's standard raffle. The final amount will be
                      the average of all submissions.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="entry-amount" className="text-sm font-semibold">
                          Suggested Entry Amount (QUBIC)
                        </Label>
                        <div className="relative">
                          <Input
                            id="entry-amount"
                            type="number"
                            value={entryAmountInput}
                            onChange={(e) => setEntryAmountInput(parseInt(e.target.value) || 0)}
                            disabled={!isRegistered}
                            className="h-10 pr-10 text-base font-medium"
                            placeholder="Enter amount..."
                          />
                          <div className="absolute top-1/2 right-3 -translate-y-1/2">
                            <Coins className="text-muted-foreground h-4 w-4" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Current Average</Label>
                        <div className="border-input from-muted/50 to-muted/30 text-foreground relative flex h-10 items-center rounded-lg border bg-gradient-to-r px-3 py-2">
                          <div className="flex items-center space-x-2">
                            <div className="bg-accent/10 rounded p-1">
                              <TrendingUp className="text-accent h-4 w-4" />
                            </div>
                            <span className="text-base font-semibold">
                              {entryAverageAmount ? entryAverageAmount.toLocaleString() : "0"} QUBIC
                            </span>
                          </div>
                        </div>
                      </div>

                      {submittedEntryAmount && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="from-success/10 to-success/5 border-success/20 rounded-lg border bg-gradient-to-r p-3"
                        >
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="text-success h-4 w-4" />
                            <p className="text-success text-sm font-semibold">
                              ✓ Submitted: {submittedEntryAmount.toLocaleString()} QUBIC for next epoch
                            </p>
                          </div>
                        </motion.div>
                      )}

                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          onClick={() => setShowEntryAmountConfirm(true)}
                          disabled={!isRegistered || submittedEntryAmount !== null || entryAmount !== 0}
                          className="from-primary to-accent hover:from-primary/90 hover:to-accent/90 h-10 w-full bg-gradient-to-r text-base font-semibold shadow-lg disabled:opacity-50"
                        >
                          <Zap className="mr-2 h-4 w-4" />
                          {submittedEntryAmount ? "Already Submitted" : "Submit Entry Amount"}
                        </Button>
                      </motion.div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeRaffleTab === "token" && (
              <Card className="border-card-border bg-card rounded-tl-none shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <div className="bg-accent/10 rounded-lg p-1.5">
                          <Vote className="text-accent h-4 w-4" />
                        </div>
                        <span className="text-lg">Active Proposals ({proposals?.length})</span>
                      </CardTitle>
                      <CardDescription className="text-sm leading-relaxed">
                        Vote on token raffle proposals. Approved proposals will become token raffles in the next epoch.
                      </CardDescription>
                    </div>
                    {isRegistered && (
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          onClick={() => setIsCreateProposalModalOpen(true)}
                          className="from-primary to-accent hover:from-primary/90 hover:to-accent/90 bg-gradient-to-r font-semibold shadow-lg"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Create Proposal
                        </Button>
                      </motion.div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isProposalsLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      <p className="text-muted-foreground">Loading active proposals...</p>
                    </div>
                  ) : (
                    <StaggerChildren staggerDelay={0.1} className="grid gap-4">
                      {proposals && proposals.length > 0 ? (
                        proposals.map((proposal, idx) => (
                          <StaggerItem key={idx}>
                            <div
                              key={idx}
                              className="from-muted/30 to-muted/10 border-muted/50 hover:border-accent/30 rounded-lg border bg-gradient-to-r p-4 transition-all duration-300"
                            >
                              <div className="mb-4 flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="mb-2 flex items-center space-x-3">
                                    <h3 className="text-foreground text-xl font-bold">{proposal?.tokenName} Raffle</h3>
                                    <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-semibold">
                                      Active
                                    </span>
                                  </div>
                                  <div className="text-muted-foreground mb-3 flex items-center space-x-4 text-sm">
                                    <div className="flex items-center space-x-1">
                                      <Coins className="h-4 w-4" />
                                      <span>{proposal?.tokenName}</span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      <TrendingUp className="h-4 w-4" />
                                      <span>
                                        Entry: {proposal?.entryAmount?.toLocaleString()} {proposal?.tokenName}
                                      </span>
                                    </div>
                                  </div>
                                  <p className="text-muted-foreground text-xs">
                                    Proposed by:{" "}
                                    {"proposer" in proposal && proposal.proposer
                                      ? proposal.proposer.slice(0, 8)
                                      : "N/A"}
                                    ...
                                    {"proposer" in proposal && proposal.proposer
                                      ? proposal.proposer.slice(-8)
                                      : "N/A"}{" "}
                                  </p>
                                </div>
                              </div>

                              <div className="mb-6 space-y-4">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground font-medium">Voting Progress</span>
                                  <span className="text-foreground font-semibold">
                                    {proposal?.nYes} Yes • {proposal?.nNo} No
                                  </span>
                                </div>

                                <div className="space-y-2">
                                  <AnimatedProgressBar
                                    progress={
                                      typeof proposal?.nYes === "number" &&
                                      typeof proposal?.nNo === "number" &&
                                      proposal.nYes + proposal.nNo > 0
                                        ? (proposal.nYes / (proposal.nYes + proposal.nNo)) * 100
                                        : 0
                                    }
                                    className="bg-background h-3 w-full rounded-full shadow-inner"
                                    barClassName="bg-gradient-to-r from-success to-success/80 h-3 rounded-full shadow-sm"
                                  />
                                  <div className="flex justify-between text-sm">
                                    <span className="text-success font-semibold">
                                      {typeof proposal?.nYes === "number" &&
                                      typeof proposal?.nNo === "number" &&
                                      proposal.nYes + proposal.nNo > 0
                                        ? ((proposal.nYes / (proposal.nYes + proposal.nNo)) * 100).toFixed(1)
                                        : "0.0"}
                                      % Yes
                                    </span>
                                    <span className="text-muted-foreground">
                                      Total:{" "}
                                      {typeof proposal?.nYes === "number" && typeof proposal?.nNo === "number"
                                        ? proposal.nYes + proposal.nNo
                                        : 0}{" "}
                                      votes
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex space-x-3">
                                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                                  <Button
                                    disabled={!isRegistered}
                                    variant="default"
                                    className="hover:success h-11 w-full font-semibold shadow-lg"
                                    onClick={() =>
                                      handleVoteClick(proposal.id, true, {
                                        nYes: Number(proposal?.nYes || 0),
                                        nNo: Number(proposal?.nNo || 0),
                                      })
                                    }
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Vote Yes
                                    {userVotesByProposalId[proposal.id] === true && (
                                      <Check className="ml-2 h-4 w-4" />
                                    )}
                                  </Button>
                                </motion.div>
                                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                                  <Button
                                    disabled={!isRegistered}
                                    variant="destructive"
                                    className="h-11 w-full font-semibold shadow-lg"
                                    onClick={() =>
                                      handleVoteClick(proposal.id, false, {
                                        nYes: Number(proposal?.nYes || 0),
                                        nNo: Number(proposal?.nNo || 0),
                                      })
                                    }
                                  >
                                    <AlertCircle className="mr-2 h-4 w-4" />
                                    Vote No
                                    {userVotesByProposalId[proposal.id] === false && (
                                      <Check className="ml-2 h-4 w-4" />
                                    )}
                                  </Button>
                                </motion.div>
                              </div>
                            </div>
                          </StaggerItem>
                        ))
                      ) : (
                        <StaggerItem>
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col items-center justify-center px-6 py-12"
                          >
                            <div className="bg-muted/20 mb-4 rounded-full p-6">
                              <Hash className="text-muted-foreground h-12 w-12" />
                            </div>
                            <h3 className="text-foreground mb-2 text-xl font-semibold">No Active Proposals</h3>
                            <p className="text-muted-foreground max-w-md text-center text-sm">
                              There are currently no active proposals to vote on. Check back later or create a new
                              proposal to get started.
                            </p>
                          </motion.div>
                        </StaggerItem>
                      )}
                    </StaggerChildren>
                  )}

                  {!isRegistered && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="from-warning/10 to-warning/5 border-warning/20 mt-6 rounded-xl border bg-gradient-to-r p-4"
                    >
                      <div className="flex items-center space-x-3">
                        <AlertCircle className="text-warning h-5 w-5" />
                        <p className="text-warning font-semibold">Register to participate in voting on proposals</p>
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeRaffleTab === "bundle" && (
              <Card className="border-card-border bg-card rounded-tl-none shadow-lg">
                <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <div className="bg-muted/20 mb-4 rounded-full p-6">
                    <Package className="text-muted-foreground h-12 w-12" />
                  </div>
                  <h3 className="text-foreground mb-2 text-xl font-semibold">Bundle Raffle (Asset Raffle)</h3>
                  <p className="text-muted-foreground max-w-md text-sm">Coming soon.</p>
                </CardContent>
              </Card>
            )}
          </FadeInWhenVisible>
        </div>
      </PageTransition>

      {/* Create Proposal Modal */}
      <CreateProposalModal open={isCreateProposalModalOpen} onOpenChange={setIsCreateProposalModalOpen} />

      {/* Confirmation Modals */}
      <ConfirmationModal
        open={showEntryAmountConfirm}
        onOpenChange={setShowEntryAmountConfirm}
        onConfirm={handleEntryAmountConfirm}
        title="Confirm Entry Amount Submission"
        description="For DAO Members: you are about to submit your suggested entry amount for the next epoch's standard raffle. The final amount will be the average of all submissions."
        type="info"
        confirmText="Submit Entry Amount"
        cancelText="Review Amount"
        details={[
          {
            label: "Your Suggested Amount",
            value: `${entryAmountInput ? entryAmountInput.toLocaleString() : "0"} QUBIC`,
            icon: <Coins className="text-muted-foreground h-4 w-4" />,
          },
          {
            label: "Current Average",
            value: `${entryAverageAmount ? entryAverageAmount.toLocaleString() : "0"} QUBIC`,
            icon: <TrendingUp className="text-muted-foreground h-4 w-4" />,
          },
        ]}
        warningMessage="You can only submit one entry amount per epoch. Make sure your suggested amount is reasonable for the community."
      />

      <ConfirmationModal
        open={showVoteConfirm}
        onOpenChange={setShowVoteConfirm}
        onConfirm={handleVoteConfirm}
        title={`Confirm ${voteData?.vote ? "Yes" : "No"} Vote`}
        description={`You are about to vote ${voteData?.vote ? "YES" : "NO"} on this token raffle proposal. Your vote will be recorded and cannot be changed.`}
        type="info"
        confirmText={`Vote ${voteData?.vote ? "Yes" : "No"}`}
        cancelText="Review Proposal"
        details={
          voteData
            ? [
                {
                  label: "Proposal ID",
                  value: `#${voteData.proposalId}`,
                  icon: <Hash className="text-muted-foreground h-4 w-4" />,
                },
                {
                  label: "Your Vote",
                  value: voteData.vote ? "YES" : "NO",
                  icon: voteData.vote ? (
                    <CheckCircle className="text-success h-4 w-4" />
                  ) : (
                    <AlertCircle className="text-destructive h-4 w-4" />
                  ),
                },
              ]
            : []
        }
        warningMessage="Your vote is final and cannot be changed. Make sure you understand the proposal before voting."
      />
    </>
  );
};

export default DAO;
