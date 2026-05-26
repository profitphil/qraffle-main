import React from "react";
import { Link } from "react-router-dom";
import { Zap, Heart, Github, Twitter } from "lucide-react";
import pkg from "../../package.json";
import { motion } from "framer-motion";

const Footer: React.FC = () => {
  const getCurrentYear = () => {
    return new Date().getFullYear();
  };
  return (
    <footer className="border-border border-t">
      <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div className="grid gap-8 px-4 py-8 md:grid-cols-4">
          {/* Brand */}
          <div>
            <Link to="/" className="mb-4 transition-opacity hover:opacity-80">
              <motion.img
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
                src={"/qraffle-short.svg"}
                alt="Qraffle Logo"
                className="mb-4 h-6"
              />
            </Link>
            <div className="flex space-x-4">
              <a
                href="https://x.com/qraffle"
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a
                href="https://github.com/serendipity-seeker/qraffle"
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="mb-4 font-semibold">Navigation</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/raffles" className="text-muted-foreground hover:text-foreground transition-colors">
                  Active Raffles
                </Link>
              </li>
              <li>
                <Link to="/statistics" className="text-muted-foreground hover:text-foreground transition-colors">
                  Statistics
                </Link>
              </li>
              <li>
                <Link to="/how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
                  How It Works
                </Link>
              </li>
            </ul>
          </div>

          {/* Features */}
          <div>
            <h4 className="mb-4 font-semibold">Features</h4>
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li>Provably Fair</li>
              <li>Deflationary Burns</li>
              <li>Dividend Payments</li>
              <li>Charity Donations</li>
              <li>Auto-reload Raffles</li>
            </ul>
          </div>

          {/* Impact */}
          <div>
            <h4 className="mb-4 font-semibold">Our Impact</h4>
            <div className="space-y-3 text-sm">
              <div className="flex items-center space-x-2">
                <Heart className="text-error-40 h-4 w-4" />
                <span className="text-muted-foreground">1% to Charity</span>
              </div>
              <div className="flex items-center space-x-2">
                <Zap className="text-warning-40 h-4 w-4" />
                <span className="text-muted-foreground">5% Token Burns</span>
              </div>
              <div className="text-muted-foreground">
                Building a sustainable
                <br />
                Qubic ecosystem
              </div>
            </div>
          </div>
        </div>

        <div className="border-border mt-4 flex flex-col items-center justify-between border-t pt-4 md:flex-row">
          <div className="text-muted-foreground flex flex-1 items-center gap-2 text-sm">
            <img src="/qraffle-short.svg" alt="Qraffle Logo" className="h-4 w-auto" />
            <div className="text-muted-foreground">
              {"\u00A9"} {getCurrentYear()} Qraffle
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 text-sm md:flex-row">
            <a
              style={{ textDecoration: "none" }}
              className="font-space text-12 text-muted-foreground hover:text-foreground leading-12"
              target="_blank"
              rel="noreferrer"
              href="https://qubic.org/terms-of-service"
            >
              Terms of service
            </a>
            <span className="hidden text-gray-500">•</span>
            <a
              style={{ textDecoration: "none" }}
              className="font-space text-12 text-muted-foreground hover:text-foreground leading-12"
              target="_blank"
              rel="noreferrer"
              href="https://qubic.org/privacy-policy"
            >
              Privacy Policy
            </a>
            <span className="hidden text-gray-500">•</span>
            <a
              style={{ textDecoration: "none" }}
              className="font-space text-12 text-muted-foreground hover:text-foreground leading-12"
              target="_blank"
              rel="noreferrer"
              href="https://status.qubic.li/"
            >
              Network Status
            </a>
            <span className="text-12 text-gray-500">Version {pkg.version}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
