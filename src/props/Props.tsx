import React from "react";
import { COLORS } from "../config";
import { PROP_IDS, type PropId } from "./ids";

/**
 * Hand-held prop drawings.
 *
 * Every shape is centred on (0,0) and roughly 60 rig-px wide, so the rig can
 * place it at a hand with a simple `translate(...) rotate(...) scale(...)`.
 * Props are deliberately icon-like: chunky, high-contrast, readable at phone
 * size (the render is downscaled to 540x960 in draft mode).
 */

const INK = COLORS.ink;
const ACCENT = COLORS.accent;
const GREEN = "#15803D";
const RED = "#DC2626";
const BLUE = "#2563EB";
const PAPER = "#FFFFFF";
const GOLD = "#F5C542";
const SOFT_BLUE = "#EAF4FF";
const SOFT_GREEN = "#EFFBF3";

type ShapeProps = { id: PropId };

const Shape: React.FC<ShapeProps> = ({ id }) => {
  switch (id) {
    case "money":
      return (
        <g strokeLinejoin="round">
          <rect x={-32} y={-14} width={62} height={38} rx={5} fill={SOFT_GREEN} stroke={GREEN} strokeWidth={5} />
          <rect x={-28} y={-22} width={62} height={38} rx={5} fill={PAPER} stroke={GREEN} strokeWidth={5} />
          <circle cx={3} cy={-3} r={9} fill="none" stroke={GREEN} strokeWidth={4} />
          <line x1={-20} y1={-14} x2={-20} y2={8} stroke={GREEN} strokeWidth={4} strokeLinecap="round" />
          <line x1={26} y1={-14} x2={26} y2={8} stroke={GREEN} strokeWidth={4} strokeLinecap="round" />
        </g>
      );

    case "coin":
      return (
        <g>
          <circle cx={0} cy={0} r={19} fill={GOLD} stroke={INK} strokeWidth={5} />
          <circle cx={0} cy={0} r={12} fill="none" stroke={INK} strokeWidth={3.5} opacity={0.65} />
          <circle cx={0} cy={0} r={3.5} fill={INK} />
        </g>
      );

    case "wallet":
      return (
        <g strokeLinejoin="round">
          <rect x={-30} y={-18} width={60} height={40} rx={7} fill="#F6E7CB" stroke={INK} strokeWidth={5} />
          <path d="M -30 -8 h 60" stroke={INK} strokeWidth={4} opacity={0.5} />
          <circle cx={18} cy={4} r={5} fill={INK} />
          <path d="M -18 -18 v -6 h 36 v 6" fill="#EFD9B4" stroke={INK} strokeWidth={4} />
        </g>
      );

    case "phone":
      return (
        <g>
          <rect x={-17} y={-30} width={34} height={60} rx={7} fill={INK} />
          <rect x={-12} y={-21} width={24} height={42} rx={3} fill={SOFT_BLUE} />
          <line x1={-4} y1={-25} x2={4} y2={-25} stroke={PAPER} strokeWidth={3} strokeLinecap="round" />
          <circle cx={0} cy={25} r={2.4} fill={PAPER} opacity={0.8} />
          <path d="M -8 2 l 5 -7 l 4 5 l 7 -9" fill="none" stroke={BLUE} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );

    case "laptop":
      return (
        <g strokeLinejoin="round">
          <rect x={-26} y={-30} width={52} height={34} rx={3} fill={SOFT_BLUE} stroke={INK} strokeWidth={5} />
          <path d="M -34 6 h 68 l -4 8 h -60 z" fill={INK} />
          <line x1={-14} y1={-14} x2={14} y2={-14} stroke={BLUE} strokeWidth={3} strokeLinecap="round" />
          <line x1={-14} y1={-6} x2={6} y2={-6} stroke={BLUE} strokeWidth={3} strokeLinecap="round" opacity={0.7} />
        </g>
      );

    case "chart_up":
      return (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="-28,24 -28,-24" stroke={INK} strokeWidth={5} />
          <polyline points="-28,24 26,24" stroke={INK} strokeWidth={5} />
          <polyline points="-20,10 -8,-2 4,4 20,-18" stroke={GREEN} strokeWidth={7} />
          <polyline points="10,-18 20,-18 20,-8" stroke={GREEN} strokeWidth={6} />
        </g>
      );

    case "chart_down":
      return (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="-28,24 -28,-24" stroke={INK} strokeWidth={5} />
          <polyline points="-28,24 26,24" stroke={INK} strokeWidth={5} />
          <polyline points="-20,-16 -8,-4 4,-10 20,14" stroke={RED} strokeWidth={7} />
          <polyline points="10,14 20,14 20,4" stroke={RED} strokeWidth={6} />
        </g>
      );

    case "clock":
      return (
        <g>
          <circle cx={0} cy={0} r={22} fill={PAPER} stroke={INK} strokeWidth={5} />
          <line x1={0} y1={0} x2={0} y2={-12} stroke={INK} strokeWidth={5} strokeLinecap="round" />
          <line x1={0} y1={0} x2={9} y2={4} stroke={INK} strokeWidth={5} strokeLinecap="round" />
          <circle cx={0} cy={0} r={3} fill={ACCENT} />
          <circle cx={0} cy={-16} r={1.8} fill={INK} opacity={0.6} />
          <circle cx={14} cy={0} r={1.8} fill={INK} opacity={0.6} />
          <circle cx={0} cy={16} r={1.8} fill={INK} opacity={0.6} />
          <circle cx={-14} cy={0} r={1.8} fill={INK} opacity={0.6} />
        </g>
      );

    case "calendar":
      return (
        <g strokeLinejoin="round">
          <rect x={-24} y={-22} width={48} height={46} rx={5} fill={PAPER} stroke={INK} strokeWidth={5} />
          <rect x={-24} y={-22} width={48} height={13} rx={5} fill={ACCENT} stroke={INK} strokeWidth={4} />
          <line x1={-11} y1={-30} x2={-11} y2={-20} stroke={INK} strokeWidth={5} strokeLinecap="round" />
          <line x1={11} y1={-30} x2={11} y2={-20} stroke={INK} strokeWidth={5} strokeLinecap="round" />
          <g fill={INK} opacity={0.75}>
            <circle cx={-12} cy={-1} r={2.6} />
            <circle cx={0} cy={-1} r={2.6} />
            <circle cx={12} cy={-1} r={2.6} />
            <circle cx={-12} cy={11} r={2.6} />
            <circle cx={0} cy={11} r={2.6} />
            <circle cx={12} cy={11} r={2.6} />
          </g>
        </g>
      );

    case "house":
      return (
        <g strokeLinejoin="round">
          <path d="M -30 2 L 0 -26 L 30 2" fill={ACCENT} stroke={INK} strokeWidth={5} />
          <rect x={-24} y={2} width={48} height={30} rx={2} fill={PAPER} stroke={INK} strokeWidth={5} />
          <rect x={-7} y={12} width={14} height={20} rx={2} fill={INK} />
          <rect x={-19} y={10} width={8} height={8} fill={SOFT_BLUE} stroke={INK} strokeWidth={3} />
        </g>
      );

    case "car":
      return (
        <g strokeLinejoin="round">
          <path
            d="M -32 8 h 64 v -8 a 6 6 0 0 0 -6 -6 h -8 l -9 -10 h -18 l -9 10 h -8 a 6 6 0 0 0 -6 6 z"
            fill={ACCENT}
            stroke={INK}
            strokeWidth={5}
          />
          <circle cx={-18} cy={12} r={8} fill={INK} />
          <circle cx={18} cy={12} r={8} fill={INK} />
          <circle cx={-18} cy={12} r={3} fill={PAPER} />
          <circle cx={18} cy={12} r={3} fill={PAPER} />
          <rect x={-8} y={-12} width={16} height={9} rx={1} fill={SOFT_BLUE} stroke={INK} strokeWidth={3} />
        </g>
      );

    case "lock":
      return (
        <g strokeLinejoin="round">
          <path d="M -14 -10 v -8 a 14 14 0 0 1 28 0 v 8" fill="none" stroke={INK} strokeWidth={6} />
          <rect x={-22} y={-10} width={44} height={36} rx={6} fill={GOLD} stroke={INK} strokeWidth={5} />
          <circle cx={0} cy={4} r={5} fill={INK} />
          <line x1={0} y1={9} x2={0} y2={16} stroke={INK} strokeWidth={5} strokeLinecap="round" />
        </g>
      );

    case "shield":
      return (
        <g>
          <path
            d="M 0 -30 L 25 -20 V 2 C 25 18 13 27 0 32 C -13 27 -25 18 -25 2 V -20 Z"
            fill={SOFT_BLUE}
            stroke={BLUE}
            strokeWidth={5}
            strokeLinejoin="round"
          />
          <polyline
            points="-11,0 -3,9 13,-10"
            fill="none"
            stroke={BLUE}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );

    case "warning":
      return (
        <g strokeLinejoin="round">
          <path
            d="M 0 -28 L 30 24 H -30 Z"
            fill="#FEE9C7"
            stroke={ACCENT}
            strokeWidth={6}
          />
          <line x1={0} y1={-8} x2={0} y2={8} stroke={INK} strokeWidth={6} strokeLinecap="round" />
          <circle cx={0} cy={16} r={3.2} fill={INK} />
        </g>
      );

    case "question":
      return (
        <g fill="none" strokeLinecap="round">
          <path
            d="M -12 -12 a 13 13 0 1 1 15 14 v 6"
            stroke={ACCENT}
            strokeWidth={8}
          />
          <circle cx={3} cy={21} r={4.4} fill={ACCENT} stroke="none" />
        </g>
      );

    case "bulb":
      return (
        <g>
          <circle cx={0} cy={-6} r={17} fill="#FFF4CC" stroke={ACCENT} strokeWidth={5} />
          <path d="M -7 8 v 5 h 14 v -5" fill="none" stroke={INK} strokeWidth={4.5} />
          <path d="M -6 16 h 12" stroke={INK} strokeWidth={4.5} strokeLinecap="round" />
          <path d="M -8 20 h 16" stroke={INK} strokeWidth={4.5} strokeLinecap="round" />
          <g stroke={ACCENT} strokeWidth={4.5} strokeLinecap="round">
            <line x1={0} y1={-32} x2={0} y2={-25} />
            <line x1={-27} y1={-12} x2={-21} y2={-8} />
            <line x1={27} y1={-12} x2={21} y2={-8} />
          </g>
        </g>
      );

    case "arrow":
      return (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <line x1={-26} y1={0} x2={20} y2={0} stroke={ACCENT} strokeWidth={7} />
          <polyline points="8,-10 20,0 8,10" stroke={ACCENT} strokeWidth={7} />
        </g>
      );

    case "check":
      return (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <circle cx={0} cy={0} r={26} fill={SOFT_GREEN} stroke={GREEN} strokeWidth={5} />
          <polyline points="-13,0 -4,10 14,-11" stroke={GREEN} strokeWidth={7} />
        </g>
      );

    case "cross":
      return (
        <g fill="none" strokeLinecap="round">
          <circle cx={0} cy={0} r={26} fill="#FDECEC" stroke={RED} strokeWidth={5} />
          <line x1={-11} y1={-11} x2={11} y2={11} stroke={RED} strokeWidth={7} />
          <line x1={11} y1={-11} x2={-11} y2={11} stroke={RED} strokeWidth={7} />
        </g>
      );

    case "magnifier":
      return (
        <g fill="none" strokeLinecap="round">
          <circle cx={-5} cy={-5} r={18} fill={SOFT_BLUE} stroke={INK} strokeWidth={6} />
          <line x1={8} y1={8} x2={23} y2={23} stroke={INK} strokeWidth={9} />
          <path d="M -12 -10 a 9 9 0 0 1 6 -4" stroke={PAPER} strokeWidth={3.5} opacity={0.9} />
        </g>
      );

    case "hammer":
      return (
        <g strokeLinejoin="round">
          <rect x={-4} y={-2} width={9} height={34} rx={4} fill="#B9752B" stroke={INK} strokeWidth={4} />
          <rect x={-22} y={-26} width={44} height={18} rx={5} fill={ACCENT} stroke={INK} strokeWidth={5} />
          <rect x={-22} y={-26} width={10} height={18} rx={4} fill={INK} opacity={0.25} />
        </g>
      );

    case "food":
      return (
        <g strokeLinejoin="round">
          <path d="M -26 8 h 52 a 26 12 0 0 1 -52 0 z" fill={SOFT_BLUE} stroke={INK} strokeWidth={4.5} />
          <path d="M -20 6 a 20 14 0 0 1 40 0 z" fill={ACCENT} stroke={INK} strokeWidth={4.5} />
          <path d="M -14 -2 a 14 12 0 0 1 28 0" fill={GOLD} stroke={INK} strokeWidth={4} />
          <g stroke={PAPER} strokeWidth={2.6} strokeLinecap="round" opacity={0.7}>
            <line x1={-8} y1={-10} x2={-8} y2={-15} />
            <line x1={0} y1={-11} x2={0} y2={-17} />
            <line x1={8} y1={-10} x2={8} y2={-15} />
          </g>
        </g>
      );

    default:
      return <circle cx={0} cy={0} r={18} fill={ACCENT} stroke={INK} strokeWidth={4} />;
  }
};

export const PropShape: React.FC<ShapeProps> = ({ id }) => <Shape id={id} />;

/** True when `id` is one of the drawings above (guards hand-authored JSON). */
export const isKnownProp = (id: string): id is PropId =>
  (PROP_IDS as readonly string[]).includes(id);
