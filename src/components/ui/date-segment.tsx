
"use client";

import { useRef } from "react";
import { useDateSegment } from "react-aria";
import { cn } from "@/lib/utils";

export function DateSegment({ segment, state }: any) {
  let ref = useRef(null);
  let { segmentProps } = useDateSegment(segment, state, ref);

  return (
    <div
      {...segmentProps}
      ref={ref}
      style={{
        // @ts-ignore
        ...segmentProps.style,
      }}
      className={cn(
        "group box-content tabular-nums text-right outline-none rounded-sm focus:bg-violet-600 focus:text-white dark:focus:bg-violet-500 text-gray-800 dark:text-gray-300",
        { "text-gray-500": segment.isPlaceholder },
        "px-0.5"
      )}
    >
      {segment.text}
    </div>
  );
}
