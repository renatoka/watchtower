CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_uptime_checks_endpoint_timestamp
ON uptime_checks(endpoint_id, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_uptime_checks_timestamp_status
ON uptime_checks(timestamp DESC, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_endpoints_enabled_created
ON endpoints(enabled, created_at DESC) WHERE enabled = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_endpoints_tags_gin
ON endpoints USING gin(tags);

-- Performance: Add partial indexes for common filters
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_uptime_checks_recent
ON uptime_checks(endpoint_id, timestamp DESC)
WHERE timestamp >= NOW() - INTERVAL '7 days';

-- Stability: Add constraints for data integrity
ALTER TABLE endpoints ADD CONSTRAINT chk_check_interval_min CHECK (check_interval >= 5);
ALTER TABLE endpoints ADD CONSTRAINT chk_timeout_min CHECK (timeout >= 1);
ALTER TABLE endpoints ADD CONSTRAINT chk_expected_status_range CHECK (expected_status BETWEEN 100 AND 599);
ALTER TABLE uptime_checks ADD CONSTRAINT chk_response_time_positive CHECK (response_time >= 0);

-- Performance: Create materialized view for dashboard stats
CREATE MATERIALIZED VIEW IF NOT EXISTS endpoint_stats_24h AS
SELECT
    e.id as endpoint_id,
    e.name as endpoint_name,
    e.severity,
    e.enabled,
    COUNT(uc.id) as total_checks,
    COUNT(uc.id) FILTER (WHERE uc.status = 'UP') as successful_checks,
    COUNT(uc.id) FILTER (WHERE uc.status = 'DOWN') as failed_checks,
    ROUND(AVG(uc.response_time), 2) as avg_response_time,
    MAX(uc.timestamp) as last_check,
    CASE
        WHEN COUNT(uc.id) = 0 THEN 100.0
        ELSE ROUND((COUNT(uc.id) FILTER (WHERE uc.status = 'UP')::decimal / COUNT(uc.id)) * 100, 2)
    END as uptime_percentage
FROM endpoints e
LEFT JOIN uptime_checks uc ON e.id = uc.endpoint_id
    AND uc.timestamp >= NOW() - INTERVAL '24 hours'
WHERE e.enabled = true
GROUP BY e.id, e.name, e.severity, e.enabled;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_endpoint_stats_24h_endpoint_id
ON endpoint_stats_24h(endpoint_id);

-- Performance: Function to refresh stats efficiently
CREATE OR REPLACE FUNCTION refresh_endpoint_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY endpoint_stats_24h;
END;