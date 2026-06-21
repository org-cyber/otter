'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ConnectButton } from '@mysten/dapp-kit';
import { useRouter } from 'next/navigation'; // Add this import
import Link from 'next/link'; // Or use Link instead of useRouter

// ── DESIGN TOKENS ───────────────────────────────────────────────────────────
const C = {
  teal: '#1a6b7a',
  tealDark: '#0d2b36',
  tealLight: '#e8f1f3',
  tealMuted: '#8fb3bd',
  brown: '#a0785a',
  brownLight: '#f5ede6',
  bg: '#f5f7f9',
  surface: '#ffffff',
  surfaceHover: '#fafbfc',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  shadow: '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
  shadowMd: '0 4px 6px -1px rgba(15,23,42,0.06), 0 2px 4px -2px rgba(15,23,42,0.04)',
  shadowLg: '0 10px 15px -3px rgba(15,23,42,0.08), 0 4px 6px -4px rgba(15,23,42,0.04)',
  shadowXl: '0 20px 25px -5px rgba(15,23,42,0.1), 0 8px 10px -6px rgba(15,23,42,0.06)',
};

// ── ICONS ───────────────────────────────────────────────────────────────────
const Icon = {
  Wallet: (p: any) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  ),
  Network: (p: any) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="16" y="16" width="6" height="6" rx="1" /><rect x="2" y="16" width="6" height="6" rx="1" /><rect x="9" y="2" width="6" height="6" rx="1" /><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3M12 12V8" />
    </svg>
  ),
  Shield: (p: any) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  ),
  Zap: (p: any) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Key: (p: any) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="7.5" cy="15.5" r="5.5" /><path d="m21 2-9.6 9.6M15.5 7.5 19 11l3-3-3-3" />
    </svg>
  ),
  Bot: (p: any) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4M8 16h.01M16 16h.01" />
    </svg>
  ),
  ArrowRight: (p: any) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  ),
  Check: (p: any) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Github: (p: any) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  ),
  Menu: (p: any) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  X: (p: any) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
};

// ── SHARED STYLES ───────────────────────────────────────────────────────────
const btnPrimary = {
  padding: '14px 28px',
  fontSize: 14,
  fontWeight: 600,
  background: C.teal,
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  transition: 'all 0.2s ease',
  letterSpacing: '-0.01em',
};

const btnSecondary = {
  padding: '14px 28px',
  fontSize: 14,
  fontWeight: 600,
  background: C.surface,
  color: C.textSecondary,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  transition: 'all 0.2s ease',
  letterSpacing: '-0.01em',
};

