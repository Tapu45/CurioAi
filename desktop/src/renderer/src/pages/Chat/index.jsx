import React, { useState, useCallback, useRef, useEffect } from 'react';
import useElectron from '../../hooks/useElectron.js';
import Button from '../../components/common/Button/index.jsx';
import ActivityDetail from '../../components/features/History/ActivityDetail.jsx';
import './Chat.css';

export default function ChatPage() {
    const electron = useElectron();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [aiServiceOnline, setAiServiceOnline] = useState(null);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const [streaming, setStreaming] = useState(false);
    const [streamingMessage, setStreamingMessage] = useState('');

    // Check AI service on mount
    useEffect(() => {
        const checkService = async () => {
            try {
                const isOnline = await electron.checkAIService?.();
                setAiServiceOnline(isOnline);
            } catch (error) {
                setAiServiceOnline(false);
            }
        };
        checkService();
    }, [electron]);

    const handleSendMessage = useCallback(async (message) => {
        if (!message.trim()) return;

        const userMessage = {
            role: 'user',
            content: message,
            timestamp: new Date().toISOString(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setStreaming(true);
        setStreamingMessage('');

        try {
            // For now, non-streaming (streaming will be added in future)
            const response = await electron.sendChatMessage?.(message, { streaming: false });

            if (response) {
                const assistantMessage = {
                    role: 'assistant',
                    content: response.answer || '',
                    sources: response.sources || [],
                    confidence: response.confidence || 0,
                    timestamp: new Date().toISOString(),
                };
                setMessages(prev => [...prev, assistantMessage]);
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            const errorMessage = {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                error: true,
                timestamp: new Date().toISOString(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setStreaming(false);
            setStreamingMessage('');
        }
    }, [electron]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = useCallback(async () => {
        if (!input.trim() || loading || !aiServiceOnline) return;

        const userMessage = input.trim();
        setInput('');
        setLoading(true);

        // Add user message
        const newUserMessage = {
            id: Date.now(),
            role: 'user',
            content: userMessage,
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, newUserMessage]);

        try {
            // Send to chat service
            const response = await electron.sendChatMessage?.(userMessage);

            const assistantMessage = {
                id: Date.now() + 1,
                role: 'assistant',
                content: response?.answer || 'I encountered an error generating a response.',
                sources: response?.sources || [],
                confidence: response?.confidence || 0,
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage = {
                id: Date.now() + 1,
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please make sure the local AI service is running.',
                error: true,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    }, [input, loading, aiServiceOnline, electron]);

    const handleKeyPress = useCallback(
        (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        },
        [handleSend]
    );

    const handleSourceClick = useCallback(
        async (activityId) => {
            try {
                const activities = await electron.getActivities?.({ limit: 1000 });
                const found = activities?.find((a) => a.id === activityId);
                if (found) {
                    setSelectedActivity(found);
                }
            } catch (error) {
                console.error('Failed to load activity:', error);
            }
        },
        [electron]
    );

    return (
        <div className="chat-page">
            <div className="chat-header">
                <div>
                    <h1 className="chat-title">Ask CurioAI</h1>
                    <p className="chat-subtitle">
                        Ask questions about your learning history
                    </p>
                </div>
                {aiServiceOnline === false && (
                    <div className="chat-warning-badge">⚠️ AI Service Offline</div>
                )}
            </div>

            {/* Messages */}
            <div className="chat-messages">
                {messages.length === 0 && (
                    <div className="chat-welcome">
                        <div className="welcome-icon">💬</div>
                        <h3 className="welcome-title">Start a conversation</h3>
                        <p className="welcome-description">
                            Ask me anything about what you&apos;ve learned. For example:
                        </p>
                        <div className="welcome-examples">
                            <button
                                className="example-button"
                                onClick={() => setInput('What did I learn about React?')}
                            >
                                &quot;What did I learn about React?&quot;
                            </button>
                            <button
                                className="example-button"
                                onClick={() => setInput('Show me concepts related to machine learning')}
                            >
                                &quot;Show me concepts related to machine learning&quot;
                            </button>
                            <button
                                className="example-button"
                                onClick={() => setInput('What are the key topics from last week?')}
                            >
                                &quot;What are the key topics from last week?&quot;
                            </button>
                        </div>
                    </div>
                )}

                {messages.map((message) => (
                    <ChatMessage
                        key={message.id}
                        message={message}
                        onSourceClick={handleSourceClick}
                    />
                ))}

                {/* Streaming indicator */}
                {streaming && (
                    <div className="chat-message assistant">
                        <div className="message-avatar">🤖</div>
                        <div className="message-content-wrapper">
                            <div className="message-content">
                                {streamingMessage || (
                                    <div className="typing-indicator">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {loading && (
                    <div className="chat-message assistant">
                        <div className="message-content">
                            <div className="typing-indicator">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="chat-input-container">
                <div className="chat-input-wrapper">
                    <textarea
                        ref={inputRef}
                        className="chat-input"
                        placeholder={
                            aiServiceOnline === false
                                ? 'AI service is offline. Please start the local AI service.'
                                : 'Type your question... (Press Enter to send)'
                        }
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={!aiServiceOnline || loading}
                        rows={1}
                    />
                    <Button
                        onClick={handleSend}
                        disabled={!aiServiceOnline || loading || !input.trim()}
                        variant="primary"
                    >
                        Send
                    </Button>
                </div>
            </div>

            {/* Activity Detail Modal */}
            {selectedActivity && (
                <ActivityDetail
                    activity={selectedActivity}
                    onClose={() => setSelectedActivity(null)}
                />
            )}
        </div>
    );
}

function ChatMessage({ message, onSourceClick }) {
    const formattedTime = new Date(message.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <div className={`chat-message ${message.role}`}>
            <div className="message-avatar">
                {message.role === 'user' ? '👤' : '🤖'}
            </div>
            <div className="message-content-wrapper">
                <div className="message-content">
                    {message.content}
                </div>
                {message.sources && message.sources.length > 0 && (
                    <div className="message-sources">
                        <div className="sources-label">Sources:</div>
                        <div className="sources-list">
                            {message.sources.map((source, idx) => (
                                <button
                                    key={idx}
                                    className="source-link"
                                    onClick={() => onSourceClick(source.activityId)}
                                >
                                    {source.title}
                                    {source.similarity && (
                                        <span className="source-similarity">
                                            {Math.round(source.similarity * 100)}%
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {message.confidence !== undefined && (
                    <div className="message-confidence">
                        Confidence: {Math.round(message.confidence)}%
                    </div>
                )}
                <div className="message-time">{formattedTime}</div>
            </div>
        </div>
    );
}