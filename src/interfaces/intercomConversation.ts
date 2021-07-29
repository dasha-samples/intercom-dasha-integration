import { ConversationParts } from "./conversationParts";

export interface IntercomConversation {
  type: string;
  id: string;
  created_at: number;
  updated_at: number;
  source: {
    attachments: any[];
    author: {
      id: string;
      type: string;
    };
    body: string;
    delivered_as: string;
    id: string;
    subject: string;
    type: string;
    url: string;
    redacted: boolean;
  };
  contacts: {
    id: string;
    type: string;
  }[];
  teammates: {
    id: string;
    type: string;
    name: string;
    email: string;
  }[];
  admin_assignee_id: string;
  team_assignee_id: string;
  custom_attributes: {
    issue_type: string;
    priority: string;
  };
  open: boolean;
  state: string;
  read: boolean;
  waiting_since: number;
  snoozed_until: number;
  tags: {
    tags: any[];
    type: string;
  };
  first_contact_reply: {
    created_at: number;
    type: string;
    url: string;
  };
  priority: string;
  sla_applied: {
    sla_name: string;
    sla_status: string;
  };
  conversation_rating: {
    created_at: number;
    contact: {
      id: string;
      type: string;
    };
    rating: any;
    remark: any;
    teammate: {
      id: string;
      type: string;
      name: string;
      email: string;
    };
  };
  statistics: {
    time_to_assignment: number;
    time_to_admin_reply: number;
    time_to_first_close: number;
    time_to_last_close: number;
    median_time_to_reply: number;
    first_contacat_reply_at: number;
    first_assignment_at: number;
    first_admin_reply_at: number;
    first_close_at: number;
    last_assignment_at: number;
    last_assignment_admin_reply_at: number;
    last_contact_reply_at: number;
    last_admin_reply_at: number;
    last_close_at: number;
    last_closed_by: {
      type: string;
      id: string;
      name: string;
      email: string;
    };
    count_reopens: number;
    count_assignments: number;
    count_conversation_parts: number;
  };
  conversation_parts: {
    conversation_parts: ConversationParts[];
    total_count: number;
    type: string;
  };
}
