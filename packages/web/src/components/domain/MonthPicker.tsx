import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

const MONTH_NAMES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

function formatMonth(iso: string): string {
  const [yearStr, monthStr] = iso.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  return `${MONTH_NAMES[month]} ${year}`;
}

function addMonths(iso: string, delta: number): string {
  const [yearStr, monthStr] = iso.split('-');
  const date = new Date(Number(yearStr), Number(monthStr) - 1 + delta, 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getYear(iso: string): number {
  return Number(iso.split('-')[0]);
}

function getMonthIndex(iso: string): number {
  return Number(iso.split('-')[1]) - 1;
}

function buildIso(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

interface MonthGridProps {
  currentMonth: string;
  onSelect: (iso: string) => void;
  onClose: () => void;
}

function MonthGrid({ currentMonth, onSelect, onClose }: MonthGridProps) {
  const [viewYear, setViewYear] = useState(getYear(currentMonth));
  const activeMonth = getMonthIndex(currentMonth);
  const activeYear = getYear(currentMonth);

  function handleSelect(monthIndex: number) {
    onSelect(buildIso(viewYear, monthIndex));
    onClose();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setViewYear((y) => y - 1)}
          aria-label="Ano anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-semibold">{viewYear}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setViewYear((y) => y + 1)}
          aria-label="Proximo ano"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {MONTH_NAMES.map((name, index) => {
          const isActive = index === activeMonth && viewYear === activeYear;
          return (
            <button
              key={name}
              onClick={() => handleSelect(index)}
              className={cn(
                'rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                isActive && 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
              )}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MonthPicker() {
  const { currentMonth, setCurrentMonth } = useUiStore();
  const [open, setOpen] = useState(false);

  const label = formatMonth(currentMonth);

  function handlePrev() {
    setCurrentMonth(addMonths(currentMonth, -1));
  }

  function handleNext() {
    setCurrentMonth(addMonths(currentMonth, +1));
  }

  const trigger = (
    <button
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium',
        'hover:bg-accent hover:text-accent-foreground transition-colors',
        'border border-border',
      )}
    >
      <CalendarDays className="size-4 text-muted-foreground" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePrev}
        aria-label="Mes anterior"
        className="size-8"
      >
        <ChevronLeft className="size-4" />
      </Button>

      {/* Mobile: Sheet */}
      <div className="sm:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent side="bottom" className="px-6 pb-8">
            <SheetHeader className="mb-4">
              <SheetTitle>Selecionar competencia</SheetTitle>
            </SheetHeader>
            <MonthGrid
              currentMonth={currentMonth}
              onSelect={setCurrentMonth}
              onClose={() => setOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: Popover */}
      <div className="hidden sm:block">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="center">
            <MonthGrid
              currentMonth={currentMonth}
              onSelect={setCurrentMonth}
              onClose={() => setOpen(false)}
            />
          </PopoverContent>
        </Popover>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleNext}
        aria-label="Proximo mes"
        className="size-8"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