const sectionTitle = {
  fontSize: 14,
  fontWeight: 600,
  color: C.teal,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const cardStyle = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: 32,
  boxShadow: C.shadow,
  transition: 'all 0.3s ease',
};

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: <Icon.Wallet style={{ color: C.teal }} />,
      title: 'On-Chain Treasuries',
      desc: 'Each agent gets its own Sui object with isolated budget management. No more shared wallet chaos.',
    },
    {
      icon: <Icon.Network style={{ color: C.teal }} />,
      title: 'Hierarchical Spawning',
      desc: 'Master treasuries spawn child agents with programmable budgets, daily caps, and automatic reclamation.',
    },
    {
      icon: <Icon.Shield style={{ color: C.teal }} />,
      title: 'Capability-Based Security',
      desc: 'TreasuryOwnerCaps enforce strict governance. Only authorized operations can modify treasury state.',
    },
    {
      icon: <Icon.Key style={{ color: C.teal }} />,
      title: 'Scoped API Keys',
      desc: 'Generate API keys tied to specific treasuries. Fine-grained access control with optional resume permissions.',
    },
    {
      icon: <Icon.Zap style={{ color: C.teal }} />,
      title: 'Parallel Execution',
      desc: 'Fire multiple agents simultaneously. Each spends from its own balance with real-time cost tracking.',
    },
    {
      icon: <Icon.Bot style={{ color: C.teal }} />,
      title: 'Multi-Provider Support',
      desc: 'Integrate with Groq, OpenAI, and more. Configure per-agent provider allowlists and cost models.',
    },
  ];

  const useCases = [
    {
      title: 'AI Agent Swarms',
      desc: 'Deploy autonomous research agents that collaborate within budget constraints. Each agent has its own treasury for tool usage and API calls.',
    },
    {
      title: 'DAO Treasury Management',
      desc: 'Create sub-treasuries for different working groups. Set spending limits and reclaim unused funds automatically.',
    },
    {
      title: 'Multi-Tenant SaaS',
      desc: 'Give each customer their own isolated treasury. One API gateway, infinite tenant isolation with on-chain audit trails.',
    },
  ];

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
        * { box-sizing: border-box; }
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; }
      `}</style>
      
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
        {/* ── NAVIGATION ───────────────────────────────────────────────────── */}
        <nav style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: scrolled ? 'rgba(245,247,249,0.95)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: scrolled ? `1px solid ${C.border}` : 'none',
          transition: 'all 0.3s ease',
        }}>
          <div style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '16px 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Image
                src="/logo.jpg"
                alt="Otter"
                width={32}
                height={32}
                style={{ borderRadius: 6, objectFit: 'contain' }}
              />
              <span style={{
                fontSize: 18,
                fontWeight: 700,
                color: C.tealDark,
                letterSpacing: '-0.02em',
              }}>
                OTTER
              </span>
            </div>

            {/* Desktop Nav */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
              <a href="#features" style={{
                fontSize: 14,
                color: C.textSecondary,
                textDecoration: 'none',
                fontWeight: 500,
                transition: 'color 0.15s ease',
              }}
                onMouseEnter={e => e.currentTarget.style.color = C.text}
                onMouseLeave={e => e.currentTarget.style.color = C.textSecondary}
              >
                Features
              </a>
              <a href="#how-it-works" style={{
                fontSize: 14,
                color: C.textSecondary,
                textDecoration: 'none',
                fontWeight: 500,
                transition: 'color 0.15s ease',
              }}
                onMouseEnter={e => e.currentTarget.style.color = C.text}
                onMouseLeave={e => e.currentTarget.style.color = C.textSecondary}
              >
                How it Works
              </a>
              <a href="#use-cases" style={{
                fontSize: 14,
                color: C.textSecondary,
                textDecoration: 'none',
                fontWeight: 500,
                transition: 'color 0.15s ease',
              }}
                onMouseEnter={e => e.currentTarget.style.color = C.text}
                onMouseLeave={e => e.currentTarget.style.color = C.textSecondary}
              >
                Use Cases
              </a>
              <div style={{
                padding: 4,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
              }}>
                <ConnectButton />
              </div>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                display: 'none',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 8,
                color: C.text,
              }}
            >
              {mobileMenuOpen ? <Icon.X /> : <Icon.Menu />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div style={{
              display: 'none',
              padding: '16px 32px',
              background: C.surface,
              borderTop: `1px solid ${C.border}`,
              flexDirection: 'column',
              gap: 16,
            }}>
              <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How it Works</a>
              <a href="#use-cases" onClick={() => setMobileMenuOpen(false)}>Use Cases</a>
            </div>
          )}
        </nav>

        {/* ── HERO SECTION ────────────────────────────────────────────────── */}
        <section style={{
          padding: '120px 32px 80px',
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          animation: 'fadeIn 0.8s ease',
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            background: C.tealLight,
            borderRadius: 20,
            marginBottom: 24,
            fontSize: 13,
            fontWeight: 600,
            color: C.tealDark,
          }}>
            <Icon.Zap style={{ width: 16, height: 16 }} />
            Built on Sui Blockchain
          </div>

          <h1 style={{
            fontSize: 64,
            fontWeight: 800,
            color: C.tealDark,
            marginBottom: 24,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            maxWidth: 900,
          }}>
            Autonomous Agent<br />
            <span style={{ color: C.brown }}>Treasury Protocol</span>
          </h1>

          <p style={{
            fontSize: 20,
            color: C.textSecondary,
            maxWidth: 700,
            marginBottom: 40,
            lineHeight: 1.6,
          }}>
            One API key. Multiple agents. On-chain objects. Manage autonomous AI agents 
            with isolated budgets, hierarchical spawning, and real-time cost tracking on Sui.
          </p>

     <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
  <Link href="/app" style={{ textDecoration: 'none' }}>
    <button style={btnPrimary}  onMouseEnter={e => {
                e.currentTarget.style.background = C.tealDark;
                e.currentTarget.style.boxShadow = C.shadowMd;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = C.teal;
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}>
      Launch App
      <Icon.ArrowRight />
    </button>
  </Link>
  
  <Link href="https://github.com/yourusername/otter" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
    <button style={btnSecondary}>
      <Icon.Github />
      View on GitHub
    </button>
  </Link>
</div>
          <div style={{
            marginTop: 80,
            padding: '40px',
            background: C.surface,
            borderRadius: 16,
            border: `1px solid ${C.border}`,
            boxShadow: C.shadowLg,
            maxWidth: 900,
            width: '100%',
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: C.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 16,
            }}>
              Protocol Statistics
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 32,
            }}>
              <div>
                <div style={{ fontSize: 36, fontWeight: 800, color: C.teal, marginBottom: 4 }}>100%</div>
                <div style={{ fontSize: 13, color: C.textSecondary }}>On-Chain Settlement</div>
              </div>
              <div>
                <div style={{ fontSize: 36, fontWeight: 800, color: C.teal, marginBottom: 4 }}>&lt;1s</div>
                <div style={{ fontSize: 13, color: C.textSecondary }}>Finality Time</div>
              </div>
              <div>
                <div style={{ fontSize: 36, fontWeight: 800, color: C.teal, marginBottom: 4 }}>∞</div>
                <div style={{ fontSize: 13, color: C.textSecondary }}>Agent Scalability</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURES GRID ───────────────────────────────────────────────── */}
        <section id="features" style={{
          padding: '100px 32px',
          background: C.surface,
        }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <div style={sectionTitle}>
                <Icon.Zap />
                Core Features
              </div>
              <h2 style={{
                fontSize: 40,
                fontWeight: 800,
                color: C.tealDark,
                marginBottom: 16,
                letterSpacing: '-0.02em',
              }}>
                Everything you need to manage<br />autonomous agents
              </h2>
              <p style={{ fontSize: 18, color: C.textSecondary, maxWidth: 600, margin: '0 auto' }}>
                Built for production-grade AI agent orchestration with blockchain-backed guarantees.
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 24,
            }}>
              {features.map((feature, i) => (
                <div
                  key={i}
                  style={{
                    ...cardStyle,
                    animation: `fadeIn 0.6s ease ${i * 0.1}s both`,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.boxShadow = C.shadowLg;
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.borderColor = C.tealMuted;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = C.shadow;
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = C.border;
                  }}
                >
                  <div style={{
                    width: 48,
                    height: 48,
                    background: C.tealLight,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 20,
                  }}>
                    {feature.icon}
                  </div>
                  <h3 style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: C.tealDark,
                    marginBottom: 12,
                    letterSpacing: '-0.01em',
                  }}>
                    {feature.title}
                  </h3>
                  <p style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.6, margin: 0 }}>
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ────────────────────────────────────────────────── */}
        <section id="how-it-works" style={{
          padding: '100px 32px',
          maxWidth: 1200,
          margin: '0 auto',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={sectionTitle}>
              <Icon.Network />
              How It Works
            </div>
            <h2 style={{
              fontSize: 40,
              fontWeight: 800,
              color: C.tealDark,
              marginBottom: 16,
              letterSpacing: '-0.02em',
            }}>
              Three steps to agent management
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {[
              {
                step: '01',
                title: 'Create Master Treasury',
                desc: 'Deploy a shared Sui object with your initial deposit. Receive a TreasuryOwnerCap for governance control.',
                color: C.teal,
              },
              {
                step: '02',
                title: 'Spawn Child Agents',
                desc: 'Create hierarchical child treasuries with isolated budgets, daily caps, and provider allowlists.',
                color: C.brown,
              },
              {
                step: '03',
                title: 'Generate API Keys',
                desc: 'Issue scoped credentials for each agent. Execute parallel requests with automatic cost tracking.',
                color: C.teal,
              },
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 32,
                  alignItems: 'flex-start',
                  padding: 32,
                  background: C.surface,
                  borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = C.shadowMd;
                  e.currentTarget.style.borderColor = item.color;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = C.border;
                }}
              >
                <div style={{
                  fontSize: 48,
                  fontWeight: 800,
                  color: item.color,
                  opacity: 0.3,
                  lineHeight: 1,
                  flexShrink: 0,
                }}>
                  {item.step}
                </div>
                <div>
                  <h3 style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: C.tealDark,
                    marginBottom: 8,
                    letterSpacing: '-0.01em',
                  }}>
                    {item.title}
                  </h3>
                  <p style={{ fontSize: 16, color: C.textSecondary, lineHeight: 1.6, margin: 0 }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── USE CASES ───────────────────────────────────────────────────── */}
        <section id="use-cases" style={{
          padding: '100px 32px',
          background: C.tealDark,
          color: '#fff',
        }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <div style={{
                ...sectionTitle,
                color: C.tealMuted,
                justifyContent: 'center',
              }}>
                <Icon.Bot />
                Use Cases
              </div>
              <h2 style={{
                fontSize: 40,
                fontWeight: 800,
                marginBottom: 16,
                letterSpacing: '-0.02em',
              }}>
                Built for real-world applications
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
              {useCases.map((useCase, i) => (
                <div
                  key={i}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    padding: 32,
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.transform = 'translateY(-4px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <h3 style={{
                    fontSize: 20,
                    fontWeight: 700,
                    marginBottom: 12,
                    color: C.tealMuted,
                  }}>
                    {useCase.title}
                  </h3>
                  <p style={{ fontSize: 15, lineHeight: 1.6, margin: 0, color: 'rgba(255,255,255,0.8)' }}>
                    {useCase.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA SECTION ─────────────────────────────────────────────────── */}
        <section style={{
          padding: '120px 32px',
          maxWidth: 900,
          margin: '0 auto',
          textAlign: 'center',
        }}>
          <h2 style={{
            fontSize: 48,
            fontWeight: 800,
            color: C.tealDark,
            marginBottom: 20,
            letterSpacing: '-0.02em',
          }}>
            Ready to deploy your agents?
          </h2>
          <p style={{
            fontSize: 18,
            color: C.textSecondary,
            marginBottom: 40,
            lineHeight: 1.6,
          }}>
            Start managing autonomous AI agents with on-chain treasuries today.
            Open source and built for production.
          </p>
          <button
            style={{
              ...btnPrimary,
              padding: '18px 36px',
              fontSize: 16,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = C.tealDark;
              e.currentTarget.style.boxShadow = C.shadowLg;
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = C.teal;
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Get Started Now
            <Icon.ArrowRight />
          </button>
        </section>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <footer style={{
          padding: '60px 32px 40px',
          background: C.surface,
          borderTop: `1px solid ${C.border}`,
        }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 40,
              flexWrap: 'wrap',
              gap: 32,
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <Image
                    src="/logo.jpg"
                    alt="Otter"
                    width={28}
                    height={28}
                    style={{ borderRadius: 6 }}
                  />
                  <span style={{ fontSize: 20, fontWeight: 700, color: C.tealDark }}>
                    OTTER
                  </span>
                </div>
                <p style={{ fontSize: 14, color: C.textSecondary, maxWidth: 300, margin: 0 }}>
                  Autonomous Agent Treasury Protocol on Sui. 
                  Built for scalable AI agent management.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 64 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
                    Product
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <a href="#features" style={{ fontSize: 14, color: C.textSecondary, textDecoration: 'none' }}>Features</a>
                    <a href="#how-it-works" style={{ fontSize: 14, color: C.textSecondary, textDecoration: 'none' }}>How it Works</a>
                    <a href="#use-cases" style={{ fontSize: 14, color: C.textSecondary, textDecoration: 'none' }}>Use Cases</a>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
                    Resources
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <a href="#" style={{ fontSize: 14, color: C.textSecondary, textDecoration: 'none' }}>Documentation</a>
                    <a href="#" style={{ fontSize: 14, color: C.textSecondary, textDecoration: 'none' }}>GitHub</a>
                    <a href="#" style={{ fontSize: 14, color: C.textSecondary, textDecoration: 'none' }}>API Reference</a>
                  </div>
                </div>
              </div>
            </div>

            <div style={{
              paddingTop: 32,
              borderTop: `1px solid ${C.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
            }}>
              <div style={{ fontSize: 13, color: C.textMuted }}>
                © 2026 Otter Protocol. Open source under MIT license.
              </div>
              <div style={{ display: 'flex', gap: 24 }}>
                <a href="#" style={{ color: C.textMuted, transition: 'color 0.15s ease' }}
                  onMouseEnter={e => e.currentTarget.style.color = C.text}
                  onMouseLeave={e => e.currentTarget.style.color = C.textMuted}
                >
                  Privacy
                </a>
                <a href="#" style={{ color: C.textMuted, transition: 'color 0.15s ease' }}
                  onMouseEnter={e => e.currentTarget.style.color = C.text}
                  onMouseLeave={e => e.currentTarget.style.color = C.textMuted}
                >
                  Terms
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}