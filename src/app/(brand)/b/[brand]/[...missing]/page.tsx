import { notFound } from "next/navigation";

// Any unknown URL on a brand domain renders the brand's own 404 (inside the brand layout) instead of the framework default.
export default function Missing() {
  notFound();
}
