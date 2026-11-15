"use client";

import { useRouter } from "next/navigation";
import { switchUser } from "@/lib/demo/store";

export function TryAs() {
  const router = useRouter();
  const go = (id: string) => {
    switchUser(id);
    router.push("/jobs");
  };
  return (
    <p className="text-sm text-muted">
      Just looking? Try it as{" "}
      <button type="button" onClick={() => go("c-sarah")} className="min-h-11 font-semibold text-brand underline-offset-2 hover:underline">
        a sample customer
      </button>{" "}
      or{" "}
      <button type="button" onClick={() => go("t-dan")} className="min-h-11 font-semibold text-brand underline-offset-2 hover:underline">
        a sample plumber
      </button>
      .
    </p>
  );
}
