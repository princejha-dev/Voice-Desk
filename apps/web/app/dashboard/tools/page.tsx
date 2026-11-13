"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar, Ticket, Phone, BookOpen, CheckCircle2, XCircle, Clock,
  Wrench, ExternalLink, RefreshCw, AlertCircle, User,
} from "lucide-react";
import { useBookings, useTickets, useCallbacks } from "@/hooks/use-api";
import { toast } from "sonner";

export default function ToolsHubPage() {
  const [activeTab, setActiveTab] = useState("bookings");

  const { bookings, loading: bookingsLoading, refetch: refetchBookings, updateStatus: updateBooking } = useBookings();
  const { tickets, loading: ticketsLoading, refetch: refetchTickets, updateStatus: updateTicket } = useTickets();
  const { callbacks, loading: callbacksLoading, refetch: refetchCallbacks, updateStatus: updateCallback } = useCallbacks();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tools & Data Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Review appointments, support tickets, and callbacks created by your voice agents
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => {
            refetchBookings();
            refetchTickets();
            refetchCallbacks();
            toast.success("Refreshed tool records");
          }}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="bookings" className="gap-2">
            <Calendar className="h-4 w-4 text-violet-500" />
            Appointments ({bookings.length})
          </TabsTrigger>
          <TabsTrigger value="tickets" className="gap-2">
            <Ticket className="h-4 w-4 text-amber-500" />
            Tickets ({tickets.length})
          </TabsTrigger>
          <TabsTrigger value="callbacks" className="gap-2">
            <Phone className="h-4 w-4 text-emerald-500" />
            Callbacks ({callbacks.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Bookings Tab ──────────────────────────────────────────────────────── */}
        <TabsContent value="bookings" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Booked Appointments</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Generated via <code className="text-violet-600 bg-violet-50 px-1 py-0.5 rounded">book_appointment</code>
                </span>
              </CardTitle>
              <CardDescription>
                Customer appointments booked during live voice calls adhering to your agent&apos;s working hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              {bookingsLoading ? (
                <div className="space-y-2 py-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : bookings.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30 text-violet-500" />
                  <p className="font-medium text-sm">No appointments booked yet</p>
                  <p className="text-xs mt-1">
                    When callers schedule a time with an agent, their appointment will appear here.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Service / Notes</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bookings.map((b) => {
                        const status = (b.status as string) || "pending";
                        return (
                          <TableRow key={b.id as string}>
                            <TableCell className="font-medium">
                              <div>{b.customer_name as string}</div>
                              {b.customer_phone ? (
                                <div className="text-xs text-muted-foreground">{b.customer_phone as string}</div>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 text-sm">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                {b.booking_date as string} at {b.booking_time as string}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Duration: {b.duration_minutes as number || 30} mins
                              </div>
                            </TableCell>
                            <TableCell className="text-sm max-w-xs truncate">
                              {(b.notes as string) || "General Appointment"}
                            </TableCell>
                            <TableCell className="text-sm">
                              <Badge variant="secondary" className="font-normal text-xs">
                                {(b.agent_name as string) || "Voice Agent"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  status === "confirmed" ? "success" : status === "cancelled" ? "destructive" : "warning"
                                }
                              >
                                {status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              {status !== "confirmed" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-emerald-600 hover:text-emerald-700"
                                  onClick={() => {
                                    updateBooking(b.id as string, "confirmed");
                                    toast.success("Appointment confirmed");
                                  }}
                                >
                                  Confirm
                                </Button>
                              )}
                              {status !== "cancelled" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-red-500 hover:text-red-700"
                                  onClick={() => {
                                    updateBooking(b.id as string, "cancelled");
                                    toast.info("Appointment cancelled");
                                  }}
                                >
                                  Cancel
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Support Tickets Tab ──────────────────────────────────────────────── */}
        <TabsContent value="tickets" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Support Tickets</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Generated via <code className="text-amber-600 bg-amber-50 px-1 py-0.5 rounded">create_ticket</code>
                </span>
              </CardTitle>
              <CardDescription>
                Issues and requests logged by voice agents for human or engineering follow-up
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ticketsLoading ? (
                <div className="space-y-2 py-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : tickets.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Ticket className="h-10 w-10 mx-auto mb-3 opacity-30 text-amber-500" />
                  <p className="font-medium text-sm">No support tickets created</p>
                  <p className="text-xs mt-1">
                    When callers report technical or account issues, tickets will appear here.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject & Description</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tickets.map((t) => {
                        const status = (t.status as string) || "open";
                        const priority = (t.priority as string) || "medium";
                        return (
                          <TableRow key={t.id as string}>
                            <TableCell className="max-w-md">
                              <div className="font-medium text-sm">{t.subject as string}</div>
                              <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                {(t.description as string) || "—"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  priority === "high" || priority === "urgent" ? "destructive" : priority === "medium" ? "warning" : "secondary"
                                }
                              >
                                {priority}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              <div>{(t.customer_name as string) || "Anonymous"}</div>
                              <div className="text-xs text-muted-foreground">{(t.customer_contact as string) || "—"}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={status === "resolved" ? "success" : "info"}>
                                {status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {status !== "resolved" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-emerald-600 hover:text-emerald-700"
                                  onClick={() => {
                                    updateTicket(t.id as string, "resolved");
                                    toast.success("Ticket resolved");
                                  }}
                                >
                                  Resolve
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">Resolved</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Callbacks Tab ────────────────────────────────────────────────────── */}
        <TabsContent value="callbacks" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Callback Requests</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Generated via <code className="text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded">request_callback</code>
                </span>
              </CardTitle>
              <CardDescription>
                Callers who requested a phone callback from a human team member
              </CardDescription>
            </CardHeader>
            <CardContent>
              {callbacksLoading ? (
                <div className="space-y-2 py-4">
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : callbacks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Phone className="h-10 w-10 mx-auto mb-3 opacity-30 text-emerald-500" />
                  <p className="font-medium text-sm">No callback requests</p>
                  <p className="text-xs mt-1">
                    When an agent escalates to a human callback, the phone number will appear here.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Phone Number</TableHead>
                        <TableHead>Reason / Notes</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {callbacks.map((c) => {
                        const status = (c.status as string) || "pending";
                        return (
                          <TableRow key={c.id as string}>
                            <TableCell className="font-mono text-sm font-semibold">
                              {c.customer_phone as string}
                            </TableCell>
                            <TableCell className="text-sm">
                              {(c.reason as string) || "Customer requested callback"}
                            </TableCell>
                            <TableCell className="text-sm">
                              <Badge variant="secondary" className="font-normal text-xs">
                                {(c.agent_name as string) || "Voice Agent"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={status === "completed" ? "success" : "warning"}>
                                {status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {status !== "completed" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-emerald-600 hover:text-emerald-700"
                                  onClick={() => {
                                    updateCallback(c.id as string, "completed");
                                    toast.success("Callback marked completed");
                                  }}
                                >
                                  Complete
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">Done</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
