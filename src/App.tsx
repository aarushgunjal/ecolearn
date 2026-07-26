import { Toaster } from "@/components/ui/toaster";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Scanner from "./pages/Scanner";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <main className="min-h-screen bg-background">
      <Scanner />
    </main>
    <Toaster />
  </QueryClientProvider>
);

export default App;
