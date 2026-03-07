import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ""}]`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          style={{
            padding: 24,
            margin: 16,
            border: "2px solid #ef4444",
            borderRadius: 8,
            backgroundColor: "#fef2f2",
            fontFamily: "system-ui",
          }}
        >
          <h3 style={{ margin: "0 0 8px", color: "#991b1b", fontSize: 14 }}>
            Something went wrong{this.props.label ? ` in ${this.props.label}` : ""}
          </h3>
          <pre
            style={{
              margin: 0,
              fontSize: 12,
              color: "#b91c1c",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {this.state.error?.message}
          </pre>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 12,
              padding: "6px 16px",
              border: "1px solid #fca5a5",
              borderRadius: 4,
              backgroundColor: "#fff",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
