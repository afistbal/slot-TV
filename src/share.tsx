import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import '@/share.css';
import { api } from './api';

createRoot(document.getElementById('root')!).render(
  <Share />,
);

function Share() {

  const [url, setUrl] = useState('');
  const [tip, setTip] = useState(false);

  function handleTipBrowser() {
    setTip(true);
  }

  useEffect(() => {
    const isTiktok = window.navigator.userAgent.toLowerCase().indexOf('bytedance') !== -1;
    const query = new URLSearchParams(window.location.search);
    const source = query.get('s');
    if (source !== null && source !== '') {
      api('anonymous/stat', {
        loading: false,
        data: {
          action: 'source',
        },
        headers: {
          'X-Source': source + '_SHARE' + (isTiktok ? '_TIKTOK' : ''),
        },
      });
    }
    
    if (isTiktok) {
      setUrl('#');
      return;
    }
    setUrl('https://yogotv.com/' + window.location.search);
  }, []);

  return <div className='h-full relative'>
    <div style={{
      background: 'url(/bg.webp)',
      backgroundSize: '200%',
      filter: 'blur(3px)',
      zIndex: '-1',
    }} className='h-full w-full absolute' />
    <div className='h-full flex justify-center items-center flex-col gap-6 bg-black/40'>
      <div className='flex flex-col gap-4 justify-center items-center mb-8'>
        <img src="/logo.png" width={86} height={86} className='rounded-lg' />
        <div className='text-white font-bold text-xl'>YogoTV</div>
      </div>
      <a href={url === '#' ? '#' : 'https://apps.apple.com/us/app/yogotv/id6751373638'} onClick={url === '#' ? handleTipBrowser : undefined} className='bg-white flex justify-center items-center rounded-md px-4 py-3 gap-2 min-w-[220px]'>
        <img src="/apple.svg" width={48} height={48} />
        <div className='flex gap-2 flex-col flex-1 justify-center items-center'>
          <div className='text-sm text-slate-400 leading-[14px]'>Download on the</div>
          <div className='text-xl leading-5 text-slate-800'>App Store</div>
        </div>
      </a>
      <a href={url === '#' ? '#' : 'https://app.yogotv.com/yogotv.apk'} onClick={url === '#' ? handleTipBrowser : undefined} className='bg-white flex justify-center items-center rounded-md px-4 py-3 gap-2 min-w-[220px]'>
        <img src="/android.svg" width={48} height={48} />
        <div className='flex gap-2 flex-col flex-1 justify-center items-center'>
          <div className='text-sm text-slate-400 leading-[14px]'>Download on the</div>
          <div className='text-xl leading-5 text-slate-800'>Android APK</div>
        </div>
      </a>
      <a href={url} onClick={url === '#' ? handleTipBrowser : undefined} className='bg-white flex justify-center items-center rounded-md px-4 py-3 gap-2 min-w-[220px]'>
        <img src="/browser.svg" width={48} height={48} />
        <div className='flex gap-2 flex-col flex-1 justify-center items-center'>
          <div className='text-sm text-slate-400 leading-[14px]'>Open in the</div>
          <div className='text-xl leading-5 text-slate-800'>Browser</div>
        </div>
      </a>
    </div>
    {tip && <div className='fixed top-2 right-0'>
      <div className='fixed top-5 right-2 text-white text-3xl leading-6 animate-[indicator_2s_ease_infinite_forwards]'>👆</div>
      <div className='bg-white px-4 py-4 rounded-xl mt-6 mr-6 flex gap-1 items-center'>
        <img src="/browser.svg" width={24} height={24} />
        <div className='text-lg'>Please open in your browser</div>
      </div>
    </div>}
  </div>
}