import App from "@/App";
import { AppProvider } from "@/context/AppContext";
export default function AccountDashboard({ uid }: { uid: string }) {
  return <AppProvider uid={uid}><App /></AppProvider>;
}
