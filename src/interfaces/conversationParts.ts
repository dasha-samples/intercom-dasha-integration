export interface ConversationParts {
  assigned_to: string;
  attachments: any[];
  author: {
    id: string;
    type: string;
  };
  body: string;
  created_at: number;
  external_id: string;
  id: string;
  notified_at: number;
  part_type: string;
  type: string;
  updated_at: number;
  redacted: boolean;
}
