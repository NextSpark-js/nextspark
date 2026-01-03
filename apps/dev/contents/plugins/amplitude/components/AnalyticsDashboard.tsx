import React, { useEffect, useState, useCallback } from 'react';
import { useAmplitudeContext } from '../providers/AmplitudeProvider';
import { getPerformanceMetrics, getPerformanceStats } from '../lib/performance';

interface AnalyticsDashboardProps {
  refreshInterval?: number;
  showAdvancedMetrics?: boolean;
  timeRange?: '1h' | '24h' | '7d' | '30d';
  compactMode?: boolean;
  onAlert?: (alert: PerformanceAlert) => void;
}

interface PerformanceAlert {
  type: 'warning' | 'error' | 'critical';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: number;
}

interface DashboardMetrics {
  eventsProcessed: number;
  errorRate: number;
  averageLatency: number;
  queueSize: number;
  memoryUsage: number;
  cacheHitRate: number;
  activeUsers: number;
  conversionRate: number;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ 
  refreshInterval = 30000,
  showAdvancedMetrics = true,
  timeRange = '24h',
  compactMode = false,
  onAlert
}) => {
  const { isInitialized, error, config } = useAmplitudeContext();
  const [metrics, setMetrics] = useState<any[]>([]);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics>({
    eventsProcessed: 0,
    errorRate: 0,
    averageLatency: 0,
    queueSize: 0,
    memoryUsage: 0,
    cacheHitRate: 0,
    activeUsers: 0,
    conversionRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);

  const checkThresholds = useCallback((stats: any) => {
    const newAlerts: PerformanceAlert[] = [];

    // Error rate threshold
    if (stats.amplitudeCore?.errorRate > 0.05) {
      newAlerts.push({
        type: 'warning',
        message: 'High error rate detected',
        metric: 'errorRate',
        value: stats.amplitudeCore.errorRate,
        threshold: 0.05,
        timestamp: Date.now()
      });
    }

    // Memory usage threshold (100MB)
    if (stats.amplitudeCore?.memoryUsage > 100 * 1024 * 1024) {
      newAlerts.push({
        type: 'warning',
        message: 'High memory usage detected',
        metric: 'memoryUsage',
        value: stats.amplitudeCore.memoryUsage,
        threshold: 100 * 1024 * 1024,
        timestamp: Date.now()
      });
    }

    // Queue size threshold
    if (stats.amplitudeCore?.eventQueueSize > 1000) {
      newAlerts.push({
        type: 'error',
        message: 'Event queue size too large',
        metric: 'queueSize',
        value: stats.amplitudeCore.eventQueueSize,
        threshold: 1000,
        timestamp: Date.now()
      });
    }

    // Latency threshold (1000ms)
    const avgLatency = stats.amplitudeCore?.trackingLatency?.reduce((a: number, b: number) => a + b, 0) / 
                      (stats.amplitudeCore?.trackingLatency?.length || 1);
    if (avgLatency > 1000) {
      newAlerts.push({
        type: 'warning',
        message: 'High tracking latency detected',
        metric: 'latency',
        value: avgLatency,
        threshold: 1000,
        timestamp: Date.now()
      });
    }

    if (newAlerts.length > 0) {
      setAlerts(prev => [...prev.slice(-10), ...newAlerts]); // Keep last 10 alerts
      newAlerts.forEach(alert => onAlert?.(alert));
    }
  }, [onAlert]);

  const refreshMetrics = useCallback(async () => {
    if (!isInitialized) return;

    try {
      setLoading(true);
      
      // Get performance metrics
      const collectedMetrics = getPerformanceMetrics();
      setMetrics(collectedMetrics);

      // Get performance stats
      const stats = getPerformanceStats();
      
      // Update dashboard metrics
      setDashboardMetrics({
        eventsProcessed: collectedMetrics.length,
        errorRate: stats.amplitudeCore?.errorRate || 0,
        averageLatency: stats.amplitudeCore?.trackingLatency?.reduce((a: number, b: number) => a + b, 0) / 
                       (stats.amplitudeCore?.trackingLatency?.length || 1) || 0,
        queueSize: stats.amplitudeCore?.eventQueueSize || 0,
        memoryUsage: stats.amplitudeCore?.memoryUsage || 0,
        cacheHitRate: Math.random() * 100, // Placeholder
        activeUsers: Math.floor(Math.random() * 1000), // Placeholder
        conversionRate: Math.random() * 10 // Placeholder
      });

      // Check thresholds for alerts
      checkThresholds(stats);

    } catch (error) {
      console.error('[Analytics Dashboard] Failed to refresh metrics:', error);
    } finally {
      setLoading(false);
    }
  }, [isInitialized, checkThresholds]);

  useEffect(() => {
    refreshMetrics();
    const interval = setInterval(refreshMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshMetrics, refreshInterval]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  if (loading && metrics.length === 0) {
    return (
      <div className="amplitude-dashboard amplitude-dashboard--loading">
        <div className="amplitude-dashboard__spinner"></div>
        <p>Loading analytics data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="amplitude-dashboard amplitude-dashboard--error">
        <h3>Error Loading Dashboard</h3>
        <p>{error.message}</p>
        <button onClick={refreshMetrics} className="amplitude-dashboard__retry-button">
          Retry
        </button>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="amplitude-dashboard amplitude-dashboard--not-initialized">
        <h3>Amplitude Plugin Not Initialized</h3>
        <p>Check configuration and ensure the plugin is properly loaded.</p>
      </div>
    );
  }

  return (
    <div className={`amplitude-dashboard ${compactMode ? 'amplitude-dashboard--compact' : ''}`}>
      <div className="amplitude-dashboard__header">
        <h2 className="amplitude-dashboard__title">Amplitude Analytics Dashboard</h2>
        <div className="amplitude-dashboard__controls">
          <button 
            onClick={refreshMetrics} 
            className="amplitude-dashboard__refresh-button"
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="amplitude-dashboard__alerts">
          <h3>Recent Alerts</h3>
          {alerts.slice(-3).map((alert, index) => (
            <div key={index} className={`amplitude-dashboard__alert amplitude-dashboard__alert--${alert.type}`}>
              <span className="amplitude-dashboard__alert-icon">
                {alert.type === 'critical' ? '🚨' : alert.type === 'error' ? '❌' : '⚠️'}
              </span>
              <span className="amplitude-dashboard__alert-message">{alert.message}</span>
              <span className="amplitude-dashboard__alert-value">
                {alert.value} (threshold: {alert.threshold})
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Main Metrics Grid */}
      <div className="amplitude-dashboard__metrics-grid">
        <div className="amplitude-dashboard__metric-card">
          <h3>Events Processed</h3>
          <span className="amplitude-dashboard__metric-value">{dashboardMetrics.eventsProcessed.toLocaleString()}</span>
          <span className="amplitude-dashboard__metric-label">Total events</span>
        </div>

        <div className="amplitude-dashboard__metric-card">
          <h3>Error Rate</h3>
          <span className="amplitude-dashboard__metric-value">
            {(dashboardMetrics.errorRate * 100).toFixed(2)}%
          </span>
          <span className="amplitude-dashboard__metric-label">Error percentage</span>
        </div>

        <div className="amplitude-dashboard__metric-card">
          <h3>Average Latency</h3>
          <span className="amplitude-dashboard__metric-value">
            {formatDuration(dashboardMetrics.averageLatency)}
          </span>
          <span className="amplitude-dashboard__metric-label">Response time</span>
        </div>

        <div className="amplitude-dashboard__metric-card">
          <h3>Queue Size</h3>
          <span className="amplitude-dashboard__metric-value">{dashboardMetrics.queueSize}</span>
          <span className="amplitude-dashboard__metric-label">Pending events</span>
        </div>

        {showAdvancedMetrics && (
          <>
            <div className="amplitude-dashboard__metric-card">
              <h3>Memory Usage</h3>
              <span className="amplitude-dashboard__metric-value">
                {formatBytes(dashboardMetrics.memoryUsage)}
              </span>
              <span className="amplitude-dashboard__metric-label">RAM usage</span>
            </div>

            <div className="amplitude-dashboard__metric-card">
              <h3>Cache Hit Rate</h3>
              <span className="amplitude-dashboard__metric-value">
                {dashboardMetrics.cacheHitRate.toFixed(1)}%
              </span>
              <span className="amplitude-dashboard__metric-label">Cache efficiency</span>
            </div>

            <div className="amplitude-dashboard__metric-card">
              <h3>Active Users</h3>
              <span className="amplitude-dashboard__metric-value">
                {dashboardMetrics.activeUsers.toLocaleString()}
              </span>
              <span className="amplitude-dashboard__metric-label">Current session</span>
            </div>

            <div className="amplitude-dashboard__metric-card">
              <h3>Conversion Rate</h3>
              <span className="amplitude-dashboard__metric-value">
                {dashboardMetrics.conversionRate.toFixed(2)}%
              </span>
              <span className="amplitude-dashboard__metric-label">Goal completion</span>
            </div>
          </>
        )}
      </div>

      {/* Performance Metrics Table */}
      {showAdvancedMetrics && (
        <div className="amplitude-dashboard__performance-table">
          <h3>Recent Performance Metrics</h3>
          <div className="amplitude-dashboard__table-container">
            <table className="amplitude-dashboard__table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Value</th>
                  <th>Unit</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {metrics.slice(-10).map((metric, index) => (
                  <tr key={index}>
                    <td>{metric.name}</td>
                    <td>{metric.value.toFixed(2)}</td>
                    <td>{metric.unit}</td>
                    <td>{new Date(metric.timestamp).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="amplitude-dashboard__footer">
        <p className="amplitude-dashboard__footer-text">
          Last updated: {new Date().toLocaleTimeString()} | 
          Refresh interval: {refreshInterval / 1000}s | 
          Time range: {timeRange}
        </p>
      </div>
    </div>
  );
};

