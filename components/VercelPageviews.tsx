'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Analytics, type BeforeSendEvent } from '@vercel/analytics/react';
import { CONSENT_KEY, filterPageview, readConsent, PUBLIC_HOSTS, PUBLIC_PATHS } from '@/lib/vercel-pageviews';

function beforeSend(event: BeforeSendEvent) {
  try { return filterPageview(event, window); } catch { return null; }
}

export default function VercelPageviews() {
  usePathname(); // Re-render when Next navigation changes; inspect the actual public URL.
  const [choice, setChoice] = useState<'granted' | 'denied' | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const refresh = () => {
      try { setChoice(readConsent(window.localStorage)); } catch { setChoice(null); }
      setReady(true);
    };
    refresh();
    window.addEventListener('storage', refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => { window.removeEventListener('storage', refresh); window.clearInterval(timer); };
  }, []);

  function choose(value: 'granted' | 'denied') {
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({value, at: Date.now()}));
      setChoice(value);
    } catch { setChoice(null); }
    setOpen(false);
  }

  // Never show or load analytics on a private/unknown route or a preview hostname.
  const publicPath = ready ? window.location.pathname : '';
  const publicHost = ready && PUBLIC_HOSTS.includes(window.location.hostname);
  if (!publicHost || !PUBLIC_PATHS.has(publicPath)) return null;

  return <>
    {choice === 'granted' && <Analytics framework="next" configString={process.env.NEXT_PUBLIC_VERCEL_OBSERVABILITY_CLIENT_CONFIG} basePath={process.env.NEXT_PUBLIC_VERCEL_OBSERVABILITY_BASEPATH} route={publicPath} path={publicPath} beforeSend={beforeSend} debug={false} />}
    {(choice === null || open) ? <aside aria-label="Analytics preferences" dir="ltr"
      style={{position:'fixed',bottom:12,left:12,right:12,zIndex:1000,background:'#fff',color:'#172c28',border:'1px solid #b9c9c2',borderRadius:12,padding:16,boxShadow:'0 4px 20px #0002',maxWidth:600,margin:'0 auto',fontSize:14}}>
      <p lang="en" dir="ltr" style={{margin:'0 0 12px'}}>With your permission, Vercel Analytics counts visits to public landing pages. Account, customer and form content is excluded, and URL query parameters and fragments are removed. You can decline or withdraw at any time in Analytics preferences.</p>
      <p lang="he" dir="rtl" style={{margin:'0 0 12px'}}>באישורכם, Vercel Analytics יספור ביקורים בדפי נחיתה ציבוריים בלבד, ללא פרטי חשבון, לקוחות או תוכן טפסים וללא פרמטרים בכתובת. אפשר לסרב או לבטל בכל עת בהעדפות המדידה.</p>
      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
        <button type="button" onClick={() => choose('denied')}>Decline</button>
        <button type="button" onClick={() => choose('granted')}>Allow</button>
      </div>
    </aside> : <button type="button" onClick={() => setOpen(true)}
      style={{position:'fixed',bottom:8,left:8,zIndex:999,fontSize:12,background:'#fff',color:'#172c28',border:'1px solid #b9c9c2',borderRadius:8,padding:'4px 8px'}}>Analytics preferences</button>}
  </>;
}
