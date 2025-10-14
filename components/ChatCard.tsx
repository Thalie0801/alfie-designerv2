"use client";
import ChatGenerator from "@/components/ChatGenerator";
import type { Brief } from "@/components/BriefExpress";

interface ChatCardProps {
  brief: Brief;
  brandName: string;
}

export default function ChatCard({ brief, brandName }: ChatCardProps) {
  return <ChatGenerator brief={brief} brandName={brandName} />;
}
