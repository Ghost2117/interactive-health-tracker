"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExportButtonProps {
  href: string;
  filename: string;
}

export function ExportButton({ href, filename }: ExportButtonProps) {
  function handleClick() {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick}>
      <Download />
      Export CSV
    </Button>
  );
}
