export const PROVIDER_BRAND: Record<string, { tint: string; soft: string }> = {
  sapling: { tint: "#6670A8", soft: "rgba(102,112,168,0.16)" },
  gptzero: { tint: "#4DA3F5", soft: "rgba(77,163,245,0.16)" },
  pangram: { tint: "#FF5A00", soft: "rgba(255,90,0,0.14)" },
};

export function ProviderIcon({ id, size = 19 }: { id: string; size?: number }) {
  const logo = LOGOS[id];
  if (logo) {
    return (
      <img
        src={logo.src}
        alt={`${logo.name} logo`}
        width={size}
        height={size}
        draggable={false}
        className="block object-contain"
        style={{
          width: size,
          height: size,
          borderRadius: id === "pangram" ? 0 : Math.max(4, Math.round(size * 0.22)),
        }}
      />
    );
  }

  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

const LOGOS: Record<string, { src: string; name: string }> = {
  sapling: { src: "/provider-logos/sapling.jpg", name: "Sapling" },
  gptzero: { src: "/provider-logos/gptzero.jpg", name: "GPTZero" },
  pangram: { src: "/provider-logos/pangram.png", name: "Pangram" },
};
