"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Permission } from "@/utils/permissions";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useMessagingConnection } from "@/hooks/useMessagingSocket";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { usePresence } from "@/hooks/usePresence";
import { useIsMessagingEnabled } from "@/config/features";
import { ROUTES } from "@/config/constants";
import { Layout } from "@/components/layout/Layout";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Loading } from "@/components/ui/Loading";
import { SkeletonListItem } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { messageService, Conversation } from "@/services/message-service";
import { formatDateTime, formatRelativeTime, cn } from "@/utils/helpers";
import { Send, ArrowLeft, CheckCheck } from "lucide-react";

export default function MessagesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { can } = usePermissions();
  const messagingEnabled = useIsMessagingEnabled();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [showThread, setShowThread] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [activeReceiverId, setActiveReceiverId] = useState<string | null>(null);

  // Connect to /messaging namespace for typing & presence
  useMessagingConnection();

  // Typing indicator
  const { isOtherTyping, sendTyping } = useTypingIndicator(activeReceiverId);

  // Online presence
  const { isOnline, requestOnlineStatus } = usePresence();

  // Redirect if not authenticated, missing permission, or messaging is disabled
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(ROUTES.LOGIN);
    } else if (!authLoading && isAuthenticated && !can(Permission.MESSAGES_READ)) {
      router.push(ROUTES.DASHBOARD);
    } else if (!authLoading && isAuthenticated && !messagingEnabled) {
      router.push(ROUTES.DASHBOARD);
    }
  }, [isAuthenticated, authLoading, router, can]);

  useRealtimeList(["message:created"], ["conversations"]);
  useRealtimeList(["message:created"], ["messages", selectedJobId]);

  const {
    data: conversations,
    isLoading,
    error: conversationsError,
    refetch,
  } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => messageService.getConversations(),
    enabled: messagingEnabled && isAuthenticated,
  });

  const { data: messages } = useQuery({
    queryKey: ["messages", selectedJobId],
    queryFn: () => messageService.getMessagesByJob(selectedJobId!),
    enabled: !!selectedJobId && messagingEnabled && isAuthenticated,
  });

  // Derive the other participant for presence
  const selectedConversation = useMemo(
    () => conversations?.find((c: Conversation) => c.job_id === selectedJobId),
    [conversations, selectedJobId],
  );
  const receiverId = selectedConversation?.participant?.id ?? null;

  // Keep activeReceiverId in sync
  useEffect(() => {
    setActiveReceiverId(receiverId);
  }, [receiverId]);

  // Request presence for all conversation participants on load
  useEffect(() => {
    if (!conversations) return;
    const participantIds = conversations
      .map((c: Conversation) => c.participant?.id)
      .filter(Boolean) as string[];
    if (participantIds.length > 0) requestOnlineStatus(participantIds);
  }, [conversations, requestOnlineStatus]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedJobId) return;

    try {
      await messageService.sendMessage({
        job_id: selectedJobId,
        message: messageText,
      });
      setMessageText("");
      sendTyping(false);
      queryClient.invalidateQueries({ queryKey: ["messages", selectedJobId] });
    } catch (error) {
      console.error("Failed to send message");
    }
  };

  if (authLoading) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Layout>
      <div className="container-custom py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Messages
        </h1>

        {conversationsError ? (
          <ErrorState
            title="Failed to load messages"
            message="We couldn't load your conversations. Please try again."
            retry={() => refetch()}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[600px]">
            {/* Conversations List */}
            <Card
              className={cn(showThread ? "hidden md:flex md:flex-col" : "")}
            >
              <CardHeader>
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  Conversations
                </h2>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <SkeletonListItem key={i} />
                    ))}
                  </div>
                ) : conversations && conversations.length > 0 ? (
                  <div className="space-y-2">
                    {conversations.map((conv: Conversation) => (
                      <button
                        key={conv.job_id}
                        onClick={() => {
                          setSelectedJobId(conv.job_id);
                          setShowThread(true);
                        }}
                        className={`w-full text-left p-3 rounded-md transition-colors ${
                          selectedJobId === conv.job_id
                            ? "bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {conv.participant?.id && (
                              <span
                                className={`inline-block h-2.5 w-2.5 rounded-full ${isOnline(conv.participant.id) ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`}
                                title={isOnline(conv.participant.id) ? "Online" : "Offline"}
                              />
                            )}
                            <p className="font-medium text-gray-900 dark:text-white">
                              Job #{conv.job_id.slice(0, 8)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {conv.last_message_at && (
                              <span className="text-xs text-gray-400">{formatRelativeTime(conv.last_message_at)}</span>
                            )}
                            {!!conv.unread_count && conv.unread_count > 0 && (
                              <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-xs font-medium text-white bg-primary-600 rounded-full">{conv.unread_count}</span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                          {conv.last_message}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">
                    No conversations
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Messages */}
            <div
              className={cn(
                "md:col-span-2",
                !showThread ? "hidden md:block" : "",
              )}
            >
              <Card className="h-full flex flex-col">
                <CardHeader>
                  <button
                    onClick={() => setShowThread(false)}
                    className="md:hidden mb-2 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back to conversations
                  </button>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    {selectedJobId ? (
                      <span className="flex items-center gap-2">
                        {`Job #${selectedJobId.slice(0, 8)}`}
                        {receiverId && (
                          <span
                            className={`inline-block h-2.5 w-2.5 rounded-full ${isOnline(receiverId) ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`}
                            title={isOnline(receiverId) ? "Online" : "Offline"}
                          />
                        )}
                      </span>
                    ) : (
                      "Select a conversation"
                    )}
                  </h2>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  {selectedJobId ? (
                    <>
                      {/* Messages */}
                      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                        {messages?.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${message.sender_id === user?.id ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[70%] rounded-lg p-3 ${
                                message.sender_id === user?.id
                                  ? "bg-primary-600 text-white"
                                  : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                              }`}
                            >
                              <p className="text-sm">{message.message}</p>
                              <div
                                className={`flex items-center gap-1 mt-1 ${
                                  message.sender_id === user?.id
                                    ? "text-primary-100"
                                    : "text-gray-500 dark:text-gray-400"
                                }`}
                              >
                                <span className="text-xs">
                                  {formatDateTime(message.created_at)}
                                </span>
                                {message.sender_id === user?.id && message.read && (
                                  <CheckCheck className="h-3.5 w-3.5" />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Typing indicator */}
                      {isOtherTyping && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 italic mb-2">
                          typing...
                        </p>
                      )}

                      {/* Message Input */}
                      <form onSubmit={handleSendMessage} className="flex gap-2">
                        <Input
                          value={messageText}
                          onChange={(e) => {
                            setMessageText(e.target.value);
                            if (e.target.value.trim()) sendTyping(true);
                            else sendTyping(false);
                          }}
                          placeholder="Type a message..."
                          className="flex-1"
                        />
                        <Button type="submit" disabled={!messageText.trim()}>
                          <Send className="h-4 w-4" />
                        </Button>
                      </form>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500">
                      Select a conversation to start messaging
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
