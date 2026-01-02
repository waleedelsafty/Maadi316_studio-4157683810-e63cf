
"use client";

import { useRef } from "react";
import { useLocale } from "react-aria";
import { useCalendarState } from "react-stately";
import { useCalendar } from "react-aria";
import { createCalendar } from "@internationalized/date";
import { CalendarGrid } from "./calendar-grid";
import { Button } from "./button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

export function Calendar(props: any) {
  let { locale } = useLocale();
  let state = useCalendarState({
    ...props,
    locale,
    createCalendar,
  });

  let ref = useRef(null);
  let { calendarProps, prevButtonProps, nextButtonProps, title } = useCalendar(
    props,
    state,
  );

  return (
    <div {...calendarProps} ref={ref} className="inline-block text-gray-800 dark:text-gray-300">
      <div className="flex items-center pb-4">
        <h2 className="flex-1 font-bold text-xl ml-2">{title}</h2>
        <Button {...prevButtonProps} variant="ghost" size="icon">
            <ChevronLeftIcon className="w-6 h-6" />
        </Button>
        <Button {...nextButtonProps} variant="ghost" size="icon">
            <ChevronRightIcon className="w-6 h-6" />
        </Button>
      </div>
      <CalendarGrid state={state} />
    </div>
  );
}
