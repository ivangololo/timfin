const PRESETS = {
  default: [
    {
      className: 'animate-gradient-flow absolute -left-32 -top-36 h-80 w-80 rounded-full bg-brand/25 blur-[140px]',
      style: { animationDuration: '18s' },
    },
    {
      className: 'animate-gradient-flow absolute right-[-120px] top-48 h-[360px] w-[360px] rounded-full bg-accent/25 blur-[150px]',
      style: { animationDuration: '20s', animationDelay: '4s' },
    },
    {
      className: 'animate-float-soft absolute left-[18%] bottom-[-160px] h-[360px] w-[380px] rounded-[160px] bg-gradient-to-r from-brand/12 via-white/0 to-accent/12 blur-[140px]',
      style: { animationDuration: '22s', animationDelay: '2s' },
    },
    {
      className: 'animate-float-soft absolute right-[10%] top-16 h-40 w-40 rounded-full border border-brand/20 bg-white/10 backdrop-blur-md',
      style: { animationDuration: '14s', animationDelay: '3s' },
    },
  ],
  minimal: [
    {
      className: 'animate-gradient-flow absolute -left-24 -top-28 h-72 w-72 rounded-full bg-brand/22 blur-[120px]',
      style: { animationDuration: '18s' },
    },
    {
      className: 'animate-gradient-flow absolute right-[-110px] top-[35%] h-[320px] w-[320px] rounded-full bg-accent/20 blur-[140px]',
      style: { animationDuration: '20s', animationDelay: '5s' },
    },
  ],
  admin: [
    {
      className: 'animate-gradient-flow absolute -left-40 -top-48 h-[420px] w-[420px] rounded-full bg-brand/24 blur-[180px]',
      style: { animationDuration: '20s' },
    },
    {
      className: 'animate-gradient-flow absolute right-[-200px] top-[240px] h-[480px] w-[480px] rounded-full bg-accent/24 blur-[190px]',
      style: { animationDuration: '22s', animationDelay: '4s' },
    },
    {
      className: 'animate-float-soft absolute left-[8%] bottom-[-200px] h-[420px] w-[460px] rounded-[200px] bg-gradient-to-r from-brand/12 via-white/0 to-accent/12 blur-[150px]',
      style: { animationDuration: '24s', animationDelay: '2s' },
    },
    {
      className: 'animate-pulse-glow absolute right-[12%] top-16 h-36 w-36 rounded-full border border-brand/25 bg-white/10 backdrop-blur-md',
      style: { animationDuration: '4s' },
    },
    {
      className: 'animate-float-soft absolute left-[-140px] top-[35%] h-64 w-64 rounded-full bg-brand-neon/18 blur-[120px]',
      style: { animationDuration: '19s', animationDelay: '6s' },
    },
  ],
  login: [
    {
      className: 'animate-gradient-flow absolute -left-28 -top-40 h-[360px] w-[360px] rounded-full bg-brand/35 blur-[160px]',
      style: { animationDuration: '20s' },
    },
    {
      className: 'animate-gradient-flow absolute right-[-120px] top-[55%] h-[340px] w-[340px] rounded-full bg-accent/30 blur-[150px]',
      style: { animationDuration: '22s', animationDelay: '5s' },
    },
    {
      className: 'animate-float-soft absolute left-[12%] bottom-[-180px] h-[400px] w-[420px] rounded-[180px] bg-gradient-to-r from-brand/18 via-transparent to-accent/12 blur-[150px]',
      style: { animationDuration: '24s', animationDelay: '3s' },
    },
  ],
};

export default function AmbientBackdrop({ variant = 'default', className = '' }) {
  const shapes = PRESETS[variant] ?? PRESETS.default;
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {shapes.map((shape, index) => (
        <div key={index} className={shape.className} style={shape.style} />
      ))}
    </div>
  );
}

