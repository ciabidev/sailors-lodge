import { ExternalLink } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const ExternalAnchor = React.forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement>
>(({ className, children, ...props }, ref) => (
  <a
    ref={ref}
    target="_blank"
    rel="noreferrer"
    className={cn(
      "font-medium text-[#8caaee] underline decoration-[#8caaee]/40 underline-offset-4 hover:text-[#babbf1]",
      className,
    )}
    {...props}
  >
    {children}
    <ExternalLink className="ml-1 inline size-3.5" aria-hidden="true" />
  </a>
));
ExternalAnchor.displayName = "ExternalAnchor";
