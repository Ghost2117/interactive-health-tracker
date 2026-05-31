"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";
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
    toast.success(`${filename} downloaded`);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} aria-label={`Export ${filename}`}>
      <Download />
      Export CSV
    </Button>
  );
}
