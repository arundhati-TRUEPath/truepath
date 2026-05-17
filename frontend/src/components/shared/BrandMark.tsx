import Image from 'next/image';

interface BrandMarkProps {
  size?: number;
}

export default function BrandMark({ size = 48 }: BrandMarkProps): React.ReactElement {
  return (
    <div className="brand-mark" style={{ width: size, height: size }}>
      <Image
        src="/logo.png"
        alt="TRUE Path Navigator"
        width={size}
        height={size}
        priority
      />
    </div>
  );
}
