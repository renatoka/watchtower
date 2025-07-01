CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS endpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    url TEXT NOT NULL,
    check_interval INTEGER NOT NULL DEFAULT 30,
    timeout INTEGER NOT NULL DEFAULT 5,
    expected_status INTEGER NOT NULL DEFAULT 200,
    severity VARCHAR(20) NOT NULL DEFAULT 'medium',
    enabled BOOLEAN NOT NULL DEFAULT true,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS uptime_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    endpoint_id UUID REFERENCES endpoints(id) ON DELETE CASCADE,
    endpoint_name VARCHAR(255) NOT NULL,
    status VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    response_time REAL NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    error_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_uptime_checks_endpoint_id ON uptime_checks(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_uptime_checks_timestamp ON uptime_checks(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_endpoints_enabled ON endpoints(enabled);

INSERT INTO endpoints (name, url, check_interval, timeout, expected_status, severity, tags)
VALUES
    ('Payment API', 'https://httpbin.org/status/200', 30, 5, 200, 'critical', ARRAY['payment', 'core']),
    ('User API', 'https://httpbin.org/status/200', 30, 5, 200, 'high', ARRAY['user', 'core']),
    ('Inventory API (Failing)', 'https://httpbin.org/status/500', 30, 5, 200, 'medium', ARRAY['inventory', 'business']),
    ('Analytics API (Slow)', 'https://httpbin.org/delay/2', 30, 8, 200, 'low', ARRAY['analytics', 'reporting']),
    ('Health Check', 'https://httpbin.org/status/200', 30, 3, 200, 'high', ARRAY['health', 'monitoring'])
ON CONFLICT (name) DO NOTHING;