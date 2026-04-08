import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { logSkillEvent } from '../services/skillTelemetry';

type Props = {
    children: ReactNode;
    /** Increment to clear error state and remount children (e.g. after "Try again"). */
    resetKey?: number;
    /** Called when the user resets after a crash (parent should bump `resetKey` / remount SkillChat). */
    onReset?: () => void;
};

type State = {
    hasError: boolean;
    error: Error | null;
};

/**
 * Catches render/lifecycle errors in the Skill chat tree so a single bad message render cannot white-screen the page.
 */
export class SkillErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        logSkillEvent({
            level: 'error',
            event: 'skill.ui.boundary',
            error,
            detail: { componentStack: info.componentStack?.slice(0, 2000) },
        });
    }

    componentDidUpdate(prevProps: Props): void {
        if (this.props.resetKey !== undefined && this.props.resetKey !== prevProps.resetKey) {
            this.setState({ hasError: false, error: null });
        }
    }

    private handleReset = (): void => {
        this.props.onReset?.();
        this.setState({ hasError: false, error: null });
    };

    render(): ReactNode {
        if (this.state.hasError && this.state.error) {
            return (
                <div className="flex flex-col h-full min-h-[280px] rounded-3xl border-2 border-red-500/40 bg-gradient-to-b from-red-950/50 to-black p-6 text-center justify-center gap-4">
                    <AlertTriangle className="w-10 h-10 text-red-400 mx-auto shrink-0" aria-hidden />
                    <div className="space-y-2">
                        <p className="text-sm font-semibold text-red-200 font-sans">Skill chat crashed</p>
                        <p className="text-xs text-red-300/80 font-sans max-w-md mx-auto [overflow-wrap:anywhere]">
                            {this.state.error.message}
                        </p>
                    </div>
                    <button
                        type="button"
                        className="mx-auto px-5 py-2.5 rounded-xl bg-red-500/20 border border-red-400/50 text-red-100 text-sm font-medium hover:bg-red-500/30 transition-colors font-sans"
                        onClick={this.handleReset}
                    >
                        Reset chat
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
