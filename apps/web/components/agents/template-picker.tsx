"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import {
  Headphones,
  Calendar,
  ShoppingCart,
  Briefcase,
  type LucideIcon,
} from "lucide-react";

interface Template {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

const templates: Template[] = [
  {
    id: "customer_support",
    name: "Customer Support",
    description: "Answer questions using your knowledge base. Handle tickets and escalations.",
    icon: Headphones,
    color: "bg-indigo-50 text-indigo-600",
  },
  {
    id: "appointment_booking",
    name: "Appointment Booking",
    description: "Schedule and manage appointments. Check availability and send confirmations.",
    icon: Calendar,
    color: "bg-violet-50 text-violet-600",
  },
  {
    id: "sales_assistant",
    name: "Sales Assistant",
    description: "Qualify leads, answer product questions, and capture contact information.",
    icon: ShoppingCart,
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    id: "business_assistant",
    name: "Business Assistant",
    description: "General purpose receptionist. Routes calls and provides business information.",
    icon: Briefcase,
    color: "bg-amber-50 text-amber-600",
  },
];

interface TemplatePickerProps {
  selected: string | null;
  onSelect: (templateId: string) => void;
}

export function TemplatePicker({ selected, onSelect }: TemplatePickerProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {templates.map((template) => {
        const isSelected = selected === template.id;
        return (
          <Card
            key={template.id}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              isSelected
                ? "ring-2 ring-primary border-primary shadow-md"
                : "hover:border-primary/30"
            )}
            onClick={() => onSelect(template.id)}
          >
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", template.color)}>
                  <template.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">{template.name}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {template.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

