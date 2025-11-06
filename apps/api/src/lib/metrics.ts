// Prometheus Metrics
// Simple metrics collection for monitoring

interface Metrics {
  requests: {
    total: number;
    byMethod: Record<string, number>;
    byStatus: Record<string, number>;
    byPath: Record<string, number>;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
  };
  response: {
    totalDuration: number;
    count: number;
  };
}

class MetricsCollector {
  private metrics: Metrics;
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
    this.metrics = {
      requests: {
        total: 0,
        byMethod: {},
        byStatus: {},
        byPath: {},
      },
      errors: {
        total: 0,
        byType: {},
      },
      response: {
        totalDuration: 0,
        count: 0,
      },
    };
  }

  /**
   * Record a request
   */
  recordRequest(method: string, path: string, status: number, duration: number) {
    this.metrics.requests.total++;
    this.metrics.requests.byMethod[method] = (this.metrics.requests.byMethod[method] || 0) + 1;
    this.metrics.requests.byStatus[status] = (this.metrics.requests.byStatus[status] || 0) + 1;
    this.metrics.requests.byPath[path] = (this.metrics.requests.byPath[path] || 0) + 1;

    this.metrics.response.totalDuration += duration;
    this.metrics.response.count++;
  }

  /**
   * Record an error
   */
  recordError(errorType: string) {
    this.metrics.errors.total++;
    this.metrics.errors.byType[errorType] = (this.metrics.errors.byType[errorType] || 0) + 1;
  }

  /**
   * Get metrics in Prometheus format
   */
  getPrometheusMetrics(): string {
    const lines: string[] = [];
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    // Process uptime
    lines.push('# HELP process_uptime_seconds Process uptime in seconds');
    lines.push('# TYPE process_uptime_seconds gauge');
    lines.push(`process_uptime_seconds ${uptime}`);
    lines.push('');

    // Request total
    lines.push('# HELP http_requests_total Total number of HTTP requests');
    lines.push('# TYPE http_requests_total counter');
    lines.push(`http_requests_total ${this.metrics.requests.total}`);
    lines.push('');

    // Requests by method
    lines.push('# HELP http_requests_by_method_total Total number of HTTP requests by method');
    lines.push('# TYPE http_requests_by_method_total counter');
    for (const [method, count] of Object.entries(this.metrics.requests.byMethod)) {
      lines.push(`http_requests_by_method_total{method="${method}"} ${count}`);
    }
    lines.push('');

    // Requests by status
    lines.push('# HELP http_requests_by_status_total Total number of HTTP requests by status code');
    lines.push('# TYPE http_requests_by_status_total counter');
    for (const [status, count] of Object.entries(this.metrics.requests.byStatus)) {
      lines.push(`http_requests_by_status_total{status="${status}"} ${count}`);
    }
    lines.push('');

    // Average response time
    const avgResponseTime = this.metrics.response.count > 0
      ? this.metrics.response.totalDuration / this.metrics.response.count
      : 0;
    lines.push('# HELP http_response_time_ms_average Average response time in milliseconds');
    lines.push('# TYPE http_response_time_ms_average gauge');
    lines.push(`http_response_time_ms_average ${avgResponseTime.toFixed(2)}`);
    lines.push('');

    // Errors total
    lines.push('# HELP http_errors_total Total number of HTTP errors');
    lines.push('# TYPE http_errors_total counter');
    lines.push(`http_errors_total ${this.metrics.errors.total}`);
    lines.push('');

    // Errors by type
    if (Object.keys(this.metrics.errors.byType).length > 0) {
      lines.push('# HELP http_errors_by_type_total Total number of HTTP errors by type');
      lines.push('# TYPE http_errors_by_type_total counter');
      for (const [type, count] of Object.entries(this.metrics.errors.byType)) {
        lines.push(`http_errors_by_type_total{type="${type}"} ${count}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Get metrics as JSON
   */
  getMetrics() {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const avgResponseTime = this.metrics.response.count > 0
      ? this.metrics.response.totalDuration / this.metrics.response.count
      : 0;

    return {
      uptime,
      requests: this.metrics.requests,
      errors: this.metrics.errors,
      response: {
        averageDuration: parseFloat(avgResponseTime.toFixed(2)),
        count: this.metrics.response.count,
      },
    };
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics = {
      requests: {
        total: 0,
        byMethod: {},
        byStatus: {},
        byPath: {},
      },
      errors: {
        total: 0,
        byType: {},
      },
      response: {
        totalDuration: 0,
        count: 0,
      },
    };
  }
}

// Export singleton instance
export const metricsCollector = new MetricsCollector();
