import React from "react";
import { CheckCircle, Wallet, Trophy, Gift, Flame, Heart, TrendingUp, AlertCircle } from "lucide-react";
import { PageTransition, FadeInWhenVisible, StaggerChildren, StaggerItem } from "@/components/animations";
import SEO from "@/components/SEO";

const HowItWorks: React.FC = () => {
  const steps = [
    {
      icon: Wallet,
      title: "Connect Wallet",
      description: "Connect your Qubic wallet using WalletConnect to participate in raffles",
    },
    {
      icon: Trophy,
      title: "Choose Raffle",
      description: "Select from active raffles with different entry costs and prize pools",
    },
    {
      icon: Gift,
      title: "Enter Raffle",
      description: "Submit your entries - entries of each raffle can be changed by registers",
    },
    {
      icon: CheckCircle,
      title: "Win & Impact",
      description: "Win prizes while supporting charity and burning tokens automatically",
    },
  ];

  const features = [
    {
      icon: CheckCircle,
      title: "Provably Fair",
      description: "Verifiable, tamper-proof winner selection ensures complete fairness",
      color: "text-success-40 bg-success-90",
    },
    {
      icon: Flame,
      title: "Deflationary Burns",
      description: "5% of every raffle is automatically burned, reducing Qubic supply and benefiting all holders",
      color: "text-error-40 bg-error-90",
    },
    {
      icon: TrendingUp,
      title: "Dividend Rewards",
      description: "8% of proceeds distributed to shareholders, creating passive income opportunities",
      color: "text-success-40 bg-success-90",
    },
    {
      icon: Heart,
      title: "Qubic Charity Fund",
      description: "1% of all proceeds donated to the Qubic Charity Fund, making a positive real-world impact",
      color: "text-warning-40 bg-warning-90",
    },
  ];

  const howItWorksStructuredData = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to Participate in Qraffle",
    description: "Step-by-step guide to participating in fair and transparent Qubic raffles",
    image: "https://qraffle.com/how-it-works-image.jpg",
    totalTime: "PT5M",
    supply: [
      {
        "@type": "HowToSupply",
        name: "Qubic Wallet",
      },
    ],
    tool: [
      {
        "@type": "HowToTool",
        name: "WalletConnect",
      },
    ],
    step: [
      {
        "@type": "HowToStep",
        name: "Connect Wallet",
        text: "Connect your Qubic wallet using WalletConnect to participate in raffles",
      },
      {
        "@type": "HowToStep",
        name: "Choose Raffle",
        text: "Select from active raffles with different entry costs and prize pools",
      },
      {
        "@type": "HowToStep",
        name: "Enter Raffle",
        text: "Submit your entries - entries of each raffle can be changed by registers",
      },
      {
        "@type": "HowToStep",
        name: "Win & Impact",
        text: "Win prizes while supporting charity and burning tokens automatically",
      },
    ],
  };

  return (
    <>
      <SEO
        title="How Qraffle Works - Provably Fair Qubic Raffles Guide | Token Burning & DAO"
        description="Learn how Qraffle's provably fair system works with transparent winner selection, automatic token burning, charity donations, and DAO governance. Complete step-by-step guide."
        keywords="how qraffle works, provably fair, transparent selection, token burning guide, DAO governance, charity donations, fair raffles"
        url="/how-it-works"
        structuredData={howItWorksStructuredData}
      />
      <PageTransition className="px-4 py-8">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <FadeInWhenVisible delay={0.2}>
            <div className="mb-16 text-center">
              <h1 className="text-foreground mb-4 text-4xl font-bold">How Qraffle Works</h1>
              <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
                Transparent, fair, and beneficial for the entire Qubic ecosystem
              </p>
            </div>
          </FadeInWhenVisible>

          {/* Steps */}
          <div className="mb-16">
            <FadeInWhenVisible delay={0.4}>
              <h2 className="text-foreground mb-8 text-center text-2xl font-bold">Getting Started</h2>
            </FadeInWhenVisible>
            <StaggerChildren staggerDelay={0.2} className="grid gap-8 md:grid-cols-4">
              {steps.map((step, index) => (
                <StaggerItem key={index}>
                  <div className="transform text-center transition-all duration-300 hover:scale-105">
                    <div className="bg-primary-90 mx-auto mb-4 flex h-16 w-16 transform items-center justify-center rounded-full transition-all duration-300">
                      <step.icon className="text-primary-40 h-8 w-8" />
                    </div>
                    <div className="bg-primary-40 text-primary-foreground mx-auto mb-4 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
                      {index + 1}
                    </div>
                    <h3 className="text-foreground mb-2 font-semibold">{step.title}</h3>
                    <p className="text-muted-foreground text-sm">{step.description}</p>
                  </div>
                </StaggerItem>
              ))}
            </StaggerChildren>
          </div>

          {/* Features */}
          <div className="mb-16">
            <FadeInWhenVisible delay={0.6}>
              <h2 className="text-foreground mb-8 text-center text-2xl font-bold">Key Features</h2>
            </FadeInWhenVisible>
            <StaggerChildren staggerDelay={0.2} className="grid gap-6 md:grid-cols-2">
              {features.map((feature, index) => (
                <StaggerItem key={index}>
                  <div className="bg-background transform rounded-xl p-6 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl">
                    <div className="flex items-start space-x-4">
                      <div
                        className={`flex h-12 min-h-[3rem] w-12 min-w-[3rem] items-center justify-center overflow-hidden rounded-[9999px] ${feature.color} transform transition-all duration-300`}
                        style={{ aspectRatio: "1 / 1" }}
                      >
                        <feature.icon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-foreground mb-2 font-semibold">{feature.title}</h3>
                        <p className="text-muted-foreground text-sm">{feature.description}</p>
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerChildren>
          </div>

          {/* Distribution Logic */}
          <FadeInWhenVisible delay={0.8}>
            <div className="bg-background mb-16 rounded-xl p-8 shadow-lg">
              <h2 className="text-foreground mb-6 text-center text-2xl font-bold">Distribution Logic</h2>
              <p className="text-muted-foreground mb-6 text-center">
                Every raffle follows a transparent distribution model that benefits the entire ecosystem
              </p>

              <StaggerChildren staggerDelay={0.1} className="grid gap-6 md:grid-cols-3">
                <StaggerItem>
                  <div className="bg-success-90 transform rounded-lg p-4 text-center transition-all duration-300 hover:scale-105">
                    <div className="text-success-40 mb-2 text-2xl font-bold">80%</div>
                    <div className="text-foreground mb-1 text-sm font-medium">Prize Pool</div>
                    <div className="text-muted-foreground text-xs">Full prize amount to winner</div>
                  </div>
                </StaggerItem>
                <StaggerItem>
                  <div className="bg-error-90 transform rounded-lg p-4 text-center transition-all duration-300 hover:scale-105">
                    <div className="text-error-40 mb-2 text-2xl font-bold">5%</div>
                    <div className="text-foreground mb-1 text-sm font-medium">Token Burn</div>
                    <div className="text-muted-foreground text-xs">Permanently removed from supply</div>
                  </div>
                </StaggerItem>
                <StaggerItem>
                  <div className="bg-primary-90 transform rounded-lg p-4 text-center transition-all duration-300 hover:scale-105">
                    <div className="text-primary-40 mb-2 text-2xl font-bold">5%</div>
                    <div className="text-foreground mb-1 text-sm font-medium">DAO Registers</div>
                    <div className="text-muted-foreground text-xs">DAO registers revenue</div>
                  </div>
                </StaggerItem>
                <StaggerItem>
                  <div className="bg-success-90 transform rounded-lg p-4 text-center transition-all duration-300 hover:scale-105">
                    <div className="text-success-40 mb-2 text-2xl font-bold">8%</div>
                    <div className="text-foreground mb-1 text-sm font-medium">Shareholders</div>
                    <div className="text-muted-foreground text-xs">Shareholders dividend distribution</div>
                  </div>
                </StaggerItem>
                <StaggerItem>
                  <div className="bg-border transform rounded-lg p-4 text-center transition-all duration-300 hover:scale-105">
                    <div className="text-foreground mb-2 text-2xl font-bold">1%</div>
                    <div className="text-foreground mb-1 text-sm font-medium">Platform Fees</div>
                    <div className="text-muted-foreground text-xs">Platform operational costs</div>
                  </div>
                </StaggerItem>
                <StaggerItem>
                  <div className="bg-warning-90 transform rounded-lg p-4 text-center transition-all duration-300 hover:scale-105">
                    <div className="text-warning-40 mb-2 text-2xl font-bold">1%</div>
                    <div className="text-foreground mb-1 text-sm font-medium">Qubic Charity Fund</div>
                    <div className="text-muted-foreground text-xs">
                      Donated to{" "}
                      <a 
                        href="https://discord.com/channels/768887649540243497/1446203919209599199"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-warning-40 hover:underline"
                      >
                        Qubic Charity
                      </a>
                    </div>
                  </div>
                </StaggerItem>
              </StaggerChildren>
            </div>
          </FadeInWhenVisible>

          {/* Important Notice */}
          <FadeInWhenVisible delay={0.9}>
            <div className="from-warning/10 to-warning/5 border-warning/30 mx-auto mb-16 max-w-2xl rounded-xl border bg-gradient-to-r p-6">
              <div className="flex items-start space-x-4">
                <div className="bg-warning/20 rounded-full p-3">
                  <AlertCircle className="text-warning h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-foreground mb-2 text-lg font-bold">Important: Fair Play Rule</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    <span className="font-semibold">1 Wallet = 1 Entry per Raffle.</span> Each wallet address can only
                    participate once in each raffle to ensure fairness for all participants. Multiple entries from the same
                    wallet are not allowed.
                  </p>
                </div>
              </div>
            </div>
          </FadeInWhenVisible>

          {/* Example */}
          <FadeInWhenVisible delay={1.0}>
            <div className="bg-card mb-16 transform rounded-xl p-8 transition-all duration-300 hover:scale-105">
              <h2 className="mb-6 text-center text-2xl font-bold">Example Raffle</h2>
              <StaggerChildren staggerDelay={0.3} className="grid gap-8 md:grid-cols-2">
                <StaggerItem>
                  <div>
                    <h3 className="mb-4 font-semibold">Raffle Details</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Entry Cost:</span>
                        <span className="text-primary font-medium">10M QUBIC</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Entries Counts:</span>
                        <span className="text-primary font-medium">1,000</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Entry Amount:</span>
                        <span className="text-primary font-medium">10B QUBIC</span>
                      </div>
                    </div>
                  </div>
                </StaggerItem>
                <StaggerItem>
                  <div>
                    <h3 className="mb-4 font-semibold">Distribution</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Winner receives:</span>
                        <span className="text-primary font-medium">8B QUBIC</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Burned:</span>
                        <span className="text-primary font-medium">1B QUBIC</span>
                      </div>
                      <div className="flex justify-between">
                        <span>DAO Registers:</span>
                        <span className="text-primary font-medium">500M QUBIC</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Shareholders:</span>
                        <span className="text-primary font-medium">300M QUBIC</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Fees + Qubic Charity Fund:</span>
                        <span className="text-primary font-medium">200M QUBIC</span>
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              </StaggerChildren>
            </div>
          </FadeInWhenVisible>

          {/* FAQ */}
          <FadeInWhenVisible delay={1.2}>
            <div className="bg-card rounded-xl p-12 shadow-lg">
              <h2 className="text-foreground mb-6 text-center text-2xl font-bold">Frequently Asked Questions</h2>
              <StaggerChildren staggerDelay={0.2} className="space-y-6">
                <StaggerItem>
                  <div className="hover:bg-muted/20 -m-4 transform rounded-lg p-4 transition-all duration-300 hover:scale-105">
                    <h3 className="text-foreground mb-2 font-semibold">How is the winner selected?</h3>
                    <p className="text-muted-foreground text-sm">
                      Winners are selected using a provably fair selection process, ensuring completely fair and
                      verifiable results that cannot be manipulated.
                    </p>
                  </div>
                </StaggerItem>
                <StaggerItem>
                  <div className="hover:bg-muted/20 -m-4 transform rounded-lg p-4 transition-all duration-300 hover:scale-105">
                    <h3 className="text-foreground mb-2 font-semibold">Can I enter multiple times?</h3>
                    <p className="text-muted-foreground text-sm">
                      No. Each wallet address can only participate once per raffle to ensure fairness for all participants. This "1 wallet = 1 entry" rule prevents unfair advantages and ensures equal opportunities for everyone.
                    </p>
                  </div>
                </StaggerItem>
                <StaggerItem>
                  <div className="hover:bg-muted/20 -m-4 transform rounded-lg p-4 transition-all duration-300 hover:scale-105">
                    <h3 className="text-foreground mb-2 font-semibold">What happens to burned tokens?</h3>
                    <p className="text-muted-foreground text-sm">
                      Burned tokens are permanently removed from circulation, reducing the total supply and potentially
                      increasing the value of remaining tokens.
                    </p>
                  </div>
                </StaggerItem>
                <StaggerItem>
                  <div className="hover:bg-muted/20 -m-4 transform rounded-lg p-4 transition-all duration-300 hover:scale-105">
                    <h3 className="text-foreground mb-2 font-semibold">How do auto-reload raffles work?</h3>
                    <p className="text-muted-foreground text-sm">
                      Auto-reload raffles automatically restart with the same parameters once completed, ensuring
                      continuous opportunities to participate.
                    </p>
                  </div>
                </StaggerItem>
              </StaggerChildren>
            </div>
          </FadeInWhenVisible>
        </div>
      </PageTransition>
    </>
  );
};

export default HowItWorks;
