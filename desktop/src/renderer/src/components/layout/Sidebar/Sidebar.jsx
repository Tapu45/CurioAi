import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    BarChart3,
    Clock,
    Brain,
    Settings,
    Moon,
    Sun,
    ChevronDown,
    MessageCircle,
    Search,
    FileText,
} from 'lucide-react';
import useAppStore from '../../../store/store.js';
import './Sidebar.css';

export default function Sidebar() {
    const currentPage = useAppStore((s) => s.currentPage);
    const setCurrentPage = useAppStore((s) => s.setCurrentPage);
    const [theme, setTheme] = useState('dark');
    const [isExpanded, setIsExpanded] = useState(true);

    const items = [
        { id: 'main', label: 'Today', icon: BarChart3 },
        { id: 'files', label: 'Files', icon: FileText }, // Add this
        { id: 'history', label: 'History', icon: Clock },
        { id: 'search', label: 'Search', icon: Search },
        { id: 'chat', label: 'Chat', icon: MessageCircle },
        { id: 'graph', label: 'Graph', icon: Brain },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
        document.documentElement.classList.toggle('dark');
    };

    return (
        <motion.div
            initial={{ x: -260 }}
            animate={{ x: 0 }}
            transition={{ duration: 0.3 }}
            className="sidebar"
        >
            {/* Logo Section */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="sidebar-logo-section"
            >
                <div className="sidebar-logo-container">
                    <motion.div
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        whileTap={{ scale: 0.95 }}
                        className="sidebar-logo-badge"
                    >
                        {/* Replace C with logo image */}
                        <img
                            src="/src/assets/icons/logo.png" // Update this path as needed
                            alt="CurioAI Logo"
                            className="sidebar-logo-img"
                            style={{ width: 40, height: 40, borderRadius: '50%' }}
                        />
                    </motion.div>
                    <div className="sidebar-logo-info">
                        <h1 className="sidebar-title">CurioAI</h1>
                        <p className="sidebar-subtitle">The AI Brain You Deserve 🧠</p>
                    </div>
                </div>
            </motion.div>

            {/* Navigation Items */}
            <nav role="navigation" aria-label="Main navigation">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="sidebar-nav"
                >
                    {items.map((item, idx) => {
                        const Icon = item.icon;
                        const isActive = currentPage === item.id;

                        return (
                            <motion.button
                                key={item.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 + idx * 0.05 }}
                                whileHover={{ x: 4 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setCurrentPage(item.id)}
                                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                                aria-label={`Go to ${item.label}`}
                                aria-current={isActive ? 'page' : undefined}
                            >
                                {/* Animated Background Gradient */}
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: isActive ? 1 : 0 }}
                                    className="sidebar-nav-bg"
                                />

                                {/* Icon */}
                                <motion.div
                                    animate={{ rotate: isActive ? 8 : 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="sidebar-nav-icon-wrapper"
                                >
                                    <Icon
                                        size={18}
                                        className={`sidebar-nav-icon ${isActive ? 'active' : ''}`}
                                    />
                                </motion.div>

                                {/* Label */}
                                <span className="sidebar-nav-label">
                                    {item.label}
                                </span>

                                {/* Active Indicator */}
                                {isActive && (
                                    <motion.div
                                        layoutId="indicator"
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="sidebar-nav-indicator"
                                    />
                                )}
                            </motion.button>
                        );
                    })}
                </motion.div>
            </nav>

            {/* Theme Toggle */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="sidebar-theme-section"
            >
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={toggleTheme}
                    className="sidebar-theme-toggle"
                >
                    <motion.div
                        animate={{ rotate: theme === 'dark' ? 0 : 180 }}
                        transition={{ duration: 0.3 }}
                        className="sidebar-theme-icon-wrapper"
                    >
                        {theme === 'dark' ? (
                            <Moon size={16} className="sidebar-theme-icon dark-icon" />
                        ) : (
                            <Sun size={16} className="sidebar-theme-icon light-icon" />
                        )}
                    </motion.div>
                    <span className="sidebar-theme-label">
                        {theme === 'dark' ? 'Dark' : 'Light'}
                    </span>
                </motion.button>
            </motion.div>

          
        </motion.div>
    );
}