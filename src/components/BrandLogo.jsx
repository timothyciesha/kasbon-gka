export default function BrandLogo({ className = "", decorative = false }) {
  return (
    <img
      className={`brand-logo ${className}`.trim()}
      src="/gka-logo.png"
      alt={decorative ? "" : "GKA"}
      aria-hidden={decorative || undefined}
    />
  );
}
