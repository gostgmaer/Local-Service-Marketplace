-- Migration: Add description column to disputes table
-- Allows users to provide a detailed description alongside the short reason category.

ALTER TABLE disputes ADD COLUMN IF NOT EXISTS description TEXT;
