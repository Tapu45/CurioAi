import React, { useState, useEffect } from 'react';
import { Brain, Loader2, CheckCircle2, XCircle, Wrench, Lightbulb } from 'lucide-react';
import './AgentStatus.css';

export default function AgentStatus({ status, reasoningSteps = [], toolCalls = [] }) {
    const [expanded, setExpanded] = useState(false);

    if (!status || status === 'idle' || status === 'completed') {
        return null;
    }

    return (
        <div className="agent-status">
            <div
                className="agent-status-header"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="agent-status-indicator">
                    {status === 'thinking' || status === 'executing' ? (
                        <Loader2 size={16} className="agent-status-spinner" />
                    ) : status === 'completed' ? (
                        <CheckCircle2 size={16} className="agent-status-success" />
                    ) : (
                        <XCircle size={16} className="agent-status-error" />
                    )}
                    <span className="agent-status-label">
                        {status === 'thinking' && 'Thinking...'}
                        {status === 'executing' && 'Executing tools...'}
                        {status === 'error' && 'Error occurred'}
                    </span>
                </div>
                {status === 'executing' && (
                    <div className="agent-status-progress">
                        <div className="agent-status-progress-bar">
                            <div
                                className="agent-status-progress-fill"
                                style={{ width: `${status.progress || 0}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {expanded && (
                <div className="agent-status-details">
                    {reasoningSteps.length > 0 && (
                        <div className="agent-status-section">
                            <h4 className="agent-status-section-title">
                                <Lightbulb size={14} />
                                Reasoning Steps
                            </h4>
                            <div className="agent-status-steps">
                                {reasoningSteps.map((step, index) => (
                                    <div
                                        key={index}
                                        className={`agent-status-step agent-status-step-${step.type}`}
                                    >
                                        <div className="agent-status-step-number">
                                            {step.stepNumber || index + 1}
                                        </div>
                                        <div className="agent-status-step-content">
                                            {step.content}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {toolCalls.length > 0 && (
                        <div className="agent-status-section">
                            <h4 className="agent-status-section-title">
                                <Wrench size={14} />
                                Tools Used ({toolCalls.length})
                            </h4>
                            <div className="agent-status-tools">
                                {toolCalls.map((toolCall, index) => (
                                    <div key={index} className="agent-status-tool">
                                        <div className="agent-status-tool-name">
                                            {toolCall.tool}
                                        </div>
                                        {toolCall.input && (
                                            <div className="agent-status-tool-input">
                                                Input: {JSON.stringify(toolCall.input).substring(0, 100)}
                                            </div>
                                        )}
                                        {toolCall.status && (
                                            <div className={`agent-status-tool-status agent-status-tool-status-${toolCall.status}`}>
                                                {toolCall.status}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}