import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { motion } from "framer-motion";
import ConnectLink from "@/components/connect/ConnectLink";
import DaoStatusMenu from "@/components/connect/DaoStatusMenu";

const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navigation = [
    { name: "Home", href: "/" },
    { name: "Raffles", href: "/raffles" },
    { name: "Raffles History", href: "/winners" },
    { name: "DAO", href: "/dao" },
    { name: "Statistics", href: "/statistics" },
    { name: "How It Works", href: "/how-it-works" },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-background border-border sticky top-0 z-50 border-b">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="transition-opacity hover:opacity-80">
            <motion.img
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
              src={"/qraffle.svg"}
              alt="Qraffle - Fair & Transparent Qubic Raffles"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden space-x-8 md:flex">
            {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`px-1 text-sm font-medium transition-colors ${
                    isActive(item.href) ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  style={{ borderRadius: 0, background: "none" }}
                >
                  {item.name}
                </Link>
            ))}
          </nav>

          {/* DAO status + Wallet Button */}
          <div className="flex items-center gap-2">
            <DaoStatusMenu />
            <ConnectLink darkMode={true} />
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-2 md:hidden"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="border-border bg-background border-t py-4 md:hidden">
            <div className="space-y-2">
              {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block rounded-md px-3 py-2 text-base font-medium transition-colors ${
                      isActive(item.href)
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {item.name}
                  </Link>
                ))}
              <ConnectLink darkMode={true} />
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
