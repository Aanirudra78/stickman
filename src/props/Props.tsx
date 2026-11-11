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

    case "book":
      return (
        <g strokeLinejoin="round">
          <path d="M -30 -22 h 27 v 44 h -27 z" fill={PAPER} stroke={INK} strokeWidth={5} />
          <path d="M 30 -22 h -27 v 44 h 27 z" fill={PAPER} stroke={INK} strokeWidth={5} />
          <line x1={0} y1={-22} x2={0} y2={22} stroke={INK} strokeWidth={4} />
          <g stroke={INK} strokeWidth={2.6} strokeLinecap="round" opacity={0.55}>
            <line x1={-23} y1={-12} x2={-8} y2={-12} />
            <line x1={-23} y1={-4} x2={-8} y2={-4} />
            <line x1={-23} y1={4} x2={-8} y2={4} />
            <line x1={-23} y1={12} x2={-12} y2={12} />
            <line x1={8} y1={-12} x2={23} y2={-12} />
            <line x1={8} y1={-4} x2={23} y2={-4} />
            <line x1={8} y1={4} x2={23} y2={4} />
            <line x1={12} y1={12} x2={23} y2={12} />
          </g>
          <rect x={22} y={-26} width={7} height={16} rx={2} fill={ACCENT} stroke={INK} strokeWidth={3} />
        </g>
      );

    case "tea":
      return (
        <g strokeLinejoin="round">
          <path
            d="M -22 -10 h 40 v 20 a 12 12 0 0 1 -12 12 h -16 a 12 12 0 0 1 -12 -12 z"
            fill={PAPER}
            stroke={INK}
            strokeWidth={5}
          />
          <path
            d="M 18 -4 a 9 9 0 0 1 0 16"
            fill="none"
            stroke={INK}
            strokeWidth={4.5}
            strokeLinecap="round"
          />
          <path d="M -18 2 h 32" stroke={ACCENT} strokeWidth={4} opacity={0.55} />
          <g stroke={ACCENT} strokeWidth={3.6} strokeLinecap="round" fill="none" opacity={0.85}>
            <path d="M -9 -16 c 4 -6 -4 -9 0 -15" />
            <path d="M 2 -16 c 4 -6 -4 -9 0 -15" />
            <path d="M 12 -16 c 4 -6 -4 -9 0 -15" />
          </g>
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

    /* ------------------------------------------------------------- rewards --- */

    case "trophy":
      return (
        <g strokeLinejoin="round">
          <path
            d="M -18 -28 h 36 v 14 a 18 18 0 0 1 -36 0 z"
            fill={GOLD}
            stroke={INK}
            strokeWidth={5}
          />
          <path d="M -18 -24 a 10 12 0 0 0 -2 20" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
          <path d="M 18 -24 a 10 12 0 0 1 2 20" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
          <rect x={-4} y={4} width={8} height={12} fill={GOLD} stroke={INK} strokeWidth={4} />
          <rect x={-14} y={16} width={28} height={10} rx={3} fill={ACCENT} stroke={INK} strokeWidth={4.5} />
          <path d="M -6 -18 l 4 8 l 8 -12 l 3 6 l 5 -2" fill="none" stroke={INK} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
        </g>
      );

    case "medal":
      return (
        <g strokeLinejoin="round">
          <path d="M -14 -30 l 9 14 l 5 -8" fill="none" stroke={RED} strokeWidth={7} strokeLinecap="round" />
          <path d="M 14 -30 l -9 14" fill="none" stroke={BLUE} strokeWidth={7} strokeLinecap="round" />
          <circle cx={0} cy={4} r={20} fill={GOLD} stroke={INK} strokeWidth={5} />
          <circle cx={0} cy={4} r={13} fill="none" stroke={INK} strokeWidth={3} opacity={0.6} />
          <path d="M 0 -4 l 3.4 7 l 7.6 0.6 l -5.8 5 l 1.8 7.4 l -7 -4 l -7 4 l 1.8 -7.4 l -5.8 -5 l 7.6 -0.6 z" fill={INK} opacity={0.85} />
        </g>
      );

    case "crown":
      return (
        <g strokeLinejoin="round">
          <path
            d="M -32 16 L -32 -14 L -16 -2 L 0 -22 L 16 -2 L 32 -14 L 32 16 Z"
            fill={GOLD}
            stroke={INK}
            strokeWidth={5}
          />
          <circle cx={0} cy={-22} r={4} fill={ACCENT} stroke={INK} strokeWidth={3} />
          <circle cx={0} cy={6} r={5} fill={RED} stroke={INK} strokeWidth={3} />
          <circle cx={-16} cy={8} r={4} fill={BLUE} stroke={INK} strokeWidth={2.6} />
          <circle cx={16} cy={8} r={4} fill={GREEN} stroke={INK} strokeWidth={2.6} />
        </g>
      );

    case "star":
      return (
        <g strokeLinejoin="round">
          <path
            d="M 0 -30 L 8.8 -9.3 L 31 -7.6 L 14 6.3 L 19.6 28 L 0 16 L -19.6 28 L -14 6.3 L -31 -7.6 L -8.8 -9.3 Z"
            fill={GOLD}
            stroke={INK}
            strokeWidth={5}
          />
        </g>
      );

    case "diamond":
      return (
        <g strokeLinejoin="round">
          <path
            d="M -22 -18 L -8 -30 L 8 -30 L 22 -18 L 0 26 Z"
            fill={SOFT_BLUE}
            stroke={BLUE}
            strokeWidth={5}
          />
          <path d="M -22 -18 L 22 -18 M -8 -30 L -4 -18 L 0 26 M 8 -30 L 4 -18" fill="none" stroke={BLUE} strokeWidth={3.5} opacity={0.7} />
          <path d="M -14 -14 L -6 -20" stroke={PAPER} strokeWidth={3.5} strokeLinecap="round" opacity={0.9} />
        </g>
      );

    case "gift":
      return (
        <g strokeLinejoin="round">
          <rect x={-26} y={-10} width={52} height={38} rx={4} fill={RED} stroke={INK} strokeWidth={5} />
          <rect x={-30} y={-20} width={60} height={12} rx={4} fill={RED} stroke={INK} strokeWidth={5} />
          <line x1={0} y1={-20} x2={0} y2={28} stroke={GOLD} strokeWidth={7} />
          <path d="M 0 -22 c -14 -18 -26 -6 -12 2 z" fill={GOLD} stroke={INK} strokeWidth={3.5} />
          <path d="M 0 -22 c 14 -18 26 -6 12 2 z" fill={GOLD} stroke={INK} strokeWidth={3.5} />
        </g>
      );

    case "piggy_bank":
      return (
        <g strokeLinejoin="round">
          <ellipse cx={0} cy={4} rx={28} ry={22} fill={ACCENT} stroke={INK} strokeWidth={5} />
          <circle cx={22} cy={-8} r={7} fill={ACCENT} stroke={INK} strokeWidth={4.5} />
          <path d="M 27 -10 l 6 -4 v 8 z" fill={INK} />
          <rect x={-8} y={-20} width={16} height={6} rx={2} fill={INK} />
          <circle cx={-14} cy={2} r={2.6} fill={INK} />
          <path d="M -4 26 v 6 M 12 26 v 6" stroke={INK} strokeWidth={5} strokeLinecap="round" />
          <path d="M -2 -22 a 12 12 0 0 1 8 0" fill="none" stroke={INK} strokeWidth={3} opacity={0.5} />
        </g>
      );

    /* -------------------------------------------------------- ideas / mind --- */

    case "brain":
      return (
        <g strokeLinejoin="round">
          <path
            d="M -6 -28 a 14 14 0 0 1 14 8 a 12 12 0 0 1 10 14 a 13 13 0 0 1 -8 20 a 12 12 0 0 1 -16 4 a 14 14 0 0 1 -16 -6 a 13 13 0 0 1 -8 -16 a 12 12 0 0 1 6 -16 a 13 13 0 0 1 18 -8 z"
            fill="#F8C9B8"
            stroke={INK}
            strokeWidth={5}
          />
          <path d="M 2 -26 v 46" fill="none" stroke={INK} strokeWidth={4} opacity={0.75} />
          <path d="M -16 -14 q 8 2 10 10 M 14 -16 q -8 4 -8 12 M -14 12 q 6 -2 12 2" fill="none" stroke={INK} strokeWidth={3.4} strokeLinecap="round" opacity={0.7} />
        </g>
      );

    case "heart":
      return (
        <g strokeLinejoin="round">
          <path
            d="M 0 24 C -30 6 -30 -16 -14 -22 C -6 -25 0 -19 0 -13 C 0 -19 6 -25 14 -22 C 30 -16 30 6 0 24 Z"
            fill={RED}
            stroke={INK}
            strokeWidth={5}
          />
          <path d="M -16 -12 a 8 8 0 0 1 6 -5" fill="none" stroke={PAPER} strokeWidth={3.5} strokeLinecap="round" opacity={0.85} />
        </g>
      );

    case "target":
      return (
        <g>
          <circle cx={0} cy={0} r={26} fill={PAPER} stroke={INK} strokeWidth={5} />
          <circle cx={0} cy={0} r={17} fill={RED} stroke={INK} strokeWidth={3.5} />
          <circle cx={0} cy={0} r={8} fill={PAPER} stroke={INK} strokeWidth={3.5} />
          <circle cx={0} cy={0} r={2.6} fill={RED} />
          <g stroke={RED} strokeWidth={4} strokeLinecap="round">
            <line x1={-34} y1={0} x2={-26} y2={0} />
            <line x1={26} y1={0} x2={34} y2={0} />
            <line x1={0} y1={-34} x2={0} y2={-26} />
            <line x1={0} y1={26} x2={0} y2={34} />
          </g>
        </g>
      );

    case "flag":
      return (
        <g strokeLinejoin="round">
          <line x1={-22} y1={-32} x2={-22} y2={32} stroke={INK} strokeWidth={6} strokeLinecap="round" />
          <path d="M -22 -30 h 44 v 18 h -44 z" fill={ACCENT} stroke={INK} strokeWidth={4.5} />
          <path d="M -22 -12 l 10 4 l 10 -4 l 10 4 l 14 -4 v 8" fill="none" stroke={INK} strokeWidth={3.5} opacity={0.6} />
          <circle cx={-22} cy={-34} r={4} fill={GOLD} stroke={INK} strokeWidth={3} />
        </g>
      );

    case "lightning":
      return (
        <g strokeLinejoin="round">
          <path
            d="M 6 -32 L -16 2 L -2 2 L -8 30 L 18 -6 L 3 -6 Z"
            fill={GOLD}
            stroke={INK}
            strokeWidth={5}
          />
        </g>
      );

    /* ----------------------------------------------------- plan / navigation --- */

    case "map":
      return (
        <g strokeLinejoin="round">
          <path
            d="M -30 -24 L -10 -30 L 10 -24 L 30 -30 L 30 24 L 10 30 L -10 24 L -30 30 Z"
            fill={PAPER}
            stroke={INK}
            strokeWidth={5}
          />
          <path d="M -22 -12 q 10 -10 22 -4 q 12 6 22 0" fill="none" stroke={RED} strokeWidth={4.5} strokeLinecap="round" strokeDasharray="7 5" />
          <circle cx={-22} cy={-12} r={4} fill={GREEN} stroke={INK} strokeWidth={3} />
          <circle cx={22} cy={-16} r={4.4} fill={RED} stroke={INK} strokeWidth={3} />
        </g>
      );

    case "compass":
      return (
        <g>
          <circle cx={0} cy={0} r={26} fill={SOFT_BLUE} stroke={INK} strokeWidth={5} />
          <path d="M 0 -18 L 7 0 L 0 18 L -7 0 Z" fill={RED} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
          <path d="M -18 0 L 0 -7 L 18 0 L 0 7 Z" fill={PAPER} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" opacity={0.9} />
          <circle cx={0} cy={0} r={3} fill={INK} />
        </g>
      );

    case "key":
      return (
        <g strokeLinejoin="round">
          <circle cx={-14} cy={-12} r={13} fill={GOLD} stroke={INK} strokeWidth={5} />
          <circle cx={-14} cy={-12} r={5} fill={PAPER} stroke={INK} strokeWidth={3.5} />
          <line x1={-5} y1={-3} x2={22} y2={24} stroke={GOLD} strokeWidth={9} strokeLinecap="round" />
          <line x1={-5} y1={-3} x2={22} y2={24} stroke={INK} strokeWidth={2} opacity={0.35} />
          <line x1={14} y1={16} x2={20} y2={10} stroke={INK} strokeWidth={5} strokeLinecap="round" />
          <line x1={20} y1={22} x2={26} y2={16} stroke={INK} strokeWidth={5} strokeLinecap="round" />
        </g>
      );

    case "bell":
      return (
        <g strokeLinejoin="round">
          <path
            d="M -20 14 a 20 22 0 0 1 40 0 l 4 6 h -48 z"
            fill={GOLD}
            stroke={INK}
            strokeWidth={5}
          />
          <circle cx={0} cy={-22} r={4.5} fill={INK} />
          <circle cx={0} cy={26} r={5.5} fill={INK} />
          <path d="M -10 -14 a 12 12 0 0 1 6 -5" fill="none" stroke={PAPER} strokeWidth={3} strokeLinecap="round" opacity={0.8} />
        </g>
      );

    case "ladder":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <line x1={-16} y1={-32} x2={-16} y2={32} stroke="#B9752B" strokeWidth={7} />
          <line x1={16} y1={-32} x2={16} y2={32} stroke="#B9752B" strokeWidth={7} />
          <g stroke={INK} strokeWidth={5.5}>
            <line x1={-16} y1={-20} x2={16} y2={-20} />
            <line x1={-16} y1={-4} x2={16} y2={-4} />
            <line x1={-16} y1={12} x2={16} y2={12} />
            <line x1={-16} y1={28} x2={16} y2={28} />
          </g>
        </g>
      );

    /* ---------------------------------------------------------- life / tech --- */

    case "fire":
      return (
        <g strokeLinejoin="round">
          <path
            d="M 0 30 C -22 30 -28 16 -22 4 C -18 -4 -14 -6 -14 -14 C -6 -10 -4 -4 -6 2 C 0 -6 2 -16 0 -26 C 12 -14 16 -4 14 4 C 18 2 20 -2 20 -8 C 26 6 24 30 0 30 Z"
            fill="#F97316"
            stroke={INK}
            strokeWidth={5}
          />
          <path
            d="M 0 26 C -10 26 -14 18 -10 10 C -7 5 -4 3 -4 -2 C 2 2 4 8 2 12 C 6 8 8 2 8 -2 C 12 8 12 26 0 26 Z"
            fill={GOLD}
            stroke="none"
          />
        </g>
      );

    case "plant":
      return (
        <g strokeLinejoin="round">
          <path d="M -18 6 h 36 l -5 22 h -26 z" fill="#D97757" stroke={INK} strokeWidth={5} />
          <rect x={-21} y={0} width={42} height={9} rx={3} fill="#C25E3F" stroke={INK} strokeWidth={4.5} />
          <path d="M 0 0 v -18" fill="none" stroke={GREEN} strokeWidth={5} strokeLinecap="round" />
          <path d="M 0 -10 C -6 -12 -12 -18 -12 -26 C -4 -26 2 -20 0 -10 Z" fill={GREEN} stroke={INK} strokeWidth={4} />
          <path d="M 0 -14 C 6 -16 12 -22 12 -30 C 4 -30 -2 -24 0 -14 Z" fill={GREEN} stroke={INK} strokeWidth={4} />
        </g>
      );

    case "mic":
      return (
        <g strokeLinejoin="round">
          <rect x={-10} y={-30} width={20} height={32} rx={10} fill={INK} />
          <path d="M -18 -6 a 18 18 0 0 0 36 0" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
          <line x1={0} y1={12} x2={0} y2={22} stroke={INK} strokeWidth={5.5} strokeLinecap="round" />
          <path d="M -14 26 h 28" stroke={ACCENT} strokeWidth={7} strokeLinecap="round" />
          <path d="M -4 -24 q 4 4 0 8 M 4 -24 q -4 4 0 8" fill="none" stroke={PAPER} strokeWidth={2.6} strokeLinecap="round" opacity={0.7} />
        </g>
      );

    case "camera":
      return (
        <g strokeLinejoin="round">
          <rect x={-32} y={-20} width={64} height={42} rx={8} fill={INK} />
          <circle cx={0} cy={1} r={14} fill={SOFT_BLUE} stroke={PAPER} strokeWidth={4} />
          <circle cx={0} cy={1} r={7} fill={INK} opacity={0.6} />
          <rect x={-12} y={-26} width={16} height={8} rx={2} fill={INK} />
          <circle cx={22} cy={-13} r={3} fill={ACCENT} />
          <path d="M -26 -12 a 7 7 0 0 1 6 -5" stroke={PAPER} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.7} />
        </g>
      );

    case "globe":
      return (
        <g>
          <circle cx={0} cy={0} r={26} fill={SOFT_BLUE} stroke={BLUE} strokeWidth={5} />
          <path d="M 0 -26 a 13 26 0 0 1 0 52 a 13 26 0 0 1 0 -52 M -26 0 h 52" fill="none" stroke={BLUE} strokeWidth={3.5} opacity={0.8} />
          <path d="M -18 -10 q 8 6 16 0 q 8 -6 16 2" fill="none" stroke={GREEN} strokeWidth={4} strokeLinecap="round" opacity={0.85} />
          <path d="M -14 12 q 10 -6 20 2" fill="none" stroke={GREEN} strokeWidth={4} strokeLinecap="round" opacity={0.85} />
        </g>
      );

    case "battery":
      return (
        <g strokeLinejoin="round">
          <rect x={-24} y={-16} width={44} height={34} rx={5} fill={PAPER} stroke={INK} strokeWidth={5} />
          <rect x={20} y={-6} width={8} height={14} rx={2} fill={INK} />
          <rect x={-19} y={-11} width={12} height={24} rx={2} fill={GREEN} stroke="none" />
          <rect x={-4} y={-11} width={9} height={24} rx={2} fill={GOLD} stroke="none" />
          <path d="M -8 -24 l 6 -8 v 5 h 6 l -6 8" fill="none" stroke={GOLD} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );

    case "dice":
      return (
        <g strokeLinejoin="round">
          <rect x={-24} y={-24} width={48} height={48} rx={9} fill={PAPER} stroke={INK} strokeWidth={5} />
          <g fill={INK}>
            <circle cx={-11} cy={-11} r={4} />
            <circle cx={11} cy={-11} r={4} />
            <circle cx={0} cy={0} r={4} />
            <circle cx={-11} cy={11} r={4} />
            <circle cx={11} cy={11} r={4} />
          </g>
        </g>
      );

    case "scale":
      return (
        <g strokeLinejoin="round">
          <line x1={0} y1={-26} x2={0} y2={22} stroke={INK} strokeWidth={5.5} strokeLinecap="round" />
          <line x1={-26} y1={-20} x2={26} y2={-20} stroke={INK} strokeWidth={5} strokeLinecap="round" />
          <path d="M -26 -20 l -9 14 a 10 10 0 0 0 18 0 z" fill={SOFT_BLUE} stroke={INK} strokeWidth={4} />
          <path d="M 26 -20 l -9 14 a 10 10 0 0 0 18 0 z" fill={SOFT_GREEN} stroke={INK} strokeWidth={4} />
          <path d="M -16 26 h 32" stroke={INK} strokeWidth={6} strokeLinecap="round" />
        </g>
      );

    case "chain":
      return (
        <g fill="none" strokeLinecap="round">
          <ellipse cx={-13} cy={0} rx={11} ry={16} stroke={INK} strokeWidth={6} />
          <ellipse cx={8} cy={-3} rx={11} ry={16} stroke={ACCENT} strokeWidth={6} />
          <ellipse cx={24} cy={2} rx={11} ry={16} stroke={INK} strokeWidth={6} />
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
