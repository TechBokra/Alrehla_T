import { Component, type ErrorInfo, type ReactNode } from "react";
import { RootError } from "./global-error";

type Props = { children: ReactNode };
type State = { failed: boolean; error: unknown };

/** Covers provider/render failures outside TanStack Router's route boundary. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, error: undefined };

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      "Admin application render failed",
      error,
      info.componentStack,
    );
  }

  render() {
    if (this.state.failed) {
      return (
        <RootError
          error={this.state.error}
          reset={() => this.setState({ failed: false, error: undefined })}
          onReload={() => window.location.reload()}
        />
      );
    }
    return this.props.children;
  }
}
