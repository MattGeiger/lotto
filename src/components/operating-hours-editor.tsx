"use client";

import React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DayOfWeek, OperatingHours } from "@/lib/state-types";

const DAYS: { value: DayOfWeek; label: string }[] = [
  { value: "sunday", label: "Sunday" },
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
];

type OperatingHoursEditorProps = {
  hours: OperatingHours;
  timezone: string;
  onChange: (hours: OperatingHours) => void;
  onTimezoneChange: (tz: string) => void;
  disabled?: boolean;
};

export function OperatingHoursEditor({
  hours,
  timezone,
  onChange,
  onTimezoneChange,
  disabled = false,
}: OperatingHoursEditorProps) {
  const handleDayToggle = (day: DayOfWeek, isOpen: boolean) => {
    onChange({
      ...hours,
      [day]: { ...hours[day], isOpen },
    });
  };

  const handleTimeChange = (day: DayOfWeek, field: "openTime" | "closeTime", value: string) => {
    onChange({
      ...hours,
      [day]: { ...hours[day], [field]: value },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <Label>Timezone</Label>
        <Select value={timezone} onValueChange={onTimezoneChange} disabled={disabled}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a timezone" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>North America</SelectLabel>
              <SelectItem value="America/New_York">Eastern Standard Time (EST)</SelectItem>
              <SelectItem value="America/Chicago">Central Standard Time (CST)</SelectItem>
              <SelectItem value="America/Denver">Mountain Standard Time (MST)</SelectItem>
              <SelectItem value="America/Los_Angeles">Pacific Standard Time (PST)</SelectItem>
              <SelectItem value="America/Anchorage">Alaska Standard Time (AKST)</SelectItem>
              <SelectItem value="Pacific/Honolulu">Hawaii Standard Time (HST)</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Europe & Africa</SelectLabel>
              <SelectItem value="Europe/London">Greenwich Mean Time (GMT)</SelectItem>
              <SelectItem value="Europe/Paris">Central European Time (CET)</SelectItem>
              <SelectItem value="Europe/Athens">Eastern European Time (EET)</SelectItem>
              <SelectItem value="Europe/Lisbon">Western European Summer Time (WEST)</SelectItem>
              <SelectItem value="Africa/Maputo">Central Africa Time (CAT)</SelectItem>
              <SelectItem value="Africa/Nairobi">East Africa Time (EAT)</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Asia</SelectLabel>
              <SelectItem value="Europe/Moscow">Moscow Time (MSK)</SelectItem>
              <SelectItem value="Asia/Kolkata">India Standard Time (IST)</SelectItem>
              <SelectItem value="Asia/Shanghai">China Standard Time (CST)</SelectItem>
              <SelectItem value="Asia/Tokyo">Japan Standard Time (JST)</SelectItem>
              <SelectItem value="Asia/Seoul">Korea Standard Time (KST)</SelectItem>
              <SelectItem value="Asia/Jakarta">Indonesia Central Standard Time (WITA)</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Australia & Pacific</SelectLabel>
              <SelectItem value="Australia/Perth">Australian Western Standard Time (AWST)</SelectItem>
              <SelectItem value="Australia/Adelaide">Australian Central Standard Time (ACST)</SelectItem>
              <SelectItem value="Australia/Sydney">Australian Eastern Standard Time (AEST)</SelectItem>
              <SelectItem value="Pacific/Auckland">New Zealand Standard Time (NZST)</SelectItem>
              <SelectItem value="Pacific/Fiji">Fiji Time (FJT)</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>South America</SelectLabel>
              <SelectItem value="America/Argentina/Buenos_Aires">Argentina Time (ART)</SelectItem>
              <SelectItem value="America/La_Paz">Bolivia Time (BOT)</SelectItem>
              <SelectItem value="America/Sao_Paulo">Brasilia Time (BRT)</SelectItem>
              <SelectItem value="America/Santiago">Chile Standard Time (CLT)</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-2 text-sm font-medium text-muted-foreground">
          <div className="px-2">Open</div>
          <div>Day</div>
          <div className="col-span-2">Hours</div>
        </div>

        {DAYS.map((day) => {
          const config = hours[day.value];
          return (
            <div
              key={day.value}
              className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-2 rounded-md border border-border bg-card p-2"
            >
              <Checkbox
                checked={config.isOpen}
                onCheckedChange={(checked) => handleDayToggle(day.value, Boolean(checked))}
                disabled={disabled}
                className="mx-2"
              />
              <div className="text-sm font-medium">{day.label}</div>
              {config.isOpen ? (
                <>
                  <Input
                    type="time"
                    step="1"
                    value={config.openTime}
                    onChange={(e) => handleTimeChange(day.value, "openTime", e.target.value)}
                    disabled={disabled}
                    className="h-9 text-xs bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                  />
                  <Input
                    type="time"
                    step="1"
                    value={config.closeTime}
                    onChange={(e) => handleTimeChange(day.value, "closeTime", e.target.value)}
                    disabled={disabled}
                    className="h-9 text-xs bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                  />
                </>
              ) : (
                <div className="col-span-2 text-sm text-muted-foreground">CLOSED</div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
