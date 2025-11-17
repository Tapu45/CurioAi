import React, { useRef, useEffect, useState, useCallback } from 'react';
import './GraphCanvas.css';

export default function GraphCanvas({ nodes, edges, onNodeClick, selectedNode }) {
    const canvasRef = useRef(null);
    const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
    const [dragging, setDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [nodePositions, setNodePositions] = useState(new Map());
    const [hoveredNode, setHoveredNode] = useState(null);
    const animationFrameRef = useRef(null);

    // Initialize node positions with force-directed layout
    useEffect(() => {
        if (nodes.length === 0) return;

        const positions = new Map();
        const centerX = 400;
        const centerY = 300;
        const radius = 200;

        // Simple circular layout for initial positions
        nodes.forEach((node, index) => {
            const angle = (index / nodes.length) * Math.PI * 2;
            positions.set(node.id, {
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius,
                vx: 0,
                vy: 0,
            });
        });

        setNodePositions(positions);
    }, [nodes]);

    // Force-directed simulation
    useEffect(() => {
        if (nodes.length === 0 || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationId;

        const simulate = () => {
            const positions = new Map(nodePositions);
            const k = Math.sqrt((400 * 300) / nodes.length);
            const repulsion = k * 0.1;
            const attraction = k * 0.01;

            // Repulsion between all nodes
            for (const [id1, pos1] of positions) {
                for (const [id2, pos2] of positions) {
                    if (id1 === id2) continue;
                    const dx = pos1.x - pos2.x;
                    const dy = pos1.y - pos2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const force = repulsion / (dist * dist);
                    pos1.vx += (dx / dist) * force;
                    pos1.vy += (dy / dist) * force;
                }
            }

            // Attraction along edges
            edges.forEach((edge) => {
                const pos1 = positions.get(edge.source);
                const pos2 = positions.get(edge.target);
                if (!pos1 || !pos2) return;

                const dx = pos2.x - pos1.x;
                const dy = pos2.y - pos1.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = (dist / k) * attraction;

                pos1.vx += (dx / dist) * force;
                pos1.vy += (dy / dist) * force;
                pos2.vx -= (dx / dist) * force;
                pos2.vy -= (dy / dist) * force;
            });

      // Apply velocity with damping
      for (const pos of positions.values()) {
                pos.vx *= 0.9;
                pos.vy *= 0.9;
                pos.x += pos.vx;
                pos.y += pos.vy;

                // Boundary constraints
                pos.x = Math.max(50, Math.min(750, pos.x));
                pos.y = Math.max(50, Math.min(550, pos.y));
            }

            setNodePositions(positions);
            draw();
            animationId = requestAnimationFrame(simulate);
        };

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(transform.x, transform.y);
            ctx.scale(transform.scale, transform.scale);

            // Draw edges
            edges.forEach((edge) => {
                const sourcePos = positions.get(edge.source);
                const targetPos = positions.get(edge.target);
                if (!sourcePos || !targetPos) return;

                ctx.beginPath();
                ctx.moveTo(sourcePos.x, sourcePos.y);
                ctx.lineTo(targetPos.x, targetPos.y);
                ctx.strokeStyle = getEdgeColor(edge.type);
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.3;
                ctx.stroke();
                ctx.globalAlpha = 1;
            });

            // Draw nodes
            nodes.forEach((node) => {
                const pos = positions.get(node.id);
                if (!pos) return;

                const isSelected = selectedNode?.id === node.id;
                const isHovered = hoveredNode === node.id;
                const radius = getNodeRadius(node.type, node.degree || 0);

                // Node circle
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
                ctx.fillStyle = getNodeColor(node.type, isSelected, isHovered);
                ctx.fill();

                if (isSelected || isHovered) {
                    ctx.strokeStyle = 'var(--ring)';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }

                // Node label
                if (transform.scale > 0.7) {
                    ctx.fillStyle = 'var(--foreground)';
                    ctx.font = '12px var(--font-sans)';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const label = node.label || node.name || node.id;
                    const maxWidth = 80;
                    if (ctx.measureText(label).width > maxWidth) {
                        ctx.fillText(label.substring(0, 10) + '...', pos.x, pos.y + radius + 14);
                    } else {
                        ctx.fillText(label, pos.x, pos.y + radius + 14);
                    }
                }
            });

            ctx.restore();
        };

        // Start simulation
        simulate();
        draw();

        return () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
        };
    }, [nodes, edges, nodePositions, transform, selectedNode, hoveredNode]);

    const handleMouseDown = useCallback((e) => {
        if (e.button === 0) {
            setDragging(true);
            setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
        }
    }, [transform]);

    const handleMouseMove = useCallback((e) => {
        if (dragging) {
            setTransform({
                ...transform,
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y,
            });
        } else {
            // Check for node hover
            const canvas = canvasRef.current;
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left - transform.x) / transform.scale;
            const y = (e.clientY - rect.top - transform.y) / transform.scale;

            let found = null;
            for (const [id, pos] of nodePositions) {
                const node = nodes.find((n) => n.id === id);
                if (!node) continue;
                const radius = getNodeRadius(node.type, node.degree || 0);
                const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
                if (dist <= radius) {
                    found = id;
                    break;
                }
            }
            setHoveredNode(found);
        }
    }, [dragging, dragStart, transform, nodePositions, nodes]);

    const handleMouseUp = useCallback(() => {
        setDragging(false);
    }, []);

    const handleClick = useCallback((e) => {
        if (dragging) return;

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - transform.x) / transform.scale;
        const y = (e.clientY - rect.top - transform.y) / transform.scale;

        for (const [id, pos] of nodePositions) {
            const node = nodes.find((n) => n.id === id);
            if (!node) continue;
            const radius = getNodeRadius(node.type, node.degree || 0);
            const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
            if (dist <= radius) {
                onNodeClick?.(node);
                return;
            }
        }
        onNodeClick?.(null);
    }, [dragging, transform, nodePositions, nodes, onNodeClick]);

    const handleWheel = useCallback((e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.3, Math.min(2, transform.scale * delta));
        setTransform({ ...transform, scale: newScale });
    }, [transform]);

    return (
        <canvas
            ref={canvasRef}
            className="graph-canvas"
            width={800}
            height={600}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleClick}
            onWheel={handleWheel}
        />
    );
}

function getNodeColor(type, isSelected, isHovered) {
    if (isSelected) return 'var(--primary)';
    if (isHovered) return 'var(--accent)';

    switch (type) {
        case 'Activity':
            return 'var(--chart-1)';
        case 'Concept':
            return 'var(--chart-2)';
        case 'Topic':
            return 'var(--chart-3)';
        default:
            return 'var(--muted-foreground)';
    }
}

function getNodeRadius(type, degree) {
    const baseRadius = type === 'Topic' ? 12 : type === 'Concept' ? 10 : 8;
    return baseRadius + Math.min(degree * 2, 8);
}

function getEdgeColor(type) {
    switch (type) {
        case 'LEARNED_FROM':
            return 'var(--primary)';
        case 'RELATED_TO':
            return 'var(--accent)';
        case 'CONNECTS':
            return 'var(--chart-4)';
        case 'CONTAINS':
            return 'var(--chart-5)';
        default:
            return 'var(--muted-foreground)';
    }
}