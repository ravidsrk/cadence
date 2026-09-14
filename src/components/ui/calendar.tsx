import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";

function Calendar({
  className,
  classNames,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      weekStartsOn={0}
      className={cn("p-1", className)}
      classNames={{
        months: "flex flex-col",
        month: "space-y-3",
        month_caption: "flex items-center justify-center pt-1 relative h-9",
        caption_label: "text-sm font-medium",
        nav: "flex items-center justify-between absolute inset-x-0 top-1 px-1",
        button_previous:
          "size-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center justify-center",
        button_next:
          "size-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center justify-center",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "text-muted-foreground w-9 text-[0.7rem] font-medium text-center",
        week: "flex w-full mt-1",
        day: "size-9 p-0 text-center text-sm relative",
        day_button:
          "size-9 rounded-md p-0 font-normal hover:bg-muted aria-selected:bg-primary aria-selected:text-primary-foreground",
        selected: "rounded-md",
        today: "text-accent",
        outside: "text-muted-foreground/50",
        disabled: "text-muted-foreground/40 opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
  );
}

export { Calendar };
