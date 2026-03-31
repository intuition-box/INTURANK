/**
 * Gamified profile widget for header — avatar, badge, link to full profile
 */
import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Medal, Award, User, ChevronDown, Trophy, Wallet } from 'lucide-react';
import { useUserBadges } from '../hooks/useUserBadges';
import { BADGE_NAMES, type BadgeTier } from '../services/badges';
import { playClick, playHover } from '../services/audio';
import { reverseResolveENS } from '../services/web3';

interface ProfileBadgeWidgetProps {
  address: string;
  isDropdownOpen: boolean;
  onToggleDropdown: () => void;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  onDisconnect?: () => void;
  children?: React.ReactNode; // dropdown content (links, disconnect, etc.)
}

const BADGE_ICONS: Record<BadgeTier, React.ReactNode> = {
  apex: <Crown size={14} />,
  elite: <Medal size={14} />,
  rising: <Medal size={14} />,
  scout: <Award size={14} />,
};

const BADGE_STYLES: Record<BadgeTier, string> = {
  apex: 'from-amber-400/40 to-amber-600/30 border-amber-400/60 text-amber-300',
  elite: 'from-slate-300/30 to-slate-500/20 border-slate-400/50 text-slate-200',
  rising: 'from-amber-700/30 to-amber-900/20 border-amber-600/50 text-amber-200',
  scout: 'from-slate-600/20 to-slate-800/10 border-slate-500/40 text-slate-400',
};

const ProfileBadgeWidget: React.FC<ProfileBadgeWidgetProps> = ({
  address,
  isDropdownOpen,
  onToggleDropdown,
  dropdownRef,
  children,
}) => {
  const { badges } = useUserBadges(address);
  const [ensName, setEnsName] = useState<string | null>(null);

  useEffect(() => {
    if (address) reverseResolveENS(address).then(setEnsName);
  }, [address]);

  const displayName = ensName || `${address.slice(0, 6)}…${address.slice(-4)}`;
  const avatarUrl = `https://effigy.im/a/${address}.png`;
  const tier = badges?.bestTier ?? 'scout';

  return (
    <div className="relative z-[1] overflow-visible" ref={dropdownRef}>
      <button
        onClick={onToggleDropdown}
        onMouseEnter={playHover}
        className="flex items-center gap-3 pl-2 pr-2.5 py-2 rounded-xl border border-slate-600/70 bg-slate-950/60 hover:border-intuition-primary/55 hover:bg-intuition-primary/[0.06] transition-all duration-200 group shadow-sm"
      >
        {/* Avatar with badge overlay */}
        <div className="relative shrink-0">
          <div className={`w-10 h-10 rounded-xl overflow-hidden border-2 ${
            tier === 'apex' ? 'border-amber-400/60' :
            tier === 'elite' ? 'border-slate-400/50' :
            tier === 'rising' ? 'border-amber-600/50' : 'border-slate-600'
          }`}>
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          </div>
          <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-lg border flex items-center justify-center bg-gradient-to-br ${BADGE_STYLES[tier]}`}>
            {BADGE_ICONS[tier]}
          </div>
        </div>
        {/* Name + badge label */}
        <div className="hidden sm:flex flex-col items-start justify-center min-w-0 gap-0.5">
          <span className="text-white font-semibold text-[0.9375rem] leading-tight truncate max-w-[132px] font-sans tracking-tight">{displayName}</span>
          <span className={`text-xs font-semibold font-sans tracking-wide ${tier === 'apex' ? 'text-amber-400' : tier === 'elite' ? 'text-slate-300' : tier === 'rising' ? 'text-amber-500' : 'text-slate-400'}`}>
            {BADGE_NAMES[tier]}
          </span>
        </div>
        <ChevronDown size={16} className={`text-slate-500 shrink-0 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      {isDropdownOpen && children}
    </div>
  );
};

export default ProfileBadgeWidget;
