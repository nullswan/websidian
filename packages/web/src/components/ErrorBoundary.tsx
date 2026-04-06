import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{ padding: 24, color: "var(--text-secondary)", fontSize: 13, textAlign: "center" }}>
          <div style={{ color: "#f88", marginBottom: 8 }}>Something went wrong</div>
          <div style={{ color: "var(--text-faint)", fontSize: 11, maxWidth: 400, margin: "0 auto", wordBreak: "break-word" }}>
            {this.state.error?.message}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: 12, padding: "4px 12px", fontSize: 12, background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: 4, cursor: "pointer" }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
