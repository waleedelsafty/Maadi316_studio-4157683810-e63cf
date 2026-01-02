
"use client"

import * as React from "react"
import { useCalendar } from "react-aria"
import { useCalendarState } from "react-stately"
import { createCalendar, getLocalTimeZone } from "@internationalized/date"
import { useLocale } from "react-aria"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "./button"

const CalendarContext = React.createContext(null)

function Calendar(props: any) {
  const { locale } = useLocale()
  const state = useCalendarState({
    ...props,
    locale,
    createCalendar,
  })

  const ref = React.useRef(null)
  const { calendarProps, prevButtonProps, nextButtonProps, title } =
    useCalendar(props, state)

  return (
    <div
      {...calendarProps}
      ref={ref}
      className="space-y-4 rounded-lg bg-background p-3"
    >
      <div className="relative flex items-center justify-center">
        <h2 className="text-sm font-semibold">{title}</h2>
        <div className="flex items-center gap-1">
          <Button
            {...prevButtonProps}
            variant="outline"
            className="absolute left-1 h-7 w-7 rounded-full p-0"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            {...nextButtonProps}
            variant="outline"
            className="absolute right-1 h-7 w-7 rounded-full p-0"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <CalendarContext.Provider value={state as any}>
        <CalendarGrid />
      </CalendarContext.Provider>
    </div>
  )
}

Calendar.displayName = "Calendar"

function CalendarGrid() {
  const state = React.useContext(CalendarContext)
  const { locale } = useLocale()
  const { gridProps, headerProps, weekDays } = useCalendarGrid(
    {},
    state as any
  )

  const weeksInMonth = getWeeksInMonth(
    (state as any).visibleRange.start,
    locale
  )

  return (
    <table {...gridProps} className="w-full border-collapse space-y-1">
      <thead {...headerProps}>
        <tr className="flex">
          {weekDays.map((day, index) => (
            <th
              key={index}
              className="w-9 rounded-md text-[0.8rem] font-normal text-muted-foreground"
            >
              {day}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...Array.from({ length: weeksInMonth }).keys()].map((weekIndex) => (
          <tr key={weekIndex} className="mt-2 flex w-full">
            {(state as any)
              .getDatesInWeek(weekIndex)
              .map((date: any, i: any) =>
                date ? (
                  <CalendarCell key={i} date={date} />
                ) : (
                  <td key={i} />
                )
              )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CalendarCell({ date }: any) {
  const state = React.useContext(CalendarContext)
  const ref = React.useRef(null)
  const {
    cellProps,
    buttonProps,
    isSelected,
    isOutsideVisibleRange,
    isDisabled,
    formattedDate,
  } = useCalendarCell(
    {
      date,
    },
    state as any,
    ref
  )

  const isToday = (state as any).isToday(date)

  return (
    <td
      {...cellProps}
      className="relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent"
    >
      <Button
        {...buttonProps}
        ref={ref}
        variant="ghost"
        className={cn(
          "h-9 w-9 rounded-full p-0 font-normal",
          isToday && "bg-accent text-accent-foreground",
          isSelected &&
            "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
          isOutsideVisibleRange && "text-muted-foreground opacity-50",
          isDisabled && "text-muted-foreground opacity-50"
        )}
      >
        {formattedDate}
      </Button>
    </td>
  )
}

export { Calendar }
