import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Layout from "@/layout";
import Error404 from "@/pages/error404";
import Home from "@/pages/home";
import Raffles from "@/pages/raffles";
import Winners from "@/pages/winners";
import HowItWorks from "@/pages/how-it-works";
import Statistics from "./pages/statistics";
import RaffleDetailPage from "./pages/raffle";
import DAO from "./pages/dao";
import Participants from "./pages/participants";
import { QubicConnectProvider } from "./components/connect/QubicConnectContext";
import { WalletConnectProvider } from "./components/connect/WalletConnectContext";
import { Toaster } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 60s, so navigating between pages or
      // remounting components reuses the cache instead of refetching.
      staleTime: 60_000,
      // Don't refetch every query just because the tab regained focus —
      // this was the main source of redundant smart-contract/RPC calls.
      refetchOnWindowFocus: false,
    },
  },
});

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <Error404 />,
    children: [
      {
        path: "/",
        element: <Home />,
      },
      {
        path: "/raffles",
        element: <Raffles />,
      },
      {
        path: "/winners",
        element: <Winners />,
      },
      {
        path: "/how-it-works",
        element: <HowItWorks />,
      },
      {
        path: "/statistics",
        element: <Statistics />,
      },
      {
        path: "/raffle/:id",
        element: <RaffleDetailPage />,
      },
      {
        path: "/raffle/:id/:tokenRaffleIndex",
        element: <RaffleDetailPage />,
      },
      {
        path: "/dao",
        element: <DAO />,
      },
      {
        path: "/participants",
        element: <Participants />,
      },
      {
        path: "/404",
        element: <Error404 />,
      },
    ],
  },
]);

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <WalletConnectProvider>
          <QubicConnectProvider>
            <RouterProvider router={router} />
            <Toaster position="top-right" richColors closeButton swipeDirections={["right", "left"]} theme="dark" />
          </QubicConnectProvider>
        </WalletConnectProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
