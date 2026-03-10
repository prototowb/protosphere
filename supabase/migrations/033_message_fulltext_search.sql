-- Migration 033: Full-text search on messages via tsvector

ALTER TABLE messages
  ADD COLUMN search_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;

CREATE INDEX messages_search_tsv_idx ON messages USING GIN (search_tsv);
