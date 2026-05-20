-- Migration 052: Add app_url to integrations
-- Frontend URL of the external app. Used in dev mode to provide a one-click
-- "Open" button that authenticates the Protosphere user on the external app.

ALTER TABLE integrations ADD COLUMN app_url TEXT;
