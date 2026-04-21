"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeDetail } from "@/hooks/useRealtimeDetail";
import { Layout } from "@/components/layout/Layout";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loading } from "@/components/ui/Loading";
import { StatusBadge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { ProtectedRoute } from "@/components/shared/ProtectedRoute";
import { disputeService } from "@/services/dispute-service";
import { ROUTES } from "@/config/constants";
import { formatRelativeTime, formatDateTime } from "@/utils/helpers";
import {
  ArrowLeft,
  AlertTriangle,
  Briefcase,
  Calendar,
  User,
  CheckCircle,
  Clock,
  ImageIcon,
  MessageSquare,
  Send,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";

const STATUS_STEPS = ["open", "investigating", "escalated", "resolved", "closed"] as const;

const REASON_LABELS: Record<string, string> = {
  not_completed: "Work Not Completed",
  poor_quality: "Poor Quality Work",
  no_show: "Provider No-Show",
  overcharged: "Overcharged",
  damaged_property: "Property Damaged",
  safety_concern: "Safety Concern",
  fraud: "Fraud / Scam",
  other: "Other",
};

export default function DisputeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const disputeId = params.id as string;
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useRealtimeDetail(["dispute:updated", "dispute:message"], ["dispute", disputeId], disputeId);

  const {
    data: dispute,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["dispute", disputeId],
    queryFn: () => disputeService.getDisputeById(disputeId),
    enabled: isAuthenticated && !!disputeId,
  });

  const {
    data: messages = [],
    isLoading: messagesLoading,
  } = useQuery({
    queryKey: ["dispute-messages", disputeId],
    queryFn: () => disputeService.getDisputeMessages(disputeId),
    enabled: isAuthenticated && !!disputeId,
    refetchInterval: 30_000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: (text: string) =>
      disputeService.sendMessage(disputeId, text),
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["dispute-messages", disputeId] });
    },
  });

  // Scroll to bottom when messages load or new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (authLoading || isLoading) {
    return (
      <Layout>
        <div className="container-custom py-8">
          <Loading />
        </div>
      </Layout>
    );
  }

  if (error || !dispute) {
    return (
      <Layout>
        <div className="container-custom py-8">
          <ErrorState
            title="Dispute not found"
            message="We couldn't find this dispute or you don't have permission to view it."
            retry={() => router.push(ROUTES.DASHBOARD_DISPUTES)}
          />
        </div>
      </Layout>
    );
  }

  const currentStep = STATUS_STEPS.indexOf(dispute.status as any);
  const canSendMessage = dispute.status !== "resolved" && dispute.status !== "closed";

  return (
    <ProtectedRoute requiredPermissions={["disputes.read"]}>
      <Layout>
        <div className="container-custom py-8 max-w-3xl mx-auto">
          <Link
            href={ROUTES.DASHBOARD_DISPUTES}
            className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-6 text-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to My Disputes
          </Link>

          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Dispute #
                {dispute.display_id || dispute.id.slice(0, 8).toUpperCase()}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Filed {formatRelativeTime(dispute.created_at)}
              </p>
            </div>
            <StatusBadge status={dispute.status} />
          </div>

          {/* Progress Tracker */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                {STATUS_STEPS.map((s, i) => (
                  <div key={s} className="flex-1 flex flex-col items-center">
                    <div className="relative flex items-center w-full">
                      {i > 0 && (
                        <div
                          className={`flex-1 h-0.5 ${i <= currentStep ? "bg-primary-500" : "bg-gray-200 dark:bg-gray-700"}`}
                        />
                      )}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${
                          i < currentStep
                            ? "bg-primary-500 border-primary-500 text-white"
                            : i === currentStep
                              ? s === "escalated"
                                ? "bg-white dark:bg-gray-900 border-red-500 text-red-500"
                                : "bg-white dark:bg-gray-900 border-primary-500 text-primary-500"
                              : "bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-400"
                        }`}
                      >
                        {i < currentStep ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          <Clock className="h-4 w-4" />
                        )}
                      </div>
                      {i < STATUS_STEPS.length - 1 && (
                        <div
                          className={`flex-1 h-0.5 ${i < currentStep ? "bg-primary-500" : "bg-gray-200 dark:bg-gray-700"}`}
                        />
                      )}
                    </div>
                    <p
                      className={`text-xs mt-2 capitalize font-medium ${
                        i === currentStep && s === "escalated"
                          ? "text-red-600 dark:text-red-400"
                          : i <= currentStep
                            ? "text-primary-600 dark:text-primary-400"
                            : "text-gray-400"
                      }`}
                    >
                      {s}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6">
            {/* Dispute Details */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" /> Dispute
                  Details
                </h2>
              </CardHeader>
              <CardContent>
                <dl className="space-y-4">
                  <div className="flex items-start gap-3">
                    <dt className="w-32 text-sm font-medium text-gray-500 dark:text-gray-400 shrink-0">
                      Reason
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white font-medium">
                      {REASON_LABELS[dispute.reason] || dispute.reason}
                    </dd>
                  </div>
                  {dispute.description && (
                    <div className="flex items-start gap-3">
                      <dt className="w-32 text-sm font-medium text-gray-500 dark:text-gray-400 shrink-0">
                        Description
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white leading-relaxed">
                        {dispute.description}
                      </dd>
                    </div>
                  )}
                  {dispute.evidence_images && dispute.evidence_images.length > 0 && (
                    <div className="flex items-start gap-3">
                      <dt className="w-32 text-sm font-medium text-gray-500 dark:text-gray-400 shrink-0 flex items-center gap-1">
                        <ImageIcon className="h-4 w-4" />
                        Evidence
                      </dt>
                      <dd className="flex-1">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {dispute.evidence_images.map((img, idx) => (
                            <a
                              key={img.id || idx}
                              href={img.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={img.url}
                                alt={`Evidence ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </a>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {dispute.evidence_images.length} photo
                          {dispute.evidence_images.length !== 1 ? "s" : ""}{" "}
                          attached — click to view full size
                        </p>
                      </dd>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <dt className="w-32 text-sm font-medium text-gray-500 dark:text-gray-400 shrink-0">
                      Status
                    </dt>
                    <dd>
                      <StatusBadge status={dispute.status} />
                    </dd>
                  </div>
                  {dispute.created_at && (
                    <div className="flex items-center gap-3">
                      <dt className="w-32 text-sm font-medium text-gray-500 dark:text-gray-400 shrink-0">
                        Filed On
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        {formatRelativeTime(dispute.created_at)}
                      </dd>
                    </div>
                  )}
                  {dispute.updated_at && (
                    <div className="flex items-center gap-3">
                      <dt className="w-32 text-sm font-medium text-gray-500 dark:text-gray-400 shrink-0">
                        Last Updated
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {formatRelativeTime(dispute.updated_at)}
                      </dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>

            {/* Related Job */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary-500" /> Related Job
                </h2>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Job ID
                    </p>
                    <p className="text-gray-900 dark:text-white font-medium">
                      #
                      {dispute.job?.display_id ||
                        dispute.job_id.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      router.push(ROUTES.DASHBOARD_JOB_DETAIL(dispute.job_id))
                    }
                  >
                    View Job
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Investigation Thread */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary-500" />{" "}
                  Investigation Thread
                  {messages.length > 0 && (
                    <span className="ml-auto text-xs font-normal text-gray-500 dark:text-gray-400">
                      {messages.length} message{messages.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </h2>
              </CardHeader>
              <CardContent className="p-0">
                {/* Messages list */}
                <div className="max-h-96 overflow-y-auto px-6 py-4 space-y-4">
                  {messagesLoading ? (
                    <Loading />
                  ) : messages.length === 0 ? (
                    <p className="text-sm text-center text-gray-500 dark:text-gray-400 py-6">
                      No messages yet. Use the form below to communicate with our team.
                    </p>
                  ) : (
                    messages.map((msg) => {
                      const isOwn = msg.sender_id === user?.id;
                      const isAdmin = msg.is_admin;
                      return (
                        <div
                          key={msg.id}
                          className={`flex gap-3 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
                        >
                          {/* Avatar */}
                          <div
                            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                              isAdmin
                                ? "bg-primary-600"
                                : isOwn
                                  ? "bg-gray-700 dark:bg-gray-500"
                                  : "bg-gray-400 dark:bg-gray-600"
                            }`}
                          >
                            {isAdmin ? (
                              <ShieldCheck className="h-4 w-4" />
                            ) : (
                              <User className="h-4 w-4" />
                            )}
                          </div>

                          {/* Bubble */}
                          <div className={`max-w-xs lg:max-w-md ${isOwn ? "items-end" : "items-start"} flex flex-col gap-1`}>
                            {isAdmin && (
                              <span className="text-xs font-medium text-primary-600 dark:text-primary-400 flex items-center gap-1">
                                <ShieldCheck className="h-3 w-3" /> Support Team
                              </span>
                            )}
                            <div
                              className={`rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                                isOwn
                                  ? "bg-primary-600 text-white rounded-tr-sm"
                                  : isAdmin
                                    ? "bg-primary-50 dark:bg-primary-900/30 text-primary-900 dark:text-primary-100 border border-primary-200 dark:border-primary-800 rounded-tl-sm"
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-tl-sm"
                              }`}
                            >
                              {msg.message}
                            </div>
                            {/* Evidence images in message */}
                            {msg.images && msg.images.length > 0 && (
                              <div className="flex gap-1 flex-wrap mt-1">
                                {msg.images.map((img, idx) => (
                                  <a
                                    key={img.id || idx}
                                    href={img.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:opacity-90"
                                  >
                                    <Image
                                      src={img.url}
                                      alt={`Attachment ${idx + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </a>
                                ))}
                              </div>
                            )}
                            <span className="text-xs text-gray-400">
                              {formatRelativeTime(msg.created_at)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Send message */}
                {canSendMessage ? (
                  <div className="border-t border-gray-100 dark:border-gray-800 px-6 py-4">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!newMessage.trim()) return;
                        sendMessageMutation.mutate(newMessage.trim());
                      }}
                      className="flex gap-2"
                    >
                      <textarea
                        className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[40px] max-h-32"
                        rows={1}
                        placeholder="Add a message to the investigation thread…"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (newMessage.trim()) sendMessageMutation.mutate(newMessage.trim());
                          }
                        }}
                        disabled={sendMessageMutation.isPending}
                      />
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={!newMessage.trim() || sendMessageMutation.isPending}
                        className="self-end flex items-center gap-1"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {sendMessageMutation.isPending ? "Sending…" : "Send"}
                      </Button>
                    </form>
                    {sendMessageMutation.isError && (
                      <p className="text-xs text-red-500 mt-1">
                        Failed to send message. Please try again.
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Press Enter to send · Shift+Enter for new line
                    </p>
                  </div>
                ) : (
                  <div className="border-t border-gray-100 dark:border-gray-800 px-6 py-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      This dispute is {dispute.status} — the thread is now read-only.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resolution */}
            {(dispute.status === "resolved" || dispute.status === "closed") &&
              dispute.resolution && (
                <Card>
                  <CardHeader>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />{" "}
                      Resolution
                    </h2>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                        {dispute.resolution}
                      </p>
                      {dispute.resolved_at && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Resolved on {formatDateTime(dispute.resolved_at)}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

            {/* Open dispute info callout */}
            {dispute.status === "open" && (
              <Card className="border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-900/10">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                        Dispute Under Review
                      </p>
                      <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                        Our team will review this dispute within 2–3 business
                        days. Payment has been paused until this is resolved.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
 