import { useTheme } from '../hooks/useTheme';

interface BrandLogoProps {
  alt: string;
  className?: string;
}

/** 使用 public 中的品牌资源；仅在有效深色主题下切换为白色版本。 */
export function BrandLogo({ alt, className }: BrandLogoProps) {
  const theme = useTheme();
  const fileName = theme === 'dark' ? 'logo_white.png' : 'logo_black.png';

  return (
    <img
      src={`${import.meta.env.BASE_URL}${fileName}`}
      alt={alt}
      className={className}
    />
  );
}
