
"use client";

import { useRef } from "react";
import { useCalendarCell } from "react-aria";
import { isSameDay, getDayOfWeek, today, getLocalTimeZone } from "@internationalized/date";
import { cn } from "@/lib/utils";

export function CalendarCell({ state, date }: any) {
  let ref = useRef(null);
  let {
    cellProps,
    buttonProps,
    isSelected,
    isOutsideVisibleRange,
    isSelectionStart,
    isSelectionEnd,
    formattedDate,
  } = useCalendarCell({ date }, state, ref);

  const isToday = isSameDay(date, today(getLocalTimeZone()));
  
  return (
    <td
      {...cellProps}
      className={cn("py-0.5", {
        "bg-violet-100 dark:bg-violet-900": isSelectionStart || isSelectionEnd,
        "rounded-l-full": isSelectionStart,
        "rounded-r-full": isSelectionEnd,
      })}
    >
      <div
        {...buttonProps}
        ref={ref}
        hidden={isOutsideVisibleRange}
        className={cn(
            "w-10 h-10 outline-none rounded-full flex items-center justify-center cursor-default",
            { "bg-violet-600 text-white font-bold": isSelected },
            { "text-gray-400": isOutsideVisibleRange },
            { "ring-2 ring-offset-2 ring-violet-600 dark:ring-violet-400": isToday },
            { "hover:bg-violet-200 dark:hover:bg-violet-800": !isSelected },
        )}
      >
        {formattedDate}
      </div>
    </td>
  );
}
