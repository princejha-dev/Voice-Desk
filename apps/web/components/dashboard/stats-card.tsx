import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, type LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  /** Numeric percentage change — renders an up/down arrow */
  change?: number;
  changeLabel?: string;
  /** Plain text shown below the value instead of a numeric change */
  subtitle?: string;
  /** Direction override for subtitle coloring */
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  iconColor?: string;
  className?: string;
}

export function StatsCard({
  title,
  value,
  change,
  changeLabel,
  subtitle,
  changeType = "neutral",
  icon: Icon,
  iconColor = "text-primary",
  className,
}: StatsCardProps) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {/* Numeric change */}
            {change !== undefined && (
              <div className="flex items-center gap-1">
                {isPositive ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                )}
                <span
                  className={cn(
                    "text-xs font-medium",
                    isPositive ? "text-emerald-600" : "text-red-500"
                  )}
                >
                  {isPositive ? "+" : ""}
                  {change}%
                </span>
                {changeLabel && (
                  <span className="text-xs text-muted-foreground">{changeLabel}</span>
                )}
              </div>
            )}
            {/* Plain subtitle */}
            {subtitle && change === undefined && (
              <p
                className={cn(
                  "text-xs",
                  changeType === "positive"
                    ? "text-emerald-600"
                    : changeType === "negative"
                    ? "text-red-500"
                    : "text-muted-foreground"
                )}
              >
                {subtitle}
              </p>
            )}
          </div>
          <div className={cn("rounded-xl p-2.5 bg-muted/50", iconColor)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
