import type { SVGProps } from 'react';
import coinIcon from '@/assets/coin.svg';

type LegacyCoinIconProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
};

/** 项目最早版本使用的金币堆图标，统一替代后加入的线框 Coins 图标。 */
export function LegacyCoinIcon({ size = 24, width, height, ...props }: LegacyCoinIconProps) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      width={width ?? size}
      height={height ?? size}
      focusable="false"
      {...props}
    >
      <image href={coinIcon} width="1024" height="1024" preserveAspectRatio="xMidYMid meet" />
    </svg>
  );
}
