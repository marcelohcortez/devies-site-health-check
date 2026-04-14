/**
 * DeviesHeader
 *
 * Devies Group logo + "Site Health Checker" label.
 * Rendered at the top of every screen (AuditForm, ScoreReport, LoadingScreen).
 */
export default function DeviesHeader() {
  return (
    <div className="devies-header">
      <img
        src="https://www.devies.se/wp-content/uploads/2025/11/Devies-Group-logo.svg"
        alt="Devies Group"
        className="devies-logo"
      />
      <p className="devies-label">Site Health Checker</p>
    </div>
  );
}
