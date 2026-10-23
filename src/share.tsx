import { createRoot } from 'react-dom/client';
import { useEffect } from 'react';
import '@/share.css';
import { api } from './api';
import { BRAND_DISPLAY_NAME, BRAND_LOGO_SRC } from './constants/brand';

createRoot(document.getElementById('root')!).render(
  <Share />,
);

function Share() {
  const url = 'https://yogotv.com/' + window.location.search;

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const source = query.get('s');
    if (source !== null && source !== '') {
      api('anonymous/stat', {
        loading: false,
        data: {
          action: 'source',
        },
        headers: {
          'X-Source': source + '_SHARE',
        },
      });
    }
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
        <img src={BRAND_LOGO_SRC} width={86} height={86} className='rounded-lg' alt="" />
        <div className='text-white font-bold text-xl'>{BRAND_DISPLAY_NAME}</div>
      </div>
      <a href="https://apps.apple.com/us/app/yogotv/id6751373638" className='bg-white flex justify-center items-center rounded-md px-4 py-3 gap-2 min-w-[220px]'>
        <img src="/apple.svg" width={48} height={48} />
        <div className='flex gap-2 flex-col flex-1 justify-center items-center'>
          <div className='text-sm text-slate-500 leading-[14px]'>Download on the</div>
          <div className='text-xl leading-5 text-slate-800'>App Store</div>
        </div>
      </a>
      <a href="https://app.yogotv.com/yogotv.apk" className='bg-white flex justify-center items-center rounded-md px-4 py-3 gap-2 min-w-[220px]'>
        <img src="/android.svg" width={48} height={48} />
        <div className='flex gap-2 flex-col flex-1 justify-center items-center'>
          <div className='text-sm text-slate-500 leading-[14px]'>Download on the</div>
          <div className='text-xl leading-5 text-slate-800'>Android APK</div>
        </div>
      </a>
      <a href={url} className='bg-white flex justify-center items-center rounded-md px-4 py-3 gap-2 min-w-[220px]'>
        <img src="/browser.svg" width={48} height={48} />
        <div className='flex gap-2 flex-col flex-1 justify-center items-center'>
          <div className='text-sm text-slate-500 leading-[14px]'>Open in the</div>
          <div className='text-xl leading-5 text-slate-800'>Browser</div>
        </div>
      </a>
    </div>
  </div>
}
