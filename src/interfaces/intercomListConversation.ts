import { IntercomConversation } from "./intercomConversation";

export interface IntercomListConversation {
  type: string;
  conversations: IntercomConversation[];
  pages: {
    next: string;
    page: number;
    per_page: number;
    total_pages: number;
    type: string;
  };
}
