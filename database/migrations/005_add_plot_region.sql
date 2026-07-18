-- Add an explicit administrative region for real dashboard filtering.
ALTER TABLE plots
    ADD COLUMN IF NOT EXISTS region VARCHAR(100);

CREATE INDEX IF NOT EXISTS ix_plots_region ON plots (region);
