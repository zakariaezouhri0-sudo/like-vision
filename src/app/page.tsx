"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Basic redirect for flow
    router.push("/login");
  }, [router]);

  return null;
}
