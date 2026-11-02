/**
 * An intentionally empty first surface for Asympta World.
 * The dots are ambient placeholders, not a claim of real-time online presence.
 */
const DOTS = 6;

export default function HomePage() {
  return (
    <main
      className="paper-world"
      role="img"
      aria-label="An empty paper world with a few gently moving dots representing people"
    >
      <div className="paper-world__people" aria-hidden="true">
        {Array.from({ length: DOTS }, (_, index) => (
          <span
            key={index}
            className={`paper-world__dot paper-world__dot--${index + 1}`}
          />
        ))}
      </div>
    </main>
  );
}
