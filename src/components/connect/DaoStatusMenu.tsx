import React, { useEffect, useRef, useState } from "react";
import { UserCheck, UserPlus, AlertCircle, CheckCircle, Zap, ChevronDown } from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { motion } from "framer-motion";
import { useQubicConnect } from "./QubicConnectContext";
import { useAllRegisters } from "@/hooks/useAllRegisters";
import { useRegisterInSystem } from "@/hooks/useRegisterInSystem";
import { useLogoutInSystem } from "@/hooks/useLogoutInSystem";
import { useTxMonitor } from "@/store/txMonitor";
import ConfirmationModal from "@/components/ConfirmationModal";
import {
  QRAFFLE_LOGOUT_FEE,
  QRAFFLE_REGISTER_AMOUNT,
  QRAFFLE_QXMR_REGISTER_AMOUNT,
  QRAFFLE_QXMR_LOGOUT_FEE,
} from "@/utils/constants";

const QXMR_ISSUER = "QXMRTKAIIGLUREPIQPCMHCKWSIPDTUYFCFNYXQLTECSUJVYEMMDELBMDOEYB";
const QXMR_ASSET_NAME = "QXMR";

const DaoStatusMenu: React.FC = () => {
  const { connected, wallet } = useQubicConnect();
  const { registers, refetch: refetchRegisters } = useAllRegisters();
  const { handleRegister } = useRegisterInSystem();
  const { handleLogout } = useLogoutInSystem();
  const { result } = useTxMonitor();

  const [isOpen, setIsOpen] = useState(false);
  const [registrationMethod, setRegistrationMethod] = useState<"QUBIC" | "QXMR">("QUBIC");
  const [showRegisterConfirm, setShowRegisterConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isRegistered = !!registers?.includes(wallet?.publicKey || "");

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (result) refetchRegisters();
  }, [result]);

  if (!connected || !wallet) return null;

  const handleRegisterConfirm = () => {
    setShowRegisterConfirm(false);
    setIsOpen(false);
    if (registrationMethod === "QXMR") {
      handleRegister({ withQXMR: true, qxmrIssuer: QXMR_ISSUER, qxmrAssetName: QXMR_ASSET_NAME });
    } else {
      handleRegister();
    }
  };

  const handleLogoutConfirm = () => {
    setShowLogoutConfirm(false);
    setIsOpen(false);
    handleLogout();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        className="flex items-center gap-1.5"
        onClick={() => setIsOpen((v) => !v)}
        type="button"
        aria-label={isRegistered ? "DAO: Registered" : "DAO: Not registered"}
        title={isRegistered ? "DAO: Registered" : "DAO: Not registered"}
      >
        {isRegistered ? (
          <UserCheck size={18} className="text-success" />
        ) : (
          <UserPlus size={18} className="text-warning" />
        )}
        <span
          className={`h-2 w-2 rounded-full ${isRegistered ? "bg-success" : "bg-warning"}`}
          aria-hidden="true"
        />
        <ChevronDown size={14} className={`opacity-60 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </Button>

      {isOpen && (
        <Card className="bg-background border-border absolute top-full right-0 z-50 mt-2 w-80 max-w-[calc(100vw-1rem)] border shadow-lg">
          <div className="flex max-h-[70vh] flex-col">
            <div className="border-border flex items-center gap-2 border-b p-4">
              <div className="bg-primary/10 rounded-lg p-1.5">
                <UserCheck className="text-primary h-4 w-4" />
              </div>
              <span className="text-base font-semibold">DAO Member Registration</span>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {!isRegistered ? (
                <>
                  <div className="from-warning/10 to-warning/5 border-warning/20 relative rounded-lg border bg-gradient-to-r p-4">
                    <div className="mb-2 flex items-center space-x-2">
                      <AlertCircle className="text-warning h-5 w-5" />
                      <span className="text-warning text-base font-semibold">Not Registered</span>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Register to participate in DAO governance and receive revenue share.
                    </p>
                    <div className="mt-3 grid gap-3">
                      <div className="text-foreground text-sm font-semibold">Registration Method</div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant={registrationMethod === "QUBIC" ? "default" : "outline"}
                          className="h-9 w-full"
                          onClick={() => setRegistrationMethod("QUBIC")}
                        >
                          Pay in QUBIC
                        </Button>
                        <Button
                          type="button"
                          variant={registrationMethod === "QXMR" ? "default" : "outline"}
                          className="h-9 w-full"
                          onClick={() => setRegistrationMethod("QXMR")}
                        >
                          Use QXMR
                        </Button>
                      </div>
                      {registrationMethod === "QUBIC" ? (
                        <div className="text-muted-foreground text-xs leading-relaxed">
                          Stake: {QRAFFLE_REGISTER_AMOUNT.toLocaleString()} QUBIC. Refunded on logout (minus a small
                          processing fee).
                        </div>
                      ) : (
                        <div className="text-muted-foreground text-xs leading-relaxed">
                          Stake: {QRAFFLE_QXMR_REGISTER_AMOUNT.toLocaleString()} QXMR share rights. Refunded on logout
                          (minus a small processing fee).
                        </div>
                      )}
                    </div>
                  </div>

                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      onClick={() => setShowRegisterConfirm(true)}
                      className="from-primary to-accent hover:from-primary/90 hover:to-accent/90 h-10 w-full bg-gradient-to-r text-base font-semibold shadow-lg"
                    >
                      <Zap className="mr-2 h-4 w-4" />
                      Register in DAO
                    </Button>
                  </motion.div>
                </>
              ) : (
                <>
                  <div className="from-success/10 to-success/5 border-success/20 relative rounded-lg border bg-gradient-to-r p-4">
                    <div className="mb-2 flex items-center space-x-2">
                      <CheckCircle className="text-success h-5 w-5" />
                      <span className="text-success text-base font-semibold">Registered</span>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      You are registered and can participate in all DAO activities.
                    </p>
                  </div>

                  <div className="text-muted-foreground text-sm leading-relaxed">
                    You will receive {QRAFFLE_REGISTER_AMOUNT.toLocaleString()} QUBIC(Or{" "}
                    {QRAFFLE_QXMR_REGISTER_AMOUNT.toLocaleString()} QXMR) back (minus a{" "}
                    {QRAFFLE_LOGOUT_FEE.toLocaleString()} QUBIC(Or {QRAFFLE_QXMR_LOGOUT_FEE.toLocaleString()} QXMR)
                    processing fee) upon logout.
                  </div>

                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      variant="destructive"
                      className="h-10 w-full text-base font-semibold shadow-lg"
                      onClick={() => setShowLogoutConfirm(true)}
                    >
                      <AlertCircle className="mr-2 h-4 w-4" />
                      Logout from DAO
                    </Button>
                  </motion.div>
                </>
              )}
            </div>
          </div>
        </Card>
      )}

      <ConfirmationModal
        open={showRegisterConfirm}
        onOpenChange={setShowRegisterConfirm}
        onConfirm={handleRegisterConfirm}
        title="Confirm DAO Registration"
        description="You are about to register in the Qraffle DAO. This will allow you to participate in governance, vote on proposals, and receive revenue share."
        type="info"
        confirmText="Register in DAO"
        cancelText="Cancel"
        warningMessage="You will be able to participate in all DAO activities after registration."
      />

      <ConfirmationModal
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        onConfirm={handleLogoutConfirm}
        title="Confirm DAO Logout"
        description="You are about to logout from the Qraffle DAO. This will remove your ability to participate in governance and receive revenue share, and a logout fee will apply."
        type="warning"
        confirmText="Logout from DAO"
        cancelText="Stay Registered"
      />
    </div>
  );
};

export default DaoStatusMenu;
