
"use client";

import { useRef } from "react";
import { useLocale } from "react-aria";
import { useDateFieldState } from "react-stately";
import { useDateField } from "react-aria";
import { createCalendar } from "@internationalized/date";
import { DateSegment } from "./date-segment";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export function DateField(props: any) {
  let { locale } = useLocale();
  let state = useDateFieldState({
    ...props,
    locale,
    createCalendar,
  });

  let ref = useRef(null);
  let { fieldProps } = useDateField(props, state, ref);

  return (
    <Slot {...fieldProps} ref={ref}>
        <div className="flex">
            {state.segments.map((segment, i) => (
                <DateSegment key={i} segment={segment} state={state} />
            ))}
        </div>
    </Slot>
  );
}
