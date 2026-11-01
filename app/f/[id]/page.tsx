import { redirect } from "next/navigation";

// v2 single-model finding cards are retired; old share links land on the current results.
export default function RetiredFinding() {
  redirect("/results");
}
