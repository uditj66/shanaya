import { redirect } from "next/navigation";

// The app address is for the Lumière team only: go straight to the dashboard (which asks for sign-in).
// Guests use the Lumière website itself.
export default function Home() {
  redirect("/dashboard");
}
