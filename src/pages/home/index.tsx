import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle, Flame, Heart, Trophy, TrendingUp, Users, Zap, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageTransition, FadeInWhenVisible, StaggerChildren, StaggerItem } from "@/components/animations";
import SEO from "@/components/SEO";
import { useQuery } from "@tanstack/react-query";
import { getAnalytics } from "@/services/sc.service";

const Home: React.FC = () => {
  const { data: analytics } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => getAnalytics(),
  });

  const formatNumber = (value: number) => value.toLocaleString();

  const stats = {
    totalBurned: analytics?.totalBurnAmount ?? 0,
    totalDividends: analytics?.totalShareholderAmount ?? 0,
    charityDonated: analytics?.totalCharityAmount ?? 0,
    activeRaffles: analytics?.numberOfActiveTokenRaffle ?? 0,
    registers: analytics?.numberOfRegisters ?? 0,
    totalRegisters: analytics?.totalRegisterAmount ?? 0,
  };

  const homeStructuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Qraffle",
    description:
      "Fair and transparent Qubic raffles with DAO governance, automatic token burning, and charity donations",
    url: "https://qraffle.com",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web Browser",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: {
      "@type": "Organization",
      name: "Qraffle",
      url: "https://qraffle.com",
    },
    featureList: [
      "Provably fair raffles with transparent winner selection",
      "Automatic token burning (5% of proceeds)",
      "DAO governance system",
      "Charity donations (1% of proceeds)",
      "Revenue sharing with registered members",
    ],
  };

  return (
    <>
      <SEO
        title="Qraffle - Fair & Transparent Qubic Raffles | DAO Governance & Token Burning"
        description="Join provably fair Qubic raffles with automatic token burning, charity donations, and DAO governance. 2.4B QUBIC burned, 1.8B dividends paid, supporting 15,400+ participants."
        keywords="qubic raffles, blockchain lottery, DAO governance, token burning, cryptocurrency, fair raffles, qubic blockchain, decentralized raffles"
        url="/"
        structuredData={homeStructuredData}
      />
      <PageTransition>
        {/* Hero Section */}
        <section className="relative px-4 py-20">
          <div className="mx-auto max-w-4xl text-center">
            <FadeInWhenVisible delay={0.2}>
              <h1 className="mb-6 text-6xl font-bold uppercase">
                Fair & Transparent
                <span className="text-primary bg-clip-text"> Raffles</span>
              </h1>
            </FadeInWhenVisible>

            <FadeInWhenVisible delay={0.4}>
              <p className="text-muted-foreground text-headline-small mx-auto mb-8 max-w-2xl uppercase">
                Dual raffle system with DAO governance. Standard QUBIC raffles with dynamic pricing + community-proposed
                token raffles. Built on Qubic's provably fair architecture.
              </p>
            </FadeInWhenVisible>

            <StaggerChildren staggerDelay={0.1} className="mb-8 flex flex-wrap justify-center gap-4 text-sm">
              <StaggerItem>
                <div className="bg-card flex items-center space-x-2 rounded-full px-4 py-2 shadow-md">
                  <CheckCircle className="text-success-40 h-4 w-4" />
                  <span>Epoch-Based</span>
                </div>
              </StaggerItem>
              <StaggerItem>
                <div className="bg-card flex items-center space-x-2 rounded-full px-4 py-2 shadow-md">
                  <Users className="text-primary-40 h-4 w-4" />
                  <span>DAO Governance</span>
                </div>
              </StaggerItem>
              <StaggerItem>
                <div className="bg-card flex items-center space-x-2 rounded-full px-4 py-2 shadow-md">
                  <Flame className="text-error-40 h-4 w-4" />
                  <span>20% Fee Distribution</span>
                </div>
              </StaggerItem>
              <StaggerItem>
                <div className="bg-card flex items-center space-x-2 rounded-full px-4 py-2 shadow-md">
                  <Heart className="text-primary-40 h-4 w-4" />
                  <span>Revenue Sharing</span>
                </div>
              </StaggerItem>
            </StaggerChildren>

            <FadeInWhenVisible delay={0.8}>
              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <Button asChild size="lg">
                  <Link to="/raffles">
                    <span>View Active Raffles</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/how-it-works">How It Works</Link>
                </Button>
              </div>
            </FadeInWhenVisible>
          </div>
        </section>

        {/* Stats Section */}
        <section className="rounded px-4 py-12">
          <div className="mx-auto max-w-7xl">
            <FadeInWhenVisible>
              <div className="mb-8 text-center">
                <h2 className="mb-4 text-3xl font-bold">Platform Impact</h2>
                <p className="text-muted-foreground">Real numbers showing our contribution to the Qubic ecosystem</p>
              </div>
            </FadeInWhenVisible>

            <StaggerChildren staggerDelay={0.1} className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <StaggerItem>
                <Card className="transform p-6 text-center transition-all duration-300 hover:scale-105 hover:shadow-lg">
                  <Flame className="text-error mx-auto mb-3 h-8 w-8" />
                  <div className="text-2xl font-bold">{formatNumber(stats.totalBurned)}</div>
                  <div className="text-muted-foreground text-sm">QU Burned</div>
                </Card>
              </StaggerItem>
              <StaggerItem>
                <Card className="transform p-6 text-center transition-all duration-300 hover:scale-105 hover:shadow-lg">
                  <TrendingUp className="text-success mx-auto mb-3 h-8 w-8" />
                  <div className="text-2xl font-bold">{formatNumber(stats.totalDividends)}</div>
                  <div className="text-muted-foreground text-sm">Dividends Paid</div>
                </Card>
              </StaggerItem>
              <StaggerItem>
                <Card className="transform p-6 text-center transition-all duration-300 hover:scale-105 hover:shadow-lg">
                  <Heart className="text-primary mx-auto mb-3 h-8 w-8" />
                  <div className="text-2xl font-bold">{formatNumber(stats.charityDonated)}</div>
                  <div className="text-muted-foreground text-sm">To Qubic Charity Fund</div>
                </Card>
              </StaggerItem>
              <StaggerItem>
                <Card className="transform p-6 text-center transition-all duration-300 hover:scale-105 hover:shadow-lg">
                  <Zap className="text-primary mx-auto mb-3 h-8 w-8" />
                  <div className="text-2xl font-bold">{formatNumber(stats.totalRegisters)}</div>
                  <div className="text-muted-foreground text-sm">To Registers</div>
                </Card>
              </StaggerItem>
              <StaggerItem>
                <Card className="transform p-6 text-center transition-all duration-300 hover:scale-105 hover:shadow-lg">
                  <Trophy className="text-warning mx-auto mb-3 h-8 w-8" />
                  <div className="text-2xl font-bold">{formatNumber(stats.activeRaffles)}</div>
                  <div className="text-muted-foreground text-sm">Active Raffles</div>
                </Card>
              </StaggerItem>
              <StaggerItem>
                <Card className="transform p-6 text-center transition-all duration-300 hover:scale-105 hover:shadow-lg">
                  <Users className="text-primary mx-auto mb-3 h-8 w-8" />
                  <div className="text-2xl font-bold">{formatNumber(stats.registers)}</div>
                  <div className="text-muted-foreground text-sm">Registers</div>
                </Card>
              </StaggerItem>
            </StaggerChildren>
          </div>
        </section>

        {/* Features Section */}
        <section className="bg-card mb-10 rounded px-4 py-16">
          <div className="mx-auto max-w-6xl">
            <FadeInWhenVisible>
              <div className="mb-12 text-center">
                <h2 className="mb-4 text-3xl font-bold">Why Choose Qraffle?</h2>
                <p className="text-muted-foreground mx-auto max-w-2xl">
                  Built on Qubic's infrastructure with transparency, fairness, and community impact at its core
                </p>
              </div>
            </FadeInWhenVisible>

            <StaggerChildren staggerDelay={0.15} className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              <StaggerItem>
                <div className="transform p-6 text-center transition-all duration-300 hover:scale-105">
                  <div className="bg-success-40/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                    <CheckCircle className="text-success-40 h-8 w-8" />
                  </div>
                  <h3 className="mb-2 font-semibold">Provably Fair</h3>
                  <p className="text-muted-foreground text-sm">
                    Verifiable, tamper-proof winner selection ensures complete fairness
                  </p>
                </div>
              </StaggerItem>

              <StaggerItem>
                <div className="transform p-6 text-center transition-all duration-300 hover:scale-105">
                  <div className="bg-error-40/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                    <Flame className="text-error-40 h-8 w-8" />
                  </div>
                  <h3 className="mb-2 font-semibold">Deflationary</h3>
                  <p className="text-muted-foreground text-sm">
                    5% of every raffle is automatically burned, reducing Qubic supply and benefiting holders
                  </p>
                </div>
              </StaggerItem>

              <StaggerItem>
                <div className="transform p-6 text-center transition-all duration-300 hover:scale-105">
                  <div className="bg-success-40/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                    <TrendingUp className="text-success-40 h-8 w-8" />
                  </div>
                  <h3 className="mb-2 font-semibold">Register Revenue</h3>
                  <p className="text-muted-foreground text-sm">
                    5% of proceeds distributed to registered DAO members, plus 8% to shareholders
                  </p>
                </div>
              </StaggerItem>

              <StaggerItem>
                <div className="transform p-6 text-center transition-all duration-300 hover:scale-105">
                  <div className="bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                    <Heart className="text-primary h-8 w-8" />
                  </div>
                  <h3 className="mb-2 font-semibold">Qubic Charity Fund</h3>
                  <p className="text-muted-foreground text-sm">
                    1% of all proceeds donated to the{" "}
                    <a 
                      href="https://discord.com/channels/768887649540243497/1446203919209599199"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium"
                    >
                      Qubic Charity Fund
                    </a>
                    , making a positive real-world impact
                  </p>
                </div>
              </StaggerItem>

              <StaggerItem>
                <div className="transform p-6 text-center transition-all duration-300 hover:scale-105">
                  <div className="bg-warning-40/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                    <Trophy className="text-warning-40 h-8 w-8" />
                  </div>
                  <h3 className="mb-2 font-semibold">Dual Raffle System</h3>
                  <p className="text-muted-foreground text-sm">
                    Standard QUBIC raffles with dynamic pricing + community-proposed token raffles
                  </p>
                </div>
              </StaggerItem>

              <StaggerItem>
                <div className="transform p-6 text-center transition-all duration-300 hover:scale-105">
                  <div className="bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                    <Users className="text-primary h-8 w-8" />
                  </div>
                  <h3 className="mb-2 font-semibold">DAO Governance</h3>
                  <p className="text-muted-foreground text-sm">
                    Register to vote on proposals, set entry amounts, and participate in system governance
                  </p>
                </div>
              </StaggerItem>
            </StaggerChildren>

            {/* Important Notice */}
            <FadeInWhenVisible delay={0.6}>
              <div className="from-warning/10 to-warning/5 border-warning/30 mx-auto mt-12 max-w-2xl rounded-xl border bg-gradient-to-r p-6">
                <div className="flex items-start space-x-4">
                  <div className="bg-warning/20 rounded-full p-3">
                    <AlertCircle className="text-warning h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-foreground mb-2 text-lg font-bold">Important: Fair Play Rule</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      <span className="font-semibold">1 Wallet = 1 Entry per Raffle.</span> Each wallet address can only
                      participate once in each raffle to ensure fairness for all participants. Multiple entries from the
                      same wallet are not allowed.
                    </p>
                  </div>
                </div>
              </div>
            </FadeInWhenVisible>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-primary rounded px-4 py-16">
          <FadeInWhenVisible delay={0.2}>
            <div className="mx-auto max-w-4xl text-center">
              <h2 className="text-primary-foreground mb-4 text-3xl font-bold">Ready to Start Winning?</h2>
              <p className="text-primary-foreground mx-auto mb-8 max-w-2xl">
                Join thousands of participants in fair, transparent raffles that benefit the entire Qubic ecosystem
              </p>
              <Button
                asChild
                variant="secondary"
                size="lg"
                className="transform transition-all duration-300 hover:scale-105"
              >
                <Link to="/raffles">
                  <span>View Active Raffles</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </FadeInWhenVisible>
        </section>
      </PageTransition>
    </>
  );
};

export default Home;
