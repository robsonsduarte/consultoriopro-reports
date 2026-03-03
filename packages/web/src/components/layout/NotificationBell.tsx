import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useUnreadNotifications } from '@/hooks/useApi';
import { formatMonth } from '@/lib/format';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const { data, isLoading } = useUnreadNotifications();
  const totalUnread = data?.totalUnread ?? 0;
  const releases = data?.releases ?? [];

  function handleClick(profId: number, month: string) {
    setOpen(false);
    navigate(`/report/${profId}?month=${month}&tab=contestacao`);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative shrink-0"
          aria-label="Notificacoes"
        >
          <Bell className="size-5" />
          {totalUnread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4.5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-medium">Notificacoes</p>
          {totalUnread > 0 && (
            <p className="text-xs text-muted-foreground">
              {totalUnread} mensage{totalUnread === 1 ? 'm' : 'ns'} nao lida{totalUnread === 1 ? '' : 's'}
            </p>
          )}
        </div>

        <ScrollArea className={cn(releases.length > 4 && 'h-72')}>
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-md" />
              ))}
            </div>
          ) : releases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="mb-2 size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Nenhuma notificacao
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {releases.map((r) => (
                <button
                  key={r.releaseId}
                  type="button"
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                  onClick={() => handleClick(r.professionalId, r.month)}
                >
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MessageSquare className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">
                        {r.senderName}
                      </p>
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                        {r.unreadCount}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatMonth(r.month)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground/70">
                      {r.lastMessage}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
