import * as React from "react";

export function Separator({ className = "" }: { className?: string }) {
  return <div className={`h-px bg-gray-200 my-2 ${className}`} />;
}

export default Separator;

