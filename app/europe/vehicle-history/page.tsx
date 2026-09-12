import type { Metadata } from "next";
import VehicleHistoryCheck from "./VehicleHistoryCheck";

export const metadata: Metadata = {
  title: "Vérifier l’historique d’un véhicule | SwitchApp Europe",
  description: "Préparez la vérification d’un véhicule français ou importé à partir de son immatriculation ou de son VIN.",
};

export default function VehicleHistoryPage() {
  return <VehicleHistoryCheck />;
}
