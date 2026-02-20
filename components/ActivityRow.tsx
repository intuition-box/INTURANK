import React from 'react';
import { Link } from 'react-router-dom';
import { User, ExternalLink, Activity as PulseIcon, Box, Zap, AlertCircle, Fingerprint, Network, Database, TrendingUp, TrendingDown, Crown } from 'lucide-react';
import { formatEther } from 'viem';
import { EXPLORER_URL } from '../constants';
import { CurrencySymbol } from './CurrencySymbol';
import { playClick, playHover } from '../services/audio';
import { formatMarketValue, safeParseUnits } from '../services/analytics';

interface ActivityRowProps {
    event: {
        id: string;
        type: string;
        timestamp: number;
        sender: any;
        target: any;
        assets: string;
        shares: string;
        curveId: string;
    };
}

const formatRelativeTime = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
};

const ActivityRow: React.FC<ActivityRowProps> = ({ event }) => {
    const isDeposit = event.type === 'Deposited';
    const isRedeem = event.type === 'Redeemed';
    const isAtomCreation = event.type === 'AtomCreated';
    const isTripleCreation = event.type === 'TripleCreated';
    
    const assetsNum = safeParseUnits(event.assets || '0');
    const isWhale = assetsNum > 50; 
    
    const curveLabel = event.curveId === '1' ? 'Linear' : 'Exponential';
    const isOpposing = event.target?.label?.includes('OPPOSING');

    // NEON PALETTE CONFIGURATION
    let colorHex = '#00f3ff'; // Cyber Cyan
    let statusLabel = 'SYNC_EVENT';
    let Icon = PulseIcon;
    let glowIntensity = isWhale ? '0 0 30px' : '0 0 15px';

    if (isDeposit) {
        if (isOpposing) {
            colorHex = '#ff0055'; // Radioactive Red
            statusLabel = 'OPPOSE_SIGNAL';
            Icon = TrendingDown;
        } else {
            colorHex = '#00f3ff'; // Cyber Cyan
            statusLabel = 'ACQUIRED';
            Icon = TrendingUp;
        }
    } else if (isRedeem) {
        colorHex = '#ff0055'; // Radioactive Red
        statusLabel = 'LIQUIDATED';
        Icon = AlertCircle;
    } else if (isAtomCreation) {
        colorHex = '#ffbd2e'; // High-Voltage Gold
        statusLabel = 'IDENTITY_GENESIS';
        Icon = Database;
    } else if (isTripleCreation) {
        colorHex = '#bd00ff'; // Plasma Purple
        statusLabel = 'SYNAPSE_LINKED';
        Icon = Network;
    }

    const cardStyle = {
        borderColor: `${colorHex}44`,
        boxShadow: `${glowIntensity} ${colorHex}11`,
    } as React.CSSProperties;

    return (
        <div 
            className={`group flex flex-col md:flex-row items-center gap-6 p-6 border-2 bg-black transition-all duration-500 relative overflow-hidden mb-2 clip-path-slant hover:border-white/40 ${isWhale ? 'animate-pulse' : ''}`}
            style={cardStyle}
            onMouseEnter={playHover}
        >
            {/* Edge Lighting (Top 1px high-intensity line) */}
            <div 
                className="absolute top-0 left-0 w-full h-[1px] opacity-30 group-hover:opacity-100 transition-opacity duration-700"
                style={{ backgroundColor: colorHex, boxShadow: `0 0 10px ${colorHex}` }}
            ></div>

            {/* Neural Static / CRT Grid Texture */}
            <div 
                className="absolute inset-0 opacity-[0.03] pointer-events-none z-0"
                style={{ 
                    backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
                    backgroundSize: '4px 4px'
                }}
            ></div>

            {/* Chroma Bloom Background */}
            <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-[0.07] transition-opacity duration-1000 pointer-events-none"
                style={{ background: `radial-gradient(circle at center, ${colorHex}, transparent 80%)` }}
            ></div>

            {/* Identity Segment */}
            <div className="flex items-center gap-4 shrink-0 min-w-[220px] relative z-10">
                <Link to={`/profile/${event.sender?.id}`} className="relative group/avatar">
                    <div 
                        className="w-14 h-14 bg-black border-2 flex items-center justify-center transition-all group-hover:scale-105 relative overflow-hidden shadow-2xl clip-path-slant"
                        style={{ borderColor: `${colorHex}66` }}
                    >
                        {event.sender?.image ? (
                            <img src={event.sender.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" alt="" />
                        ) : (
                            <User size={24} className="text-slate-800" />
                        )}
                        {/* Overlay scanline on avatar */}
                        <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.4)_50%)] bg-[length:100%_2px] opacity-20"></div>
                    </div>
                    {isWhale && (
                        <div 
                            className="absolute -top-1 -right-1 bg-white text-black p-0.5 rounded-sm z-20 shadow-lg border border-black/50"
                            style={{ boxShadow: `0 0 15px white` }}
                        >
                            <Crown size={10} />
                        </div>
                    )}
                </Link>
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 opacity-60">
                        <Fingerprint size={8} style={{ color: colorHex }} />
                        <span className="text-[7px] font-black font-mono text-slate-500 uppercase tracking-widest leading-none">Citizenship_ID</span>
                    </div>
                    <Link to={`/profile/${event.sender?.id}`} className="text-sm font-black text-white hover:text-white transition-colors truncate max-w-[140px] uppercase tracking-tighter font-display leading-none mt-2 group-hover:text-glow-white">
                        {event.sender?.label || `${event.sender?.id?.slice(0, 8)}...`}
                    </Link>
                </div>
            </div>

            {/* Narrative Segment */}
            <div className="flex-1 flex flex-wrap items-center gap-4 text-xs font-mono relative z-10 py-1">
                <div 
                    className={`px-4 py-1.5 border-2 clip-path-slant font-black uppercase text-[9px] tracking-widest shadow-xl transition-all duration-700`}
                    style={{ 
                        backgroundColor: `${colorHex}15`, 
                        borderColor: `${colorHex}66`,
                        color: colorHex,
                        textShadow: `0 0 8px ${colorHex}`
                    }}
                >
                    {isWhale ? `ALPHA_${statusLabel}` : statusLabel}
                </div>
                
                {!(isAtomCreation || isTripleCreation) && (
                    <div className="flex items-center gap-2">
                        <span className={`font-black text-2xl tracking-tighter text-white transition-transform duration-700 ${isWhale ? 'scale-110' : ''}`}>
                            {formatMarketValue(assetsNum)}
                        </span>
                        <CurrencySymbol size="md" className="font-black uppercase" style={{ color: `${colorHex}88` }} />
                    </div>
                )}

                <span className="text-slate-800 uppercase font-black italic tracking-tighter px-2 opacity-40">{" >> "}</span>

                <div className="flex items-center gap-4 bg-black/60 border border-white/5 px-5 py-2.5 clip-path-slant hover:border-white transition-all group/target cursor-pointer shadow-inner">
                    <div className="w-6 h-6 bg-black flex items-center justify-center overflow-hidden border border-white/10 rounded-sm group-hover:scale-110 transition-transform">
                        {event.target?.image ? (
                            <img src={event.target.image} className="w-full h-full object-cover" alt="" />
                        ) : (
                            <Box size={12} className="text-slate-700" />
                        )}
                    </div>
                    <Link to={`/markets/${event.target?.id}`} className="text-white font-black hover:text-white transition-colors truncate max-w-[200px] tracking-tight text-sm uppercase group-hover:text-glow-white">
                        {event.target?.label}
                    </Link>
                </div>
            </div>

            {/* Metadata Badges */}
            <div className="flex items-center gap-4 shrink-0 relative z-10">
                <div 
                    className={`px-5 py-1.5 border text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2 clip-path-slant transition-all shadow-lg overflow-hidden group/badge`}
                    style={{ 
                        backgroundColor: `${colorHex}08`, 
                        borderColor: `${colorHex}33`,
                        color: colorHex
                    }}
                >
                    <Icon size={12} className="animate-pulse" />
                    {isWhale ? 'WHALE_CONVICTION' : isOpposing ? 'Oppose' : isDeposit ? 'Support' : isAtomCreation ? 'Anchor' : 'Synapse'}
                    {/* Tiny shimmer line inside badge */}
                    <div className="absolute inset-0 w-1/2 h-full bg-white opacity-[0.03] skew-x-[-20deg] -translate-x-full group-hover/badge:translate-x-[200%] transition-transform duration-[1500ms]"></div>
                </div>
                <div className="flex flex-col items-end">
                    <div className="text-[7px] font-black text-slate-700 uppercase tracking-[0.4em] mb-1">Logic_Model</div>
                    <div 
                        className="px-3 py-0.5 bg-black border text-[8px] font-black uppercase tracking-widest clip-path-slant"
                        style={{ borderColor: `${colorHex}22`, color: `${colorHex}aa` }}
                    >
                        {curveLabel}
                    </div>
                </div>
            </div>

            {/* Time & Explorer */}
            <div className="flex items-center gap-6 shrink-0 min-w-[150px] justify-end relative z-10 border-l border-white/5 pl-8">
                <div className="text-right">
                    <div className="text-[7px] font-black text-slate-700 uppercase tracking-[0.4em] mb-1">Temporal_Log</div>
                    <span className="text-[10px] font-black font-mono text-slate-500 group-hover:text-white transition-colors uppercase tracking-widest">
                        {formatRelativeTime(event.timestamp)}
                    </span>
                </div>
                <a 
                    href={`${EXPLORER_URL}/tx/${event.id}`} 
                    target="_blank" 
                    rel="noreferrer"
                    onClick={(e) => { e.stopPropagation(); playClick(); }}
                    className="w-12 h-12 bg-black border transition-all flex items-center justify-center clip-path-slant shadow-2xl group/link"
                    style={{ borderColor: `${colorHex}44`, color: colorHex }}
                >
                    <ExternalLink size={18} className="group-hover/link:scale-110 group-hover/link:text-glow-white transition-all" />
                </a>
            </div>
        </div>
    );
};

export default ActivityRow;