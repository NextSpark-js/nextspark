/**
 * Performance Monitor component for real-time plugin performance tracking
 * Displays key metrics, alerts, and performance insights
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAmplitudeContext } from '../providers/AmplitudeProvider';
import { getPerformanceStats, getPerformanceMetrics } from '../lib/performance';
import { PerformanceMetric, PerformanceStats } from '../lib/performance';

// Component props
export interface PerformanceMonitorProps {
  refreshInterval?: number;
  showAlerts?: boolean;
  showCharts?: boolean;
  compactMode?: boolean;
  alertThresholds?: PerformanceThresholds;
  onAlert?: (alert: PerformanceAlert) => void;
  className?: string;
  style?: React.CSSProperties;
}

// Performance thresholds for alerts
export interface PerformanceThresholds {
  errorRate: number;
  memoryUsageMB: number;
  latencyMs: number;
  queueSize: number;
  cacheHitRate: number;
}

// Performance alert
export interface PerformanceAlert {
  id: string;
  type: 'error_rate' | 'memory' | 'latency' | 'queue' | 'cache';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

// Chart data point
export interface ChartDataPoint {
  timestamp: number;
  value: number;
  label?: string;
}

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  errorRate: 0.05, // 5%
  memoryUsageMB: 100,
  latencyMs: 1000,
  queueSize: 1000,
  cacheHitRate: 0.8, // 80%
};

/**
 * Performance Monitor Component
 */
