export function PollyLogo({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Polly logo"
    >
      {/* speech bubble */}
      <path
        d="M8 10a6 6 0 0 1 6-6h20a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H20l-8.5 7.5A1.5 1.5 0 0 1 9 38.4V32a6 6 0 0 1-6-6V10a5 5 0 0 1 5-5"
        fill="currentColor"
        opacity="0.12"
      />
      <path
        d="M14 5h20a5 5 0 0 1 5 5v16a5 5 0 0 1-5 5H20.4L12 43v-12h-3a5 5 0 0 1-4-5V10a5 5 0 0 1 5-5h6Z"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      {/* poll bars */}
      <rect x="15" y="22" width="4.5" height="9" rx="2" fill="currentColor" />
      <rect x="21.75" y="15" width="4.5" height="16" rx="2" fill="currentColor" opacity="0.75" />
      <rect x="28.5" y="18.5" width="4.5" height="12.5" rx="2" fill="currentColor" opacity="0.45" />
    </svg>
  );
}
