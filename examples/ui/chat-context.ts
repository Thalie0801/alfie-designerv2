import { createContext, useContext } from "react";

type Message = { text: string; quick?: string[] };

type ChatContextType = {
  chatId?: string;
  send: (text: string) => Promise<Message[]>;
};

export const ChatContext = createContext<ChatContextType>({
  send: async () => [],
});

export const useChat = () => useContext(ChatContext);
