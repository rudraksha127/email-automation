import { redirect } from "next/navigation";
import { paths } from "@/routes/paths";

/** The app root sends visitors to the dashboard (guards redirect to /login if unauthenticated). */
export default function Home() {
  redirect(paths.dashboard);
}
