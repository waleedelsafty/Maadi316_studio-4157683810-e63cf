
"use client";

import { useRef } from "react";
import { useLocale, useDatePicker } from "react-aria";
import { useDatePickerState } from "react-stately";
import { DateField } from "./date-field";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Calendar } from "./calendar-react-aria";
import { Button } from "./button";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { type CalendarDate } from "@internationalized/date";

export function DatePicker({
  value,
  onChange,
  ...props
}: {
  value: CalendarDate | null;
  onChange: (date: CalendarDate) => void;
  [key: string]: any;
}) {
  let { locale } = useLocale();
  let state = useDatePickerState({
    ...props,
    value,
    onChange,
    locale,
    shouldCloseOnSelect: true,
  });
  let ref = useRef(null);
  let {
    groupProps,
    labelProps,
    fieldProps,
    buttonProps: ariaButtonProps, // rename to avoid conflict
    dialogProps,
    calendarProps,
  } = useDatePicker(props, state, ref);


  return (
    <div className="relative inline-flex flex-col text-left w-full">
      {props.label && (
        <span
          {...labelProps}
          className="text-sm text-gray-800 dark:text-gray-300"
        >
          {props.label}
        </span>
      )}
      <Popover open={state.isOpen} onOpenChange={state.setOpen}>
        <div {...groupProps} ref={ref} className="flex group w-full">
            <div className="flex items-center bg-white dark:bg-gray-900 border border-input group-hover:border-primary/50 transition-colors rounded-md group-focus-within:border-primary group-focus-within:ring-2 group-focus-within:ring-ring group-focus-within:ring-offset-2 p-1 relative w-full">
                <PopoverTrigger asChild>
                    <div className="flex-1">
                        <DateField {...fieldProps} />
                    </div>
                </PopoverTrigger>
                <div
                    className={cn(
                    "absolute right-10 inset-y-0 flex items-center",
                    state.validationState === "invalid" ? "text-red-500" : ""
                    )}
                >
                    {state.validationState === "invalid" && (
                    <span aria-hidden="true">🚫</span>
                    )}
                </div>
                 <Button
                    {...ariaButtonProps}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-full w-8 h-8 hover:bg-accent"
                    onClick={() => state.setOpen(true)}
                >
                    <CalendarIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </Button>
            </div>
        </div>
        <PopoverContent className="w-auto p-0">
          <div {...dialogProps}>
            <Calendar {...calendarProps} />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
