-- Migration 034: allow empty content when message has attachments
ALTER TABLE messages DROP CONSTRAINT message_content_length;

ALTER TABLE messages ADD CONSTRAINT message_content_length
  CHECK (
    char_length(content) BETWEEN 0 AND 4000 AND
    (char_length(content) > 0 OR jsonb_array_length(attachments) > 0)
  );
