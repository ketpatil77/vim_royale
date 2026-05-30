type AerialUpdateBannerProps = {
  message: string
  label?: string
  className?: string
  ariaLabel?: string
}

export function AerialUpdateBanner({
  message,
  label = "what's new",
  className,
  ariaLabel = 'Latest update banner',
}: AerialUpdateBannerProps) {
  const trimmedMessage = message.trim()
  if (!trimmedMessage) {
    return null
  }

  const rootClassName = className ? `aerial-update ${className}` : 'aerial-update'

  return (
    <aside className={rootClassName} aria-live="polite" aria-label={ariaLabel}>
      <div className="aerial-update__flight">
        <span className="aerial-update__plane" aria-hidden="true">
          <svg
            className="aerial-update__plane-pixel"
            width="52"
            height="28"
            viewBox="0 0 52 28"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* propeller — front/left */}
            <g className="aerial-update__plane-propeller">
              <rect x="3" y="7" width="2" height="14" fill="#90CAF9" />
              <rect x="1" y="13" width="6" height="2" fill="#42A5F5" />
            </g>
            {/* nose */}
            <rect x="5" y="12" width="4" height="4" fill="#42A5F5" />
            {/* fuselage */}
            <rect x="9" y="11" width="18" height="6" fill="#64B5F6" />
            {/* top wing */}
            <rect x="11" y="9" width="14" height="2" fill="#90CAF9" />
            <rect x="13" y="7" width="10" height="2" fill="#BBDEFB" />
            {/* body rear */}
            <rect x="27" y="10" width="16" height="8" fill="#42A5F5" />
            {/* tail */}
            <rect x="43" y="12" width="6" height="4" fill="#1565C0" />
            <rect x="47" y="13" width="4" height="2" fill="#0D47A1" />
            {/* bottom wing */}
            <rect x="17" y="17" width="14" height="4" fill="#1E88E5" />
            <rect x="29" y="21" width="6" height="2" fill="#1565C0" />
            {/* tail fin */}
            <rect x="27" y="6" width="8" height="4" fill="#1E88E5" />
            <rect x="31" y="4" width="4" height="2" fill="#1565C0" />
            {/* windows */}
            <rect x="13" y="11" width="6" height="4" fill="#E3F2FD" opacity="0.9" />
            <rect x="20" y="11" width="4" height="4" fill="#E3F2FD" opacity="0.7" />
            {/* exhaust */}
            <rect x="43" y="15" width="4" height="2" fill="#FF8A65" />
          </svg>
        </span>

        <svg
          className="aerial-update__rope"
          width="12"
          height="2"
          viewBox="0 0 12 2"
          aria-hidden="true"
        >
          <line
            x1="0" y1="1" x2="12" y2="1"
            stroke="#90A4AE"
            strokeWidth="1"
            strokeDasharray="2,1"
          />
        </svg>

        <div className="aerial-update__banner">
          <span className="aerial-update__flag" aria-hidden="true" />
          <span className="aerial-update__label">✦ {label}</span>
          <p className="aerial-update__message"> {trimmedMessage}</p>
        </div>
      </div>
    </aside>
  )
}