export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  refreshInterval = 5000, // 5 seconds
  showAlerts = true,
  showCharts = true,
  compactMode = false,
  alertThresholds = DEFAULT_THRESHOLDS,
  onAlert,
  className,
  style,
}) => {
  const { isInitialized, config } = useAmplitudeContext();
  
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [chartData, setChartData] = useState<Map<string, ChartDataPoint[]>>(new Map());

  // Fetch performance data
  const fetchPerformanceData = useCallback(async () => {
    if (!isInitialized) return;

    try {
      setIsLoading(true);
      
      const currentStats = getPerformanceStats();
      const currentMetrics = getPerformanceMetrics();
      
      setStats(currentStats);
      setMetrics(currentMetrics);
      setLastUpdate(new Date());

      // Update chart data
      const now = Date.now();
      const newChartData = new Map(chartData);

      // Add current data points
      const metricsToChart = ['latency', 'memory_usage', 'error_rate', 'queue_size'];
      metricsToChart.forEach(metricName => {
        if (!newChartData.has(metricName)) {
          newChartData.set(metricName, []);
        }
        
        const chartPoints = newChartData.get(metricName)!;
        let value = 0;

        // Map stats to chart values
        switch (metricName) {
          case 'latency':
            value = currentStats.amplitudeCore.trackingLatency.reduce((a, b) => a + b, 0) / Math.max(currentStats.amplitudeCore.trackingLatency.length, 1);
            break;
          case 'memory_usage':
            value = currentStats.amplitudeCore.memoryUsage / (1024 * 1024); // Convert to MB
            break;
          case 'error_rate':
            value = currentStats.amplitudeCore.errorRate * 100; // Convert to percentage
            break;
          case 'queue_size':
            value = currentStats.amplitudeCore.eventQueueSize;
            break;
        }

        chartPoints.push({ timestamp: now, value });

        // Keep only last 50 data points
        if (chartPoints.length > 50) {
          chartPoints.shift();
        }
      });

      setChartData(newChartData);

      // Check for alerts
      if (showAlerts) {
        checkForAlerts(currentStats);
      }
    } catch (error) {
      console.error('[Performance Monitor] Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, chartData, showAlerts, alertThresholds]);

  // Check for performance alerts
  const checkForAlerts = useCallback((currentStats: PerformanceStats) => {
    const newAlerts: PerformanceAlert[] = [];
    const now = Date.now();

    // Error rate alert
    if (currentStats.amplitudeCore.errorRate > alertThresholds.errorRate) {
      newAlerts.push({
        id: `error_rate_${now}`,
        type: 'error_rate',
        severity: currentStats.amplitudeCore.errorRate > alertThresholds.errorRate * 2 ? 'critical' : 'warning',
        message: `High error rate detected: ${(currentStats.amplitudeCore.errorRate * 100).toFixed(2)}%`,
        value: currentStats.amplitudeCore.errorRate,
        threshold: alertThresholds.errorRate,
        timestamp: now,
      });
    }

    // Memory usage alert
    const memoryUsageMB = currentStats.amplitudeCore.memoryUsage / (1024 * 1024);
    if (memoryUsageMB > alertThresholds.memoryUsageMB) {
      newAlerts.push({
        id: `memory_${now}`,
        type: 'memory',
        severity: memoryUsageMB > alertThresholds.memoryUsageMB * 1.5 ? 'critical' : 'warning',
        message: `High memory usage: ${memoryUsageMB.toFixed(2)} MB`,
        value: memoryUsageMB,
        threshold: alertThresholds.memoryUsageMB,
        timestamp: now,
      });
    }

    // Average latency alert
    const avgLatency = currentStats.amplitudeCore.trackingLatency.reduce((a, b) => a + b, 0) / Math.max(currentStats.amplitudeCore.trackingLatency.length, 1);
    if (avgLatency > alertThresholds.latencyMs) {
      newAlerts.push({
        id: `latency_${now}`,
        type: 'latency',
        severity: avgLatency > alertThresholds.latencyMs * 2 ? 'critical' : 'warning',
        message: `High tracking latency: ${avgLatency.toFixed(0)}ms`,
        value: avgLatency,
        threshold: alertThresholds.latencyMs,
        timestamp: now,
      });
    }

    // Queue size alert
    if (currentStats.amplitudeCore.eventQueueSize > alertThresholds.queueSize) {
      newAlerts.push({
        id: `queue_${now}`,
        type: 'queue',
        severity: currentStats.amplitudeCore.eventQueueSize > alertThresholds.queueSize * 2 ? 'critical' : 'warning',
        message: `Large event queue: ${currentStats.amplitudeCore.eventQueueSize} events`,
        value: currentStats.amplitudeCore.eventQueueSize,
        threshold: alertThresholds.queueSize,
        timestamp: now,
      });
    }

    // Add new alerts and notify
    if (newAlerts.length > 0) {
      setAlerts(prev => [...newAlerts, ...prev].slice(0, 10)); // Keep only 10 most recent alerts
      newAlerts.forEach(alert => onAlert?.(alert));
    }
  }, [alertThresholds, onAlert]);

  // Auto-refresh data
  useEffect(() => {
    fetchPerformanceData();
    
    const interval = setInterval(fetchPerformanceData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchPerformanceData, refreshInterval]);

  // Format numbers for display
  const formatNumber = useCallback((num: number, decimals = 0): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(decimals)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(decimals)}K`;
    return num.toFixed(decimals);
  }, []);

  // Format bytes
  const formatBytes = useCallback((bytes: number): string => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  }, []);

  // Get status color
  const getStatusColor = useCallback((value: number, threshold: number, invert = false): string => {
    const isGood = invert ? value < threshold : value > threshold;
    return isGood ? '#10b981' : value > threshold * 1.5 ? '#ef4444' : '#f59e0b';
  }, []);

  // Simple chart component
  const SimpleChart: React.FC<{ data: ChartDataPoint[]; color: string; height?: number }> = ({ 
    data, 
    color, 
    height = 60 
  }) => {
    const points = useMemo(() => {
      if (data.length < 2) return '';
      
      const minValue = Math.min(...data.map(d => d.value));
      const maxValue = Math.max(...data.map(d => d.value));
      const range = maxValue - minValue || 1;
      
      const width = 200;
      const stepX = width / (data.length - 1);
      
      return data.map((point, index) => {
        const x = index * stepX;
        const y = height - ((point.value - minValue) / range) * height;
        return `${x},${y}`;
      }).join(' ');
    }, [data, height]);

    return (
      <svg width="200" height={height} style={{ overflow: 'visible' }}>
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
        />
        {data.length > 0 && (
          <circle
            cx={200 * (data.length - 1) / Math.max(data.length - 1, 1)}
            cy={height - ((data[data.length - 1].value - Math.min(...data.map(d => d.value))) / (Math.max(...data.map(d => d.value)) - Math.min(...data.map(d => d.value)) || 1)) * height}
            r="3"
            fill={color}
          />
        )}
      </svg>
    );
  };

  if (!isInitialized) {
    return (
      <div className={`amplitude-performance-monitor ${className || ''}`} style={style}>
        <div style={{ padding: '16px', textAlign: 'center', color: '#6b7280' }}>
          Amplitude plugin not initialized
        </div>
      </div>
    );
  }

  if (isLoading && !stats) {
    return (
      <div className={`amplitude-performance-monitor ${className || ''}`} style={style}>
        <div style={{ padding: '16px', textAlign: 'center', color: '#6b7280' }}>
          Loading performance data...
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`amplitude-performance-monitor ${compactMode ? 'compact' : ''} ${className || ''}`} 
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        padding: compactMode ? '12px' : '16px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
        ...style,
      }}
    >
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: compactMode ? '8px' : '16px'
      }}>
        <h3 style={{ 
          margin: 0, 
          fontSize: compactMode ? '14px' : '16px',
          fontWeight: '600',
          color: '#111827'
        }}>
          Plugin Performance
        </h3>
        <div style={{ fontSize: '12px', color: '#6b7280' }}>
          Updated: {lastUpdate.toLocaleTimeString()}
        </div>
      </div>

      {/* Alerts */}
      {showAlerts && alerts.length > 0 && (
        <div style={{ marginBottom: compactMode ? '8px' : '16px' }}>
          {alerts.slice(0, compactMode ? 2 : 3).map(alert => (
            <div
              key={alert.id}
              style={{
                padding: '8px 12px',
                backgroundColor: alert.severity === 'critical' ? '#fef2f2' : '#fffbeb',
                border: `1px solid ${alert.severity === 'critical' ? '#fecaca' : '#fed7aa'}`,
                borderRadius: '6px',
                marginBottom: '4px',
                fontSize: '12px',
                color: alert.severity === 'critical' ? '#991b1b' : '#92400e',
              }}
            >
              <strong>{alert.severity.toUpperCase()}</strong>: {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* Metrics Grid */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: compactMode ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: compactMode ? '8px' : '12px',
          marginBottom: showCharts ? (compactMode ? '8px' : '16px') : 0,
        }}>
          {/* Error Rate */}
          <div style={{
            padding: compactMode ? '8px' : '12px',
            backgroundColor: '#f9fafb',
            borderRadius: '6px',
            border: '1px solid #f3f4f6',
          }}>
            <div style={{ 
              fontSize: '12px', 
              color: '#6b7280', 
              marginBottom: '4px' 
            }}>
              Error Rate
            </div>
            <div style={{ 
              fontSize: compactMode ? '18px' : '20px',
              fontWeight: '600',
              color: getStatusColor(stats.amplitudeCore.errorRate, alertThresholds.errorRate),
              marginBottom: '2px'
            }}>
              {(stats.amplitudeCore.errorRate * 100).toFixed(2)}%
            </div>
            <div style={{ fontSize: '10px', color: '#9ca3af' }}>
              Threshold: {(alertThresholds.errorRate * 100).toFixed(1)}%
            </div>
          </div>

          {/* Memory Usage */}
          <div style={{
            padding: compactMode ? '8px' : '12px',
            backgroundColor: '#f9fafb',
            borderRadius: '6px',
            border: '1px solid #f3f4f6',
          }}>
            <div style={{ 
              fontSize: '12px', 
              color: '#6b7280', 
              marginBottom: '4px' 
            }}>
              Memory Usage
            </div>
            <div style={{ 
              fontSize: compactMode ? '18px' : '20px',
              fontWeight: '600',
              color: getStatusColor(stats.amplitudeCore.memoryUsage / (1024 * 1024), alertThresholds.memoryUsageMB),
              marginBottom: '2px'
            }}>
              {formatBytes(stats.amplitudeCore.memoryUsage)}
            </div>
            <div style={{ fontSize: '10px', color: '#9ca3af' }}>
              Limit: {alertThresholds.memoryUsageMB} MB
            </div>
          </div>

          {/* Average Latency */}
          <div style={{
            padding: compactMode ? '8px' : '12px',
            backgroundColor: '#f9fafb',
            borderRadius: '6px',
            border: '1px solid #f3f4f6',
          }}>
            <div style={{ 
              fontSize: '12px', 
              color: '#6b7280', 
              marginBottom: '4px' 
            }}>
              Avg Latency
            </div>
            <div style={{ 
              fontSize: compactMode ? '18px' : '20px',
              fontWeight: '600',
              color: getStatusColor(
                stats.amplitudeCore.trackingLatency.reduce((a, b) => a + b, 0) / Math.max(stats.amplitudeCore.trackingLatency.length, 1),
                alertThresholds.latencyMs
              ),
              marginBottom: '2px'
            }}>
              {Math.round(stats.amplitudeCore.trackingLatency.reduce((a, b) => a + b, 0) / Math.max(stats.amplitudeCore.trackingLatency.length, 1))}ms
            </div>
            <div style={{ fontSize: '10px', color: '#9ca3af' }}>
              Threshold: {alertThresholds.latencyMs}ms
            </div>
          </div>

          {/* Queue Size */}
          <div style={{
            padding: compactMode ? '8px' : '12px',
            backgroundColor: '#f9fafb',
            borderRadius: '6px',
            border: '1px solid #f3f4f6',
          }}>
            <div style={{ 
              fontSize: '12px', 
              color: '#6b7280', 
              marginBottom: '4px' 
            }}>
              Event Queue
            </div>
            <div style={{ 
              fontSize: compactMode ? '18px' : '20px',
              fontWeight: '600',
              color: getStatusColor(stats.amplitudeCore.eventQueueSize, alertThresholds.queueSize),
              marginBottom: '2px'
            }}>
              {formatNumber(stats.amplitudeCore.eventQueueSize)}
            </div>
            <div style={{ fontSize: '10px', color: '#9ca3af' }}>
              Limit: {formatNumber(alertThresholds.queueSize)}
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      {showCharts && !compactMode && chartData.size > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '16px',
        }}>
          {Array.from(chartData.entries()).map(([metricName, data]) => (
            <div key={metricName} style={{
              padding: '12px',
              backgroundColor: '#f9fafb',
              borderRadius: '6px',
              border: '1px solid #f3f4f6',
            }}>
              <div style={{ 
                fontSize: '12px', 
                color: '#6b7280', 
                marginBottom: '8px',
                textTransform: 'capitalize'
              }}>
                {metricName.replace('_', ' ')} Trend
              </div>
              <SimpleChart 
                data={data} 
                color={
                  metricName === 'error_rate' ? '#ef4444' :
                  metricName === 'memory_usage' ? '#f59e0b' :
                  metricName === 'latency' ? '#8b5cf6' :
                  '#10b981'
                }
              />
            </div>
          ))}
        </div>
      )}

      {/* Footer Actions */}
      {!compactMode && (
        <div style={{
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid #f3f4f6',
          display: 'flex',
          gap: '8px',
          fontSize: '12px',
        }}>
          <button
            onClick={fetchPerformanceData}
            style={{
              padding: '4px 8px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Refresh
          </button>
          <button
            onClick={() => {
              const metrics = getPerformanceMetrics();
              const stats = getPerformanceStats();
              const data = { metrics, stats };
              console.log('Performance Data:', data);
            }}
            style={{
              padding: '4px 8px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Export Data
          </button>
          <button
            onClick={() => setAlerts([])}
            style={{
              padding: '4px 8px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Clear Alerts
          </button>
        </div>
      )}
    </div>
  );
};

export default PerformanceMonitor;
